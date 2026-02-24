from __future__ import annotations

import os
import glob
from typing import Optional, List, Dict

import pandas as pd

# Directory containing Databento CSV files
DATA_DIR = os.path.join(os.path.dirname(__file__), "databento")

# Map frontend symbols to Databento file prefixes
SYMBOL_PREFIX = {
    "NQ=F": "nq",
    "MNQ=F": "nq",
    "ES=F": "es",
    "GC=F": "gc",
    "CL=F": "cl",
}

# Map interval strings to pandas resample rules
RESAMPLE_MAP = {
    "1m": "1min",
    "3m": "3min",
    "5m": "5min",
    "15m": "15min",
    "30m": "30min",
    "1h": "1h",
    "4h": "4h",
    "1d": "1D",
    "1wk": "1W",
}

# Cache loaded DataFrames in memory
_ohlcv_cache: Dict[str, pd.DataFrame] = {}
_tick_cache: Dict[str, pd.DataFrame] = {}


def _load_symbol_data(prefix: str) -> pd.DataFrame:
    """Load and concatenate all 1-min CSV files for a given symbol prefix."""
    if prefix in _ohlcv_cache:
        return _ohlcv_cache[prefix]

    pattern = os.path.join(DATA_DIR, f"{prefix}_*_1min.csv")
    files = sorted(glob.glob(pattern))

    if not files:
        raise ValueError(f"No Databento data found for prefix '{prefix}' in {DATA_DIR}")

    frames = []
    for f in files:
        df = pd.read_csv(
            f,
            parse_dates=["ts_event"],
            usecols=["ts_event", "open", "high", "low", "close", "volume"],
        )
        frames.append(df)

    combined = pd.concat(frames, ignore_index=True)
    combined = combined.sort_values("ts_event").drop_duplicates(subset=["ts_event"])
    combined = combined.set_index("ts_event")

    for col in ["open", "high", "low", "close"]:
        combined[col] = pd.to_numeric(combined[col], errors="coerce")
    combined["volume"] = pd.to_numeric(combined["volume"], errors="coerce").fillna(0).astype(int)
    combined = combined.dropna(subset=["open", "high", "low", "close"])

    _ohlcv_cache[prefix] = combined
    return combined


def _load_tick_data(prefix: str) -> pd.DataFrame:
    """Load tick (trades) data for a given symbol prefix.

    Returns empty DataFrame if no tick files exist (tick data is optional).
    """
    if prefix in _tick_cache:
        return _tick_cache[prefix]

    pattern = os.path.join(DATA_DIR, f"{prefix}_tick_*.csv")
    files = sorted(glob.glob(pattern))

    if not files:
        # Tick data is optional — return empty DataFrame instead of crashing
        empty = pd.DataFrame(columns=["price", "size", "side"])
        empty.index.name = "ts_event"
        _tick_cache[prefix] = empty
        return empty

    frames = []
    for f in files:
        df = pd.read_csv(
            f,
            usecols=["ts_event", "price", "size", "side"],
        )
        df["ts_event"] = pd.to_datetime(df["ts_event"], format="ISO8601", utc=True)
        frames.append(df)

    combined = pd.concat(frames, ignore_index=True)
    combined = combined.sort_values("ts_event")
    combined = combined.set_index("ts_event")

    combined["price"] = pd.to_numeric(combined["price"], errors="coerce")
    combined["size"] = pd.to_numeric(combined["size"], errors="coerce").fillna(0).astype(int)
    combined = combined.dropna(subset=["price"])

    _tick_cache[prefix] = combined
    return combined


def _resample(df: pd.DataFrame, rule: str) -> pd.DataFrame:
    """Resample 1-min OHLCV data to a higher timeframe."""
    if rule == "1min":
        return df

    resampled = df.resample(rule).agg({
        "open": "first",
        "high": "max",
        "low": "min",
        "close": "last",
        "volume": "sum",
    }).dropna(subset=["open"])

    return resampled


def _trim_by_period(df: pd.DataFrame, period: str) -> pd.DataFrame:
    """Trim DataFrame to the most recent N period of data."""
    if df.empty:
        return df

    end = df.index.max()

    period_map = {
        "1d": pd.Timedelta(days=1),
        "5d": pd.Timedelta(days=5),
        "1mo": pd.Timedelta(days=30),
        "3mo": pd.Timedelta(days=90),
        "6mo": pd.Timedelta(days=180),
        "60d": pd.Timedelta(days=60),
        "1y": pd.Timedelta(days=365),
        "2y": pd.Timedelta(days=730),
        "5y": pd.Timedelta(days=1825),
        "max": pd.Timedelta(days=99999),
    }

    delta = period_map.get(period, pd.Timedelta(days=365))
    start = end - delta

    return df[df.index >= start]


async def fetch_ohlcv(
    symbol: str,
    period: str = "1y",
    interval: str = "1d",
) -> pd.DataFrame:
    """Fetch OHLCV data from local Databento CSV files.

    Loads 1-minute data and resamples to the requested interval.
    Period parameter is used to trim the date range.
    """
    prefix = SYMBOL_PREFIX.get(symbol)
    if not prefix:
        raise ValueError(f"No Databento data mapping for symbol '{symbol}'")

    raw = _load_symbol_data(prefix)
    trimmed = _trim_by_period(raw, period)

    if trimmed.empty:
        raise ValueError(f"No data for {symbol} in period {period}")

    rule = RESAMPLE_MAP.get(interval, "1D")
    result = _resample(trimmed, rule)

    result.index.name = "timestamp"
    return result


async def fetch_ticks(
    symbol: str,
    date: Optional[str] = None,
    limit: int = 50000,
) -> List[Dict]:
    """Fetch tick data for a symbol, optionally filtered to a specific date.

    Returns list of {time, price, size, side} dicts.
    If date is provided (YYYY-MM-DD), returns only ticks for that date.
    """
    prefix = SYMBOL_PREFIX.get(symbol)
    if not prefix:
        raise ValueError(f"No Databento data mapping for symbol '{symbol}'")

    raw = _load_tick_data(prefix)

    if raw.empty:
        return []

    if date:
        # Filter to specific date
        target = pd.Timestamp(date).tz_localize("UTC")
        end_target = target + pd.Timedelta(days=1)
        filtered = raw.loc[target:end_target]
    else:
        # Return most recent data
        filtered = raw.tail(limit)

    # Limit to prevent memory issues
    if len(filtered) > limit:
        filtered = filtered.tail(limit)

    ticks = []
    for ts, row in filtered.iterrows():
        ticks.append({
            "time": ts.timestamp(),
            "price": round(float(row["price"]), 2),
            "size": int(row["size"]),
            "side": str(row["side"]),
        })

    return ticks
