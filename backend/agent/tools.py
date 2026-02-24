"""Trading tools for Anthropic tool_use.

Defines tool schemas and handlers for the AI copilot.
Claude uses these tools to fetch data, run backtests, and get news.
"""
from __future__ import annotations

import asyncio
import json
from typing import Any

from data.fetcher import fetch_ohlcv
from data.contracts import get_contract_config, CONTRACTS
from data.news_fetcher import fetch_all_news
from data.stock_fetcher import fetch_stock_quote, fetch_analyst_ratings
from data.options_fetcher import fetch_options_chain, fetch_options_greeks
from data.edgar_fetcher import fetch_insider_trades, fetch_institutional_holdings
from data.finnhub_fetcher import fetch_insider_sentiment, fetch_earnings_calendar, fetch_company_news
from data.fred_fetcher import fetch_economic_indicator, fetch_treasury_yields, POPULAR_SERIES
from data.polymarket_fetcher import search_markets as poly_search, get_trending_markets as poly_trending
from data.kalshi_fetcher import search_markets as kalshi_search
from data.bls_fetcher import fetch_bls_indicator, POPULAR_SERIES as BLS_SERIES
from engine.backtester import Backtester, BacktestConfig
from engine.vbt_strategy import VectorBTStrategy
from engine.vbt_backtester import run_vbt_backtest, run_vbt_sweep, HAS_VBT
from engine.monte_carlo import run_monte_carlo
from engine.walk_forward import run_walk_forward
from engine.pattern_detector import analyze_trade_patterns
from engine.persistence import save_strategy, list_strategies, load_strategy
from engine.preset_strategies import PRESET_STRATEGIES
from engine.chart_patterns import (
    detect_fvg, detect_order_blocks, detect_liquidity_sweeps,
    detect_bos_choch, detect_swing_points_with_labels,
    detect_support_resistance, detect_session_levels,
    detect_round_numbers, detect_vwap_bands,
    detect_rsi_divergence, detect_macd_divergence,
    detect_volume_profile, detect_volume_spikes,
)
from agent.sandbox import validate_strategy_code, execute_strategy_code
from db import trades_repo, backtest_repo

# ─── Tool Definitions (Anthropic tool_use schema) ───

TOOLS = [
    {
        "name": "fetch_market_data",
        "description": "Fetch OHLCV candlestick data for any symbol — stocks (AAPL, NVDA), ETFs (SPY, QQQ), indices (^VIX), or futures (NQ=F, ES=F, GC=F, CL=F). Returns recent candle data including open, high, low, close, volume.",
        "input_schema": {
            "type": "object",
            "properties": {
                "symbol": {
                    "type": "string",
                    "description": "Any ticker symbol: stocks (AAPL, TSLA), ETFs (SPY, QQQ), futures (NQ=F, ES=F, GC=F, CL=F), or indices (^GSPC, ^VIX)",
                },
                "period": {
                    "type": "string",
                    "description": "How far back to fetch data",
                    "enum": ["5d", "60d", "1y", "2y"],
                    "default": "1y",
                },
                "interval": {
                    "type": "string",
                    "description": "Candle interval/timeframe",
                    "enum": ["1m", "5m", "15m", "30m", "1h", "4h", "1d", "1wk"],
                    "default": "1d",
                },
            },
            "required": ["symbol"],
        },
    },
    {
        "name": "fetch_news",
        "description": "Fetch latest financial news from Reuters, CNBC, Bloomberg, Seeking Alpha, Yahoo Finance, MarketWatch. Can filter by category or ticker symbol.",
        "input_schema": {
            "type": "object",
            "properties": {
                "category": {
                    "type": "string",
                    "description": "News category filter",
                    "enum": ["All", "Markets", "Futures", "Commodities", "Macro", "Earnings", "Bonds", "Global"],
                },
                "ticker": {
                    "type": "string",
                    "description": "Filter news for a specific ticker symbol, e.g. 'AAPL', 'NQ=F'",
                },
                "limit": {
                    "type": "integer",
                    "description": "Max number of articles to return (default 10)",
                    "default": 10,
                },
            },
        },
    },
    {
        "name": "get_stock_info",
        "description": "Get real-time stock quote, fundamentals (market cap, PE, EPS, etc.), and analyst ratings for a ticker symbol.",
        "input_schema": {
            "type": "object",
            "properties": {
                "ticker": {
                    "type": "string",
                    "description": "Stock ticker symbol, e.g. 'AAPL', 'MSFT', 'NVDA'",
                },
            },
            "required": ["ticker"],
        },
    },
    {
        "name": "run_backtest",
        "description": "Generate a trading strategy from a natural language description, validate it, and run a full backtest. Returns trade list, equity curve, and performance metrics (win rate, profit factor, max drawdown, etc.).",
        "input_schema": {
            "type": "object",
            "properties": {
                "strategy_description": {
                    "type": "string",
                    "description": "Natural language description of the trading strategy, e.g. 'Buy when RSI crosses above 30, sell when RSI crosses above 70, 50 point stop loss'",
                },
                "symbol": {
                    "type": "string",
                    "description": "Futures symbol to backtest on",
                    "enum": list(CONTRACTS.keys()),
                    "default": "NQ=F",
                },
                "period": {
                    "type": "string",
                    "description": "Historical period for backtest",
                    "enum": ["60d", "1y", "2y"],
                    "default": "1y",
                },
                "interval": {
                    "type": "string",
                    "description": "Candle interval for backtest",
                    "enum": ["5m", "15m", "30m", "1h", "4h", "1d"],
                    "default": "1d",
                },
                "initial_balance": {
                    "type": "number",
                    "description": "Starting account balance in USD",
                    "default": 25000,
                },
                "engine": {
                    "type": "string",
                    "description": "Backtesting engine to use. 'vectorbt' for vectorized (faster param sweeps), 'classic' for bar-by-bar (supports SL/TP). Default auto-detects.",
                    "enum": ["auto", "vectorbt", "classic"],
                    "default": "auto",
                },
            },
            "required": ["strategy_description"],
        },
    },
    {
        "name": "run_parameter_sweep",
        "description": "Run a vectorized parameter sweep using VectorBT. Tests thousands of parameter combinations in seconds. Returns performance metrics for each combo, best parameters, and heatmap data for 2-param sweeps.",
        "input_schema": {
            "type": "object",
            "properties": {
                "strategy_description": {
                    "type": "string",
                    "description": "Natural language description of the strategy to sweep",
                },
                "param_grid": {
                    "type": "object",
                    "description": "Parameter grid for sweep, e.g. {'fast_ema': [5, 10, 15, 20], 'slow_ema': [30, 40, 50, 60]}",
                },
                "symbol": {
                    "type": "string",
                    "description": "Futures symbol to test on",
                    "enum": list(CONTRACTS.keys()),
                    "default": "NQ=F",
                },
                "period": {
                    "type": "string",
                    "description": "Historical period",
                    "enum": ["60d", "1y", "2y"],
                    "default": "1y",
                },
                "interval": {
                    "type": "string",
                    "description": "Candle interval",
                    "enum": ["5m", "15m", "30m", "1h", "4h", "1d"],
                    "default": "1d",
                },
                "optimization_metric": {
                    "type": "string",
                    "description": "Metric to rank parameter combos by",
                    "enum": ["sharpe_ratio", "profit_factor", "total_return", "total_return_pct", "sortino_ratio", "calmar_ratio"],
                    "default": "sharpe_ratio",
                },
                "initial_balance": {
                    "type": "number",
                    "description": "Starting account balance",
                    "default": 25000,
                },
            },
            "required": ["strategy_description", "param_grid"],
        },
    },
    {
        "name": "generate_pinescript",
        "description": "Generate a complete PineScript v5 strategy or indicator for TradingView from a natural language description. Returns ready-to-paste PineScript code that the user can add to TradingView charts for backtesting and live trading signals.",
        "input_schema": {
            "type": "object",
            "properties": {
                "strategy_description": {
                    "type": "string",
                    "description": "Natural language description of the trading strategy or indicator. Be specific about entry/exit conditions, indicators, timeframes, and risk management.",
                },
                "script_type": {
                    "type": "string",
                    "description": "Type of PineScript to generate",
                    "enum": ["strategy", "indicator"],
                    "default": "strategy",
                },
            },
            "required": ["strategy_description"],
        },
    },
    {
        "name": "get_contract_info",
        "description": "Get contract specifications for a futures symbol (point value, tick size).",
        "input_schema": {
            "type": "object",
            "properties": {
                "symbol": {
                    "type": "string",
                    "description": "Futures symbol",
                    "enum": list(CONTRACTS.keys()),
                },
            },
            "required": ["symbol"],
        },
    },
    {
        "name": "run_monte_carlo",
        "description": "Run Monte Carlo simulation on backtest trade results. Supports 3 methods: reshuffle (permutation), resample (bootstrap), skip (randomly skip trades). Use 'full' to run all 3 and get a composite robustness grade (A+ through F). Use after running a backtest to assess strategy robustness.",
        "input_schema": {
            "type": "object",
            "properties": {
                "trade_pnls": {
                    "type": "array",
                    "items": {"type": "number"},
                    "description": "List of per-trade P&L values from a backtest",
                },
                "initial_balance": {
                    "type": "number",
                    "description": "Starting account balance",
                    "default": 25000,
                },
                "num_simulations": {
                    "type": "integer",
                    "description": "Number of simulations to run per method",
                    "default": 1000,
                },
                "ruin_threshold_pct": {
                    "type": "number",
                    "description": "Ruin = losing this % of initial balance (e.g. 50 = 50% loss)",
                    "default": 50,
                },
                "method": {
                    "type": "string",
                    "description": "Simulation method. 'full' runs all 3 and computes robustness grade.",
                    "enum": ["reshuffle", "resample", "skip", "full"],
                    "default": "full",
                },
            },
            "required": ["trade_pnls"],
        },
    },
    {
        "name": "run_walk_forward",
        "description": "Run walk-forward analysis on a strategy. Splits data into sequential in-sample/out-of-sample windows, optimizes parameters on in-sample, validates on out-of-sample. Returns per-window performance and robustness ratio (OOS/IS performance).",
        "input_schema": {
            "type": "object",
            "properties": {
                "strategy_description": {
                    "type": "string",
                    "description": "Natural language description of the strategy to walk-forward test",
                },
                "param_grid": {
                    "type": "object",
                    "description": "Parameter grid for optimization, e.g. {'rsi_period': [10, 14, 20], 'stop_loss': [30, 50, 70]}",
                },
                "symbol": {
                    "type": "string",
                    "description": "Futures symbol",
                    "enum": list(CONTRACTS.keys()),
                    "default": "NQ=F",
                },
                "period": {
                    "type": "string",
                    "description": "Historical period",
                    "enum": ["60d", "1y", "2y"],
                    "default": "2y",
                },
                "interval": {
                    "type": "string",
                    "description": "Candle interval",
                    "enum": ["5m", "15m", "30m", "1h", "4h", "1d"],
                    "default": "1d",
                },
                "num_windows": {
                    "type": "integer",
                    "description": "Number of IS/OOS windows",
                    "default": 5,
                },
                "initial_balance": {
                    "type": "number",
                    "description": "Starting account balance",
                    "default": 25000,
                },
            },
            "required": ["strategy_description", "param_grid"],
        },
    },
    {
        "name": "analyze_trades",
        "description": "Analyze trade patterns from a backtest — find best/worst entry hours, days, pre-entry conditions (ATR, momentum), setup quality scores, MAE/MFE analysis, and post-exit continuation. Use after running a backtest to understand what drives wins vs losses.",
        "input_schema": {
            "type": "object",
            "properties": {
                "trades": {
                    "type": "array",
                    "items": {"type": "object"},
                    "description": "Trade list from a backtest result",
                },
                "symbol": {
                    "type": "string",
                    "description": "Symbol the trades were on (to fetch price data)",
                    "enum": list(CONTRACTS.keys()),
                    "default": "NQ=F",
                },
                "period": {
                    "type": "string",
                    "description": "Period matching the backtest data",
                    "enum": ["60d", "1y", "2y"],
                    "default": "1y",
                },
                "interval": {
                    "type": "string",
                    "description": "Interval matching the backtest data",
                    "enum": ["5m", "15m", "30m", "1h", "4h", "1d"],
                    "default": "1d",
                },
            },
            "required": ["trades"],
        },
    },
    {
        "name": "list_saved_strategies",
        "description": "List all saved strategies (newest first). Returns name, description, symbol, interval, creation date, and whether backtest/Monte Carlo results are saved.",
        "input_schema": {
            "type": "object",
            "properties": {},
        },
    },
    {
        "name": "load_saved_strategy",
        "description": "Load a saved strategy by filename. Returns the full strategy including code, parameters, backtest metrics, and Monte Carlo results if available.",
        "input_schema": {
            "type": "object",
            "properties": {
                "filename": {
                    "type": "string",
                    "description": "The strategy filename to load",
                },
            },
            "required": ["filename"],
        },
    },
    {
        "name": "create_chart_script",
        "description": "Create a custom visual overlay on the user's chart. Supports vertical lines, horizontal price lines, boxes/zones, markers, text labels, shaded regions, and computed data lines. Use this for session markers, price levels, zones, annotations, and any visual element the user requests on their chart.",
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Display name for this chart script, e.g. 'NY Session Lines', 'Support/Resistance Zones'",
                },
                "description": {
                    "type": "string",
                    "description": "Brief description of what this script shows",
                },
                "elements": {
                    "type": "array",
                    "description": "Static visual elements to draw on the chart",
                    "items": {
                        "type": "object",
                        "properties": {
                            "type": {
                                "type": "string",
                                "enum": ["line", "hline", "vline", "box", "marker", "label", "shade"],
                                "description": "Element type",
                            },
                            "id": {
                                "type": "string",
                                "description": "Unique ID for this element",
                            },
                            "price": {"type": "number", "description": "Price level (for hline)"},
                            "time": {"type": "number", "description": "Unix timestamp (for vline, marker, label)"},
                            "timeStart": {"type": "number", "description": "Start time (for box, shade)"},
                            "timeEnd": {"type": "number", "description": "End time (for box, shade)"},
                            "priceHigh": {"type": "number", "description": "Upper price (for box)"},
                            "priceLow": {"type": "number", "description": "Lower price (for box)"},
                            "color": {"type": "string", "description": "CSS color, e.g. '#ff0000', 'rgba(255,0,0,0.5)'"},
                            "width": {"type": "number", "description": "Line width in pixels"},
                            "style": {"type": "string", "enum": ["solid", "dashed", "dotted"], "description": "Line style"},
                            "label": {"type": "string", "description": "Text label"},
                            "text": {"type": "string", "description": "Display text (for label, marker)"},
                            "position": {"type": "string", "enum": ["aboveBar", "belowBar", "inBar"], "description": "Marker position"},
                            "shape": {"type": "string", "enum": ["arrowUp", "arrowDown", "circle", "square"], "description": "Marker shape"},
                            "opacity": {"type": "number", "description": "Opacity 0-1 (for box, shade)"},
                            "fontSize": {"type": "number", "description": "Font size in pixels (for label)"},
                            "background": {"type": "string", "description": "Background color (for label)"},
                            "data": {
                                "type": "array",
                                "description": "Array of {time, value} points (for line type)",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "time": {"type": "number"},
                                        "value": {"type": "number"},
                                    },
                                },
                            },
                        },
                        "required": ["type", "id"],
                    },
                },
                "generators": {
                    "type": "array",
                    "description": "Dynamic generators that compute elements from candle data",
                    "items": {
                        "type": "object",
                        "properties": {
                            "type": {
                                "type": "string",
                                "enum": ["session_vlines", "prev_day_levels"],
                                "description": "Generator type",
                            },
                            "hour": {"type": "integer", "description": "Hour (0-23) for session_vlines"},
                            "minute": {"type": "integer", "description": "Minute (0-59) for session_vlines"},
                            "label": {"type": "string", "description": "Label text"},
                            "color": {"type": "string", "description": "CSS color"},
                            "width": {"type": "number", "description": "Line width"},
                            "style": {"type": "string", "enum": ["solid", "dashed", "dotted"]},
                        },
                        "required": ["type"],
                    },
                },
            },
            "required": ["name"],
        },
    },
    {
        "name": "get_trading_summary",
        "description": "Get the user's current trading account summary: open positions, recent closed trades, P&L overview, win rate, and account balance. Use when the user asks 'how am I doing?', 'show my account', 'what are my positions?', or any account status question.",
        "input_schema": {
            "type": "object",
            "properties": {},
        },
    },
    {
        "name": "query_trade_history",
        "description": "Query the user's closed trade history with optional filters. Returns trades and computed analytics (win rate, profit factor, P&L breakdown by symbol and day). Use when the user asks about specific trades, P&L on a symbol, or trading performance over time.",
        "input_schema": {
            "type": "object",
            "properties": {
                "symbol": {
                    "type": "string",
                    "description": "Filter trades by symbol, e.g. 'NQ=F', 'AAPL'",
                },
                "source": {
                    "type": "string",
                    "description": "Filter by trade source",
                    "enum": ["manual", "backtest", "strategy"],
                },
                "limit": {
                    "type": "integer",
                    "description": "Max trades to return (default 50)",
                    "default": 50,
                },
            },
        },
    },
    {
        "name": "get_backtest_history",
        "description": "List past backtest runs with their key metrics (win rate, profit factor, total return, trade count). Use when the user asks to compare backtests, review past strategy tests, or wants to see their backtest history.",
        "input_schema": {
            "type": "object",
            "properties": {
                "limit": {
                    "type": "integer",
                    "description": "Max runs to return (default 20)",
                    "default": 20,
                },
            },
        },
    },
    {
        "name": "list_preset_strategies",
        "description": "List all 10 built-in preset strategies with their names, descriptions, categories, default parameters, and recommended symbols. Use when the user asks what strategies are available, wants to try a preset, or says 'show me strategies'.",
        "input_schema": {
            "type": "object",
            "properties": {},
        },
    },
    {
        "name": "run_preset_strategy",
        "description": "Run a preset strategy backtest by ID (1-10). Instantly backtests the strategy with default parameters, runs Monte Carlo, and persists results. Much faster than run_backtest since no code generation is needed. Use when the user picks a preset or says 'run preset 3'.",
        "input_schema": {
            "type": "object",
            "properties": {
                "preset_id": {
                    "type": "integer",
                    "description": "Preset strategy ID (1-10)",
                    "enum": list(range(1, 11)),
                },
                "symbol": {
                    "type": "string",
                    "description": "Override the default symbol",
                    "enum": list(CONTRACTS.keys()),
                },
                "interval": {
                    "type": "string",
                    "description": "Override the default interval",
                    "enum": ["5m", "15m", "30m", "1h", "4h", "1d"],
                },
                "initial_balance": {
                    "type": "number",
                    "description": "Starting account balance",
                    "default": 25000,
                },
            },
            "required": ["preset_id"],
        },
    },
    # ─── Chart Pattern Detection Tools ───
    {
        "name": "detect_chart_patterns",
        "description": (
            "Detect ICT / Smart Money Concept patterns on price data and draw them on the chart. "
            "This tool does the math for you — just pick a pattern_type and it returns ready-to-render chart elements.\n\n"
            "Pattern types:\n"
            "- 'fvg': Fair Value Gaps — 3-bar price imbalances where the market moved so fast it left a gap. "
            "These gaps often get 'filled' (price returns to close them). Green = bullish gap (price jumped up), Red = bearish gap.\n"
            "- 'order_blocks': Order Blocks — the last opposing price bar before a strong move. "
            "These zones often cause price to bounce when revisited. Green = demand zone (price likely to bounce up), Red = supply zone.\n"
            "- 'liquidity_sweeps': Stop Hunts — price briefly pokes past a prior high/low to trigger stop orders, then reverses. "
            "Shows where institutional players grabbed liquidity.\n"
            "- 'bos_choch': Break of Structure / Change of Character — BOS = price continues the trend by breaking past a key level. "
            "CHoCH = price breaks against the trend, signaling a potential reversal.\n"
            "- 'swing_points': Swing Highs/Lows with labels — marks local peaks (swing highs) and valleys (swing lows), "
            "classifying them as HH (Higher High), HL (Higher Low), LH (Lower High), LL (Lower Low) to show trend structure."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "pattern_type": {
                    "type": "string",
                    "description": "Which pattern to detect",
                    "enum": ["fvg", "order_blocks", "liquidity_sweeps", "bos_choch", "swing_points"],
                },
                "symbol": {
                    "type": "string",
                    "description": "The futures symbol to analyze",
                    "enum": list(CONTRACTS.keys()),
                    "default": "NQ=F",
                },
                "period": {
                    "type": "string",
                    "description": "How far back to fetch data",
                    "enum": ["5d", "60d", "1y"],
                    "default": "60d",
                },
                "interval": {
                    "type": "string",
                    "description": "Candle interval/timeframe",
                    "enum": ["5m", "15m", "30m", "1h", "4h", "1d"],
                    "default": "15m",
                },
                "swing_lookback": {
                    "type": "integer",
                    "description": "Number of bars on each side to confirm a swing point (higher = fewer but stronger swings)",
                    "default": 5,
                },
                "min_gap_atr_ratio": {
                    "type": "number",
                    "description": "(FVG only) Minimum gap size as a ratio of average volatility. Higher = only show significant gaps.",
                    "default": 0.5,
                },
                "show_filled": {
                    "type": "boolean",
                    "description": "(FVG only) Whether to show gaps that have already been filled by subsequent price action",
                    "default": True,
                },
                "impulse_atr_multiplier": {
                    "type": "number",
                    "description": "(Order Blocks only) How strong the move must be to qualify (in multiples of average volatility)",
                    "default": 1.5,
                },
            },
            "required": ["pattern_type", "symbol"],
        },
    },
    {
        "name": "detect_key_levels",
        "description": (
            "Detect important price levels and draw them on the chart. "
            "These are prices where the market has historically reacted or where traders pay attention.\n\n"
            "Level types:\n"
            "- 'support_resistance': Cluster nearby swing points to find price levels that price has bounced off multiple times. "
            "Support (green) = price tends to stop falling here. Resistance (red) = price tends to stop rising here. "
            "The touch count shows how many times price reacted at that level.\n"
            "- 'session_levels': Show key prices from the previous trading session (day, week, or specific market hours). "
            "PDH/PDL = Previous Day High/Low, PDO/PDC = Previous Day Open/Close. These are levels day-traders watch closely.\n"
            "- 'round_numbers': Psychological price levels (e.g. 21000, 21500 for NQ). "
            "Traders naturally cluster orders at round numbers, creating self-fulfilling support/resistance.\n"
            "- 'vwap_bands': Volume-Weighted Average Price + standard deviation bands. "
            "VWAP = the average price weighted by how much was traded at each price. "
            "Price above VWAP = bullish bias, below = bearish. SD bands show overbought/oversold zones."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "level_type": {
                    "type": "string",
                    "description": "Which level type to detect",
                    "enum": ["support_resistance", "session_levels", "round_numbers", "vwap_bands"],
                },
                "symbol": {
                    "type": "string",
                    "description": "The futures symbol to analyze",
                    "enum": list(CONTRACTS.keys()),
                    "default": "NQ=F",
                },
                "period": {
                    "type": "string",
                    "description": "How far back to fetch data",
                    "enum": ["5d", "60d", "1y"],
                    "default": "60d",
                },
                "interval": {
                    "type": "string",
                    "description": "Candle interval/timeframe",
                    "enum": ["5m", "15m", "30m", "1h", "4h", "1d"],
                    "default": "15m",
                },
                "sensitivity": {
                    "type": "number",
                    "description": "(S/R only) How close prices must be to cluster into the same level (in multiples of volatility). Lower = more levels.",
                    "default": 1.0,
                },
                "min_touches": {
                    "type": "integer",
                    "description": "(S/R only) Minimum number of times price must touch a level to show it",
                    "default": 2,
                },
                "sessions": {
                    "type": "array",
                    "items": {"type": "string", "enum": ["previous_day", "previous_week", "asian", "london", "new_york"]},
                    "description": "(Session levels only) Which sessions to show levels for",
                    "default": ["previous_day"],
                },
                "std_dev_bands": {
                    "type": "array",
                    "items": {"type": "number"},
                    "description": "(VWAP only) Standard deviation multipliers for bands",
                    "default": [1.0, 2.0],
                },
            },
            "required": ["level_type", "symbol"],
        },
    },
    {
        "name": "detect_divergences",
        "description": (
            "Detect momentum divergences and volume patterns on price data. "
            "Divergences show when price direction and underlying momentum/volume disagree — "
            "a powerful signal that the current trend may be weakening or about to reverse.\n\n"
            "Pattern types:\n"
            "- 'rsi_divergence': RSI (Relative Strength Index) divergence — compares price peaks/troughs with RSI peaks/troughs. "
            "Bearish divergence = price making new highs but RSI shows weakening momentum (potential drop coming). "
            "Bullish divergence = price making new lows but RSI shows recovering momentum (potential bounce coming).\n"
            "- 'macd_divergence': MACD divergence — same concept but using MACD histogram which measures the difference between "
            "fast and slow moving averages. Shows changes in the speed/acceleration of the trend.\n"
            "- 'volume_profile': Shows how trading volume is distributed across price levels. "
            "Finds the POC (most-traded price — acts like a magnet) and Value Area (zone containing 70% of volume — price tends to stay here).\n"
            "- 'volume_spikes': Flags bars with abnormally high volume (e.g. 2x+ the average). "
            "High-volume bars often signal institutional activity and mark important turning points."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "pattern_type": {
                    "type": "string",
                    "description": "Which divergence/volume pattern to detect",
                    "enum": ["rsi_divergence", "macd_divergence", "volume_profile", "volume_spikes"],
                },
                "symbol": {
                    "type": "string",
                    "description": "The futures symbol to analyze",
                    "enum": list(CONTRACTS.keys()),
                    "default": "NQ=F",
                },
                "period": {
                    "type": "string",
                    "description": "How far back to fetch data",
                    "enum": ["5d", "60d", "1y"],
                    "default": "60d",
                },
                "interval": {
                    "type": "string",
                    "description": "Candle interval/timeframe",
                    "enum": ["5m", "15m", "30m", "1h", "4h", "1d"],
                    "default": "1h",
                },
                "rsi_period": {
                    "type": "integer",
                    "description": "(RSI only) RSI calculation period",
                    "default": 14,
                },
                "divergence_type": {
                    "type": "string",
                    "description": "(RSI only) Which divergences to show: 'regular' = trend reversal signals, 'hidden' = trend continuation signals, 'all' = both",
                    "enum": ["regular", "hidden", "all"],
                    "default": "all",
                },
                "macd_fast": {
                    "type": "integer",
                    "description": "(MACD only) Fast EMA period",
                    "default": 12,
                },
                "macd_slow": {
                    "type": "integer",
                    "description": "(MACD only) Slow EMA period",
                    "default": 26,
                },
                "macd_signal": {
                    "type": "integer",
                    "description": "(MACD only) Signal line EMA period",
                    "default": 9,
                },
                "volume_threshold": {
                    "type": "number",
                    "description": "(Volume spikes only) Volume must be this many times the average to flag (e.g. 2.0 = 2x average)",
                    "default": 2.0,
                },
                "num_bins": {
                    "type": "integer",
                    "description": "(Volume profile only) Number of price bins to divide the range into",
                    "default": 30,
                },
                "lookback_bars": {
                    "type": "integer",
                    "description": "(Volume profile only) Number of recent bars to analyze",
                    "default": 100,
                },
            },
            "required": ["pattern_type", "symbol"],
        },
    },
    # ─── Finance Data Tools ───
    {
        "name": "fetch_options_chain",
        "description": (
            "Fetch the options chain for a stock ticker. Returns calls and puts for the nearest "
            "expiration dates with strike prices, bid/ask, volume, open interest, and implied volatility. "
            "Optionally computes Black-Scholes Greeks (delta, gamma, theta, vega) from IV. "
            "Use when the user asks about options, IV, options flow, or specific strikes."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "ticker": {
                    "type": "string",
                    "description": "Stock ticker symbol (e.g. AAPL, TSLA, SPY)",
                },
                "include_greeks": {
                    "type": "boolean",
                    "description": "If true, compute Black-Scholes Greeks from IV (slower but more data)",
                    "default": False,
                },
                "expiration": {
                    "type": "string",
                    "description": "Specific expiration date (YYYY-MM-DD). If omitted, uses nearest expiration.",
                },
            },
            "required": ["ticker"],
        },
    },
    {
        "name": "fetch_insider_activity",
        "description": (
            "Fetch insider trading activity for a stock. Combines SEC EDGAR Form 4 filings "
            "(recent insider buys/sells with filing dates) and optionally Finnhub insider sentiment "
            "(monthly MSPR aggregates). Use when the user asks about insider buying/selling, "
            "Form 4 filings, or insider sentiment."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "ticker": {
                    "type": "string",
                    "description": "Stock ticker symbol",
                },
                "limit": {
                    "type": "integer",
                    "description": "Max insider transactions to return",
                    "default": 15,
                },
            },
            "required": ["ticker"],
        },
    },
    {
        "name": "fetch_economic_data",
        "description": (
            "Fetch macroeconomic data from FRED (Federal Reserve Economic Data). "
            "Supports GDP, CPI, Fed Funds Rate, unemployment, treasury yields, and 15+ other indicators. "
            "Use when the user asks about macro, economic conditions, interest rates, inflation, "
            "yield curve, or specific economic series.\n\n"
            "Quick shorthands: gdp, cpi, core_cpi, fed_funds, unemployment, pce, core_pce, "
            "m2, housing_starts, retail_sales, industrial_production, consumer_sentiment, "
            "initial_claims, t10y2y, vix.\n\n"
            "For treasury yield curve, use series_id='yield_curve' (fetches all maturities)."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "series_id": {
                    "type": "string",
                    "description": "FRED series ID or shorthand (e.g. 'gdp', 'cpi', 'fed_funds', 'yield_curve', or raw FRED ID like 'CPIAUCSL')",
                },
                "limit": {
                    "type": "integer",
                    "description": "Number of recent observations to return",
                    "default": 24,
                },
            },
            "required": ["series_id"],
        },
    },
    {
        "name": "fetch_earnings_calendar",
        "description": (
            "Fetch upcoming and recent earnings dates for a stock via Finnhub. "
            "Returns EPS estimates vs actuals, revenue estimates, and reporting time (BMO/AMC). "
            "Use when the user asks about earnings, 'when does X report?', or EPS estimates."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "ticker": {
                    "type": "string",
                    "description": "Stock ticker symbol",
                },
            },
            "required": ["ticker"],
        },
    },
    {
        "name": "fetch_company_news_feed",
        "description": (
            "Fetch recent company-specific news from Finnhub with headlines, sources, and summaries. "
            "Use when the user asks for recent news on a specific stock, or wants to know what's happening with a company."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "ticker": {
                    "type": "string",
                    "description": "Stock ticker symbol",
                },
                "days": {
                    "type": "integer",
                    "description": "Number of days back to search for news",
                    "default": 7,
                },
            },
            "required": ["ticker"],
        },
    },
    {
        "name": "search_news",
        "description": (
            "Search for news articles on any topic using Google News. "
            "Works for broad topics (tariffs, OPEC, Fed rate decision), "
            "specific companies (AAPL news), sectors (tech stocks), or events (earnings season). "
            "Use this when the user asks about news that isn't company-specific, "
            "or when fetch_company_news_feed doesn't find enough results."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Search query, e.g. 'tariffs trade war', 'OPEC oil production', 'Fed rate decision 2025'",
                },
                "limit": {
                    "type": "integer",
                    "description": "Max number of articles to return",
                    "default": 10,
                },
            },
            "required": ["query"],
        },
    },
    {
        "name": "query_prediction_markets",
        "description": (
            "Query prediction market odds from Polymarket and Kalshi. "
            "Returns market titles, outcome probabilities, volume, and links. "
            "Use when the user asks about prediction markets, odds, probabilities, "
            "betting markets, 'what are the chances of...', Fed rate odds, election odds, "
            "or any event contract pricing."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Search query, e.g. 'Fed rate cut', 'election', 'recession', 'bitcoin'",
                },
                "limit": {
                    "type": "integer",
                    "description": "Max number of markets to return per source",
                    "default": 5,
                },
            },
            "required": ["query"],
        },
    },
    {
        "name": "fetch_labor_data",
        "description": (
            "Fetch US labor market data from the Bureau of Labor Statistics (BLS). "
            "Provides CPI, unemployment rate, nonfarm payrolls, PPI, average hourly earnings, "
            "labor force participation rate, and more.\n\n"
            "Quick shorthands: cpi, core_cpi, unemployment, nonfarm_payrolls, ppi, "
            "avg_hourly_earnings, labor_force_participation, employment_population.\n\n"
            "Use when the user asks about jobs, labor market, BLS data, nonfarm payrolls, "
            "payroll numbers, wage growth, or labor statistics."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "indicator": {
                    "type": "string",
                    "description": "BLS indicator shorthand (e.g. 'unemployment', 'nonfarm_payrolls', 'cpi') or raw BLS series ID",
                },
                "years": {
                    "type": "integer",
                    "description": "Number of years of history to fetch (default 3, max 20)",
                    "default": 3,
                },
            },
            "required": ["indicator"],
        },
    },
]


# ─── Tool Handlers ───

async def handle_fetch_market_data(args: dict) -> str:
    """Handle fetch_market_data tool call."""
    symbol = args["symbol"]
    period = args.get("period", "1y")
    interval = args.get("interval", "1d")

    df = await fetch_ohlcv(symbol, period, interval)
    # Return last 20 candles as summary
    recent = df.tail(20)
    candles = []
    for ts, row in recent.iterrows():
        candles.append({
            "time": str(ts),
            "open": round(float(row["open"]), 2),
            "high": round(float(row["high"]), 2),
            "low": round(float(row["low"]), 2),
            "close": round(float(row["close"]), 2),
            "volume": int(row["volume"]),
        })

    return json.dumps({
        "symbol": symbol,
        "period": period,
        "interval": interval,
        "total_candles": len(df),
        "recent_candles": candles,
        "latest_close": candles[-1]["close"] if candles else None,
    })


async def handle_fetch_news(args: dict) -> str:
    """Handle fetch_news tool call."""
    category = args.get("category")
    ticker = args.get("ticker")
    limit = args.get("limit", 10)

    items = fetch_all_news(category=category, ticker=ticker, limit=limit)
    # Slim down for the LLM context
    slim_items = []
    for item in items:
        slim_items.append({
            "title": item["title"],
            "source": item["source"],
            "time": item["time"],
            "category": item["category"],
            "sentiment": item.get("sentiment", "neutral"),
            "ticker": item.get("ticker"),
            "summary": item.get("summary", "")[:200],
        })

    return json.dumps({"count": len(slim_items), "articles": slim_items})


async def handle_get_stock_info(args: dict) -> str:
    """Handle get_stock_info tool call."""
    ticker = args["ticker"]

    quote = fetch_stock_quote(ticker)
    if not quote:
        return json.dumps({"error": f"Could not fetch data for {ticker}"})

    ratings = fetch_analyst_ratings(ticker)
    quote["ratings"] = ratings[:5]
    return json.dumps(quote)


async def handle_run_backtest(args: dict, strategy_generator, vbt_strategy_generator=None) -> str:
    """Handle run_backtest tool call.

    Engine dispatcher: detects strategy type (VectorBT vs classic) and routes
    to the appropriate backtester. Both return the same BacktestResult format.
    """
    description = args["strategy_description"]
    symbol = args.get("symbol", "NQ=F")
    period = args.get("period", "1y")
    interval = args.get("interval", "1d")
    initial_balance = args.get("initial_balance", 25000)
    engine = args.get("engine", "auto")

    # Decide which generator to use
    use_vbt = (engine == "vectorbt") or (engine == "auto" and HAS_VBT and vbt_strategy_generator)

    if use_vbt and vbt_strategy_generator:
        gen_func = vbt_strategy_generator
    else:
        gen_func = strategy_generator
        use_vbt = False

    # Generate strategy code (run in thread to avoid blocking the event loop)
    strategy_result = await asyncio.to_thread(gen_func, description, [])
    if "error" in strategy_result:
        return json.dumps({"error": strategy_result.get("raw_response", "Failed to generate strategy")})

    code = strategy_result.get("code", "")

    # Validate
    is_valid, msg = validate_strategy_code(code)
    if not is_valid:
        return json.dumps({"error": f"Strategy validation failed: {msg}"})

    # Compile and detect strategy type
    try:
        strategy_class = execute_strategy_code(code)
        strategy_instance = strategy_class(strategy_result.get("parameters", {}))
    except Exception as e:
        return json.dumps({"error": f"Strategy compilation failed: {str(e)}"})

    # Auto-detect engine if not specified
    is_vbt_strategy = isinstance(strategy_instance, VectorBTStrategy)

    try:
        df = await fetch_ohlcv(symbol, period, interval)
        contract = get_contract_config(symbol)
        config = BacktestConfig(
            initial_balance=initial_balance,
            point_value=contract["point_value"],
            tick_size=contract["tick_size"],
        )

        if is_vbt_strategy and HAS_VBT:
            result = await asyncio.to_thread(run_vbt_backtest, strategy_instance, df, config)
        else:
            bt = Backtester(strategy_instance, df, config)
            result = await asyncio.to_thread(bt.run)
    except Exception as e:
        return json.dumps({"error": f"Backtest execution failed: {str(e)}"})

    # Auto-run Monte Carlo on trade results
    monte_carlo_data = None
    trade_pnls = [t["pnl"] for t in result.trades]
    if trade_pnls:
        try:
            mc = await asyncio.to_thread(run_monte_carlo, trade_pnls, initial_balance)
            monte_carlo_data = mc.to_dict()
        except Exception:
            pass

    # Auto-save strategy
    saved_filename = None
    try:
        saved_filename = save_strategy(
            name=strategy_result.get("name", "Unnamed Strategy"),
            description=strategy_result.get("description", ""),
            code=code,
            parameters=strategy_result.get("parameters", {}),
            backtest_metrics=result.metrics,
            monte_carlo=monte_carlo_data,
            symbol=symbol,
            interval=interval,
        )
    except Exception:
        pass

    # Persist backtest run + trades to DB
    backtest_run_id = None
    try:
        backtest_run_id = backtest_repo.insert_backtest_run(
            strategy_name=strategy_result.get("name", "Unnamed Strategy"),
            symbol=symbol,
            interval=interval,
            trades=result.trades,
            metrics=result.metrics,
            equity_curve=result.equity_curve,
            monte_carlo=monte_carlo_data,
            code=code,
            params=strategy_result.get("parameters"),
            initial_balance=initial_balance,
        )
    except Exception:
        pass

    return json.dumps({
        "strategy": {
            "name": strategy_result.get("name"),
            "description": strategy_result.get("description"),
            "parameters": strategy_result.get("parameters"),
            "code": code,
        },
        "metrics": result.metrics,
        "trade_count": len(result.trades),
        "trades": result.trades,
        "equity_curve": result.equity_curve,
        "monte_carlo": monte_carlo_data,
        "saved_filename": saved_filename,
        "backtest_run_id": backtest_run_id,
    })


async def handle_run_parameter_sweep(args: dict, vbt_strategy_generator) -> str:
    """Handle run_parameter_sweep tool call.

    Uses VectorBT to test thousands of parameter combos in seconds.
    """
    description = args["strategy_description"]
    param_grid = args["param_grid"]
    symbol = args.get("symbol", "NQ=F")
    period = args.get("period", "1y")
    interval = args.get("interval", "1d")
    optimization_metric = args.get("optimization_metric", "sharpe_ratio")
    initial_balance = args.get("initial_balance", 25000)

    if not HAS_VBT:
        return json.dumps({"error": "VectorBT is not installed. Cannot run parameter sweep."})

    # Generate VBT strategy code (run in thread to avoid blocking the event loop)
    strategy_result = await asyncio.to_thread(vbt_strategy_generator, description, [])
    if "error" in strategy_result:
        return json.dumps({"error": strategy_result.get("raw_response", "Failed to generate strategy")})

    code = strategy_result.get("code", "")
    is_valid, msg = validate_strategy_code(code)
    if not is_valid:
        return json.dumps({"error": f"Strategy validation failed: {msg}"})

    try:
        strategy_class = execute_strategy_code(code)
    except Exception as e:
        return json.dumps({"error": f"Strategy compilation failed: {str(e)}"})

    try:
        df = await fetch_ohlcv(symbol, period, interval)
        contract = get_contract_config(symbol)
        config = BacktestConfig(
            initial_balance=initial_balance,
            point_value=contract["point_value"],
            tick_size=contract["tick_size"],
        )
        sweep_result = await asyncio.to_thread(
            run_vbt_sweep,
            strategy_class=strategy_class,
            data=df,
            config=config,
            param_grid=param_grid,
            optimization_metric=optimization_metric,
        )

        return json.dumps({
            "total_combos": sweep_result.total_combos,
            "param_names": sweep_result.param_names,
            "best_params": sweep_result.best_params,
            "best_metrics": sweep_result.best_metrics,
            "heatmap_data": sweep_result.heatmap_data,
            "all_results": sweep_result.metrics[:50],  # Cap at 50 for context size
            "strategy": {
                "name": strategy_result.get("name"),
                "description": strategy_result.get("description"),
                "code": code,
            },
        })
    except Exception as e:
        return json.dumps({"error": f"Parameter sweep failed: {str(e)}"})


async def handle_generate_pinescript(args: dict, pinescript_generator) -> str:
    """Handle generate_pinescript tool call.

    Uses a separate Claude call to generate PineScript v5 code from description.
    """
    description = args["strategy_description"]
    script_type = args.get("script_type", "strategy")

    prompt = f"Generate a PineScript v5 {script_type}: {description}"
    result = await asyncio.to_thread(pinescript_generator, prompt, [])

    if "error" in result:
        return json.dumps({"error": result.get("raw_response", "Failed to generate PineScript")})

    return json.dumps({
        "name": result.get("name", "Custom Strategy"),
        "description": result.get("description", ""),
        "parameters": result.get("parameters", {}),
        "code": result.get("code", ""),
        "script_type": script_type,
    })


async def handle_get_contract_info(args: dict) -> str:
    """Handle get_contract_info tool call."""
    symbol = args["symbol"]
    config = get_contract_config(symbol)
    return json.dumps(config)


async def handle_run_monte_carlo(args: dict) -> str:
    """Handle run_monte_carlo tool call."""
    trade_pnls = args["trade_pnls"]
    initial_balance = args.get("initial_balance", 25000)
    num_simulations = args.get("num_simulations", 1000)
    ruin_threshold_pct = args.get("ruin_threshold_pct", 50)
    method = args.get("method", "full")

    if not trade_pnls:
        return json.dumps({"error": "No trade PnLs provided"})

    try:
        result = await asyncio.to_thread(
            run_monte_carlo,
            trade_pnls=trade_pnls,
            initial_balance=initial_balance,
            num_simulations=num_simulations,
            ruin_threshold_pct=ruin_threshold_pct,
            method=method,
        )
        return json.dumps(result.to_dict())
    except Exception as e:
        return json.dumps({"error": f"Monte Carlo failed: {str(e)}"})


async def handle_run_walk_forward(args: dict, strategy_generator) -> str:
    """Handle run_walk_forward tool call."""
    description = args["strategy_description"]
    param_grid = args["param_grid"]
    symbol = args.get("symbol", "NQ=F")
    period = args.get("period", "2y")
    interval = args.get("interval", "1d")
    num_windows = args.get("num_windows", 5)
    initial_balance = args.get("initial_balance", 25000)

    # Generate strategy code (run in thread to avoid blocking the event loop)
    strategy_result = await asyncio.to_thread(strategy_generator, description, [])
    if "error" in strategy_result:
        return json.dumps({"error": strategy_result.get("raw_response", "Failed to generate strategy")})

    code = strategy_result.get("code", "")
    is_valid, msg = validate_strategy_code(code)
    if not is_valid:
        return json.dumps({"error": f"Strategy validation failed: {msg}"})

    try:
        strategy_class = execute_strategy_code(code)
    except Exception as e:
        return json.dumps({"error": f"Strategy compilation failed: {str(e)}"})

    try:
        df = await fetch_ohlcv(symbol, period, interval)
        contract = get_contract_config(symbol)
        config = BacktestConfig(
            initial_balance=initial_balance,
            point_value=contract["point_value"],
            tick_size=contract["tick_size"],
        )
        result = await asyncio.to_thread(
            run_walk_forward,
            strategy_class=strategy_class,
            data=df,
            config=config,
            param_grid=param_grid,
            num_windows=num_windows,
        )

        # Persist walk-forward run + OOS trades
        try:
            wf_dict = result.to_dict()
            run_id = backtest_repo.insert_backtest_run(
                strategy_name=f"WF: {strategy_result.get('name', 'Walk-Forward')}",
                symbol=symbol,
                interval=interval,
                trades=wf_dict.get("oos_trades", []),
                metrics=wf_dict.get("aggregate_oos_metrics"),
                code=code,
                params={"param_grid": param_grid, "num_windows": num_windows},
                initial_balance=initial_balance,
                run_type="walk_forward",
            )
            backtest_repo.insert_walk_forward_result(
                backtest_run_id=run_id,
                num_windows=result.num_windows,
                is_ratio=result.is_ratio,
                robustness_ratio=result.robustness_ratio,
                windows=wf_dict.get("windows"),
                aggregate_oos_metrics=wf_dict.get("aggregate_oos_metrics"),
            )
        except Exception:
            pass

        return json.dumps(result.to_dict())
    except Exception as e:
        return json.dumps({"error": f"Walk-forward failed: {str(e)}"})


async def handle_analyze_trades(args: dict) -> str:
    """Handle analyze_trades tool call."""
    trades = args["trades"]
    symbol = args.get("symbol", "NQ=F")
    period = args.get("period", "1y")
    interval = args.get("interval", "1d")

    if not trades:
        return json.dumps({"error": "No trades provided"})

    try:
        df = await fetch_ohlcv(symbol, period, interval)
        result = await asyncio.to_thread(analyze_trade_patterns, trades, df)
        return json.dumps(result.to_dict())
    except Exception as e:
        return json.dumps({"error": f"Trade analysis failed: {str(e)}"})


async def handle_list_strategies(args: dict) -> str:
    """Handle list_saved_strategies tool call."""
    strategies = list_strategies()
    return json.dumps({"strategies": strategies, "count": len(strategies)})


async def handle_load_strategy(args: dict) -> str:
    """Handle load_saved_strategy tool call.

    Loads the saved strategy and re-runs its backtest to produce trades
    with timestamps for chart markers.
    """
    from agent.sandbox import validate_strategy_code, execute_strategy_code
    from engine.vbt_backtester import run_signals_backtest

    filename = args["filename"]
    data = load_strategy(filename)
    if not data:
        return json.dumps({"error": f"Strategy not found: {filename}"})

    code = data.get("code", "")
    params = data.get("parameters", {})
    symbol = data.get("symbol", "NQ=F")
    interval = data.get("interval", "1d")

    if not code:
        return json.dumps(data)

    valid, msg = validate_strategy_code(code)
    if not valid:
        return json.dumps({**data, "rerun_error": f"Code validation failed: {msg}"})

    try:
        strategy_class = execute_strategy_code(code)
        strategy_instance = strategy_class(params)

        df = await fetch_ohlcv(symbol, "1y", interval)
        contract = get_contract_config(symbol)
        config = BacktestConfig(
            initial_balance=25000,
            point_value=contract["point_value"],
            tick_size=contract["tick_size"],
        )

        is_vbt = isinstance(strategy_instance, VectorBTStrategy)
        if is_vbt and HAS_VBT:
            result = await asyncio.to_thread(run_vbt_backtest, strategy_instance, df, config)
        elif is_vbt:
            result = await asyncio.to_thread(run_signals_backtest, strategy_instance, df, config)
        else:
            bt = Backtester(strategy_instance, df, config)
            result = await asyncio.to_thread(bt.run)

        return json.dumps({
            "strategy": {"name": data.get("name", ""), "description": data.get("description", "")},
            "metrics": result.metrics,
            "trades": result.trades,
            "equity_curve": result.equity_curve,
            "trade_count": len(result.trades),
            "monte_carlo": data.get("monte_carlo"),
        }, default=str)
    except Exception as e:
        # Fallback: return metadata without trades
        return json.dumps({**data, "rerun_error": str(e)})


async def handle_create_chart_script(args: dict) -> str:
    """Handle create_chart_script tool call.

    Validates and wraps elements/generators into a ChartScript JSON object.
    The frontend will parse this and render it on the chart.
    """
    import uuid

    name = args.get("name", "Chart Script")
    description = args.get("description", "")
    elements = args.get("elements", [])
    generators = args.get("generators", [])

    script_id = f"cs_{uuid.uuid4().hex[:8]}"

    # Validate and normalize elements
    validated_elements = []
    for el in elements:
        el_type = el.get("type")
        if el_type not in ("line", "hline", "vline", "box", "marker", "label", "shade"):
            continue
        # Ensure each element has an id
        if not el.get("id"):
            el["id"] = f"{script_id}_{el_type}_{len(validated_elements)}"
        validated_elements.append(el)

    # Validate generators
    validated_generators = []
    for gen in generators:
        gen_type = gen.get("type")
        if gen_type not in ("session_vlines", "prev_day_levels"):
            continue
        validated_generators.append(gen)

    chart_script = {
        "id": script_id,
        "name": name,
        "visible": True,
        "elements": validated_elements,
        "generators": validated_generators,
    }

    return json.dumps({
        "chart_script": chart_script,
        "description": description,
    })


async def handle_get_trading_summary(args: dict) -> str:
    """Handle get_trading_summary tool call."""
    try:
        positions = trades_repo.get_open_positions()
        analytics = trades_repo.get_trade_analytics()
        recent_trades = trades_repo.get_trades(source="manual", limit=10)
        snapshots = trades_repo.get_account_snapshots(limit=1)

        latest_snapshot = snapshots[0] if snapshots else None

        return json.dumps({
            "account": {
                "balance": latest_snapshot["balance"] if latest_snapshot else None,
                "equity": latest_snapshot["equity"] if latest_snapshot else None,
                "unrealized_pnl": latest_snapshot["unrealized_pnl"] if latest_snapshot else None,
                "last_snapshot": latest_snapshot["timestamp"] if latest_snapshot else None,
            },
            "open_positions": positions,
            "position_count": len(positions),
            "analytics": analytics,
            "recent_trades": recent_trades,
        })
    except Exception as e:
        return json.dumps({"error": f"Failed to get trading summary: {str(e)}"})


async def handle_query_trade_history(args: dict) -> str:
    """Handle query_trade_history tool call."""
    try:
        symbol = args.get("symbol")
        source = args.get("source")
        limit = args.get("limit", 50)

        trade_list = trades_repo.get_trades(
            symbol=symbol, source=source, limit=limit,
        )
        analytics = trades_repo.get_trade_analytics(symbol=symbol)

        return json.dumps({
            "trades": trade_list,
            "trade_count": len(trade_list),
            "analytics": analytics,
        })
    except Exception as e:
        return json.dumps({"error": f"Failed to query trades: {str(e)}"})


async def handle_get_backtest_history(args: dict) -> str:
    """Handle get_backtest_history tool call."""
    try:
        limit = args.get("limit", 20)
        runs = backtest_repo.list_backtest_runs(limit=limit)

        return json.dumps({
            "backtest_runs": runs,
            "count": len(runs),
        })
    except Exception as e:
        return json.dumps({"error": f"Failed to get backtest history: {str(e)}"})


async def handle_list_preset_strategies(args: dict) -> str:
    """Handle list_preset_strategies tool call."""
    presets = []
    for p in PRESET_STRATEGIES:
        presets.append({
            "id": p["id"],
            "name": p["name"],
            "description": p["description"],
            "category": p["category"],
            "default_params": p["default_params"],
            "symbol": p["symbol"],
            "interval": p["interval"],
        })
    return json.dumps({"presets": presets, "count": len(presets)})


async def handle_run_preset_strategy(args: dict) -> str:
    """Handle run_preset_strategy tool call — run a preset backtest directly."""
    preset_id = args["preset_id"]
    initial_balance = args.get("initial_balance", 25000)

    preset = None
    for p in PRESET_STRATEGIES:
        if p["id"] == preset_id:
            preset = p
            break
    if not preset:
        return json.dumps({"error": f"Preset {preset_id} not found"})

    symbol = args.get("symbol", preset["symbol"])
    interval = args.get("interval", preset["interval"])

    try:
        strategy_instance = preset["class"](preset["default_params"])
        df = await fetch_ohlcv(symbol, "1y", interval)
        contract = get_contract_config(symbol)
        config = BacktestConfig(
            initial_balance=initial_balance,
            point_value=contract["point_value"],
            tick_size=contract["tick_size"],
        )
        bt = Backtester(strategy_instance, df, config)
        result = await asyncio.to_thread(bt.run)
    except Exception as e:
        return json.dumps({"error": f"Backtest failed: {str(e)}"})

    # Monte Carlo
    monte_carlo_data = None
    trade_pnls = [t["pnl"] for t in result.trades]
    if trade_pnls:
        try:
            mc = await asyncio.to_thread(run_monte_carlo, trade_pnls, initial_balance)
            monte_carlo_data = mc.to_dict()
        except Exception:
            pass

    # Persist
    backtest_run_id = None
    try:
        backtest_run_id = backtest_repo.insert_backtest_run(
            strategy_name=preset["name"],
            symbol=symbol,
            interval=interval,
            trades=result.trades,
            metrics=result.metrics,
            equity_curve=result.equity_curve,
            monte_carlo=monte_carlo_data,
            params=preset["default_params"],
            initial_balance=initial_balance,
            run_type="preset",
        )
    except Exception:
        pass

    return json.dumps({
        "preset_id": preset_id,
        "preset_name": preset["name"],
        "strategy": {
            "name": preset["name"],
            "description": preset["description"],
            "parameters": preset["default_params"],
        },
        "metrics": result.metrics,
        "trade_count": len(result.trades),
        "trades": result.trades,
        "equity_curve": result.equity_curve,
        "monte_carlo": monte_carlo_data,
        "backtest_run_id": backtest_run_id,
    })


# ─── Chart Pattern Handlers ───

# Dispatch tables for sub-commands
_CHART_PATTERN_DISPATCH = {
    "fvg": lambda df, args: detect_fvg(
        df,
        min_gap_atr_ratio=args.get("min_gap_atr_ratio", 0.5),
        show_filled=args.get("show_filled", True),
        swing_lookback=args.get("swing_lookback", 5),
    ),
    "order_blocks": lambda df, args: detect_order_blocks(
        df,
        impulse_atr_multiplier=args.get("impulse_atr_multiplier", 1.5),
        swing_lookback=args.get("swing_lookback", 5),
    ),
    "liquidity_sweeps": lambda df, args: detect_liquidity_sweeps(
        df,
        swing_lookback=args.get("swing_lookback", 5),
    ),
    "bos_choch": lambda df, args: detect_bos_choch(
        df,
        swing_lookback=args.get("swing_lookback", 5),
    ),
    "swing_points": lambda df, args: detect_swing_points_with_labels(
        df,
        lookback=args.get("swing_lookback", 5),
        lookforward=args.get("swing_lookback", 5),
    ),
}

_KEY_LEVEL_DISPATCH = {
    "support_resistance": lambda df, args: detect_support_resistance(
        df,
        sensitivity=args.get("sensitivity", 1.0),
        min_touches=args.get("min_touches", 2),
    ),
    "session_levels": lambda df, args: detect_session_levels(
        df,
        sessions=args.get("sessions", ["previous_day"]),
    ),
    "round_numbers": lambda df, args: detect_round_numbers(df),
    "vwap_bands": lambda df, args: detect_vwap_bands(
        df,
        std_dev_bands=args.get("std_dev_bands", [1.0, 2.0]),
    ),
}

_DIVERGENCE_DISPATCH = {
    "rsi_divergence": lambda df, args: detect_rsi_divergence(
        df,
        rsi_period=args.get("rsi_period", 14),
        divergence_type=args.get("divergence_type", "all"),
    ),
    "macd_divergence": lambda df, args: detect_macd_divergence(
        df,
        macd_fast=args.get("macd_fast", 12),
        macd_slow=args.get("macd_slow", 26),
        macd_signal=args.get("macd_signal", 9),
    ),
    "volume_profile": lambda df, args: detect_volume_profile(
        df,
        num_bins=args.get("num_bins", 30),
        lookback_bars=args.get("lookback_bars", 100),
    ),
    "volume_spikes": lambda df, args: detect_volume_spikes(
        df,
        volume_threshold=args.get("volume_threshold", 2.0),
    ),
}

# Pretty names for chart scripts
_PATTERN_NAMES = {
    "fvg": "Fair Value Gaps",
    "order_blocks": "Order Blocks",
    "liquidity_sweeps": "Liquidity Sweeps",
    "bos_choch": "BOS / CHoCH",
    "swing_points": "Swing Points",
    "support_resistance": "Support & Resistance",
    "session_levels": "Session Levels",
    "round_numbers": "Round Numbers",
    "vwap_bands": "VWAP Bands",
    "rsi_divergence": "RSI Divergence",
    "macd_divergence": "MACD Divergence",
    "volume_profile": "Volume Profile",
    "volume_spikes": "Volume Spikes",
}


async def _run_pattern_detection(args: dict, dispatch: dict, type_key: str) -> str:
    """Shared handler for all 3 pattern detection tools."""
    import uuid

    pattern_type = args.get(type_key)
    if not pattern_type or pattern_type not in dispatch:
        return json.dumps({"error": f"Unknown {type_key}: {pattern_type}. Valid: {list(dispatch.keys())}"})

    symbol = args.get("symbol", "NQ=F")
    period = args.get("period", "60d")
    interval = args.get("interval", "15m")

    try:
        df = await fetch_ohlcv(symbol, period, interval)
    except Exception as e:
        return json.dumps({"error": f"Failed to fetch data for {symbol}: {str(e)}"})

    try:
        result = await asyncio.to_thread(dispatch[pattern_type], df, args)
    except Exception as e:
        return json.dumps({"error": f"Pattern detection failed: {str(e)}"})

    script_id = f"cp_{uuid.uuid4().hex[:8]}"
    name = f"{_PATTERN_NAMES.get(pattern_type, pattern_type)} — {symbol} {interval}"
    chart_script = result.to_chart_script(name, script_id)

    return json.dumps({
        "chart_script": chart_script,
        "pattern_type": result.pattern_type,
        "metadata": result.metadata,
        "symbol": symbol,
        "interval": interval,
    })


async def handle_detect_chart_patterns(args: dict) -> str:
    """Handle detect_chart_patterns tool call."""
    return await _run_pattern_detection(args, _CHART_PATTERN_DISPATCH, "pattern_type")


async def handle_detect_key_levels(args: dict) -> str:
    """Handle detect_key_levels tool call."""
    return await _run_pattern_detection(args, _KEY_LEVEL_DISPATCH, "level_type")


async def handle_detect_divergences(args: dict) -> str:
    """Handle detect_divergences tool call."""
    return await _run_pattern_detection(args, _DIVERGENCE_DISPATCH, "pattern_type")


# ─── Finance Data Handlers ───

async def handle_fetch_options_chain(args: dict) -> str:
    """Handle fetch_options_chain tool call."""
    ticker = args["ticker"]
    include_greeks = args.get("include_greeks", False)
    expiration = args.get("expiration")

    try:
        if include_greeks:
            result = fetch_options_greeks(ticker, expiration)
        else:
            result = fetch_options_chain(ticker)
        return json.dumps(result)
    except Exception as e:
        return json.dumps({"error": f"Options fetch failed for {ticker}: {str(e)}"})


async def handle_fetch_insider_activity(args: dict) -> str:
    """Handle fetch_insider_activity tool call — combines EDGAR + Finnhub."""
    ticker = args["ticker"]
    limit = args.get("limit", 15)

    result: dict[str, Any] = {"ticker": ticker}

    # SEC EDGAR (always available, no key)
    try:
        edgar_data = fetch_insider_trades(ticker, limit=limit)
        result["edgar"] = edgar_data
    except Exception as e:
        result["edgar"] = {"error": str(e)}

    # Finnhub sentiment (optional, needs key)
    try:
        sentiment = fetch_insider_sentiment(ticker)
        result["sentiment"] = sentiment
    except Exception:
        result["sentiment"] = {"error": "Finnhub not available"}

    return json.dumps(result)


async def handle_fetch_economic_data(args: dict) -> str:
    """Handle fetch_economic_data tool call.

    Tries FRED first, falls back to free yfinance proxy ETFs/indices.
    """
    series_id = args["series_id"]
    limit = args.get("limit", 24)

    # Special case: yield curve
    if series_id.lower() == "yield_curve":
        try:
            result = fetch_treasury_yields()
            if not result.get("error"):
                return json.dumps(result)
        except Exception:
            pass
        # Fallback to free proxy
        from data.fred_fetcher import fetch_treasury_yields_free
        try:
            return json.dumps(fetch_treasury_yields_free())
        except Exception as e:
            return json.dumps({"error": f"Treasury yields fetch failed: {str(e)}"})

    # Try FRED first
    try:
        result = fetch_economic_indicator(series_id, limit=limit)
        if not result.get("error"):
            return json.dumps(result)
    except Exception:
        pass

    # Fallback to free yfinance proxy
    from data.fred_fetcher import fetch_economic_indicator_free
    try:
        result = fetch_economic_indicator_free(series_id, limit=limit)
        return json.dumps(result)
    except Exception as e:
        return json.dumps({"error": f"Economic data fetch failed for {series_id}: {str(e)}"})


async def handle_fetch_earnings_calendar(args: dict) -> str:
    """Handle fetch_earnings_calendar tool call.

    Tries Finnhub first, falls back to yfinance earnings_dates.
    """
    ticker = args["ticker"]

    # Try Finnhub first
    try:
        result = fetch_earnings_calendar(ticker)
        if result.get("earnings") and not result.get("error"):
            return json.dumps(result)
    except Exception:
        pass

    # Fallback to yfinance
    from data.stock_fetcher import fetch_earnings_dates_free
    try:
        result = fetch_earnings_dates_free(ticker)
        return json.dumps(result)
    except Exception as e:
        return json.dumps({"error": f"Earnings calendar fetch failed: {str(e)}"})


async def handle_fetch_company_news_feed(args: dict) -> str:
    """Handle fetch_company_news_feed tool call.

    Tries Finnhub first, falls back to yfinance news + Google News RSS.
    """
    ticker = args["ticker"]
    days = args.get("days", 7)

    # Try Finnhub first
    try:
        result = fetch_company_news(ticker, days=days)
        if result.get("news") and not result.get("error"):
            return json.dumps(result)
    except Exception:
        pass

    # Fallback: yfinance news
    from data.stock_fetcher import fetch_stock_news
    yf_result = fetch_stock_news(ticker)
    if yf_result.get("news"):
        return json.dumps(yf_result)

    # Last resort: Google News RSS
    from data.news_fetcher import fetch_google_news_rss
    google_articles = fetch_google_news_rss(f"{ticker} stock")
    if google_articles:
        return json.dumps({
            "ticker": ticker,
            "newsCount": len(google_articles),
            "news": [{"headline": a["title"], "source": a["source"], "url": a.get("url", ""), "summary": a.get("summary", "")} for a in google_articles],
            "source": "google_news",
        })

    return json.dumps({"ticker": ticker, "news": [], "newsCount": 0, "error": "No news sources available"})


async def handle_search_news(args: dict) -> str:
    """Handle search_news tool call — Google News RSS search for any topic."""
    query = args["query"]
    limit = args.get("limit", 10)

    from data.news_fetcher import fetch_google_news_rss
    articles = fetch_google_news_rss(query, limit=limit)

    if not articles:
        return json.dumps({"query": query, "articles": [], "count": 0, "error": "No results found"})

    slim = []
    for a in articles:
        slim.append({
            "title": a["title"],
            "source": a["source"],
            "time": a["time"],
            "sentiment": a.get("sentiment", "neutral"),
            "summary": a.get("summary", "")[:200],
            "url": a.get("url", ""),
        })

    return json.dumps({"query": query, "count": len(slim), "articles": slim})


async def handle_query_prediction_markets(args: dict) -> str:
    """Handle query_prediction_markets — queries Polymarket + Kalshi in parallel."""
    query = args["query"]
    limit = args.get("limit", 5)

    polymarket_results = []
    kalshi_results = []

    # Query both sources
    try:
        polymarket_results = poly_search(query, limit=limit)
    except Exception:
        pass

    try:
        kalshi_results = kalshi_search(query, limit=limit)
    except Exception:
        pass

    # If no results from search, try trending
    if not polymarket_results:
        try:
            polymarket_results = poly_trending(limit=limit)
        except Exception:
            pass

    markets = []
    for m in polymarket_results:
        markets.append(m)
    for m in kalshi_results:
        markets.append(m)

    return json.dumps({
        "query": query,
        "markets": markets,
        "polymarketCount": len(polymarket_results),
        "kalshiCount": len(kalshi_results),
        "totalCount": len(markets),
    })


async def handle_fetch_labor_data(args: dict) -> str:
    """Handle fetch_labor_data — fetches BLS labor statistics."""
    indicator = args["indicator"]
    years = min(args.get("years", 3), 20)

    try:
        result = fetch_bls_indicator(indicator, years=years)
        return json.dumps(result)
    except Exception as e:
        return json.dumps({"error": f"BLS data fetch failed for {indicator}: {str(e)}"})


# ─── Dispatcher ───

TOOL_HANDLERS = {
    "fetch_market_data": handle_fetch_market_data,
    "fetch_news": handle_fetch_news,
    "get_stock_info": handle_get_stock_info,
    "get_contract_info": handle_get_contract_info,
    "run_monte_carlo": handle_run_monte_carlo,
    "analyze_trades": handle_analyze_trades,
    "list_saved_strategies": handle_list_strategies,
    "load_saved_strategy": handle_load_strategy,
    "create_chart_script": handle_create_chart_script,
    "get_trading_summary": handle_get_trading_summary,
    "query_trade_history": handle_query_trade_history,
    "get_backtest_history": handle_get_backtest_history,
    "list_preset_strategies": handle_list_preset_strategies,
    "detect_chart_patterns": handle_detect_chart_patterns,
    "detect_key_levels": handle_detect_key_levels,
    "detect_divergences": handle_detect_divergences,
    "fetch_options_chain": handle_fetch_options_chain,
    "fetch_insider_activity": handle_fetch_insider_activity,
    "fetch_economic_data": handle_fetch_economic_data,
    "fetch_earnings_calendar": handle_fetch_earnings_calendar,
    "fetch_company_news_feed": handle_fetch_company_news_feed,
    "search_news": handle_search_news,
    "query_prediction_markets": handle_query_prediction_markets,
    "fetch_labor_data": handle_fetch_labor_data,
    # run_backtest, generate_pinescript, run_walk_forward, run_preset_strategy, run_parameter_sweep are special
}
