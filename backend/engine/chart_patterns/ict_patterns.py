"""ICT / Smart Money Concept pattern detectors.

Detects: Fair Value Gaps, Order Blocks, Liquidity Sweeps,
Break of Structure / Change of Character, and Swing Points.
"""
from __future__ import annotations

from typing import List

import numpy as np
import pandas as pd

from ._types import ChartElement, ChartPatternResult, SwingPoint
from ._utils import compute_atr, detect_swing_points, ts_to_unix

MAX_ELEMENTS = 50


# ─── Fair Value Gaps ───

def detect_fvg(
    df: pd.DataFrame,
    min_gap_atr_ratio: float = 0.5,
    show_filled: bool = True,
    max_age_bars: int = 100,
    swing_lookback: int = 5,
) -> ChartPatternResult:
    """Detect Fair Value Gaps (3-candle imbalances).

    Bullish FVG: candle[i-2].high < candle[i].low  (gap up)
    Bearish FVG: candle[i-2].low  > candle[i].high (gap down)
    """
    atr = compute_atr(df, 14)
    highs = df["high"].values
    lows = df["low"].values
    timestamps = df.index
    n = len(df)

    # Limit scan range
    start = max(2, n - max_age_bars)

    elements: List[ChartElement] = []
    fvg_count = 0

    for i in range(start, n):
        if np.isnan(atr[i]):
            continue

        # Bullish FVG
        gap = lows[i] - highs[i - 2]
        if gap > min_gap_atr_ratio * atr[i]:
            top = float(lows[i])
            bottom = float(highs[i - 2])
            t_start = ts_to_unix(timestamps[i - 2])
            t_end = ts_to_unix(timestamps[min(i + 10, n - 1)])

            # Check fill status
            filled = False
            if show_filled:
                for j in range(i + 1, n):
                    if lows[j] <= bottom:
                        filled = True
                        t_end = ts_to_unix(timestamps[j])
                        break

            opacity = 0.06 if filled else 0.15
            label = "FVG (filled)" if filled else "FVG"

            elements.append(ChartElement(
                type="box",
                id=f"fvg_bull_{i}",
                props={
                    "timeStart": t_start,
                    "timeEnd": t_end,
                    "priceHigh": top,
                    "priceLow": bottom,
                    "color": "rgba(0,200,100,1)",
                    "opacity": opacity,
                    "label": label,
                },
            ))
            fvg_count += 1

        # Bearish FVG
        gap = lows[i - 2] - highs[i]
        if gap > min_gap_atr_ratio * atr[i]:
            top = float(lows[i - 2])
            bottom = float(highs[i])
            t_start = ts_to_unix(timestamps[i - 2])
            t_end = ts_to_unix(timestamps[min(i + 10, n - 1)])

            filled = False
            if show_filled:
                for j in range(i + 1, n):
                    if highs[j] >= top:
                        filled = True
                        t_end = ts_to_unix(timestamps[j])
                        break

            opacity = 0.06 if filled else 0.15
            label = "FVG (filled)" if filled else "FVG"

            elements.append(ChartElement(
                type="box",
                id=f"fvg_bear_{i}",
                props={
                    "timeStart": t_start,
                    "timeEnd": t_end,
                    "priceHigh": top,
                    "priceLow": bottom,
                    "color": "rgba(255,60,60,1)",
                    "opacity": opacity,
                    "label": label,
                },
            ))
            fvg_count += 1

    # Cap elements
    if len(elements) > MAX_ELEMENTS:
        elements = elements[-MAX_ELEMENTS:]

    return ChartPatternResult(
        pattern_type="fvg",
        elements=elements,
        metadata={
            "total_detected": fvg_count,
            "displayed": len(elements),
            "capped": fvg_count > MAX_ELEMENTS,
            "params": {
                "min_gap_atr_ratio": min_gap_atr_ratio,
                "show_filled": show_filled,
                "max_age_bars": max_age_bars,
            },
        },
    )


# ─── Order Blocks ───

def detect_order_blocks(
    df: pd.DataFrame,
    impulse_atr_multiplier: float = 1.5,
    impulse_candle_count: int = 3,
    swing_lookback: int = 5,
) -> ChartPatternResult:
    """Detect Order Blocks — last opposing candle before an impulse move.

    Bullish OB: Last red candle before a strong up-move >= impulse_atr_multiplier * ATR.
    Bearish OB: Last green candle before a strong down-move.
    """
    atr = compute_atr(df, 14)
    opens = df["open"].values
    closes = df["close"].values
    highs = df["high"].values
    lows = df["low"].values
    timestamps = df.index
    n = len(df)

    elements: List[ChartElement] = []
    ob_count = 0

    for i in range(impulse_candle_count, n - 1):
        if np.isnan(atr[i]):
            continue

        # Measure impulse move over impulse_candle_count bars
        move_up = highs[i] - lows[i - impulse_candle_count]
        move_down = lows[i - impulse_candle_count] - highs[i]
        threshold = impulse_atr_multiplier * atr[i]

        # Bullish OB: strong up-move, find last red candle before it
        if move_up >= threshold:
            for k in range(i, max(i - impulse_candle_count - 1, 0) - 1, -1):
                if closes[k] < opens[k]:  # Red candle
                    ob_high = float(highs[k])
                    ob_low = float(lows[k])
                    t_start = ts_to_unix(timestamps[k])
                    t_end = ts_to_unix(timestamps[min(i + 15, n - 1)])

                    # Check mitigation
                    mitigated = False
                    for j in range(i + 1, n):
                        if lows[j] <= ob_low:
                            mitigated = True
                            t_end = ts_to_unix(timestamps[j])
                            break

                    opacity = 0.06 if mitigated else 0.12
                    label = "OB (mitigated)" if mitigated else "Bullish OB"

                    elements.append(ChartElement(
                        type="box",
                        id=f"ob_bull_{i}",
                        props={
                            "timeStart": t_start,
                            "timeEnd": t_end,
                            "priceHigh": ob_high,
                            "priceLow": ob_low,
                            "color": "rgba(0,200,100,1)",
                            "opacity": opacity,
                            "label": label,
                        },
                    ))
                    ob_count += 1
                    break

        # Bearish OB: strong down-move, find last green candle before it
        if move_down >= threshold:
            for k in range(i, max(i - impulse_candle_count - 1, 0) - 1, -1):
                if closes[k] > opens[k]:  # Green candle
                    ob_high = float(highs[k])
                    ob_low = float(lows[k])
                    t_start = ts_to_unix(timestamps[k])
                    t_end = ts_to_unix(timestamps[min(i + 15, n - 1)])

                    mitigated = False
                    for j in range(i + 1, n):
                        if highs[j] >= ob_high:
                            mitigated = True
                            t_end = ts_to_unix(timestamps[j])
                            break

                    opacity = 0.06 if mitigated else 0.12
                    label = "OB (mitigated)" if mitigated else "Bearish OB"

                    elements.append(ChartElement(
                        type="box",
                        id=f"ob_bear_{i}",
                        props={
                            "timeStart": t_start,
                            "timeEnd": t_end,
                            "priceHigh": ob_high,
                            "priceLow": ob_low,
                            "color": "rgba(255,60,60,1)",
                            "opacity": opacity,
                            "label": label,
                        },
                    ))
                    ob_count += 1
                    break

    if len(elements) > MAX_ELEMENTS:
        elements = elements[-MAX_ELEMENTS:]

    return ChartPatternResult(
        pattern_type="order_blocks",
        elements=elements,
        metadata={
            "total_detected": ob_count,
            "displayed": len(elements),
            "capped": ob_count > MAX_ELEMENTS,
            "params": {
                "impulse_atr_multiplier": impulse_atr_multiplier,
                "impulse_candle_count": impulse_candle_count,
            },
        },
    )


# ─── Liquidity Sweeps ───

def detect_liquidity_sweeps(
    df: pd.DataFrame,
    sweep_threshold_ticks: float = 2.0,
    reversal_candles: int = 3,
    swing_lookback: int = 5,
) -> ChartPatternResult:
    """Detect liquidity sweeps (stop hunts).

    A sweep occurs when price takes out a swing high/low by a small amount
    then reverses within N candles.
    """
    swings = detect_swing_points(df, lookback=swing_lookback, lookforward=swing_lookback)
    highs = df["high"].values
    lows = df["low"].values
    closes = df["close"].values
    timestamps = df.index
    n = len(df)

    # Estimate tick size from price range
    avg_price = np.nanmean(closes)
    tick_size = 0.25 if avg_price > 1000 else 0.01
    threshold = sweep_threshold_ticks * tick_size

    elements: List[ChartElement] = []
    sweep_count = 0

    for sp in swings:
        if sp.index >= n - reversal_candles - 1:
            continue

        if sp.type == "high":
            # Check bars after this swing high for a sweep above then reversal
            for i in range(sp.index + 1, min(sp.index + 20, n)):
                if highs[i] > sp.price and (highs[i] - sp.price) <= threshold * 10:
                    # Check for reversal: close below the swing high within N candles
                    reversed_bar = False
                    for j in range(i, min(i + reversal_candles + 1, n)):
                        if closes[j] < sp.price:
                            reversed_bar = True
                            break
                    if reversed_bar:
                        elements.append(ChartElement(
                            type="marker",
                            id=f"sweep_high_{sp.index}_{i}",
                            props={
                                "time": ts_to_unix(timestamps[i]),
                                "position": "aboveBar",
                                "shape": "arrowDown",
                                "color": "rgba(255,180,0,1)",
                                "text": "Sweep",
                            },
                        ))
                        elements.append(ChartElement(
                            type="hline",
                            id=f"sweep_level_high_{sp.index}",
                            props={
                                "price": sp.price,
                                "color": "rgba(255,180,0,0.6)",
                                "width": 1,
                                "style": "dashed",
                                "label": f"Swept {sp.price:.2f}",
                            },
                        ))
                        sweep_count += 1
                        break

        else:  # swing low
            for i in range(sp.index + 1, min(sp.index + 20, n)):
                if lows[i] < sp.price and (sp.price - lows[i]) <= threshold * 10:
                    reversed_bar = False
                    for j in range(i, min(i + reversal_candles + 1, n)):
                        if closes[j] > sp.price:
                            reversed_bar = True
                            break
                    if reversed_bar:
                        elements.append(ChartElement(
                            type="marker",
                            id=f"sweep_low_{sp.index}_{i}",
                            props={
                                "time": ts_to_unix(timestamps[i]),
                                "position": "belowBar",
                                "shape": "arrowUp",
                                "color": "rgba(255,180,0,1)",
                                "text": "Sweep",
                            },
                        ))
                        elements.append(ChartElement(
                            type="hline",
                            id=f"sweep_level_low_{sp.index}",
                            props={
                                "price": sp.price,
                                "color": "rgba(255,180,0,0.6)",
                                "width": 1,
                                "style": "dashed",
                                "label": f"Swept {sp.price:.2f}",
                            },
                        ))
                        sweep_count += 1
                        break

    if len(elements) > MAX_ELEMENTS:
        elements = elements[-MAX_ELEMENTS:]

    return ChartPatternResult(
        pattern_type="liquidity_sweeps",
        elements=elements,
        metadata={
            "total_detected": sweep_count,
            "displayed": len(elements),
            "capped": sweep_count * 2 > MAX_ELEMENTS,
            "params": {
                "sweep_threshold_ticks": sweep_threshold_ticks,
                "reversal_candles": reversal_candles,
            },
        },
    )


# ─── Break of Structure / Change of Character ───

def detect_bos_choch(
    df: pd.DataFrame,
    trend_swings: int = 3,
    swing_lookback: int = 5,
) -> ChartPatternResult:
    """Detect Break of Structure (BOS) and Change of Character (CHoCH).

    BOS: Price breaks past a swing point in the prevailing trend direction.
    CHoCH: First break against the prevailing trend (trend reversal signal).

    Trend is established by tracking the last `trend_swings` swing points.
    """
    swings = detect_swing_points(df, lookback=swing_lookback, lookforward=swing_lookback)
    highs = df["high"].values
    lows = df["low"].values
    timestamps = df.index
    n = len(df)

    elements: List[ChartElement] = []
    bos_choch_count = 0

    # Track recent swing highs and lows separately
    recent_highs: List[SwingPoint] = []
    recent_lows: List[SwingPoint] = []
    trend = "neutral"  # "up", "down", "neutral"

    for sp in swings:
        if sp.type == "high":
            recent_highs.append(sp)
            if len(recent_highs) > trend_swings:
                recent_highs.pop(0)
        else:
            recent_lows.append(sp)
            if len(recent_lows) > trend_swings:
                recent_lows.pop(0)

        # Determine trend from classifications
        if len(recent_highs) >= 2 and len(recent_lows) >= 2:
            hh_count = sum(1 for s in recent_highs if s.classification == "HH")
            hl_count = sum(1 for s in recent_lows if s.classification == "HL")
            lh_count = sum(1 for s in recent_highs if s.classification == "LH")
            ll_count = sum(1 for s in recent_lows if s.classification == "LL")

            if hh_count >= lh_count and hl_count >= ll_count:
                trend = "up"
            elif lh_count >= hh_count and ll_count >= hl_count:
                trend = "down"

    # Now scan for breaks of swing levels
    for i, sp in enumerate(swings):
        if sp.type == "high" and sp.index < n - 1:
            # Check if a future bar breaks above this swing high
            for j in range(sp.index + 1, min(sp.index + 30, n)):
                if highs[j] > sp.price:
                    # Determine current trend at this point
                    local_trend = _get_trend_at(swings, sp.index, trend_swings)

                    if local_trend == "up":
                        label_text = "BOS"
                        color = "rgba(60,130,255,0.8)"
                    elif local_trend == "down":
                        label_text = "CHoCH"
                        color = "rgba(160,60,255,0.8)"
                    else:
                        label_text = "BOS"
                        color = "rgba(60,130,255,0.6)"

                    elements.append(ChartElement(
                        type="hline",
                        id=f"bos_{sp.index}_{j}",
                        props={
                            "price": sp.price,
                            "color": color,
                            "width": 1,
                            "style": "dashed",
                            "label": f"{label_text} {sp.price:.2f}",
                        },
                    ))
                    elements.append(ChartElement(
                        type="marker",
                        id=f"bos_marker_{j}",
                        props={
                            "time": ts_to_unix(timestamps[j]),
                            "position": "aboveBar",
                            "shape": "circle",
                            "color": color,
                            "text": label_text,
                        },
                    ))
                    bos_choch_count += 1
                    break

        elif sp.type == "low" and sp.index < n - 1:
            for j in range(sp.index + 1, min(sp.index + 30, n)):
                if lows[j] < sp.price:
                    local_trend = _get_trend_at(swings, sp.index, trend_swings)

                    if local_trend == "down":
                        label_text = "BOS"
                        color = "rgba(60,130,255,0.8)"
                    elif local_trend == "up":
                        label_text = "CHoCH"
                        color = "rgba(160,60,255,0.8)"
                    else:
                        label_text = "BOS"
                        color = "rgba(60,130,255,0.6)"

                    elements.append(ChartElement(
                        type="hline",
                        id=f"bos_{sp.index}_{j}",
                        props={
                            "price": sp.price,
                            "color": color,
                            "width": 1,
                            "style": "dashed",
                            "label": f"{label_text} {sp.price:.2f}",
                        },
                    ))
                    elements.append(ChartElement(
                        type="marker",
                        id=f"bos_marker_{j}",
                        props={
                            "time": ts_to_unix(timestamps[j]),
                            "position": "belowBar",
                            "shape": "circle",
                            "color": color,
                            "text": label_text,
                        },
                    ))
                    bos_choch_count += 1
                    break

    if len(elements) > MAX_ELEMENTS:
        elements = elements[-MAX_ELEMENTS:]

    return ChartPatternResult(
        pattern_type="bos_choch",
        elements=elements,
        metadata={
            "total_detected": bos_choch_count,
            "displayed": len(elements),
            "capped": bos_choch_count * 2 > MAX_ELEMENTS,
            "params": {"trend_swings": trend_swings},
        },
    )


def _get_trend_at(swings: List[SwingPoint], bar_index: int, window: int) -> str:
    """Determine trend at a given bar index from recent swings."""
    recent = [s for s in swings if s.index < bar_index]
    recent = recent[-window * 2:]  # Look at last N swing pairs

    hh = sum(1 for s in recent if s.classification == "HH")
    hl = sum(1 for s in recent if s.classification == "HL")
    lh = sum(1 for s in recent if s.classification == "LH")
    ll = sum(1 for s in recent if s.classification == "LL")

    up_score = hh + hl
    down_score = lh + ll

    if up_score > down_score:
        return "up"
    elif down_score > up_score:
        return "down"
    return "neutral"


# ─── Swing Points with Classification ───

def detect_swing_points_with_labels(
    df: pd.DataFrame,
    lookback: int = 5,
    lookforward: int = 5,
) -> ChartPatternResult:
    """Detect and label swing highs/lows as HH, HL, LH, LL.

    Returns markers at each swing point colored by classification.
    """
    swings = detect_swing_points(df, lookback=lookback, lookforward=lookforward)
    timestamps = df.index

    color_map = {
        "HH": "rgba(0,200,100,1)",
        "HL": "rgba(100,220,150,1)",
        "LH": "rgba(255,120,120,1)",
        "LL": "rgba(255,60,60,1)",
    }

    elements: List[ChartElement] = []
    for sp in swings:
        color = color_map.get(sp.classification, "rgba(180,180,180,1)")
        position = "aboveBar" if sp.type == "high" else "belowBar"
        shape = "arrowDown" if sp.type == "high" else "arrowUp"

        elements.append(ChartElement(
            type="marker",
            id=f"swing_{sp.type}_{sp.index}",
            props={
                "time": sp.timestamp,
                "position": position,
                "shape": shape,
                "color": color,
                "text": f"{sp.classification} {sp.price:.2f}",
            },
        ))

    if len(elements) > MAX_ELEMENTS:
        elements = elements[-MAX_ELEMENTS:]

    return ChartPatternResult(
        pattern_type="swing_points",
        elements=elements,
        metadata={
            "total_detected": len(swings),
            "displayed": len(elements),
            "capped": len(swings) > MAX_ELEMENTS,
            "params": {"lookback": lookback, "lookforward": lookforward},
        },
    )
