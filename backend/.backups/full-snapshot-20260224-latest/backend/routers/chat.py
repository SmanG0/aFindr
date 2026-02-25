"""Chat router — Alphy AI copilot with native Anthropic tool_use.

Uses Claude's tool_use API to let the model call trading tools directly.
No fragile JSON parsing — Claude returns structured tool calls.
"""
from __future__ import annotations

import json
import os
import re
from typing import List, Dict

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field
from anthropic import AsyncAnthropic

from rate_limit import limiter

from agent.prompts import ALPHY_SYSTEM_PROMPT
from agent.tools import TOOLS, TOOL_HANDLERS, handle_run_backtest, handle_generate_pinescript, handle_run_walk_forward, handle_run_preset_strategy, handle_run_parameter_sweep
from agent.strategy_agent import generate_strategy, generate_pinescript, generate_vbt_strategy

router = APIRouter(prefix="/api/chat", tags=["chat"])


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

client = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))

MAX_TOOL_ROUNDS = 5  # Prevent infinite tool-calling loops


def strip_markdown(text: str) -> str:
    """Remove markdown formatting — Alphy speaks plain text only."""
    # Remove fenced code blocks but keep content
    text = re.sub(r"```[\w]*\n?", "", text)
    # Remove headings (# ## ### etc.)
    text = re.sub(r"^#{1,6}\s*", "", text, flags=re.MULTILINE)
    # Remove bold/italic (**text**, *text*, ***text***)
    text = re.sub(r"\*{1,3}(.+?)\*{1,3}", r"\1", text)
    # Remove underscore emphasis (__text__, _text_)
    text = re.sub(r"(?<!\w)_{1,3}(.+?)_{1,3}(?!\w)", r"\1", text)
    # Remove inline code (`text`)
    text = re.sub(r"`([^`]+)`", r"\1", text)
    # Replace bullet asterisks with dashes
    text = re.sub(r"^\s*\*\s+", "- ", text, flags=re.MULTILINE)
    return text


class ChatRequest(BaseModel):
    message: str = Field(..., max_length=10000)
    symbol: str = Field(default="NQ=F", pattern=r"^[A-Z0-9=.\-\/\^]+$")
    period: str = "1y"
    interval: str = "1d"
    initial_balance: float = 25000.0
    conversation_history: List[Dict] = Field(default=[], max_length=50)


@router.post("")
@limiter.limit("30/minute")
async def chat(request: Request, req: ChatRequest):
    """Process chat message with tool-calling loop.

    1. Send user message + tools to Claude
    2. If Claude calls tools, execute them and send results back
    3. Repeat until Claude produces a text response (max MAX_TOOL_ROUNDS)
    """
    # Build messages from conversation history
    messages = []
    for msg in req.conversation_history:
        messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": req.message})

    # Track tool results for the frontend
    backtest_result = None
    pinescript_result = None
    monte_carlo_result = None
    walk_forward_result = None
    trade_analysis_result = None
    chart_script_results: list = []
    tool_data = []

    for _round in range(MAX_TOOL_ROUNDS):
        response = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=4096,
            system=ALPHY_SYSTEM_PROMPT,
            tools=TOOLS,
            messages=messages,
        )

        # Check if Claude wants to use tools
        tool_use_blocks = [b for b in response.content if b.type == "tool_use"]

        if not tool_use_blocks:
            # No tool calls — extract text response
            text_parts = [b.text for b in response.content if b.type == "text"]
            final_text = "\n".join(text_parts) if text_parts else "I couldn't generate a response."
            final_text = strip_markdown(final_text)

            return _sanitize_floats({
                "message": final_text,
                "strategy": backtest_result.get("strategy") if backtest_result else None,
                "backtest_result": _format_backtest_for_frontend(backtest_result) if backtest_result else None,
                "pinescript": pinescript_result,
                "monte_carlo": monte_carlo_result,
                "walk_forward": walk_forward_result,
                "trade_analysis": trade_analysis_result,
                "chart_scripts": chart_script_results if chart_script_results else None,
                "tool_data": tool_data if tool_data else None,
            })

        # Execute tool calls and collect results
        # First, add Claude's response (with tool_use blocks) to messages
        messages.append({"role": "assistant", "content": response.content})

        tool_results = []
        for tool_block in tool_use_blocks:
            tool_name = tool_block.name
            tool_input = tool_block.input
            result_str = json.dumps({"error": "Tool did not produce a result"})

            try:
                if tool_name == "run_backtest":
                    result_str = await handle_run_backtest(tool_input, generate_strategy, generate_vbt_strategy)
                    result_data = json.loads(result_str)
                    if "error" not in result_data:
                        backtest_result = result_data
                        # Extract auto-generated Monte Carlo if present
                        if result_data.get("monte_carlo"):
                            monte_carlo_result = result_data["monte_carlo"]
                elif tool_name == "generate_pinescript":
                    result_str = await handle_generate_pinescript(tool_input, generate_pinescript)
                    result_data = json.loads(result_str)
                    if "error" not in result_data:
                        pinescript_result = result_data
                elif tool_name == "run_walk_forward":
                    result_str = await handle_run_walk_forward(tool_input, generate_strategy)
                    result_data = json.loads(result_str)
                    if "error" not in result_data:
                        walk_forward_result = result_data
                elif tool_name == "run_parameter_sweep":
                    result_str = await handle_run_parameter_sweep(tool_input, generate_vbt_strategy)
                    result_data = json.loads(result_str)
                    if "error" not in result_data:
                        # Store sweep results for frontend
                        pass
                elif tool_name == "run_preset_strategy":
                    result_str = await handle_run_preset_strategy(tool_input)
                    result_data = json.loads(result_str)
                    if "error" not in result_data:
                        backtest_result = result_data
                        if result_data.get("monte_carlo"):
                            monte_carlo_result = result_data["monte_carlo"]
                elif tool_name == "run_monte_carlo":
                    result_str = await TOOL_HANDLERS[tool_name](tool_input)
                    result_data = json.loads(result_str)
                    if "error" not in result_data:
                        monte_carlo_result = result_data
                elif tool_name == "analyze_trades":
                    result_str = await TOOL_HANDLERS[tool_name](tool_input)
                    result_data = json.loads(result_str)
                    if "error" not in result_data:
                        trade_analysis_result = result_data
                elif tool_name == "create_chart_script":
                    result_str = await TOOL_HANDLERS[tool_name](tool_input)
                    result_data = json.loads(result_str)
                    if "error" not in result_data and result_data.get("chart_script"):
                        chart_script_results.append(result_data["chart_script"])
                elif tool_name in ("detect_chart_patterns", "detect_key_levels", "detect_divergences"):
                    result_str = await TOOL_HANDLERS[tool_name](tool_input)
                    result_data = json.loads(result_str)
                    if "error" not in result_data and result_data.get("chart_script"):
                        chart_script_results.append(result_data["chart_script"])
                elif tool_name == "load_saved_strategy":
                    result_str = await TOOL_HANDLERS[tool_name](tool_input)
                    result_data = json.loads(result_str)
                    if "error" not in result_data and result_data.get("trades"):
                        backtest_result = result_data
                        if result_data.get("monte_carlo"):
                            monte_carlo_result = result_data["monte_carlo"]
                elif tool_name in TOOL_HANDLERS:
                    result_str = await TOOL_HANDLERS[tool_name](tool_input)
                    result_data = json.loads(result_str)
                else:
                    result_str = json.dumps({"error": f"Unknown tool: {tool_name}"})
                    result_data = {"error": f"Unknown tool: {tool_name}"}

                tool_data.append({
                    "tool": tool_name,
                    "input": tool_input,
                    "data": result_data,
                })

            except Exception as e:
                result_str = json.dumps({"error": str(e)})

            tool_results.append({
                "type": "tool_result",
                "tool_use_id": tool_block.id,
                "content": result_str,
            })

        messages.append({"role": "user", "content": tool_results})

    # If we hit the max rounds, return what we have
    return _sanitize_floats({
        "message": "I gathered the data but hit my tool-calling limit. Here's what I found so far.",
        "strategy": backtest_result.get("strategy") if backtest_result else None,
        "backtest_result": _format_backtest_for_frontend(backtest_result) if backtest_result else None,
        "pinescript": pinescript_result,
        "monte_carlo": monte_carlo_result,
        "walk_forward": walk_forward_result,
        "trade_analysis": trade_analysis_result,
        "chart_scripts": chart_script_results if chart_script_results else None,
        "tool_data": tool_data if tool_data else None,
    })


def _format_backtest_for_frontend(result: dict) -> dict | None:
    """Format backtest result to match frontend expectations."""
    if not result:
        return None

    strategy = result.get("strategy", {})
    metrics = result.get("metrics", {})
    trades = result.get("trades", [])
    equity_curve = result.get("equity_curve", [])

    return {
        "trades": trades,
        "equity_curve": equity_curve,
        "metrics": metrics,
        "strategy_name": strategy.get("name", ""),
        "strategy_description": strategy.get("description", ""),
    }
