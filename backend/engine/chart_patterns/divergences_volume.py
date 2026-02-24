"""Divergence and volume pattern detectors.

Detects: RSI divergence, MACD divergence, Volume Profile, Volume Spikes.
"""
from __future__ import annotations

from typing import List

import numpy as np
import pandas as pd

from ._types import ChartElement, ChartPatternResult
from ._utils import compute_rsi, compute_macd, detect_swing_points, ts_to_unix

MAX_ELEMENTS = 50


# ─── RSI Divergence ───

def detect_rsi_divergence(
    df: pd.DataFrame,
    rsi_period: int = 14,
    divergence_type: str = "all",
    swing_lookback: int = 5,
) -> ChartPatternResult:
    """Detect RSI divergences.

    Regular bearish: price makes Higher High but RSI makes Lower High (momentum weakening, potential drop).
    Regular bullish: price makes Lower Low but RSI makes Higher Low (selling pressure fading, potential rise).
    Hidden bearish: price makes Lower High but RSI makes Higher High (trend continuation down).
    Hidden bullish: price makes Higher Low but RSI makes Lower Low (trend continuation up).
    """
    closes = df["close"].values
    rsi = compute_rsi(closes, rsi_period)

    swings = detect_swing_points(df, lookback=swing_lookback, lookforward=swing_lookback)

    elements: List[ChartElement] = []
    div_count = 0
    timestamps = df.index

    # Get swing highs and lows with their RSI values
    swing_highs = [(sp, float(rsi[sp.index])) for sp in swings
                   if sp.type == "high" and not np.isnan(rsi[sp.index])]
    swing_lows = [(sp, float(rsi[sp.index])) for sp in swings
                  if sp.type == "low" and not np.isnan(rsi[sp.index])]

    # Check bearish divergences (comparing swing highs)
    if divergence_type in ("all", "regular"):
        for i in range(1, len(swing_highs)):
            sp_prev, rsi_prev = swing_highs[i - 1]
            sp_curr, rsi_curr = swing_highs[i]

            # Regular bearish: price HH, RSI LH
            if sp_curr.price > sp_prev.price and rsi_curr < rsi_prev:
                elements.extend(_make_divergence_elements(
                    sp_prev, sp_curr, timestamps, "RSI Bear Div",
                    "rgba(255,60,60,0.8)", div_count,
                ))
                div_count += 1

    if divergence_type in ("all", "hidden"):
        for i in range(1, len(swing_highs)):
            sp_prev, rsi_prev = swing_highs[i - 1]
            sp_curr, rsi_curr = swing_highs[i]

            # Hidden bearish: price LH, RSI HH
            if sp_curr.price < sp_prev.price and rsi_curr > rsi_prev:
                elements.extend(_make_divergence_elements(
                    sp_prev, sp_curr, timestamps, "Hidden Bear Div",
                    "rgba(255,160,0,0.8)", div_count,
                ))
                div_count += 1

    # Check bullish divergences (comparing swing lows)
    if divergence_type in ("all", "regular"):
        for i in range(1, len(swing_lows)):
            sp_prev, rsi_prev = swing_lows[i - 1]
            sp_curr, rsi_curr = swing_lows[i]

            # Regular bullish: price LL, RSI HL
            if sp_curr.price < sp_prev.price and rsi_curr > rsi_prev:
                elements.extend(_make_divergence_elements(
                    sp_prev, sp_curr, timestamps, "RSI Bull Div",
                    "rgba(0,200,100,0.8)", div_count,
                ))
                div_count += 1

    if divergence_type in ("all", "hidden"):
        for i in range(1, len(swing_lows)):
            sp_prev, rsi_prev = swing_lows[i - 1]
            sp_curr, rsi_curr = swing_lows[i]

            # Hidden bullish: price HL, RSI LL
            if sp_curr.price > sp_prev.price and rsi_curr < rsi_prev:
                elements.extend(_make_divergence_elements(
                    sp_prev, sp_curr, timestamps, "Hidden Bull Div",
                    "rgba(255,160,0,0.8)", div_count,
                ))
                div_count += 1

    if len(elements) > MAX_ELEMENTS:
        elements = elements[-MAX_ELEMENTS:]

    return ChartPatternResult(
        pattern_type="rsi_divergence",
        elements=elements,
        metadata={
            "total_detected": div_count,
            "displayed": len(elements),
            "capped": div_count > MAX_ELEMENTS,
            "params": {
                "rsi_period": rsi_period,
                "divergence_type": divergence_type,
            },
            "explanation": (
                "Divergences show when price and momentum disagree. "
                "Regular bearish = price rising but momentum fading (potential reversal down). "
                "Regular bullish = price falling but momentum recovering (potential reversal up). "
                "Hidden divergences signal trend continuation."
            ),
        },
    )


def _make_divergence_elements(
    sp1, sp2, timestamps, label: str, color: str, idx: int,
) -> List[ChartElement]:
    """Create marker + label elements for a divergence."""
    position = "aboveBar" if sp1.type == "high" else "belowBar"
    return [
        ChartElement(
            type="marker",
            id=f"div_{idx}_start",
            props={
                "time": sp1.timestamp,
                "position": position,
                "shape": "circle",
                "color": color,
                "text": label,
            },
        ),
        ChartElement(
            type="marker",
            id=f"div_{idx}_end",
            props={
                "time": sp2.timestamp,
                "position": position,
                "shape": "circle",
                "color": color,
                "text": label,
            },
        ),
    ]


# ─── MACD Divergence ───

def detect_macd_divergence(
    df: pd.DataFrame,
    macd_fast: int = 12,
    macd_slow: int = 26,
    macd_signal: int = 9,
    swing_lookback: int = 5,
) -> ChartPatternResult:
    """Detect MACD histogram divergences.

    Same logic as RSI divergence but uses MACD histogram peaks/troughs
    instead of RSI values. MACD measures the difference between fast and
    slow moving averages — divergence means the trend's acceleration is
    changing even though price keeps moving in the same direction.
    """
    closes = df["close"].values
    _, _, histogram = compute_macd(closes, macd_fast, macd_slow, macd_signal)

    swings = detect_swing_points(df, lookback=swing_lookback, lookforward=swing_lookback)
    timestamps = df.index

    elements: List[ChartElement] = []
    div_count = 0

    swing_highs = [(sp, float(histogram[sp.index])) for sp in swings
                   if sp.type == "high" and not np.isnan(histogram[sp.index])]
    swing_lows = [(sp, float(histogram[sp.index])) for sp in swings
                  if sp.type == "low" and not np.isnan(histogram[sp.index])]

    # Regular bearish: price HH, MACD histogram LH
    for i in range(1, len(swing_highs)):
        sp_prev, macd_prev = swing_highs[i - 1]
        sp_curr, macd_curr = swing_highs[i]

        if sp_curr.price > sp_prev.price and macd_curr < macd_prev:
            elements.extend(_make_divergence_elements(
                sp_prev, sp_curr, timestamps, "MACD Bear Div",
                "rgba(160,60,255,0.8)", div_count,
            ))
            div_count += 1

    # Regular bullish: price LL, MACD histogram HL
    for i in range(1, len(swing_lows)):
        sp_prev, macd_prev = swing_lows[i - 1]
        sp_curr, macd_curr = swing_lows[i]

        if sp_curr.price < sp_prev.price and macd_curr > macd_prev:
            elements.extend(_make_divergence_elements(
                sp_prev, sp_curr, timestamps, "MACD Bull Div",
                "rgba(160,60,255,0.8)", div_count,
            ))
            div_count += 1

    if len(elements) > MAX_ELEMENTS:
        elements = elements[-MAX_ELEMENTS:]

    return ChartPatternResult(
        pattern_type="macd_divergence",
        elements=elements,
        metadata={
            "total_detected": div_count,
            "displayed": len(elements),
            "capped": div_count > MAX_ELEMENTS,
            "params": {
                "macd_fast": macd_fast,
                "macd_slow": macd_slow,
                "macd_signal": macd_signal,
            },
            "explanation": (
                "MACD divergences show when the speed of price movement disagrees with the direction. "
                "Bearish = price still rising but the upward acceleration is slowing. "
                "Bullish = price still falling but the downward acceleration is slowing."
            ),
        },
    )


# ─── Volume Profile ───

def detect_volume_profile(
    df: pd.DataFrame,
    num_bins: int = 30,
    lookback_bars: int = 100,
    value_area_pct: int = 70,
) -> ChartPatternResult:
    """Compute Volume Profile — distribution of traded volume across price levels.

    Point of Control (POC): The price level where the most volume was traded.
    Value Area: The price range containing value_area_pct% of total volume.
    Prices near POC tend to act as magnets; VAH/VAL act like support/resistance.
    """
    df_slice = df.iloc[-lookback_bars:] if len(df) > lookback_bars else df

    closes = df_slice["close"].values
    volumes = df_slice["volume"].values.astype(float)
    highs = df_slice["high"].values
    lows = df_slice["low"].values
    timestamps = df_slice.index

    price_min = float(lows.min())
    price_max = float(highs.max())

    if price_max <= price_min:
        return ChartPatternResult(pattern_type="volume_profile", metadata={"error": "No price range"})

    bin_size = (price_max - price_min) / num_bins
    bins = np.zeros(num_bins)

    # Distribute each bar's volume across the price bins it spans
    for i in range(len(df_slice)):
        bar_low = lows[i]
        bar_high = highs[i]
        bar_vol = volumes[i]

        low_bin = max(0, int((bar_low - price_min) / bin_size))
        high_bin = min(num_bins - 1, int((bar_high - price_min) / bin_size))

        if high_bin >= low_bin:
            share = bar_vol / (high_bin - low_bin + 1)
            for b in range(low_bin, high_bin + 1):
                bins[b] += share

    # Find POC
    poc_bin = int(np.argmax(bins))
    poc_price = price_min + (poc_bin + 0.5) * bin_size

    # Find Value Area (expand from POC until value_area_pct% of volume)
    total_vol = bins.sum()
    target_vol = total_vol * value_area_pct / 100.0

    va_low_bin = poc_bin
    va_high_bin = poc_bin
    va_vol = bins[poc_bin]

    while va_vol < target_vol and (va_low_bin > 0 or va_high_bin < num_bins - 1):
        expand_up = bins[va_high_bin + 1] if va_high_bin < num_bins - 1 else 0
        expand_down = bins[va_low_bin - 1] if va_low_bin > 0 else 0

        if expand_up >= expand_down and va_high_bin < num_bins - 1:
            va_high_bin += 1
            va_vol += bins[va_high_bin]
        elif va_low_bin > 0:
            va_low_bin -= 1
            va_vol += bins[va_low_bin]
        else:
            va_high_bin = min(va_high_bin + 1, num_bins - 1)
            va_vol += bins[va_high_bin]

    vah = price_min + (va_high_bin + 1) * bin_size
    val = price_min + va_low_bin * bin_size

    t_start = ts_to_unix(timestamps[0])
    t_end = ts_to_unix(timestamps[-1])

    elements: List[ChartElement] = [
        # POC line
        ChartElement(
            type="hline",
            id="vp_poc",
            props={
                "price": round(poc_price, 2),
                "color": "rgba(255,180,0,0.9)",
                "width": 2,
                "style": "solid",
                "label": f"POC {poc_price:.2f}",
            },
        ),
        # VAH line
        ChartElement(
            type="hline",
            id="vp_vah",
            props={
                "price": round(vah, 2),
                "color": "rgba(255,180,0,0.5)",
                "width": 1,
                "style": "dashed",
                "label": f"VAH {vah:.2f}",
            },
        ),
        # VAL line
        ChartElement(
            type="hline",
            id="vp_val",
            props={
                "price": round(val, 2),
                "color": "rgba(255,180,0,0.5)",
                "width": 1,
                "style": "dashed",
                "label": f"VAL {val:.2f}",
            },
        ),
        # Value Area box
        ChartElement(
            type="box",
            id="vp_value_area",
            props={
                "timeStart": t_start,
                "timeEnd": t_end,
                "priceHigh": round(vah, 2),
                "priceLow": round(val, 2),
                "color": "rgba(255,180,0,0.5)",
                "opacity": 0.06,
                "label": f"Value Area ({value_area_pct}%)",
            },
        ),
    ]

    return ChartPatternResult(
        pattern_type="volume_profile",
        elements=elements,
        metadata={
            "poc_price": round(poc_price, 2),
            "vah": round(vah, 2),
            "val": round(val, 2),
            "value_area_pct": value_area_pct,
            "total_detected": len(elements),
            "displayed": len(elements),
            "params": {
                "num_bins": num_bins,
                "lookback_bars": lookback_bars,
                "value_area_pct": value_area_pct,
            },
            "explanation": (
                f"Volume Profile shows where the most trading activity happened. "
                f"POC (Point of Control) at {poc_price:.2f} is the most-traded price level — "
                f"it acts like a magnet pulling price back. "
                f"Value Area ({val:.2f} to {vah:.2f}) contains {value_area_pct}% of volume — "
                f"price tends to stay inside or return to this zone."
            ),
        },
    )


# ─── Volume Spikes ───

def detect_volume_spikes(
    df: pd.DataFrame,
    volume_threshold: float = 2.0,
    avg_period: int = 20,
) -> ChartPatternResult:
    """Detect bars with abnormally high volume.

    Flags bars where volume exceeds threshold_multiplier times the
    moving average volume. High-volume bars often signal institutional
    activity or important price levels being tested.
    """
    volumes = df["volume"].values.astype(float)
    closes = df["close"].values
    opens = df["open"].values
    timestamps = df.index
    n = len(df)

    # Compute rolling average volume
    avg_vol = np.full(n, np.nan)
    for i in range(avg_period, n):
        avg_vol[i] = np.mean(volumes[i - avg_period : i])

    elements: List[ChartElement] = []
    spike_count = 0

    for i in range(avg_period, n):
        if np.isnan(avg_vol[i]) or avg_vol[i] == 0:
            continue

        ratio = volumes[i] / avg_vol[i]
        if ratio >= volume_threshold:
            is_bullish = closes[i] >= opens[i]
            color = "rgba(0,200,100,0.8)" if is_bullish else "rgba(255,60,60,0.8)"

            elements.append(ChartElement(
                type="marker",
                id=f"vol_spike_{i}",
                props={
                    "time": ts_to_unix(timestamps[i]),
                    "position": "inBar",
                    "shape": "circle",
                    "color": color,
                    "text": f"{ratio:.1f}x",
                },
            ))
            spike_count += 1

    if len(elements) > MAX_ELEMENTS:
        elements = elements[-MAX_ELEMENTS:]

    return ChartPatternResult(
        pattern_type="volume_spikes",
        elements=elements,
        metadata={
            "total_detected": spike_count,
            "displayed": len(elements),
            "capped": spike_count > MAX_ELEMENTS,
            "params": {
                "volume_threshold": volume_threshold,
                "avg_period": avg_period,
            },
            "explanation": (
                f"Found {spike_count} bars with volume at least {volume_threshold}x the "
                f"{avg_period}-bar average. Green markers = buying pressure (price closed higher). "
                f"Red markers = selling pressure (price closed lower). "
                f"High-volume bars often mark significant institutional activity."
            ),
        },
    )
