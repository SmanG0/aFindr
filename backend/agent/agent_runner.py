"""Streaming Agent Runner — the core agentic loop with SSE event yielding.

Replaces the blocking request/response pattern in chat.py with an async
generator that streams events to the frontend in real-time:

  text_delta    — token-by-token text as Claude generates it
  tool_start    — Claude wants to call a tool (name + args)
  tool_result   — tool execution completed (result data)
  approval_req  — expensive tool needs user approval before running
  approval_ack  — tool approved, now executing
  error         — something went wrong
  done          — agent loop finished, final results attached

Architecture:
  AsyncAnthropic.messages.stream() → agentic loop (max N rounds)
  Each round: stream text tokens, detect tool_use blocks, execute tools,
  feed results back. Hooks fire pre/post tool execution.

NOTE: This file was added as part of the Agent SDK + SSE migration.
      The original blocking chat endpoint (routers/chat.py) is preserved
      and still works. This is a NEW streaming alternative.
      Backup of original files: backend/.backups/pre-agent-sdk/
"""
from __future__ import annotations

import asyncio
import json
import os
import time
import re
import uuid
from dataclasses import dataclass, field, asdict
from typing import AsyncGenerator, Any, Callable, Dict, List, Optional

from anthropic import AsyncAnthropic

from agent.prompts import ALPHY_SYSTEM_PROMPT
from agent.tools import (
    TOOLS,
    TOOL_HANDLERS,
    handle_run_backtest,
    handle_generate_pinescript,
    handle_run_walk_forward,
    handle_run_preset_strategy,
    handle_run_parameter_sweep,
)
from agent.strategy_agent import generate_strategy, generate_pinescript, generate_vbt_strategy


# ─── SSE Event Types ───

@dataclass
class SSEEvent:
    """A single Server-Sent Event to push to the frontend."""
    event: str  # text_delta, tool_start, tool_result, approval_req, error, done
    data: Dict[str, Any]
    id: Optional[str] = None

    def to_sse(self) -> str:
        """Format as SSE wire protocol."""
        lines = []
        if self.id:
            lines.append(f"id: {self.id}")
        lines.append(f"event: {self.event}")
        lines.append(f"data: {json.dumps(self.data)}")
        lines.append("")  # blank line terminates event
        return "\n".join(lines) + "\n"


# ─── Configuration ───

MAX_TOOL_ROUNDS = 5
DEFAULT_MODEL = "claude-sonnet-4-20250514"

# Tools that require user approval before execution (expensive/slow)
APPROVAL_REQUIRED_TOOLS = {
    "run_backtest",
    "run_walk_forward",
    "run_parameter_sweep",
    "run_preset_strategy",
}

# Tools that are always auto-approved (fast/read-only)
AUTO_APPROVED_TOOLS = {
    "fetch_market_data",
    "fetch_news",
    "get_stock_info",
    "get_contract_info",
    "list_saved_strategies",
    "load_saved_strategy",
    "list_preset_strategies",
    "get_trading_summary",
    "query_trade_history",
    "get_backtest_history",
    "run_monte_carlo",       # runs as part of backtest, fast enough
    "analyze_trades",
    "create_chart_script",
    "generate_pinescript",
    "fetch_options_chain",
    "fetch_insider_activity",
    "fetch_economic_data",
    "fetch_earnings_calendar",
    "fetch_company_news_feed",
    "search_news",
    "query_prediction_markets",
    "fetch_labor_data",
}


def _sanitize_floats(obj):
    """Replace NaN/Inf with JSON-safe values recursively."""
    if isinstance(obj, float):
        if obj != obj:  # NaN
            return None
        if obj == float("inf"):
            return 9999.99
        if obj == float("-inf"):
            return -9999.99
    elif isinstance(obj, dict):
        return {k: _sanitize_floats(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_sanitize_floats(v) for v in obj]
    return obj


def strip_markdown(text: str) -> str:
    """Remove markdown formatting — Alphy speaks plain text only."""
    text = re.sub(r"```[\w]*\n?", "", text)
    text = re.sub(r"^#{1,6}\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"\*{1,3}(.+?)\*{1,3}", r"\1", text)
    text = re.sub(r"(?<!\w)_{1,3}(.+?)_{1,3}(?!\w)", r"\1", text)
    text = re.sub(r"`([^`]+)`", r"\1", text)
    text = re.sub(r"^\s*\*\s+", "- ", text, flags=re.MULTILINE)
    return text


# ─── Tool Execution ───

async def _execute_tool(tool_name: str, tool_input: dict) -> str:
    """Execute a single tool call and return JSON string result.

    Routes to the correct handler based on tool name, matching the
    dispatch logic from chat.py but without the per-tool state tracking.
    """
    try:
        if tool_name == "run_backtest":
            return await handle_run_backtest(tool_input, generate_strategy, generate_vbt_strategy)
        elif tool_name == "generate_pinescript":
            return await handle_generate_pinescript(tool_input, generate_pinescript)
        elif tool_name == "run_walk_forward":
            return await handle_run_walk_forward(tool_input, generate_strategy)
        elif tool_name == "run_parameter_sweep":
            return await handle_run_parameter_sweep(tool_input, generate_vbt_strategy)
        elif tool_name == "run_preset_strategy":
            return await handle_run_preset_strategy(tool_input)
        elif tool_name in TOOL_HANDLERS:
            return await TOOL_HANDLERS[tool_name](tool_input)
        else:
            return json.dumps({"error": f"Unknown tool: {tool_name}"})
    except Exception as e:
        return json.dumps({"error": str(e)})


# ─── Streaming Agent Runner ───

async def run_agent_stream(
    message: str,
    conversation_history: List[Dict] = None,
    symbol: str = "NQ=F",
    period: str = "1y",
    interval: str = "1d",
    initial_balance: float = 50000.0,
    require_approval: bool = True,
    approval_callback: Optional[Callable] = None,
    hooks: Optional[Dict] = None,
    current_page: Optional[str] = None,
    news_headlines: Optional[List[str]] = None,
) -> AsyncGenerator[SSEEvent, None]:
    """Core streaming agent loop. Yields SSEEvent objects.

    This is an async generator — the caller iterates over it and
    pushes each SSEEvent to the client via SSE/StreamingResponse.

    Args:
        message: User's chat message
        conversation_history: Previous messages for context
        symbol: Default trading symbol
        period: Default data period
        interval: Default candle interval
        initial_balance: Default starting balance
        require_approval: Whether to pause for approval on expensive tools
        approval_callback: Async callable that returns True/False for tool approval
                          (used for WebSocket-based approval; SSE uses approval_req events)
        hooks: Dict of hook functions: {"pre_tool": fn, "post_tool": fn}
    """
    client = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))
    hooks = hooks or {}
    run_id = f"agent_{uuid.uuid4().hex[:8]}"
    start_time = time.time()

    # Build dynamic system prompt with page context
    system_prompt = ALPHY_SYSTEM_PROMPT
    if current_page:
        system_prompt += f"\n\nThe user is currently on the '{current_page}' page of aFindr."
    if news_headlines:
        headlines_text = "\n".join(f"- {h}" for h in news_headlines[:20])
        system_prompt += f"\n\nThe user can currently see these news headlines on screen:\n{headlines_text}\nYou can reference these headlines when the user asks about news they're seeing."

    # Build messages
    messages = []
    if conversation_history:
        for msg in conversation_history:
            messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": message})

    # Track accumulated results for the final "done" event
    backtest_result = None
    pinescript_result = None
    monte_carlo_result = None
    walk_forward_result = None
    trade_analysis_result = None
    chart_script_result = None
    tool_data = []
    full_text = ""

    for _round in range(MAX_TOOL_ROUNDS):
        # ── Stream Claude's response ──
        collected_text = ""
        tool_use_blocks = []
        current_tool_block = None

        try:
            async with client.messages.stream(
                model=DEFAULT_MODEL,
                max_tokens=4096,
                system=system_prompt,
                tools=TOOLS,
                messages=messages,
            ) as stream:
                async for event in stream:
                    # Text token streaming
                    if event.type == "content_block_delta":
                        if hasattr(event.delta, "text"):
                            text_chunk = event.delta.text
                            collected_text += text_chunk
                            yield SSEEvent(
                                event="text_delta",
                                data={"text": text_chunk, "run_id": run_id},
                            )

                    # Tool use detection
                    elif event.type == "content_block_start":
                        if hasattr(event.content_block, "type") and event.content_block.type == "tool_use":
                            current_tool_block = {
                                "id": event.content_block.id,
                                "name": event.content_block.name,
                                "input": {},
                            }

                    elif event.type == "content_block_stop":
                        if current_tool_block:
                            tool_use_blocks.append(current_tool_block)
                            current_tool_block = None

                # Get the final accumulated message for tool input extraction
                final_message = await stream.get_final_message()

        except Exception as e:
            yield SSEEvent(event="error", data={"error": str(e), "run_id": run_id})
            return

        # Extract complete tool use blocks from the final message
        # (the streaming events don't always give us complete input JSON)
        actual_tool_blocks = [
            b for b in final_message.content
            if hasattr(b, "type") and b.type == "tool_use"
        ]

        if not actual_tool_blocks:
            # No tool calls — we're done. Clean up the text.
            full_text += collected_text
            full_text = strip_markdown(full_text)

            yield SSEEvent(
                event="done",
                data=_sanitize_floats({
                    "run_id": run_id,
                    "message": full_text,
                    "strategy": backtest_result.get("strategy") if backtest_result else None,
                    "backtest_result": _format_backtest(backtest_result),
                    "pinescript": pinescript_result,
                    "monte_carlo": monte_carlo_result,
                    "walk_forward": walk_forward_result,
                    "trade_analysis": trade_analysis_result,
                    "chart_script": chart_script_result,
                    "tool_data": tool_data if tool_data else None,
                    "duration_ms": int((time.time() - start_time) * 1000),
                }),
            )
            return

        # ── Execute tool calls ──
        # Add Claude's response to message history
        messages.append({"role": "assistant", "content": final_message.content})

        tool_results = []
        for tool_block in actual_tool_blocks:
            tool_name = tool_block.name
            tool_input = tool_block.input

            # ── Pre-tool hook ──
            if "pre_tool" in hooks:
                try:
                    await hooks["pre_tool"](tool_name, tool_input)
                except Exception:
                    pass

            # ── Approval gate ──
            needs_approval = (
                require_approval
                and tool_name in APPROVAL_REQUIRED_TOOLS
            )

            if needs_approval:
                yield SSEEvent(
                    event="approval_req",
                    data={
                        "run_id": run_id,
                        "tool_name": tool_name,
                        "tool_input": tool_input,
                        "tool_use_id": tool_block.id,
                        "message": f"Alphy wants to run: {tool_name}",
                    },
                )

                # If we have a callback, use it. Otherwise, auto-approve
                # (the frontend will handle approval via a separate mechanism)
                if approval_callback:
                    approved = await approval_callback(tool_name, tool_input)
                    if not approved:
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": tool_block.id,
                            "content": json.dumps({
                                "error": "Tool execution denied by user"
                            }),
                        })
                        yield SSEEvent(
                            event="tool_result",
                            data={
                                "run_id": run_id,
                                "tool_name": tool_name,
                                "status": "denied",
                            },
                        )
                        continue

            # ── Execute the tool ──
            yield SSEEvent(
                event="tool_start",
                data={
                    "run_id": run_id,
                    "tool_name": tool_name,
                    "tool_input": tool_input,
                },
            )

            result_str = await _execute_tool(tool_name, tool_input)

            # Parse result and track for frontend
            try:
                result_data = json.loads(result_str)
            except json.JSONDecodeError:
                result_data = {"raw": result_str}

            # Track results by tool type (same logic as chat.py)
            if tool_name == "run_backtest" and "error" not in result_data:
                backtest_result = result_data
                if result_data.get("monte_carlo"):
                    monte_carlo_result = result_data["monte_carlo"]
            elif tool_name == "run_preset_strategy" and "error" not in result_data:
                backtest_result = result_data
                if result_data.get("monte_carlo"):
                    monte_carlo_result = result_data["monte_carlo"]
            elif tool_name == "generate_pinescript" and "error" not in result_data:
                pinescript_result = result_data
            elif tool_name == "run_walk_forward" and "error" not in result_data:
                walk_forward_result = result_data
            elif tool_name == "run_monte_carlo" and "error" not in result_data:
                monte_carlo_result = result_data
            elif tool_name == "analyze_trades" and "error" not in result_data:
                trade_analysis_result = result_data
            elif tool_name == "load_saved_strategy" and "error" not in result_data and result_data.get("trades"):
                backtest_result = result_data
                if result_data.get("monte_carlo"):
                    monte_carlo_result = result_data["monte_carlo"]
            elif tool_name == "create_chart_script" and "error" not in result_data:
                chart_script_result = result_data.get("chart_script")

            tool_data.append({
                "tool": tool_name,
                "input": tool_input,
                "data": result_data,
            })

            # ── Post-tool hook ──
            if "post_tool" in hooks:
                try:
                    await hooks["post_tool"](tool_name, tool_input, result_data)
                except Exception:
                    pass

            # Yield tool result event
            yield SSEEvent(
                event="tool_result",
                data=_sanitize_floats({
                    "run_id": run_id,
                    "tool_name": tool_name,
                    "status": "error" if "error" in result_data else "success",
                    "result": result_data,
                }),
            )

            tool_results.append({
                "type": "tool_result",
                "tool_use_id": tool_block.id,
                "content": result_str,
            })

        # Feed tool results back to Claude for the next round
        messages.append({"role": "user", "content": tool_results})

    # Hit max rounds — yield what we have
    yield SSEEvent(
        event="done",
        data=_sanitize_floats({
            "run_id": run_id,
            "message": strip_markdown(full_text) if full_text else "I gathered the data but hit my tool-calling limit. Here's what I found so far.",
            "strategy": backtest_result.get("strategy") if backtest_result else None,
            "backtest_result": _format_backtest(backtest_result),
            "pinescript": pinescript_result,
            "monte_carlo": monte_carlo_result,
            "walk_forward": walk_forward_result,
            "trade_analysis": trade_analysis_result,
            "chart_script": chart_script_result,
            "tool_data": tool_data if tool_data else None,
            "duration_ms": int((time.time() - start_time) * 1000),
            "hit_max_rounds": True,
        }),
    )


def _format_backtest(result: Optional[dict]) -> Optional[dict]:
    """Format backtest result to match frontend expectations."""
    if not result:
        return None
    strategy = result.get("strategy", {})
    return {
        "trades": result.get("trades", []),
        "equity_curve": result.get("equity_curve", []),
        "metrics": result.get("metrics", {}),
        "strategy_name": strategy.get("name", "") if isinstance(strategy, dict) else "",
        "strategy_description": strategy.get("description", "") if isinstance(strategy, dict) else "",
    }
