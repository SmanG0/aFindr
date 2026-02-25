"""SDK MCP Tool Servers — wraps all 35+ Alphy tools as SDK @tool definitions.

Each MCP tool is a thin wrapper that delegates to the existing handler in
tools.py. Zero business logic duplication — only schema translation.

6 MCP servers:
  market_data  — fetch_market_data, get_stock_info, get_contract_info,
                 fetch_options_chain, fetch_insider_activity, fetch_economic_data,
                 fetch_earnings_calendar, fetch_company_news_feed, fetch_labor_data
  news         — fetch_news, search_news, query_prediction_markets
  backtesting  — run_backtest, run_parameter_sweep, run_walk_forward,
                 run_preset_strategy, run_monte_carlo, analyze_trades,
                 generate_pinescript
  strategies   — list_saved_strategies, load_saved_strategy, list_preset_strategies,
                 get_backtest_history, get_trading_summary, query_trade_history
  charting     — create_chart_script, manage_chart_scripts, apply_chart_snippet,
                 list_chart_snippets, detect_chart_patterns, detect_key_levels,
                 detect_divergences
  ui_control   — control_ui, manage_holdings, manage_alerts
"""
from __future__ import annotations

import json
import logging
from typing import Any, Callable, Dict, List, Optional

from claude_agent_sdk import tool, create_sdk_mcp_server

from agent.tools import (
    TOOL_HANDLERS,
    handle_run_backtest,
    handle_generate_pinescript,
    handle_run_walk_forward,
    handle_run_preset_strategy,
    handle_run_parameter_sweep,
)
from agent.resilience import with_timeout, ToolTimeoutError
from agent.agent_runner import TOOL_TIMEOUTS, DEFAULT_TOOL_TIMEOUT

logger = logging.getLogger("afindr.mcp_tools")

# Max result size before truncation (500 KB)
MAX_RESULT_SIZE = 500_000


def _text_result(data: str) -> dict:
    """Build an MCP tool result from a JSON string, truncating if oversized."""
    if len(data) > MAX_RESULT_SIZE:
        truncated = data[:MAX_RESULT_SIZE]
        truncated += '\n... [TRUNCATED — result exceeded 500KB]'
        return {"content": [{"type": "text", "text": truncated}]}
    return {"content": [{"type": "text", "text": data}]}


def _error_result(msg: str) -> dict:
    """Build an MCP error result."""
    return {
        "content": [{"type": "text", "text": json.dumps({"error": msg})}],
        "is_error": True,
    }


async def _run_with_timeout(tool_name: str, coro) -> dict:
    """Execute a tool handler coroutine with per-tool timeout."""
    timeout = TOOL_TIMEOUTS.get(tool_name, DEFAULT_TOOL_TIMEOUT)
    try:
        result_str = await with_timeout(coro, seconds=timeout, label=tool_name)
        return _text_result(result_str)
    except ToolTimeoutError as e:
        logger.warning("tool_timeout", extra={"tool": tool_name, "timeout_s": timeout})
        return _error_result(str(e))
    except Exception as e:
        logger.error("tool_error", extra={"tool": tool_name, "error": str(e)})
        return _error_result(str(e))


# ─── Simple handler wrapper (for tools in TOOL_HANDLERS) ───

async def _simple_handler(tool_name: str, args: dict) -> dict:
    """Wrap a standard TOOL_HANDLERS entry with timeout + truncation."""
    handler = TOOL_HANDLERS.get(tool_name)
    if not handler:
        return _error_result(f"Unknown tool: {tool_name}")
    return await _run_with_timeout(tool_name, handler(args))


# ═══════════════════════════════════════════════════════════════
# MCP Server: market_data
# ═══════════════════════════════════════════════════════════════

@tool("fetch_market_data",
      "Fetch OHLCV candlestick data for any symbol — stocks, ETFs, indices, or futures.",
      {"symbol": str, "period": str, "interval": str})
async def sdk_fetch_market_data(args: dict) -> dict:
    return await _simple_handler("fetch_market_data", args)


@tool("get_stock_info",
      "Get real-time stock quote, fundamentals, and analyst ratings for a ticker.",
      {"ticker": str})
async def sdk_get_stock_info(args: dict) -> dict:
    return await _simple_handler("get_stock_info", args)


@tool("get_contract_info",
      "Get contract specifications for a futures symbol (point value, tick size).",
      {"symbol": str})
async def sdk_get_contract_info(args: dict) -> dict:
    return await _simple_handler("get_contract_info", args)


@tool("fetch_options_chain",
      "Fetch options chain for a stock ticker with strikes, bid/ask, volume, OI, IV, and optional Greeks.",
      {"ticker": str, "include_greeks": bool, "expiration": str})
async def sdk_fetch_options_chain(args: dict) -> dict:
    return await _simple_handler("fetch_options_chain", args)


@tool("fetch_insider_activity",
      "Fetch insider trading activity (SEC Form 4 filings) and insider sentiment for a stock.",
      {"ticker": str, "limit": int})
async def sdk_fetch_insider_activity(args: dict) -> dict:
    return await _simple_handler("fetch_insider_activity", args)


@tool("fetch_economic_data",
      "Fetch macroeconomic data from FRED — GDP, CPI, Fed Funds Rate, unemployment, treasury yields, etc.",
      {"series_id": str, "limit": int})
async def sdk_fetch_economic_data(args: dict) -> dict:
    return await _simple_handler("fetch_economic_data", args)


@tool("fetch_earnings_calendar",
      "Fetch upcoming and recent earnings dates for a stock via Finnhub.",
      {"ticker": str})
async def sdk_fetch_earnings_calendar(args: dict) -> dict:
    return await _simple_handler("fetch_earnings_calendar", args)


@tool("fetch_company_news_feed",
      "Fetch recent company-specific news from Finnhub with headlines and summaries.",
      {"ticker": str, "days": int})
async def sdk_fetch_company_news_feed(args: dict) -> dict:
    return await _simple_handler("fetch_company_news_feed", args)


@tool("fetch_labor_data",
      "Fetch US economic data from the Bureau of Labor Statistics — JOLTS, ECI, productivity, sector payrolls, etc.",
      {"indicator": str, "compare": list, "years": int})
async def sdk_fetch_labor_data(args: dict) -> dict:
    return await _simple_handler("fetch_labor_data", args)


def _create_market_data_server():
    return create_sdk_mcp_server(
        name="market_data",
        version="1.0.0",
        tools=[
            sdk_fetch_market_data,
            sdk_get_stock_info,
            sdk_get_contract_info,
            sdk_fetch_options_chain,
            sdk_fetch_insider_activity,
            sdk_fetch_economic_data,
            sdk_fetch_earnings_calendar,
            sdk_fetch_company_news_feed,
            sdk_fetch_labor_data,
        ],
    )


# ═══════════════════════════════════════════════════════════════
# MCP Server: news
# ═══════════════════════════════════════════════════════════════

@tool("fetch_news",
      "Fetch latest financial news from Reuters, CNBC, Bloomberg, Seeking Alpha, etc.",
      {"category": str, "ticker": str, "limit": int})
async def sdk_fetch_news(args: dict) -> dict:
    return await _simple_handler("fetch_news", args)


@tool("search_news",
      "Search for news articles on any topic using Google News.",
      {"query": str, "limit": int})
async def sdk_search_news(args: dict) -> dict:
    return await _simple_handler("search_news", args)


@tool("query_prediction_markets",
      "Query prediction market odds from Polymarket and Kalshi.",
      {"query": str, "limit": int})
async def sdk_query_prediction_markets(args: dict) -> dict:
    return await _simple_handler("query_prediction_markets", args)


def _create_news_server():
    return create_sdk_mcp_server(
        name="news",
        version="1.0.0",
        tools=[
            sdk_fetch_news,
            sdk_search_news,
            sdk_query_prediction_markets,
        ],
    )


# ═══════════════════════════════════════════════════════════════
# MCP Server: backtesting (needs strategy generators via factory)
# ═══════════════════════════════════════════════════════════════

def _create_backtesting_server(
    strategy_gen: Callable,
    vbt_gen: Callable,
    pine_gen: Callable,
):
    """Factory: creates the backtesting MCP server with closures for generators."""

    @tool("run_backtest",
          "Generate a trading strategy from natural language and run a full backtest.",
          {"strategy_description": str, "symbol": str, "period": str, "interval": str,
           "initial_balance": float, "engine": str})
    async def sdk_run_backtest(args: dict) -> dict:
        return await _run_with_timeout(
            "run_backtest",
            handle_run_backtest(args, strategy_gen, vbt_gen),
        )

    @tool("run_parameter_sweep",
          "Run a vectorized parameter sweep using VectorBT — test thousands of combos in seconds.",
          {"strategy_description": str, "param_grid": dict, "symbol": str, "period": str,
           "interval": str, "optimization_metric": str, "initial_balance": float})
    async def sdk_run_parameter_sweep(args: dict) -> dict:
        return await _run_with_timeout(
            "run_parameter_sweep",
            handle_run_parameter_sweep(args, vbt_gen),
        )

    @tool("run_walk_forward",
          "Run walk-forward analysis — sequential IS/OOS optimization windows.",
          {"strategy_description": str, "param_grid": dict, "symbol": str, "period": str,
           "interval": str, "num_windows": int, "initial_balance": float})
    async def sdk_run_walk_forward(args: dict) -> dict:
        return await _run_with_timeout(
            "run_walk_forward",
            handle_run_walk_forward(args, strategy_gen),
        )

    @tool("run_preset_strategy",
          "Run a preset strategy backtest by ID (1-10) with auto Monte Carlo.",
          {"preset_id": int, "symbol": str, "interval": str, "initial_balance": float})
    async def sdk_run_preset_strategy(args: dict) -> dict:
        return await _run_with_timeout(
            "run_preset_strategy",
            handle_run_preset_strategy(args),
        )

    @tool("run_monte_carlo",
          "Run Monte Carlo simulation on backtest trade results to assess strategy robustness.",
          {"trade_pnls": list, "initial_balance": float, "num_simulations": int,
           "ruin_threshold_pct": float, "method": str})
    async def sdk_run_monte_carlo(args: dict) -> dict:
        return await _simple_handler("run_monte_carlo", args)

    @tool("analyze_trades",
          "Analyze trade patterns from a backtest — best/worst hours, days, MAE/MFE, setup quality.",
          {"trades": list, "symbol": str, "period": str, "interval": str})
    async def sdk_analyze_trades(args: dict) -> dict:
        return await _simple_handler("analyze_trades", args)

    @tool("generate_pinescript",
          "Generate PineScript v5 strategy/indicator for TradingView from natural language.",
          {"strategy_description": str, "script_type": str})
    async def sdk_generate_pinescript(args: dict) -> dict:
        return await _run_with_timeout(
            "generate_pinescript",
            handle_generate_pinescript(args, pine_gen),
        )

    return create_sdk_mcp_server(
        name="backtesting",
        version="1.0.0",
        tools=[
            sdk_run_backtest,
            sdk_run_parameter_sweep,
            sdk_run_walk_forward,
            sdk_run_preset_strategy,
            sdk_run_monte_carlo,
            sdk_analyze_trades,
            sdk_generate_pinescript,
        ],
    )


# ═══════════════════════════════════════════════════════════════
# MCP Server: strategies
# ═══════════════════════════════════════════════════════════════

@tool("list_saved_strategies",
      "List all saved strategies (newest first) with names, descriptions, and metrics.",
      {})
async def sdk_list_saved_strategies(args: dict) -> dict:
    return await _simple_handler("list_saved_strategies", args)


@tool("load_saved_strategy",
      "Load a saved strategy by filename with full code, parameters, and results.",
      {"filename": str})
async def sdk_load_saved_strategy(args: dict) -> dict:
    return await _simple_handler("load_saved_strategy", args)


@tool("list_preset_strategies",
      "List all 10 built-in preset strategies with names, categories, and parameters.",
      {})
async def sdk_list_preset_strategies(args: dict) -> dict:
    return await _simple_handler("list_preset_strategies", args)


@tool("get_backtest_history",
      "List past backtest runs with key metrics (win rate, profit factor, etc.).",
      {"limit": int})
async def sdk_get_backtest_history(args: dict) -> dict:
    return await _simple_handler("get_backtest_history", args)


@tool("get_trading_summary",
      "Get the user's trading account summary: positions, P&L, win rate, balance.",
      {})
async def sdk_get_trading_summary(args: dict) -> dict:
    return await _simple_handler("get_trading_summary", args)


@tool("query_trade_history",
      "Query the user's closed trade history with optional filters and computed analytics.",
      {"symbol": str, "source": str, "limit": int})
async def sdk_query_trade_history(args: dict) -> dict:
    return await _simple_handler("query_trade_history", args)


def _create_strategies_server():
    return create_sdk_mcp_server(
        name="strategies",
        version="1.0.0",
        tools=[
            sdk_list_saved_strategies,
            sdk_load_saved_strategy,
            sdk_list_preset_strategies,
            sdk_get_backtest_history,
            sdk_get_trading_summary,
            sdk_query_trade_history,
        ],
    )


# ═══════════════════════════════════════════════════════════════
# MCP Server: charting
# ═══════════════════════════════════════════════════════════════

@tool("create_chart_script",
      "Create a custom visual overlay on the user's chart (lines, boxes, zones, markers, labels).",
      {"name": str, "description": str, "elements": list, "generators": list})
async def sdk_create_chart_script(args: dict) -> dict:
    return await _simple_handler("create_chart_script", args)


@tool("manage_chart_scripts",
      "List, update, or delete chart scripts on the user's chart.",
      {"action": str, "script_name": str, "updates": dict})
async def sdk_manage_chart_scripts(args: dict) -> dict:
    return await _simple_handler("manage_chart_scripts", args)


@tool("apply_chart_snippet",
      "Apply a pre-built chart overlay from the snippet library (sessions, killzones, levels).",
      {"template": str, "color": str, "style": str, "visible": bool})
async def sdk_apply_chart_snippet(args: dict) -> dict:
    return await _simple_handler("apply_chart_snippet", args)


@tool("list_chart_snippets",
      "List all available pre-built chart overlay snippets with categories and descriptions.",
      {})
async def sdk_list_chart_snippets(args: dict) -> dict:
    return await _simple_handler("list_chart_snippets", args)


@tool("detect_chart_patterns",
      "Detect ICT / Smart Money patterns (FVG, order blocks, liquidity sweeps, BOS/CHoCH, swing points).",
      {"pattern_type": str, "symbol": str, "period": str, "interval": str,
       "swing_lookback": int, "min_gap_atr_ratio": float, "show_filled": bool,
       "impulse_atr_multiplier": float})
async def sdk_detect_chart_patterns(args: dict) -> dict:
    return await _simple_handler("detect_chart_patterns", args)


@tool("detect_key_levels",
      "Detect price levels (support/resistance, session levels, round numbers, VWAP bands).",
      {"level_type": str, "symbol": str, "period": str, "interval": str,
       "sensitivity": float, "min_touches": int, "sessions": list, "std_dev_bands": list})
async def sdk_detect_key_levels(args: dict) -> dict:
    return await _simple_handler("detect_key_levels", args)


@tool("detect_divergences",
      "Detect momentum divergences and volume patterns (RSI, MACD, volume profile, volume spikes).",
      {"pattern_type": str, "symbol": str, "period": str, "interval": str,
       "rsi_period": int, "divergence_type": str, "macd_fast": int, "macd_slow": int,
       "macd_signal": int, "volume_threshold": float, "num_bins": int, "lookback_bars": int})
async def sdk_detect_divergences(args: dict) -> dict:
    return await _simple_handler("detect_divergences", args)


def _create_charting_server():
    return create_sdk_mcp_server(
        name="charting",
        version="1.0.0",
        tools=[
            sdk_create_chart_script,
            sdk_manage_chart_scripts,
            sdk_apply_chart_snippet,
            sdk_list_chart_snippets,
            sdk_detect_chart_patterns,
            sdk_detect_key_levels,
            sdk_detect_divergences,
        ],
    )


# ═══════════════════════════════════════════════════════════════
# MCP Server: ui_control
# ═══════════════════════════════════════════════════════════════

@tool("control_ui",
      "Navigate the UI, change chart settings, switch intervals/symbols, toggle panels.",
      {"actions": list})
async def sdk_control_ui(args: dict) -> dict:
    return await _simple_handler("control_ui", args)


@tool("manage_holdings",
      "Add, edit, or remove positions/holdings in the user's portfolio.",
      {"action": str, "symbol": str, "side": str, "size": float,
       "entry_price": float, "stop_loss": float, "take_profit": float})
async def sdk_manage_holdings(args: dict) -> dict:
    return await _simple_handler("manage_holdings", args)


@tool("manage_alerts",
      "Create, toggle, or delete price/news alerts for the user.",
      {"action": str, "type": str, "symbol": str, "condition": str,
       "target_price": float, "keywords": list, "alert_id": str, "active": bool})
async def sdk_manage_alerts(args: dict) -> dict:
    return await _simple_handler("manage_alerts", args)


def _create_ui_control_server():
    return create_sdk_mcp_server(
        name="ui_control",
        version="1.0.0",
        tools=[
            sdk_control_ui,
            sdk_manage_holdings,
            sdk_manage_alerts,
        ],
    )


# ═══════════════════════════════════════════════════════════════
# Public API
# ═══════════════════════════════════════════════════════════════

# Map MCP-prefixed tool names back to bare names for SSE events
# e.g. "mcp__market_data__fetch_market_data" → "fetch_market_data"
_SERVER_TOOLS: Dict[str, List[str]] = {
    "market_data": [
        "fetch_market_data", "get_stock_info", "get_contract_info",
        "fetch_options_chain", "fetch_insider_activity", "fetch_economic_data",
        "fetch_earnings_calendar", "fetch_company_news_feed", "fetch_labor_data",
    ],
    "news": [
        "fetch_news", "search_news", "query_prediction_markets",
    ],
    "backtesting": [
        "run_backtest", "run_parameter_sweep", "run_walk_forward",
        "run_preset_strategy", "run_monte_carlo", "analyze_trades",
        "generate_pinescript",
    ],
    "strategies": [
        "list_saved_strategies", "load_saved_strategy", "list_preset_strategies",
        "get_backtest_history", "get_trading_summary", "query_trade_history",
    ],
    "charting": [
        "create_chart_script", "manage_chart_scripts", "apply_chart_snippet",
        "list_chart_snippets", "detect_chart_patterns", "detect_key_levels",
        "detect_divergences",
    ],
    "ui_control": [
        "control_ui", "manage_holdings", "manage_alerts",
    ],
}

# Build lookup maps
TOOL_NAME_MAP: Dict[str, str] = {}  # mcp__server__tool → tool
_ALL_ALLOWED: List[str] = []

for server_name, tool_names in _SERVER_TOOLS.items():
    for t in tool_names:
        mcp_name = f"mcp__{server_name}__{t}"
        TOOL_NAME_MAP[mcp_name] = t
        _ALL_ALLOWED.append(mcp_name)


def bare_tool_name(mcp_tool_name: str) -> str:
    """Strip MCP prefix: 'mcp__market_data__fetch_market_data' → 'fetch_market_data'.

    Returns the input unchanged if it's not an MCP-prefixed name.
    """
    return TOOL_NAME_MAP.get(mcp_tool_name, mcp_tool_name)


def get_all_allowed_tools() -> List[str]:
    """Return list of all MCP-prefixed tool names for ClaudeAgentOptions.allowed_tools."""
    return list(_ALL_ALLOWED)


def create_all_mcp_servers(
    strategy_gen: Callable,
    vbt_gen: Callable,
    pine_gen: Callable,
) -> Dict[str, Any]:
    """Create all 6 MCP servers with injected strategy generators.

    Args:
        strategy_gen: generate_strategy from strategy_agent.py
        vbt_gen: generate_vbt_strategy from strategy_agent.py
        pine_gen: generate_pinescript from strategy_agent.py

    Returns:
        Dict of server_name → MCP server object, ready for ClaudeAgentOptions.mcp_servers
    """
    return {
        "market_data": _create_market_data_server(),
        "news": _create_news_server(),
        "backtesting": _create_backtesting_server(strategy_gen, vbt_gen, pine_gen),
        "strategies": _create_strategies_server(),
        "charting": _create_charting_server(),
        "ui_control": _create_ui_control_server(),
    }
