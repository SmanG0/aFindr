"""Polygon.io data fetcher for historical and real-time market data.

Provides an alternative data source to Databento/yfinance,
supporting US equities and futures with REST API access.
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta
from typing import Optional, List, Dict

import pandas as pd

try:
    from polygon import RESTClient
    HAS_POLYGON = True
except ImportError:
    HAS_POLYGON = False

POLYGON_API_KEY = os.getenv("POLYGON_API_KEY", "")

# Polygon timespan mapping
INTERVAL_MAP = {
    "1m": ("minute", 1),
    "5m": ("minute", 5),
    "15m": ("minute", 15),
    "30m": ("minute", 30),
    "1h": ("hour", 1),
    "4h": ("hour", 4),
    "1d": ("day", 1),
    "1wk": ("week", 1),
}

# Period to days mapping
PERIOD_DAYS = {
    "5d": 5,
    "1mo": 30,
    "60d": 60,
    "6mo": 180,
    "1y": 365,
    "2y": 730,
    "5y": 1825,
}


def is_available() -> bool:
    """Check if Polygon.io is configured and available."""
    return HAS_POLYGON and bool(POLYGON_API_KEY)


async def fetch_polygon_ohlcv(
    symbol: str,
    period: str = "1y",
    interval: str = "1d",
) -> pd.DataFrame:
    """Fetch OHLCV data from Polygon.io.

    Args:
        symbol: Ticker symbol (e.g., "AAPL", "NQ=F").
                For futures, converts to Polygon format.
        period: How far back to fetch (5d, 60d, 1y, 2y).
        interval: Candle interval (1m, 5m, 15m, 30m, 1h, 4h, 1d, 1wk).

    Returns:
        DataFrame with columns: open, high, low, close, volume.
        Index is DatetimeIndex.
    """
    if not is_available():
        raise ImportError("Polygon.io client not available. Install with: pip install polygon-api-client")

    client = RESTClient(POLYGON_API_KEY)

    # Convert symbol format for Polygon
    poly_symbol = _convert_symbol(symbol)

    # Date range
    days = PERIOD_DAYS.get(period, 365)
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)

    # Interval mapping
    timespan, multiplier = INTERVAL_MAP.get(interval, ("day", 1))

    # Fetch aggregates
    aggs = client.get_aggs(
        ticker=poly_symbol,
        multiplier=multiplier,
        timespan=timespan,
        from_=start_date.strftime("%Y-%m-%d"),
        to=end_date.strftime("%Y-%m-%d"),
        limit=50000,
    )

    if not aggs:
        raise ValueError(f"No Polygon data for {symbol} ({poly_symbol})")

    # Convert to DataFrame
    rows = []
    for agg in aggs:
        rows.append({
            "timestamp": pd.Timestamp(agg.timestamp, unit="ms"),
            "open": float(agg.open),
            "high": float(agg.high),
            "low": float(agg.low),
            "close": float(agg.close),
            "volume": int(agg.volume),
        })

    df = pd.DataFrame(rows)
    df = df.set_index("timestamp").sort_index()
    df = df.dropna()

    return df


def _convert_symbol(symbol: str) -> str:
    """Convert our symbol format to Polygon.io format.

    Yahoo-style futures (NQ=F) -> Polygon futures (NQ) or stock tickers (AAPL).
    """
    # Futures mapping
    futures_map = {
        "NQ=F": "NQ",
        "MNQ=F": "MNQ",
        "ES=F": "ES",
        "GC=F": "GC",
        "CL=F": "CL",
    }

    if symbol in futures_map:
        return futures_map[symbol]

    # Stock tickers pass through as-is
    return symbol.upper()


async def fetch_polygon_quote(symbol: str) -> Optional[Dict]:
    """Fetch real-time quote from Polygon.io."""
    if not is_available():
        return None

    client = RESTClient(POLYGON_API_KEY)
    poly_symbol = _convert_symbol(symbol)

    try:
        snapshot = client.get_snapshot_ticker("stocks", poly_symbol)
        if not snapshot:
            return None

        return {
            "symbol": symbol,
            "price": float(snapshot.day.close) if snapshot.day else None,
            "change": float(snapshot.todaysChange) if snapshot.todaysChange else 0,
            "changePct": float(snapshot.todaysChangePerc) if snapshot.todaysChangePerc else 0,
            "volume": int(snapshot.day.volume) if snapshot.day else 0,
            "prevClose": float(snapshot.prev_day.close) if snapshot.prev_day else None,
        }
    except Exception:
        return None
