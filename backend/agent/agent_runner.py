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

from anthropic import AsyncAnthropic, APIStatusError, APIConnectionError, APITimeoutError

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
from agent.resilience import (
    retry_api_call,
    CircuitOpenError,
    ToolTimeoutError,
    with_timeout,
    anthropic_breaker,
)
from agent.hooks import DuplicateToolCallError

import logging

logger = logging.getLogger("afindr.agent")


# ─── App Context for Read Tools ───
# Stored per-request so read_portfolio/read_journal/etc. can access injected context.
_current_app_context: Dict[str, Any] = {}


def _set_app_context(ctx: Dict[str, Any]) -> None:
    global _current_app_context
    _current_app_context = ctx


def get_app_context() -> Dict[str, Any]:
    """Get the current app context (used by read tool handlers)."""
    return _current_app_context


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
DEFAULT_MODEL = "claude-haiku-4-5-20251001"
FAST_MODEL = "claude-haiku-4-5-20251001"

MAX_TOKENS = 4096

STREAM_TIMEOUT = 120  # seconds — max total agent loop time
APPROVAL_TIMEOUT = 60  # seconds — auto-deny if user doesn't respond

# Per-tool timeout configuration (seconds)
TOOL_TIMEOUTS = {
    "run_backtest": 60,
    "run_walk_forward": 60,
    "run_parameter_sweep": 60,
    "run_preset_strategy": 60,
    "fetch_market_data": 15,
    "get_stock_info": 15,
    "fetch_options_chain": 15,
    "fetch_insider_activity": 15,
    "fetch_economic_data": 15,
    "fetch_earnings_calendar": 15,
    "fetch_company_news_feed": 15,
    "fetch_labor_data": 15,
    "fetch_news": 10,
    "search_news": 10,
    "query_prediction_markets": 10,
    "detect_chart_patterns": 20,
    "detect_key_levels": 20,
    "detect_divergences": 20,
    "create_chart_script": 15,
    "manage_chart_scripts": 5,
    "apply_chart_snippet": 10,
    "list_chart_snippets": 5,
    "control_ui": 5,
    "manage_holdings": 5,
    "manage_alerts": 5,
    "read_portfolio": 2,
    "read_journal": 2,
    "read_watchlist": 2,
    "read_chart_state": 2,
    "read_app_settings": 2,
    "manage_drawings": 5,
    "manage_indicators": 5,
    "manage_journal": 5,
    "manage_watchlist": 5,
}
DEFAULT_TOOL_TIMEOUT = 30

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
    "manage_chart_scripts",
    "apply_chart_snippet",
    "list_chart_snippets",
    "control_ui",
    "generate_pinescript",
    "fetch_options_chain",
    "fetch_insider_activity",
    "fetch_economic_data",
    "fetch_earnings_calendar",
    "fetch_company_news_feed",
    "search_news",
    "query_prediction_markets",
    "fetch_labor_data",
    "detect_chart_patterns",
    "detect_key_levels",
    "detect_divergences",
    "manage_holdings",
    "manage_alerts",
    # Phase 2: Read tools (instant, read-only)
    "read_portfolio",
    "read_journal",
    "read_watchlist",
    "read_chart_state",
    "read_app_settings",
    # Phase 3: Write tools
    "manage_drawings",
    "manage_indicators",
    "manage_journal",
    "manage_watchlist",
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


# Map of indicator keywords → tag to inject if the model forgets the control tag
_INDICATOR_KEYWORDS = {
    "vwap": "[INDICATOR:vwap]",
    "sma": "[INDICATOR:sma:period=20]",
    "ema": "[INDICATOR:ema:period=20]",
    "rsi": "[INDICATOR:rsi:period=14]",
    "macd": "[INDICATOR:macd:fast=12,slow=26,signal=9]",
    "bollinger": "[INDICATOR:bb:period=20,stdDev=2]",
    "atr": "[INDICATOR:atr:period=14]",
    "stochastic": "[INDICATOR:stoch:k=14,d=3]",
    "supertrend": "[INDICATOR:supertrend:period=10,mult=3]",
}


def _inject_missing_indicator_tags(text: str) -> str:
    """Safety net: if agent says it added/removed an indicator but forgot the tag, inject it.

    Only triggers when the text mentions adding/removing a specific indicator
    AND there is no corresponding [INDICATOR:...] or [CLEAR_INDICATORS] tag already present.
    """
    text_lower = text.lower()

    # Check for removal intent first
    removal_phrases = ["removed", "removing", "cleared", "taken off", "got rid", "no longer"]
    has_removal = any(phrase in text_lower for phrase in removal_phrases)
    if has_removal and "[CLEAR_INDICATORS]" not in text and "[INDICATOR:" not in text:
        # Agent says it removed an indicator but forgot the clear tag
        text = text.rstrip() + " [CLEAR_INDICATORS]"
        return text

    if "[INDICATOR:" in text or "[CLEAR_INDICATORS]" in text:
        # Agent already included a control tag — trust the response
        return text

    # Only inject if the agent claims to have added something
    action_phrases = ["added", "adding", "here's", "applied", "enabled", "turned on", "now on"]
    has_action = any(phrase in text_lower for phrase in action_phrases)
    if not has_action:
        return text

    injected = []
    for keyword, tag in _INDICATOR_KEYWORDS.items():
        if keyword in text_lower:
            injected.append(tag)

    if injected:
        text = text.rstrip() + " " + " ".join(injected)

    return text


# ─── Task-Aware Model Routing ───

# Tools whose results benefit from Sonnet-level reasoning
REASONING_TOOLS = {
    "run_backtest", "run_walk_forward", "run_parameter_sweep",
    "run_preset_strategy", "run_monte_carlo", "analyze_trades",
}

REASONING_MODEL = "claude-sonnet-4-20250514"


def _pick_model(
    round_num: int,
    message: str = "",
    prev_round_tools: Optional[list[str]] = None,
) -> str:
    """Route to Sonnet when the previous round returned complex results."""
    if round_num == 0:
        return DEFAULT_MODEL

    if prev_round_tools and any(t in REASONING_TOOLS for t in prev_round_tools):
        return REASONING_MODEL

    return DEFAULT_MODEL


# ─── Tool Execution ───

async def _execute_tool(tool_name: str, tool_input: dict) -> str:
    """Execute a single tool call with timeout and return JSON string result."""
    timeout = TOOL_TIMEOUTS.get(tool_name, DEFAULT_TOOL_TIMEOUT)

    async def _inner() -> str:
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

    try:
        return await with_timeout(_inner(), seconds=timeout, label=tool_name)
    except ToolTimeoutError as e:
        logger.warning("tool_timeout", extra={"tool": tool_name, "timeout_s": timeout})
        return json.dumps({"error": str(e)})
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
    active_scripts: Optional[List[str]] = None,
    user_profile: Optional[Dict] = None,
    active_alerts: Optional[List[Dict]] = None,
    # ─── Full App Awareness (Phase 1) ───
    portfolio_holdings: Optional[List[Dict]] = None,
    open_positions: Optional[List[Dict]] = None,
    account_state: Optional[Dict] = None,
    recent_journal: Optional[List[Dict]] = None,
    watchlist_symbols: Optional[List[str]] = None,
    chart_drawings: Optional[List[Dict]] = None,
    active_indicators: Optional[List[Dict]] = None,
    app_settings: Optional[Dict] = None,
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
    stream_failures = 0  # Track consecutive stream failures

    # Get token tracker from hooks if available
    token_tracker = hooks.get("_tokens")
    duplicate_guard = hooks.get("_duplicate_guard")

    logger.info(
        "agent_session_start",
        extra={
            "run_id": run_id,
            "model": DEFAULT_MODEL,
            "message_len": len(message),
            "has_history": bool(conversation_history),
        },
    )

    # Build system prompt as content blocks for prompt caching.
    # Static base prompt (identical every request) gets cache_control.
    # Dynamic per-request context (chart, page, news, profile, alerts) does not.
    dynamic_parts = []

    dynamic_parts.append(f"CRITICAL — Current Chart Context: The user is viewing {symbol} on {interval} candles right now. ALL analysis, chart scripts, pattern detection, and level drawing MUST target {symbol}. When calling ANY tool that takes a symbol parameter, pass symbol=\"{symbol}\". When calling detection tools (detect_chart_patterns, detect_key_levels, detect_divergences), pass symbol=\"{symbol}\" and interval=\"{interval}\". Do NOT reference or draw levels for any other symbol unless the user explicitly asks.")
    if current_page:
        dynamic_parts.append(f"The user is currently on the '{current_page}' page of aFindr.")
    if news_headlines:
        headlines_text = "\n".join(f"- {h}" for h in news_headlines[:20])
        dynamic_parts.append(f"The user can currently see these news headlines on screen:\n{headlines_text}\nYou can reference these headlines when the user asks about news they're seeing.")
    if active_scripts:
        scripts_text = "\n".join(f"- {s}" for s in active_scripts)
        dynamic_parts.append(f"Active chart scripts currently rendered on {symbol} (with element counts and generator types):\n{scripts_text}\nTo edit or remove a script, use manage_chart_scripts.\nIMPORTANT: If the user asks you to add levels/patterns/overlays, ALWAYS create them — even if similar scripts appear in this list. The user may not see them due to rendering issues. Never tell the user something is 'already there' — just create it fresh.\nAfter creating a script, confirm to the user what you added (name, type, color) so they can verify visually.")
    else:
        dynamic_parts.append(f"No chart scripts are currently active on {symbol}. The chart is clean — any overlays you create will be the only ones visible.")

    # Inject user profile for personalized responses
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
            profile_parts.append(f"\nAI Memory Profile (auto-built from activity):\n{user_profile['profileSummary']}")
        if profile_parts:
            dynamic_parts.append("User Profile:\n" + "\n".join(profile_parts) + "\n\nPersonalize your responses to match this trader's style and goals. A scalper wants quick setups and tight stops. A swing trader wants multi-day levels. Match indicator suggestions, strategy complexity, and timeframe recommendations to their profile. Reference their favorite symbols, recent activity, and trading patterns when relevant — but don't over-do it. Be natural.")

    # Inject active alerts context
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
        dynamic_parts.append(f"User's Current Alerts ({len(active_alerts)} total):\n" + "\n".join(alerts_text) + "\nUse the alert IDs in brackets when the user asks to toggle or delete alerts. When the user asks 'what alerts do I have?', list them from this context.")
    else:
        dynamic_parts.append("The user has no alerts set up. If they ask to manage alerts, help them create new ones using the manage_alerts tool.")

    # ─── Full App Awareness: Portfolio, Journal, Chart, Watchlist, Settings ───

    # Portfolio & Positions
    if portfolio_holdings or open_positions or account_state:
        port_parts = []
        if portfolio_holdings:
            holdings_text = ", ".join(
                f"{h.get('symbol')} {h.get('shares')} shares @ ${h.get('avgCostBasis', 0):.2f}"
                for h in portfolio_holdings[:20]
            )
            port_parts.append(f"Holdings ({len(portfolio_holdings)}): {holdings_text}")
        if open_positions:
            pos_text = ", ".join(
                f"{'Long' if p.get('side') == 'long' else 'Short'} {p.get('symbol')} {p.get('size')} @ {p.get('entryPrice', 0)}"
                f" (SL {p.get('stopLoss', 'none')}, TP {p.get('takeProfit', 'none')}, PnL ${p.get('unrealizedPnl', 0):+.2f})"
                for p in open_positions[:20]
            )
            port_parts.append(f"Open Positions ({len(open_positions)}): {pos_text}")
        if account_state:
            bal = account_state.get("balance", 0)
            eq = account_state.get("equity", 0)
            pnl = account_state.get("unrealizedPnl", 0)
            port_parts.append(f"Account: Balance=${bal:,.2f}, Equity=${eq:,.2f}, Unrealized PnL=${pnl:+,.2f}")
        if port_parts:
            dynamic_parts.append("User's Portfolio:\n" + "\n".join(port_parts))

    # Journal
    if recent_journal:
        journal_lines = []
        for j in recent_journal[:5]:
            date = j.get("date", "?")[:10]
            title = j.get("title", "Untitled")
            outcome = j.get("outcome", "")
            mood = j.get("mood", "")
            body_preview = (j.get("body") or "")[:150]
            journal_lines.append(f"- [{date}] '{title}' — {outcome}{', ' + mood if mood else ''}{' — ' + body_preview if body_preview else ''}")
        dynamic_parts.append(f"Recent Journal ({len(recent_journal)} entries):\n" + "\n".join(journal_lines))

    # Chart State (drawings + indicators)
    chart_state_parts = []
    if chart_drawings:
        drawings_text = ", ".join(
            f"{d.get('type')}{'@' + str(d.get('price', '')) if d.get('price') else ''}"
            f"{'(' + d.get('color', '') + ')' if d.get('color') else ''}"
            for d in chart_drawings[:20]
        )
        chart_state_parts.append(f"Drawings on chart: {drawings_text}")
    if active_indicators:
        indicators_text = ", ".join(
            f"{ic.get('type', '?')}({', '.join(str(v) for v in (ic.get('params') or {}).values())})"
            for ic in active_indicators if ic.get("visible", True)
        )
        chart_state_parts.append(f"Active indicators: {indicators_text}")
    if chart_state_parts:
        dynamic_parts.append(f"Chart State ({symbol} {interval}):\n" + "\n".join(chart_state_parts))

    # Watchlist
    if watchlist_symbols:
        dynamic_parts.append(f"Watchlist ({len(watchlist_symbols)} symbols): {', '.join(watchlist_symbols[:30])}")

    # App Settings
    if app_settings:
        settings_parts = []
        if app_settings.get("theme"):
            settings_parts.append(f"Theme={app_settings['theme']}")
        if app_settings.get("broker"):
            settings_parts.append(f"Broker={app_settings['broker']}")
        risk = app_settings.get("riskLimits") or app_settings.get("risk")
        if risk:
            risk_items = []
            if risk.get("maxOpenPositions"):
                risk_items.append(f"max {risk['maxOpenPositions']} positions")
            if risk.get("requireSlTp"):
                risk_items.append("SL/TP required")
            if risk.get("maxLossPerTradePct"):
                risk_items.append(f"max {risk['maxLossPerTradePct']}% loss/trade")
            if risk_items:
                settings_parts.append(f"Risk: {', '.join(risk_items)}")
        if settings_parts:
            dynamic_parts.append(f"Settings: {', '.join(settings_parts)}")

    # ─── Store app context for read tools (Phase 2) ───
    _app_context = {
        "portfolio_holdings": portfolio_holdings,
        "open_positions": open_positions,
        "account_state": account_state,
        "recent_journal": recent_journal,
        "watchlist_symbols": watchlist_symbols,
        "chart_drawings": chart_drawings,
        "active_indicators": active_indicators,
        "app_settings": app_settings,
        "symbol": symbol,
        "interval": interval,
    }
    # Make accessible to tool handlers via module-level variable
    _set_app_context(_app_context)

    # Assemble system content blocks with cache_control
    system_blocks = [
        {
            "type": "text",
            "text": ALPHY_SYSTEM_PROMPT,
            "cache_control": {"type": "ephemeral"},
        },
    ]
    dynamic_context = "\n\n".join(dynamic_parts)
    if dynamic_context:
        system_blocks.append({
            "type": "text",
            "text": dynamic_context,
        })

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
    chart_script_results: list = []
    tool_data = []
    full_text = ""
    total_rounds = 0
    prev_round_tool_names: list[str] = []

    for _round in range(MAX_TOOL_ROUNDS):
        total_rounds = _round + 1

        # Check stream-level timeout
        elapsed = time.time() - start_time
        if elapsed > STREAM_TIMEOUT:
            logger.warning(
                "stream_timeout",
                extra={"run_id": run_id, "elapsed_s": round(elapsed, 1)},
            )
            yield SSEEvent(
                event="done",
                data=_sanitize_floats({
                    "run_id": run_id,
                    "message": strip_markdown(full_text) if full_text else "I ran out of time but here's what I found so far.",
                    "strategy": backtest_result.get("strategy") if backtest_result else None,
                    "backtest_result": _format_backtest(backtest_result),
                    "pinescript": pinescript_result,
                    "monte_carlo": monte_carlo_result,
                    "walk_forward": walk_forward_result,
                    "trade_analysis": trade_analysis_result,
                    "chart_scripts": chart_script_results if chart_script_results else None,
                    "tool_data": tool_data if tool_data else None,
                    "token_usage": token_tracker.get_summary() if token_tracker else None,
                    "duration_ms": int((time.time() - start_time) * 1000),
                    "timed_out": True,
                }),
            )
            return

        # ── Stream Claude's response ──
        collected_text = ""
        tool_use_blocks = []
        current_tool_block = None
        model = _pick_model(_round, message, prev_round_tools=prev_round_tool_names)
        max_tokens = MAX_TOKENS

        try:
            # Wrap the API call with circuit breaker + retry
            async def _make_stream():
                return client.messages.stream(
                    model=model,
                    max_tokens=max_tokens,
                    system=system_blocks,
                    tools=TOOLS,
                    messages=messages,
                    extra_headers={"anthropic-beta": "prompt-caching-2024-07-31"},
                )

            stream_ctx = await anthropic_breaker.call(_make_stream)

            async with stream_ctx as stream:
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

            # Track token usage
            if token_tracker and hasattr(final_message, "usage"):
                token_tracker.track(
                    model,
                    final_message.usage.input_tokens,
                    final_message.usage.output_tokens,
                )
                # Emit live token update so frontend can show a ticking counter
                yield SSEEvent(
                    event="token_update",
                    data=_sanitize_floats({
                        "run_id": run_id,
                        **token_tracker.get_summary(),
                    }),
                )

            # Reset failure counter on success
            stream_failures = 0

        except CircuitOpenError as e:
            logger.error(
                "circuit_open",
                extra={"run_id": run_id, "provider": e.provider, "recovery_in": e.recovery_in},
            )
            yield SSEEvent(
                event="error",
                data=_sanitize_floats({
                    "error": f"Anthropic API temporarily unavailable. Try again in ~{int(e.recovery_in)}s.",
                    "run_id": run_id,
                    "retry_after_s": int(e.recovery_in),
                }),
            )
            yield SSEEvent(
                event="done",
                data=_sanitize_floats({
                    "run_id": run_id,
                    "message": strip_markdown(full_text) if full_text else "Service temporarily unavailable. Please try again shortly.",
                    "strategy": backtest_result.get("strategy") if backtest_result else None,
                    "backtest_result": _format_backtest(backtest_result),
                    "pinescript": pinescript_result,
                    "monte_carlo": monte_carlo_result,
                    "walk_forward": walk_forward_result,
                    "trade_analysis": trade_analysis_result,
                    "chart_scripts": chart_script_results if chart_script_results else None,
                    "tool_data": tool_data if tool_data else None,
                    "token_usage": token_tracker.get_summary() if token_tracker else None,
                    "duration_ms": int((time.time() - start_time) * 1000),
                    "error_terminated": True,
                }),
            )
            return

        except (APIStatusError, APIConnectionError, APITimeoutError) as e:
            stream_failures += 1
            logger.error(
                "stream_api_error",
                extra={
                    "run_id": run_id,
                    "error": str(e),
                    "failures": stream_failures,
                },
            )

            if stream_failures >= 3:
                yield SSEEvent(
                    event="done",
                    data=_sanitize_floats({
                        "run_id": run_id,
                        "message": strip_markdown(full_text) if full_text else "Service is experiencing issues. Here's what I gathered before the interruption.",
                        "strategy": backtest_result.get("strategy") if backtest_result else None,
                        "backtest_result": _format_backtest(backtest_result),
                        "pinescript": pinescript_result,
                        "monte_carlo": monte_carlo_result,
                        "walk_forward": walk_forward_result,
                        "trade_analysis": trade_analysis_result,
                        "chart_scripts": chart_script_results if chart_script_results else None,
                        "tool_data": tool_data if tool_data else None,
                        "token_usage": token_tracker.get_summary() if token_tracker else None,
                        "duration_ms": int((time.time() - start_time) * 1000),
                        "service_degraded": True,
                    }),
                )
                return

            yield SSEEvent(event="error", data=_sanitize_floats({"error": str(e), "run_id": run_id}))
            yield SSEEvent(
                event="done",
                data=_sanitize_floats({
                    "run_id": run_id,
                    "message": strip_markdown(full_text) if full_text else "Something went wrong. Here's what I gathered before the error.",
                    "strategy": backtest_result.get("strategy") if backtest_result else None,
                    "backtest_result": _format_backtest(backtest_result),
                    "pinescript": pinescript_result,
                    "monte_carlo": monte_carlo_result,
                    "walk_forward": walk_forward_result,
                    "trade_analysis": trade_analysis_result,
                    "chart_scripts": chart_script_results if chart_script_results else None,
                    "tool_data": tool_data if tool_data else None,
                    "token_usage": token_tracker.get_summary() if token_tracker else None,
                    "duration_ms": int((time.time() - start_time) * 1000),
                    "error_terminated": True,
                }),
            )
            return

        except Exception as e:
            logger.error("stream_error", extra={"run_id": run_id, "error": str(e)})
            yield SSEEvent(event="error", data=_sanitize_floats({"error": str(e), "run_id": run_id}))
            yield SSEEvent(
                event="done",
                data=_sanitize_floats({
                    "run_id": run_id,
                    "message": strip_markdown(full_text) if full_text else "Something went wrong. Here's what I gathered before the error.",
                    "strategy": backtest_result.get("strategy") if backtest_result else None,
                    "backtest_result": _format_backtest(backtest_result),
                    "pinescript": pinescript_result,
                    "monte_carlo": monte_carlo_result,
                    "walk_forward": walk_forward_result,
                    "trade_analysis": trade_analysis_result,
                    "chart_scripts": chart_script_results if chart_script_results else None,
                    "tool_data": tool_data if tool_data else None,
                    "token_usage": token_tracker.get_summary() if token_tracker else None,
                    "duration_ms": int((time.time() - start_time) * 1000),
                    "error_terminated": True,
                }),
            )
            return

        # Extract complete tool use blocks from the final message
        actual_tool_blocks = [
            b for b in final_message.content
            if hasattr(b, "type") and b.type == "tool_use"
        ]

        # Track tool names for model routing in the next round
        prev_round_tool_names = [b.name for b in actual_tool_blocks]

        # Always accumulate text from every round (not just the final one)
        # so that indicator tags like [INDICATOR:vwap] emitted in earlier
        # rounds survive into the done event message.
        full_text += collected_text

        if not actual_tool_blocks:
            # No tool calls — we're done. Clean up the text.
            full_text = strip_markdown(full_text)

            # Safety net: if agent mentions adding an indicator but forgot
            # the control tag, inject the tag so the frontend can parse it.
            full_text = _inject_missing_indicator_tags(full_text)

            duration_ms = int((time.time() - start_time) * 1000)
            logger.info(
                "agent_session_end",
                extra={
                    "run_id": run_id,
                    "duration_ms": duration_ms,
                    "rounds": total_rounds,
                    "tools_called": len(tool_data),
                    "tokens": token_tracker.get_summary() if token_tracker else None,
                },
            )

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
                    "chart_scripts": chart_script_results if chart_script_results else None,
                    "tool_data": tool_data if tool_data else None,
                    "token_usage": token_tracker.get_summary() if token_tracker else None,
                    "duration_ms": duration_ms,
                }),
            )
            return

        # ── Execute tool calls ──
        messages.append({"role": "assistant", "content": final_message.content})

        tool_results = []
        for tool_block in actual_tool_blocks:
            tool_name = tool_block.name
            tool_input = tool_block.input
            tool_start_time = time.time()

            # ── Pre-tool hook ──
            if "pre_tool" in hooks:
                try:
                    await hooks["pre_tool"](tool_name, tool_input)
                except DuplicateToolCallError as dup:
                    # Use cached result instead of re-executing
                    logger.info(
                        "tool_duplicate_cached",
                        extra={"tool": tool_name, "run_id": run_id},
                    )
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": tool_block.id,
                        "content": dup.cached_result,
                    })
                    try:
                        cached_data = json.loads(dup.cached_result)
                    except json.JSONDecodeError:
                        cached_data = {"raw": dup.cached_result}
                    yield SSEEvent(
                        event="tool_result",
                        data=_sanitize_floats({
                            "run_id": run_id,
                            "tool_name": tool_name,
                            "tool_use_id": tool_block.id,
                            "status": "cached",
                            "result": cached_data,
                            "cached": True,
                        }),
                    )
                    continue
                except (ValueError, RuntimeError) as e:
                    logger.warning(f"Pre-tool hook rejected: {e}", extra={"tool": tool_name})
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": tool_block.id,
                        "content": json.dumps({"error": str(e)}),
                    })
                    yield SSEEvent(
                        event="tool_result",
                        data=_sanitize_floats({"run_id": run_id, "tool_name": tool_name, "tool_use_id": tool_block.id, "status": "error", "error": str(e)}),
                    )
                    continue
                except Exception as e:
                    logger.warning(f"Pre-tool hook error: {e}", extra={"tool": tool_name})

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

                if approval_callback:
                    try:
                        approved = await asyncio.wait_for(
                            approval_callback(tool_name, tool_input),
                            timeout=APPROVAL_TIMEOUT,
                        )
                    except asyncio.TimeoutError:
                        approved = False
                        yield SSEEvent(
                            event="tool_result",
                            data=_sanitize_floats({
                                "run_id": run_id,
                                "tool_name": tool_name,
                                "tool_use_id": tool_block.id,
                                "status": "timeout",
                                "message": f"Approval timed out after {APPROVAL_TIMEOUT}s. Say 'go ahead' or 'run it' to try again.",
                            }),
                        )

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
                            data=_sanitize_floats({
                                "run_id": run_id,
                                "tool_name": tool_name,
                                "tool_use_id": tool_block.id,
                                "status": "denied",
                            }),
                        )
                        continue

            # ── Execute the tool ──
            yield SSEEvent(
                event="tool_start",
                data={
                    "run_id": run_id,
                    "tool_name": tool_name,
                    "tool_input": tool_input,
                    "tool_use_id": tool_block.id,
                },
            )

            result_str = await _execute_tool(tool_name, tool_input)

            # Store result in duplicate guard cache
            if duplicate_guard:
                duplicate_guard.store_result(tool_name, tool_input, result_str)

            tool_duration_ms = int((time.time() - tool_start_time) * 1000)

            # Parse result and track for frontend
            try:
                result_data = json.loads(result_str)
            except json.JSONDecodeError:
                result_data = {"raw": result_str}

            logger.info(
                "tool_exec",
                extra={
                    "tool": tool_name,
                    "duration_ms": tool_duration_ms,
                    "status": "error" if "error" in result_data else "success",
                    "run_id": run_id,
                },
            )

            # Track results by tool type (same logic as chat.py)
            if tool_name == "run_backtest" and "error" not in result_data:
                backtest_result = result_data
                if result_data.get("monte_carlo"):
                    monte_carlo_result = result_data["monte_carlo"]
                if result_data.get("chart_script"):
                    chart_script_results.append(result_data["chart_script"])
            elif tool_name == "run_preset_strategy" and "error" not in result_data:
                backtest_result = result_data
                if result_data.get("monte_carlo"):
                    monte_carlo_result = result_data["monte_carlo"]
                if result_data.get("chart_script"):
                    chart_script_results.append(result_data["chart_script"])
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
                cs = result_data.get("chart_script")
                if cs:
                    cs.setdefault("symbol", symbol)  # stamp with current chart symbol
                    chart_script_results.append(cs)
            elif tool_name in ("detect_chart_patterns", "detect_key_levels", "detect_divergences", "apply_chart_snippet") and "error" not in result_data:
                cs = result_data.get("chart_script")
                if cs:
                    cs.setdefault("symbol", symbol)  # stamp with current chart symbol
                    chart_script_results.append(cs)
            elif tool_name == "control_ui" and "error" not in result_data:
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
            elif tool_name == "manage_drawings" and "error" not in result_data:
                drawing_actions = result_data.get("drawing_actions", [])
                if drawing_actions:
                    yield SSEEvent(
                        event="drawing_action",
                        data=_sanitize_floats({"run_id": run_id, "actions": drawing_actions}),
                    )
            elif tool_name == "manage_indicators" and "error" not in result_data:
                indicator_actions = result_data.get("indicator_actions", [])
                if indicator_actions:
                    yield SSEEvent(
                        event="indicator_action",
                        data=_sanitize_floats({"run_id": run_id, "actions": indicator_actions}),
                    )
            elif tool_name == "manage_journal" and "error" not in result_data:
                journal_actions = result_data.get("journal_actions", [])
                if journal_actions:
                    yield SSEEvent(
                        event="journal_action",
                        data={"run_id": run_id, "actions": journal_actions},
                    )
            elif tool_name == "manage_watchlist" and "error" not in result_data:
                watchlist_actions = result_data.get("watchlist_actions", [])
                if watchlist_actions:
                    yield SSEEvent(
                        event="watchlist_action",
                        data={"run_id": run_id, "actions": watchlist_actions},
                    )

            tool_data.append({
                "tool": tool_name,
                "input": tool_input,
                "data": result_data,
            })

            # ── Post-tool hook ──
            if "post_tool" in hooks:
                try:
                    await hooks["post_tool"](tool_name, tool_input, result_data)
                except Exception as e:
                    logger.warning(f"Post-tool hook error: {e}", extra={"tool": tool_name})

            # Yield tool result event
            yield SSEEvent(
                event="tool_result",
                data=_sanitize_floats({
                    "run_id": run_id,
                    "tool_name": tool_name,
                    "tool_use_id": tool_block.id,
                    "status": "error" if "error" in result_data else "success",
                    "result": result_data,
                    "duration_ms": tool_duration_ms,
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
    duration_ms = int((time.time() - start_time) * 1000)
    logger.info(
        "agent_session_end",
        extra={
            "run_id": run_id,
            "duration_ms": duration_ms,
            "rounds": total_rounds,
            "tools_called": len(tool_data),
            "hit_max_rounds": True,
            "tokens": token_tracker.get_summary() if token_tracker else None,
        },
    )

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
            "chart_scripts": chart_script_results if chart_script_results else None,
            "tool_data": tool_data if tool_data else None,
            "token_usage": token_tracker.get_summary() if token_tracker else None,
            "duration_ms": duration_ms,
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
