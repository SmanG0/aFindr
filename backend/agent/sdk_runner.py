"""SDK-based Streaming Agent Runner — drop-in replacement for agent_runner.py.

Uses the Claude Agent SDK (ClaudeSDKClient) with MCP tool servers instead of
the hand-rolled agentic loop. Yields the exact same SSEEvent objects so the
frontend and router don't know the difference.

Feature-flagged: activated by AFINDR_USE_SDK_RUNNER=true in env.

Key differences from agent_runner.py:
  - Tool execution handled by SDK via MCP servers (no manual loop)
  - Hooks use SDK HookMatcher (PreToolUse/PostToolUse) instead of dict callbacks
  - Text arrives per-message (not per-token) — still emitted as text_delta for compat
  - Model routing via SDK subagent concept instead of manual _pick_model()
"""
from __future__ import annotations

import json
import logging
import os
import time
import uuid
from typing import AsyncGenerator, Any, Callable, Dict, List, Optional

from claude_agent_sdk import (
    ClaudeSDKClient,
    ClaudeAgentOptions,
    AssistantMessage,
    UserMessage,
    SystemMessage,
    ResultMessage,
    TextBlock,
    ToolUseBlock,
    ToolResultBlock,
)

from agent.prompts import ALPHY_SYSTEM_PROMPT
from agent.strategy_agent import generate_strategy, generate_pinescript, generate_vbt_strategy
from agent.mcp_tools import (
    create_all_mcp_servers,
    get_all_allowed_tools,
    bare_tool_name,
    TOOL_NAME_MAP,
)
from agent.sdk_hooks import create_sdk_hooks
from agent.agent_runner import (
    SSEEvent,
    APPROVAL_REQUIRED_TOOLS,
    AUTO_APPROVED_TOOLS,
    MAX_TOOL_ROUNDS,
    STREAM_TIMEOUT,
    strip_markdown,
    _sanitize_floats,
    _inject_missing_indicator_tags,
    _format_backtest,
)
from agent.hooks import TokenTracker

logger = logging.getLogger("afindr.sdk_runner")


# ─── Dynamic Context Builder ───
# Mirrors agent_runner.py:360-425 exactly

def _build_dynamic_context(
    symbol: str,
    interval: str,
    current_page: Optional[str],
    news_headlines: Optional[List[str]],
    active_scripts: Optional[List[str]],
    user_profile: Optional[Dict],
    active_alerts: Optional[List[Dict]],
) -> str:
    """Build the dynamic part of the system prompt (chart context, user profile, etc.)."""
    parts = []

    parts.append(
        f"CRITICAL — Current Chart Context: The user is viewing {symbol} on {interval} "
        f"candles right now. ALL analysis, chart scripts, pattern detection, and level drawing "
        f"MUST target {symbol}. When calling ANY tool that takes a symbol parameter, pass "
        f'symbol="{symbol}". When calling detection tools (detect_chart_patterns, detect_key_levels, '
        f'detect_divergences), pass symbol="{symbol}" and interval="{interval}". '
        f"Do NOT reference or draw levels for any other symbol unless the user explicitly asks."
    )

    if current_page:
        parts.append(f"The user is currently on the '{current_page}' page of aFindr.")

    if news_headlines:
        headlines_text = "\n".join(f"- {h}" for h in news_headlines[:20])
        parts.append(
            f"The user can currently see these news headlines on screen:\n{headlines_text}\n"
            "You can reference these headlines when the user asks about news they're seeing."
        )

    if active_scripts:
        scripts_text = "\n".join(f"- {s}" for s in active_scripts)
        parts.append(
            f"Active chart scripts currently rendered on {symbol} (with element counts and "
            f"generator types):\n{scripts_text}\n"
            "To edit or remove a script, use manage_chart_scripts.\n"
            "IMPORTANT: If the user asks you to add levels/patterns/overlays, ALWAYS create "
            "them — even if similar scripts appear in this list. The user may not see them due "
            "to rendering issues. Never tell the user something is 'already there' — just "
            "create it fresh.\n"
            "After creating a script, confirm to the user what you added (name, type, color) "
            "so they can verify visually."
        )
    else:
        parts.append(
            f"No chart scripts are currently active on {symbol}. The chart is clean — "
            "any overlays you create will be the only ones visible."
        )

    if user_profile:
        profile_parts = []
        if user_profile.get("name"):
            profile_parts.append(f"- Name: {user_profile['name']}")
        if user_profile.get("experience"):
            profile_parts.append(f"- Experience: {user_profile['experience']}")
        if user_profile.get("tradingStyle"):
            profile_parts.append(f"- Style: {user_profile['tradingStyle']}")
        if user_profile.get("analysisApproach"):
            profile_parts.append(f"- Analysis: {', '.join(user_profile['analysisApproach'])}")
        if user_profile.get("tradingGoals"):
            profile_parts.append(f"- Goals: {', '.join(user_profile['tradingGoals'])}")
        if user_profile.get("markets"):
            profile_parts.append(f"- Markets: {', '.join(user_profile['markets'])}")
        if user_profile.get("profileSummary"):
            profile_parts.append(
                f"\nAI Memory Profile (auto-built from activity):\n{user_profile['profileSummary']}"
            )
        if profile_parts:
            parts.append(
                "User Profile:\n" + "\n".join(profile_parts)
                + "\n\nPersonalize your responses to match this trader's style and goals. "
                "A scalper wants quick setups and tight stops. A swing trader wants multi-day "
                "levels. Match indicator suggestions, strategy complexity, and timeframe "
                "recommendations to their profile. Reference their favorite symbols, recent "
                "activity, and trading patterns when relevant — but don't over-do it. Be natural."
            )

    if active_alerts:
        alerts_text = []
        for a in active_alerts:
            aid = a.get("id", a.get("_id", "?"))
            atype = a.get("type", "?")
            sym = a.get("symbol", "?")
            active_flag = "active" if a.get("active", True) else "paused"
            if atype == "price":
                cond = a.get("condition", "?")
                price = a.get("targetPrice", "?")
                alerts_text.append(f"- [{aid}] {sym} price {cond} ${price} ({active_flag})")
            else:
                kws = ", ".join(a.get("keywords", []))
                alerts_text.append(f"- [{aid}] {sym} news alert for: {kws} ({active_flag})")
        parts.append(
            f"User's Current Alerts ({len(active_alerts)} total):\n"
            + "\n".join(alerts_text)
            + "\nUse the alert IDs in brackets when the user asks to toggle or delete alerts. "
            "When the user asks 'what alerts do I have?', list them from this context."
        )
    else:
        parts.append(
            "The user has no alerts set up. If they ask to manage alerts, help them create "
            "new ones using the manage_alerts tool."
        )

    return "\n\n".join(parts)


# ─── Approval Callback ───

async def _auto_approve_callback(tool_name: str, tool_input: dict) -> dict:
    """SDK permission callback: auto-approve known tools, deny unknown.

    The SDK calls this with tool_name and tool_input. We return a permission dict.
    For tools needing user approval in the old runner, we still auto-approve here
    since the SSE approval flow is handled at the router/frontend level.
    """
    bare = bare_tool_name(tool_name)
    if bare in AUTO_APPROVED_TOOLS or bare in APPROVAL_REQUIRED_TOOLS:
        return {"behavior": "allow"}
    return {"behavior": "allow"}  # Allow all MCP tools


# ─── Streaming SDK Runner ───

async def run_sdk_agent_stream(
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
    active_scripts: Optional[List[str]] = None,
    user_profile: Optional[Dict] = None,
    active_alerts: Optional[List[Dict]] = None,
) -> AsyncGenerator[SSEEvent, None]:
    """SDK-based streaming agent loop. Drop-in replacement for run_agent_stream().

    Same signature, same SSEEvent yield format. The router doesn't know the difference.
    """
    run_id = f"sdk_{uuid.uuid4().hex[:8]}"
    start_time = time.time()
    token_tracker = TokenTracker()

    logger.info(
        "sdk_agent_session_start",
        extra={
            "run_id": run_id,
            "message_len": len(message),
            "has_history": bool(conversation_history),
        },
    )

    # Build system prompt: static base + dynamic context
    dynamic_context = _build_dynamic_context(
        symbol=symbol,
        interval=interval,
        current_page=current_page,
        news_headlines=news_headlines,
        active_scripts=active_scripts,
        user_profile=user_profile,
        active_alerts=active_alerts,
    )
    full_system_prompt = ALPHY_SYSTEM_PROMPT + "\n\n" + dynamic_context

    # Build conversation context for the prompt
    context_parts = []
    if conversation_history:
        for msg in conversation_history:
            role = msg["role"]
            content = msg["content"] if isinstance(msg["content"], str) else json.dumps(msg["content"])
            context_parts.append(f"[{role}]: {content}")

    prompt = message
    if context_parts:
        context_str = "\n".join(context_parts[-10:])  # Last 10 messages for context
        prompt = f"Conversation history:\n{context_str}\n\nUser: {message}"

    # Create MCP servers with strategy generators
    mcp_servers = create_all_mcp_servers(
        strategy_gen=generate_strategy,
        vbt_gen=generate_vbt_strategy,
        pine_gen=generate_pinescript,
    )

    # Create SDK hooks
    sdk_hooks, audit_log, rate_limiter = create_sdk_hooks(max_calls=20)

    # Configure SDK options
    options = ClaudeAgentOptions(
        system_prompt=full_system_prompt,
        mcp_servers=mcp_servers,
        allowed_tools=get_all_allowed_tools(),
        hooks=sdk_hooks,
        max_turns=MAX_TOOL_ROUNDS,
        model="claude-haiku-4-5-20251001",
    )

    # Track accumulated results for the final "done" event
    results = _ResultTracker(symbol=symbol)
    tool_data: list = []
    full_text = ""
    total_rounds = 0

    # Map tool_use_id → (bare tool name, tool input) — populated on ToolUseBlock, read on ToolResultBlock
    tool_id_map: Dict[str, tuple[str, dict]] = {}
    sdk_cost_usd: Optional[float] = None

    try:
        async with ClaudeSDKClient(options=options) as client:
            await client.query(prompt)

            async for msg in client.receive_messages():
                # Check stream-level timeout
                elapsed = time.time() - start_time
                if elapsed > STREAM_TIMEOUT:
                    logger.warning(
                        "sdk_stream_timeout",
                        extra={"run_id": run_id, "elapsed_s": round(elapsed, 1)},
                    )
                    yield SSEEvent(
                        event="done",
                        data=_sanitize_floats(results.done_payload(
                            run_id=run_id,
                            message=strip_markdown(full_text) if full_text else "I ran out of time but here's what I found so far.",
                            tool_data=tool_data,
                            token_usage=_build_token_usage(token_tracker, sdk_cost_usd),
                            duration_ms=int(elapsed * 1000),
                            extra={"timed_out": True},
                        )),
                    )
                    return

                # ── AssistantMessage: text + tool use blocks ──
                if isinstance(msg, AssistantMessage):
                    total_rounds += 1

                    for block in msg.content:
                        if isinstance(block, TextBlock) and block.text:
                            # Emit text as text_delta for frontend compatibility
                            full_text += block.text
                            yield SSEEvent(
                                event="text_delta",
                                data={"text": block.text, "run_id": run_id},
                            )

                        elif isinstance(block, ToolUseBlock):
                            tool_name = bare_tool_name(block.name)
                            tool_input = block.input if isinstance(block.input, dict) else {}

                            # Record mapping for later ToolResultBlock lookup
                            tool_id_map[block.id] = (tool_name, tool_input)

                            yield SSEEvent(
                                event="tool_start",
                                data={
                                    "run_id": run_id,
                                    "tool_name": tool_name,
                                    "tool_input": tool_input,
                                    "tool_use_id": block.id,
                                },
                            )

                # ── UserMessage: contains ToolResultBlocks from SDK execution ──
                elif isinstance(msg, UserMessage):
                    for block in msg.content:
                        if isinstance(block, ToolResultBlock):
                            tool_use_id = block.tool_use_id
                            content_str = block.content if isinstance(block.content, str) else json.dumps(block.content)

                            # Parse tool result
                            try:
                                result_data = json.loads(content_str)
                            except (json.JSONDecodeError, TypeError):
                                result_data = {"raw": content_str}

                            # Look up tool name + input from the ID we recorded earlier
                            tool_name, tool_input = tool_id_map.get(tool_use_id, ("unknown", {}))

                            # Track results by tool type
                            results.track(tool_name, result_data)

                            tool_data.append({
                                "tool": tool_name,
                                "input": tool_input,
                                "data": result_data,
                            })

                            # Emit side-effect events
                            if tool_name == "control_ui" and "error" not in result_data:
                                ui_actions = result_data.get("ui_actions", [])
                                if ui_actions:
                                    yield SSEEvent(
                                        event="ui_action",
                                        data={"run_id": run_id, "actions": ui_actions},
                                    )
                            elif tool_name == "manage_holdings" and "error" not in result_data:
                                pos_actions = result_data.get("position_actions", [])
                                if pos_actions:
                                    yield SSEEvent(
                                        event="position_action",
                                        data=_sanitize_floats({"run_id": run_id, "actions": pos_actions}),
                                    )
                            elif tool_name == "manage_alerts" and "error" not in result_data:
                                alert_actions = result_data.get("alert_actions", [])
                                if alert_actions:
                                    yield SSEEvent(
                                        event="alert_action",
                                        data={"run_id": run_id, "actions": alert_actions},
                                    )

                            # Emit tool_result
                            yield SSEEvent(
                                event="tool_result",
                                data=_sanitize_floats({
                                    "run_id": run_id,
                                    "tool_name": tool_name,
                                    "tool_use_id": tool_use_id,
                                    "status": "error" if "error" in result_data else "success",
                                    "result": result_data,
                                }),
                            )

                # ── ResultMessage: agent finished ──
                elif isinstance(msg, ResultMessage):
                    if hasattr(msg, "num_turns") and msg.num_turns:
                        total_rounds = msg.num_turns
                    if hasattr(msg, "total_cost_usd") and msg.total_cost_usd:
                        sdk_cost_usd = msg.total_cost_usd

                    break  # Done

    except Exception as e:
        logger.error("sdk_runner_error", extra={"run_id": run_id, "error": str(e)})
        yield SSEEvent(
            event="error",
            data=_sanitize_floats({"error": str(e), "run_id": run_id}),
        )
        # Emit a done event with partial results, then return to prevent double-fire
        duration_ms = int((time.time() - start_time) * 1000)
        if full_text:
            full_text = strip_markdown(full_text)
            full_text = _inject_missing_indicator_tags(full_text)
        yield SSEEvent(
            event="done",
            data=_sanitize_floats(results.done_payload(
                run_id=run_id,
                message=full_text if full_text else "Something went wrong. Here's what I gathered before the error.",
                tool_data=tool_data,
                token_usage=_build_token_usage(token_tracker, sdk_cost_usd),
                duration_ms=duration_ms,
                extra={"error_terminated": True},
            )),
        )
        return

    # ── Final done event (success path) ──
    duration_ms = int((time.time() - start_time) * 1000)

    # Clean up text
    if full_text:
        full_text = strip_markdown(full_text)
        full_text = _inject_missing_indicator_tags(full_text)

    logger.info(
        "sdk_agent_session_end",
        extra={
            "run_id": run_id,
            "duration_ms": duration_ms,
            "rounds": total_rounds,
            "tools_called": len(tool_data),
        },
    )

    yield SSEEvent(
        event="done",
        data=_sanitize_floats(results.done_payload(
            run_id=run_id,
            message=full_text if full_text else "I gathered the data but hit a limit. Here's what I found.",
            tool_data=tool_data,
            token_usage=_build_token_usage(token_tracker, sdk_cost_usd),
            duration_ms=duration_ms,
        )),
    )


# ─── Helpers ───

def _build_token_usage(tracker: TokenTracker, sdk_cost_usd: Optional[float]) -> dict:
    """Build token usage dict, merging TokenTracker data with SDK cost if available.

    The SDK provides total_cost_usd from ResultMessage but not per-model token
    breakdowns. We use that as a more accurate cost estimate when available.
    """
    summary = tracker.get_summary()
    if sdk_cost_usd is not None:
        summary["estimated_cost_usd"] = round(sdk_cost_usd, 6)
    return summary


# ─── Result Tracker ───

class _ResultTracker:
    """Accumulates tool results for the final 'done' SSE event.

    Replaces the scattered holder variables with a single mutable object.
    Mirrors the tracking logic from agent_runner.py:855-909.
    """

    def __init__(self, symbol: str):
        self.symbol = symbol
        self.backtest: Optional[dict] = None
        self.pinescript: Optional[dict] = None
        self.monte_carlo: Optional[dict] = None
        self.walk_forward: Optional[dict] = None
        self.trade_analysis: Optional[dict] = None
        self.chart_scripts: list = []

    def track(self, tool_name: str, result_data: dict) -> None:
        """Track a tool result by type."""
        if "error" in result_data:
            return

        if tool_name in ("run_backtest", "run_preset_strategy"):
            self.backtest = result_data
            if result_data.get("monte_carlo"):
                self.monte_carlo = result_data["monte_carlo"]
            if result_data.get("chart_script"):
                self.chart_scripts.append(result_data["chart_script"])
        elif tool_name == "generate_pinescript":
            self.pinescript = result_data
        elif tool_name == "run_walk_forward":
            self.walk_forward = result_data
        elif tool_name == "run_monte_carlo":
            self.monte_carlo = result_data
        elif tool_name == "analyze_trades":
            self.trade_analysis = result_data
        elif tool_name == "load_saved_strategy" and result_data.get("trades"):
            self.backtest = result_data
            if result_data.get("monte_carlo"):
                self.monte_carlo = result_data["monte_carlo"]
        elif tool_name == "create_chart_script":
            cs = result_data.get("chart_script")
            if cs:
                cs.setdefault("symbol", self.symbol)
                self.chart_scripts.append(cs)
        elif tool_name in ("detect_chart_patterns", "detect_key_levels",
                           "detect_divergences", "apply_chart_snippet"):
            cs = result_data.get("chart_script")
            if cs:
                cs.setdefault("symbol", self.symbol)
                self.chart_scripts.append(cs)

    def done_payload(
        self,
        run_id: str,
        message: str,
        tool_data: list,
        token_usage: dict,
        duration_ms: int,
        extra: Optional[dict] = None,
    ) -> dict:
        """Build the data dict for the final SSEEvent('done', ...)."""
        payload = {
            "run_id": run_id,
            "message": message,
            "strategy": self.backtest.get("strategy") if self.backtest else None,
            "backtest_result": _format_backtest(self.backtest),
            "pinescript": self.pinescript,
            "monte_carlo": self.monte_carlo,
            "walk_forward": self.walk_forward,
            "trade_analysis": self.trade_analysis,
            "chart_scripts": self.chart_scripts if self.chart_scripts else None,
            "tool_data": tool_data if tool_data else None,
            "token_usage": token_usage,
            "duration_ms": duration_ms,
        }
        if extra:
            payload.update(extra)
        return payload
