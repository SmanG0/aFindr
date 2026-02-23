"""Trading tools for Anthropic tool_use.

Defines tool schemas and handlers for the AI copilot.
Claude uses these tools to fetch data, run backtests, and get news.
"""
from __future__ import annotations

import json
from typing import Any

from data.fetcher import fetch_ohlcv
from data.contracts import get_contract_config, CONTRACTS
from data.news_fetcher import fetch_all_news
from data.stock_fetcher import fetch_stock_quote, fetch_analyst_ratings
from engine.backtester import Backtester, BacktestConfig
from agent.sandbox import validate_strategy_code, execute_strategy_code

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
            },
            "required": ["strategy_description"],
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


async def handle_run_backtest(args: dict, strategy_generator) -> str:
    """Handle run_backtest tool call.

    Uses a separate Claude call to generate strategy code from the description,
    then validates, compiles, and backtests it.
    """
    description = args["strategy_description"]
    symbol = args.get("symbol", "NQ=F")
    period = args.get("period", "1y")
    interval = args.get("interval", "1d")
    initial_balance = args.get("initial_balance", 50000)

    # Generate strategy code using the strategy generator function
    strategy_result = strategy_generator(description, [])
    if "error" in strategy_result:
        return json.dumps({"error": strategy_result.get("raw_response", "Failed to generate strategy")})

    code = strategy_result.get("code", "")

    # Validate
    is_valid, msg = validate_strategy_code(code)
    if not is_valid:
        return json.dumps({"error": f"Strategy validation failed: {msg}"})

    # Compile and run
    try:
        strategy_class = execute_strategy_code(code)
        strategy_instance = strategy_class(strategy_result.get("parameters", {}))
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
        bt = Backtester(strategy_instance, df, config)
        result = bt.run()
    except Exception as e:
        return json.dumps({"error": f"Backtest execution failed: {str(e)}"})

    return json.dumps({
        "strategy": {
            "name": strategy_result.get("name"),
            "description": strategy_result.get("description"),
            "parameters": strategy_result.get("parameters"),
            "code": code,
        },
        "metrics": result.metrics,
        "trade_count": len(result.trades),
        "trades": result.trades[:10],  # First 10 trades for context
        "equity_start": result.equity_curve[0]["value"] if result.equity_curve else initial_balance,
        "equity_end": result.equity_curve[-1]["value"] if result.equity_curve else initial_balance,
    })


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


# ─── Dispatcher ───

TOOL_HANDLERS = {
    "fetch_market_data": handle_fetch_market_data,
    "fetch_news": handle_fetch_news,
    "get_stock_info": handle_get_stock_info,
    "get_contract_info": handle_get_contract_info,
    # run_backtest is special — needs strategy_generator passed in
}
