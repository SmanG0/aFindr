"""ICT / Smart Money Concept pattern detectors.

Detects: Fair Value Gaps, Order Blocks, Breaker Blocks, Liquidity Sweeps,
Break of Structure / Change of Character, Swing Points, and Killzone Ranges.
"""
from __future__ import annotations

from typing import List

import numpy as np
import pandas as pd

from ._types import ChartElement, ChartPatternResult, SwingPoint
from ._utils import compute_atr, detect_swing_points, ts_to_unix
from .chart_palette import FVG, OB, BB, STRUCTURE, SWEEP, SWING, KILLZONE

MAX_ELEMENTS = 50


# ─── Fair Value Gaps ───

def detect_fvg(
    df: pd.DataFrame,
    min_gap_atr_ratio: float = 0.3,
    show_filled: bool = True,
    max_age_bars: int = 500,
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

    # Limit scan range — use at least 500 bars to cover recent visible candles
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

            # Check fill status
            filled = False
            t_end = ts_to_unix(timestamps[-1])  # extend to last bar by default
            if show_filled:
                for j in range(i + 1, n):
                    if lows[j] <= bottom:
                        filled = True
                        t_end = ts_to_unix(timestamps[j])
                        break

            opacity = FVG["bull"]["opacity_filled"] if filled else FVG["bull"]["opacity_active"]
            label = f"{FVG['bull']['label']} (filled)" if filled else FVG["bull"]["label"]

            elements.append(ChartElement(
                type="box",
                id=f"fvg_bull_{i}",
                props={
                    "timeStart": t_start,
                    "timeEnd": t_end,
                    "priceHigh": top,
                    "priceLow": bottom,
                    "color": FVG["bull"]["color"],
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

            filled = False
            t_end = ts_to_unix(timestamps[-1])  # extend to last bar by default
            if show_filled:
                for j in range(i + 1, n):
                    if highs[j] >= top:
                        filled = True
                        t_end = ts_to_unix(timestamps[j])
                        break

            opacity = FVG["bear"]["opacity_filled"] if filled else FVG["bear"]["opacity_active"]
            label = f"{FVG['bear']['label']} (filled)" if filled else FVG["bear"]["label"]

            elements.append(ChartElement(
                type="box",
                id=f"fvg_bear_{i}",
                props={
                    "timeStart": t_start,
                    "timeEnd": t_end,
                    "priceHigh": top,
                    "priceLow": bottom,
                    "color": FVG["bear"]["color"],
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
    """Detect Order Blocks -- last opposing candle before an impulse move.

    Bullish OB: Last red candle before a strong up-move >= impulse_atr_multiplier * ATR.
    Bearish OB: Last green candle before a strong down-move.
    Mitigated OBs become Breaker Blocks with flipped colors.
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
                    ob_mid = (ob_high + ob_low) / 2.0
                    t_start = ts_to_unix(timestamps[k])

                    # Check mitigation
                    mitigated = False
                    mitigation_bar = None
                    for j in range(i + 1, n):
                        if lows[j] <= ob_low:
                            mitigated = True
                            mitigation_bar = j
                            break

                    if mitigated:
                        # OB box ends at mitigation
                        t_end = ts_to_unix(timestamps[mitigation_bar])
                        elements.append(ChartElement(
                            type="box",
                            id=f"ob_bull_{i}",
                            props={
                                "timeStart": t_start,
                                "timeEnd": t_end,
                                "priceHigh": ob_high,
                                "priceLow": ob_low,
                                "color": OB["bull"]["color"],
                                "opacity": 0.06,
                                "label": OB["bull"]["label"],
                            },
                        ))
                        # Breaker Block: former bull OB mitigated -> bear BB
                        bb_end = ts_to_unix(timestamps[-1])
                        elements.append(ChartElement(
                            type="box",
                            id=f"bb_bear_{i}",
                            props={
                                "timeStart": t_end,
                                "timeEnd": bb_end,
                                "priceHigh": ob_high,
                                "priceLow": ob_low,
                                "color": BB["bear"]["color"],
                                "opacity": BB["bear"]["opacity"],
                                "label": BB["bear"]["label"],
                            },
                        ))
                    else:
                        t_end = ts_to_unix(timestamps[-1])
                        elements.append(ChartElement(
                            type="box",
                            id=f"ob_bull_{i}",
                            props={
                                "timeStart": t_start,
                                "timeEnd": t_end,
                                "priceHigh": ob_high,
                                "priceLow": ob_low,
                                "color": OB["bull"]["color"],
                                "opacity": OB["bull"]["opacity"],
                                "label": OB["bull"]["label"],
                            },
                        ))

                    # Midline for all OBs
                    elements.append(ChartElement(
                        type="hline",
                        id=f"ob_mid_bull_{i}",
                        props={
                            "price": round(ob_mid, 2),
                            "color": OB["midline"]["color"],
                            "width": OB["midline"]["width"],
                            "style": OB["midline"]["style"],
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
                    ob_mid = (ob_high + ob_low) / 2.0
                    t_start = ts_to_unix(timestamps[k])

                    mitigated = False
                    mitigation_bar = None
                    for j in range(i + 1, n):
                        if highs[j] >= ob_high:
                            mitigated = True
                            mitigation_bar = j
                            break

                    if mitigated:
                        t_end = ts_to_unix(timestamps[mitigation_bar])
                        elements.append(ChartElement(
                            type="box",
                            id=f"ob_bear_{i}",
                            props={
                                "timeStart": t_start,
                                "timeEnd": t_end,
                                "priceHigh": ob_high,
                                "priceLow": ob_low,
                                "color": OB["bear"]["color"],
                                "opacity": 0.06,
                                "label": OB["bear"]["label"],
                            },
                        ))
                        # Breaker Block: former bear OB mitigated -> bull BB
                        bb_end = ts_to_unix(timestamps[-1])
                        elements.append(ChartElement(
                            type="box",
                            id=f"bb_bull_{i}",
                            props={
                                "timeStart": t_end,
                                "timeEnd": bb_end,
                                "priceHigh": ob_high,
                                "priceLow": ob_low,
                                "color": BB["bull"]["color"],
                                "opacity": BB["bull"]["opacity"],
                                "label": BB["bull"]["label"],
                            },
                        ))
                    else:
                        t_end = ts_to_unix(timestamps[-1])
                        elements.append(ChartElement(
                            type="box",
                            id=f"ob_bear_{i}",
                            props={
                                "timeStart": t_start,
                                "timeEnd": t_end,
                                "priceHigh": ob_high,
                                "priceLow": ob_low,
                                "color": OB["bear"]["color"],
                                "opacity": OB["bear"]["opacity"],
                                "label": OB["bear"]["label"],
                            },
                        ))

                    # Midline
                    elements.append(ChartElement(
                        type="hline",
                        id=f"ob_mid_bear_{i}",
                        props={
                            "price": round(ob_mid, 2),
                            "color": OB["midline"]["color"],
                            "width": OB["midline"]["width"],
                            "style": OB["midline"]["style"],
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
                                "color": SWEEP["marker_color"],
                                "text": SWEEP["marker_text"],
                            },
                        ))
                        elements.append(ChartElement(
                            type="hline",
                            id=f"sweep_level_high_{sp.index}",
                            props={
                                "price": sp.price,
                                "color": SWEEP["line_color"],
                                "width": SWEEP["line_width"],
                                "style": SWEEP["line_style"],
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
                                "color": SWEEP["marker_color"],
                                "text": SWEEP["marker_text"],
                            },
                        ))
                        elements.append(ChartElement(
                            type="hline",
                            id=f"sweep_level_low_{sp.index}",
                            props={
                                "price": sp.price,
                                "color": SWEEP["line_color"],
                                "width": SWEEP["line_width"],
                                "style": SWEEP["line_style"],
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
                    local_trend = _get_trend_at(swings, sp.index, trend_swings)

                    # Bullish break (upward)
                    if local_trend == "up":
                        label_text = STRUCTURE["bos_label"]
                        color = STRUCTURE["bull"]["color"]
                    elif local_trend == "down":
                        label_text = STRUCTURE["choch_label"]
                        color = STRUCTURE["bull"]["color"]
                    else:
                        label_text = STRUCTURE["bos_label"]
                        color = STRUCTURE["bull"]["color"]

                    elements.append(ChartElement(
                        type="hline",
                        id=f"bos_{sp.index}_{j}",
                        props={
                            "price": sp.price,
                            "color": color,
                            "width": STRUCTURE["bull"]["width"],
                            "style": STRUCTURE["bull"]["style"],
                            "label": f"{label_text} {sp.price:.2f}",
                        },
                    ))
                    bos_choch_count += 1
                    break

        elif sp.type == "low" and sp.index < n - 1:
            for j in range(sp.index + 1, min(sp.index + 30, n)):
                if lows[j] < sp.price:
                    local_trend = _get_trend_at(swings, sp.index, trend_swings)

                    # Bearish break (downward)
                    if local_trend == "down":
                        label_text = STRUCTURE["bos_label"]
                        color = STRUCTURE["bear"]["color"]
                    elif local_trend == "up":
                        label_text = STRUCTURE["choch_label"]
                        color = STRUCTURE["bear"]["color"]
                    else:
                        label_text = STRUCTURE["bos_label"]
                        color = STRUCTURE["bear"]["color"]

                    elements.append(ChartElement(
                        type="hline",
                        id=f"bos_{sp.index}_{j}",
                        props={
                            "price": sp.price,
                            "color": color,
                            "width": STRUCTURE["bear"]["width"],
                            "style": STRUCTURE["bear"]["style"],
                            "label": f"{label_text} {sp.price:.2f}",
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
            "capped": bos_choch_count > MAX_ELEMENTS,
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

    elements: List[ChartElement] = []
    for sp in swings:
        swing_def = SWING.get(sp.classification, SWING["unknown"])
        color = swing_def["color"]
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


# ─── Killzone Ranges ───

def detect_killzone_ranges(
    df: pd.DataFrame,
    killzones: list[str] | None = None,
) -> ChartPatternResult:
    """Shade ICT killzone sessions with high/low range lines.

    Groups candles by UTC time into killzone windows, creates shade + high/low
    hline elements per killzone session per day.
    """
    if killzones is None:
        killzones = ["asian", "london", "ny_am", "ny_pm"]

    timestamps = df.index
    highs = df["high"].values
    lows = df["low"].values

    # Need UTC hour/minute for each bar
    hours = pd.Series(timestamps, index=df.index).dt.hour.values
    minutes = pd.Series(timestamps, index=df.index).dt.minute.values
    dates = pd.Series(timestamps, index=df.index).dt.date.values

    elements: List[ChartElement] = []
    kz_count = 0
    unique_dates = sorted(set(dates))

    for day in unique_dates:
        day_mask = dates == day
        day_indices = np.where(day_mask)[0]
        if len(day_indices) == 0:
            continue

        for kz_name in killzones:
            if kz_name not in KILLZONE:
                continue

            kz = KILLZONE[kz_name]
            start_h, start_m = kz["utc_start"]
            end_h, end_m = kz["utc_end"]
            start_minutes = start_h * 60 + start_m
            end_minutes = end_h * 60 + end_m

            # Find candles within this killzone window on this day
            kz_indices = []
            for idx in day_indices:
                bar_minutes = int(hours[idx]) * 60 + int(minutes[idx])
                if start_minutes <= bar_minutes < end_minutes:
                    kz_indices.append(idx)

            if len(kz_indices) < 2:
                continue

            kz_high = float(np.max(highs[kz_indices]))
            kz_low = float(np.min(lows[kz_indices]))
            t_start = ts_to_unix(timestamps[kz_indices[0]])
            t_end = ts_to_unix(timestamps[kz_indices[-1]])

            # Shade element
            elements.append(ChartElement(
                type="shade",
                id=f"kz_{kz_name}_{day}",
                props={
                    "timeStart": t_start,
                    "timeEnd": t_end,
                    "color": kz["color"],
                    "opacity": kz["opacity"],
                    "label": kz["label"],
                },
            ))

            # Session high/low hlines
            elements.append(ChartElement(
                type="hline",
                id=f"kz_{kz_name}_h_{day}",
                props={
                    "price": round(kz_high, 2),
                    "color": kz["color"],
                    "width": 1,
                    "style": "dashed",
                    "label": f"{kz['label']} H {kz_high:.2f}",
                },
            ))
            elements.append(ChartElement(
                type="hline",
                id=f"kz_{kz_name}_l_{day}",
                props={
                    "price": round(kz_low, 2),
                    "color": kz["color"],
                    "width": 1,
                    "style": "dashed",
                    "label": f"{kz['label']} L {kz_low:.2f}",
                },
            ))
            kz_count += 1

    if len(elements) > MAX_ELEMENTS:
        elements = elements[-MAX_ELEMENTS:]

    return ChartPatternResult(
        pattern_type="killzone_ranges",
        elements=elements,
        metadata={
            "total_detected": kz_count,
            "displayed": len(elements),
            "capped": kz_count > MAX_ELEMENTS,
            "killzones": killzones,
        },
    )
