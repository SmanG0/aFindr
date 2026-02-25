"""Shared utilities for chart pattern detection.

Reusable across ICT patterns, key levels, and divergence/volume detectors.
All functions operate on pandas DataFrames with columns: open, high, low, close, volume.
"""
from __future__ import annotations

from typing import List, Tuple

import numpy as np
import pandas as pd

from ._types import SwingPoint


# ─── Timestamp Conversion ───

def ts_to_unix(ts) -> int:
    """Convert a pandas Timestamp (or similar) to Unix seconds (int)."""
    if isinstance(ts, (int, float)):
        return int(ts)
    if hasattr(ts, "timestamp"):
        return int(ts.timestamp())
    return int(pd.Timestamp(ts).timestamp())


# ─── Swing Point Detection ───

def detect_swing_points(
    df: pd.DataFrame,
    lookback: int = 5,
    lookforward: int = 5,
) -> List[SwingPoint]:
    """Detect swing highs and lows with configurable lookback/lookforward.

    A swing high at bar i means high[i] is the highest high in
    [i - lookback, i + lookforward].  Swing low is analogous with lows.

    Returns SwingPoints sorted by index, with HH/HL/LH/LL classification.
    """
    highs = df["high"].values
    lows = df["low"].values
    n = len(df)
    timestamps = df.index

    swings: List[SwingPoint] = []

    for i in range(lookback, n - lookforward):
        # Swing high check
        window_highs = highs[i - lookback : i + lookforward + 1]
        if highs[i] == window_highs.max() and np.sum(window_highs == highs[i]) == 1:
            swings.append(SwingPoint(
                index=i,
                price=float(highs[i]),
                timestamp=ts_to_unix(timestamps[i]),
                type="high",
            ))

        # Swing low check
        window_lows = lows[i - lookback : i + lookforward + 1]
        if lows[i] == window_lows.min() and np.sum(window_lows == lows[i]) == 1:
            swings.append(SwingPoint(
                index=i,
                price=float(lows[i]),
                timestamp=ts_to_unix(timestamps[i]),
                type="low",
            ))

    # Classify HH/HL/LH/LL
    _classify_swings(swings)
    return swings


def _classify_swings(swings: List[SwingPoint]) -> None:
    """Classify swings as HH, HL, LH, LL based on sequence."""
    prev_high: float | None = None
    prev_low: float | None = None

    for sp in swings:
        if sp.type == "high":
            if prev_high is not None:
                sp.classification = "HH" if sp.price > prev_high else "LH"
            else:
                sp.classification = "HH"  # First swing high
            prev_high = sp.price
        else:
            if prev_low is not None:
                sp.classification = "HL" if sp.price > prev_low else "LL"
            else:
                sp.classification = "HL"  # First swing low
            prev_low = sp.price


# ─── Technical Indicators (vectorized) ───

def compute_atr(df: pd.DataFrame, period: int = 14) -> np.ndarray:
    """Compute Average True Range (Wilder's smoothing).

    Returns numpy array of length len(df).  First `period` values are NaN.
    """
    high = df["high"].values.astype(float)
    low = df["low"].values.astype(float)
    close = df["close"].values.astype(float)

    tr = np.empty(len(df))
    tr[0] = high[0] - low[0]
    for i in range(1, len(df)):
        tr[i] = max(
            high[i] - low[i],
            abs(high[i] - close[i - 1]),
            abs(low[i] - close[i - 1]),
        )

    atr = np.full(len(df), np.nan)
    atr[period - 1] = np.mean(tr[:period])
    for i in range(period, len(df)):
        atr[i] = (atr[i - 1] * (period - 1) + tr[i]) / period
    return atr


def compute_rsi(closes: np.ndarray, period: int = 14) -> np.ndarray:
    """Compute RSI using Wilder's smoothing.

    Returns numpy array same length as closes.  First `period` values are NaN.
    """
    closes = closes.astype(float)
    deltas = np.diff(closes)
    gains = np.where(deltas > 0, deltas, 0.0)
    losses = np.where(deltas < 0, -deltas, 0.0)

    rsi = np.full(len(closes), np.nan)

    avg_gain = np.mean(gains[:period])
    avg_loss = np.mean(losses[:period])

    if avg_loss == 0:
        rsi[period] = 100.0
    else:
        rs = avg_gain / avg_loss
        rsi[period] = 100.0 - 100.0 / (1.0 + rs)

    for i in range(period, len(deltas)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period
        if avg_loss == 0:
            rsi[i + 1] = 100.0
        else:
            rs = avg_gain / avg_loss
            rsi[i + 1] = 100.0 - 100.0 / (1.0 + rs)

    return rsi


def compute_macd(
    closes: np.ndarray,
    fast: int = 12,
    slow: int = 26,
    signal: int = 9,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Compute MACD line, signal line, and histogram.

    Returns (macd, signal_line, histogram) as numpy arrays.
    """
    closes = closes.astype(float)

    def ema(data: np.ndarray, span: int) -> np.ndarray:
        result = np.full(len(data), np.nan)
        alpha = 2.0 / (span + 1)
        result[span - 1] = np.mean(data[:span])
        for i in range(span, len(data)):
            result[i] = alpha * data[i] + (1 - alpha) * result[i - 1]
        return result

    fast_ema = ema(closes, fast)
    slow_ema = ema(closes, slow)

    macd_line = fast_ema - slow_ema

    # Signal line: EMA of MACD line (starting from where MACD is valid)
    signal_line = np.full(len(closes), np.nan)
    # Find first valid MACD value
    valid_start = slow - 1
    valid_macd = macd_line[valid_start:]

    if len(valid_macd) >= signal:
        sig = ema(valid_macd, signal)
        signal_line[valid_start:] = sig

    histogram = macd_line - signal_line
    return macd_line, signal_line, histogram


def compute_vwap(df: pd.DataFrame) -> np.ndarray:
    """Compute cumulative VWAP from the start of the data.

    Returns numpy array of VWAP values.
    """
    tp = (df["high"].values + df["low"].values + df["close"].values) / 3.0
    vol = df["volume"].values.astype(float)

    cum_tp_vol = np.cumsum(tp * vol)
    cum_vol = np.cumsum(vol)

    # Avoid division by zero
    with np.errstate(divide="ignore", invalid="ignore"):
        vwap = np.where(cum_vol > 0, cum_tp_vol / cum_vol, np.nan)
    return vwap
