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
from engine.backtester import Backtester, BacktestConfig
from engine.vbt_strategy import VectorBTStrategy
from engine.vbt_backtester import run_vbt_backtest, run_vbt_sweep, HAS_VBT
from engine.monte_carlo import run_monte_carlo
from engine.walk_forward import run_walk_forward
from engine.pattern_detector import analyze_trade_patterns
from engine.persistence import save_strategy, list_strategies, load_strategy
from engine.preset_strategies import PRESET_STRATEGIES
from agent.sandbox import validate_strategy_code, execute_strategy_code
from db import trades_repo, backtest_repo

# ─── Tool Definitions (Anthropic tool_use schema) ───

TOOLS = [
    {
        "name": "fetch_market_data",
        "description": "Fetch OHLCV candlestick data for a futures symbol. Available symbols: NQ=F (Nasdaq 100), ES=F (S&P 500), GC=F (Gold), CL=F (Crude Oil), MNQ=F (Micro Nasdaq). Returns recent candle data including open, high, low, close, volume.",
        "input_schema": {
            "type": "object",
            "properties": {
                "symbol": {
                    "type": "string",
                    "description": "The futures symbol, e.g. 'NQ=F', 'ES=F', 'GC=F', 'CL=F'",
                    "enum": list(CONTRACTS.keys()),
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
                    "default": 50000,
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
                    "default": 50000,
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
                    "default": 50000,
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
                    "default": 50000,
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
                    "default": 50000,
                },
            },
            "required": ["preset_id"],
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
    initial_balance = args.get("initial_balance", 50000)
    engine = args.get("engine", "auto")

    # Decide which generator to use
    use_vbt = (engine == "vectorbt") or (engine == "auto" and HAS_VBT and vbt_strategy_generator)

    if use_vbt and vbt_strategy_generator:
        gen_func = vbt_strategy_generator
    else:
        gen_func = strategy_generator
        use_vbt = False

    # Generate strategy code
    strategy_result = gen_func(description, [])
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
    initial_balance = args.get("initial_balance", 50000)

    if not HAS_VBT:
        return json.dumps({"error": "VectorBT is not installed. Cannot run parameter sweep."})

    # Generate VBT strategy code
    strategy_result = vbt_strategy_generator(description, [])
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
    result = pinescript_generator(prompt, [])

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
    initial_balance = args.get("initial_balance", 50000)
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
    initial_balance = args.get("initial_balance", 50000)

    # Generate strategy code
    strategy_result = strategy_generator(description, [])
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
    """Handle load_saved_strategy tool call."""
    filename = args["filename"]
    data = load_strategy(filename)
    if not data:
        return json.dumps({"error": f"Strategy not found: {filename}"})
    return json.dumps(data)


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
    initial_balance = args.get("initial_balance", 50000)

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
    # run_backtest, generate_pinescript, run_walk_forward, run_preset_strategy, run_parameter_sweep are special
}
