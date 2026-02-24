"""Key level detectors.

Detects: Support/Resistance clusters, Session levels,
Round numbers, and VWAP bands.
"""
from __future__ import annotations

from typing import List

import numpy as np
import pandas as pd

from ._types import ChartElement, ChartPatternResult
from ._utils import compute_atr, compute_vwap, detect_swing_points, ts_to_unix

MAX_ELEMENTS = 50


# ─── Support / Resistance Clusters ───

def detect_support_resistance(
    df: pd.DataFrame,
    sensitivity: float = 1.0,
    min_touches: int = 2,
    lookback_bars: int = 200,
    swing_lookback: int = 5,
) -> ChartPatternResult:
    """Detect S/R levels by clustering swing point prices.

    Swing prices within `sensitivity * ATR` of each other are grouped.
    Levels with >= min_touches are returned.
    """
    # Use only last lookback_bars
    df_slice = df.iloc[-lookback_bars:] if len(df) > lookback_bars else df
    atr = compute_atr(df_slice, 14)
    avg_atr = float(np.nanmean(atr[~np.isnan(atr)])) if np.any(~np.isnan(atr)) else 1.0

    swings = detect_swing_points(df_slice, lookback=swing_lookback, lookforward=swing_lookback)
    if not swings:
        return ChartPatternResult(pattern_type="support_resistance", metadata={"total_detected": 0})

    # Cluster swing prices
    cluster_range = sensitivity * avg_atr
    prices = sorted([sp.price for sp in swings])

    clusters: List[List[float]] = []
    current_cluster = [prices[0]]

    for price in prices[1:]:
        if price - current_cluster[-1] <= cluster_range:
            current_cluster.append(price)
        else:
            clusters.append(current_cluster)
            current_cluster = [price]
    clusters.append(current_cluster)

    # Filter by min_touches and classify
    last_close = float(df["close"].iloc[-1])
    elements: List[ChartElement] = []
    level_count = 0

    for cluster in clusters:
        touches = len(cluster)
        if touches < min_touches:
            continue

        level_price = float(np.mean(cluster))
        is_support = level_price < last_close
        level_count += 1

        color = "rgba(0,200,100,0.8)" if is_support else "rgba(255,60,60,0.8)"
        style = "solid" if touches >= 3 else "dashed"
        width = 2 if touches >= 3 else 1
        sr_label = "S" if is_support else "R"

        elements.append(ChartElement(
            type="hline",
            id=f"sr_{level_count}",
            props={
                "price": round(level_price, 2),
                "color": color,
                "width": width,
                "style": style,
                "label": f"{sr_label} {level_price:.2f} ({touches}x)",
            },
        ))

    if len(elements) > MAX_ELEMENTS:
        elements = elements[-MAX_ELEMENTS:]

    return ChartPatternResult(
        pattern_type="support_resistance",
        elements=elements,
        metadata={
            "total_detected": level_count,
            "displayed": len(elements),
            "capped": level_count > MAX_ELEMENTS,
            "params": {
                "sensitivity": sensitivity,
                "min_touches": min_touches,
                "lookback_bars": lookback_bars,
            },
        },
    )


# ─── Session Levels (Previous Day/Week High/Low/Open/Close) ───

def detect_session_levels(
    df: pd.DataFrame,
    sessions: List[str] | None = None,
) -> ChartPatternResult:
    """Detect previous session HLOC levels.

    Sessions: previous_day, previous_week, asian, london, new_york.
    """
    if sessions is None:
        sessions = ["previous_day"]

    elements: List[ChartElement] = []
    timestamps = df.index

    if "previous_day" in sessions or "previous_week" in sessions:
        # Group by date
        df_copy = df.copy()
        df_copy["date"] = pd.Series(timestamps, index=df_copy.index).dt.date

        dates = sorted(df_copy["date"].unique())

        if "previous_day" in sessions and len(dates) >= 2:
            prev_date = dates[-2]
            prev_day = df_copy[df_copy["date"] == prev_date]

            if len(prev_day) > 0:
                pdh = float(prev_day["high"].max())
                pdl = float(prev_day["low"].min())
                pdo = float(prev_day["open"].iloc[0])
                pdc = float(prev_day["close"].iloc[-1])

                for label, price, eid in [
                    ("PDH", pdh, "pdh"),
                    ("PDL", pdl, "pdl"),
                    ("PDO", pdo, "pdo"),
                    ("PDC", pdc, "pdc"),
                ]:
                    elements.append(ChartElement(
                        type="hline",
                        id=f"session_{eid}",
                        props={
                            "price": round(price, 2),
                            "color": "rgba(255,180,0,0.7)",
                            "width": 1,
                            "style": "dashed",
                            "label": f"{label} {price:.2f}",
                        },
                    ))

        if "previous_week" in sessions and len(dates) >= 7:
            # Find previous week's data
            df_copy["week"] = pd.Series(timestamps, index=df_copy.index).dt.isocalendar().week.values
            weeks = sorted(df_copy["week"].unique())
            if len(weeks) >= 2:
                prev_week = weeks[-2]
                pw_data = df_copy[df_copy["week"] == prev_week]

                if len(pw_data) > 0:
                    pwh = float(pw_data["high"].max())
                    pwl = float(pw_data["low"].min())

                    elements.append(ChartElement(
                        type="hline",
                        id="session_pwh",
                        props={
                            "price": round(pwh, 2),
                            "color": "rgba(255,150,0,0.6)",
                            "width": 1,
                            "style": "dashed",
                            "label": f"PWH {pwh:.2f}",
                        },
                    ))
                    elements.append(ChartElement(
                        type="hline",
                        id="session_pwl",
                        props={
                            "price": round(pwl, 2),
                            "color": "rgba(255,150,0,0.6)",
                            "width": 1,
                            "style": "dashed",
                            "label": f"PWL {pwl:.2f}",
                        },
                    ))

    # Session time-based levels (Asian, London, NY)
    session_defs = {
        "asian": (0, 8),     # 00:00 - 08:00 UTC
        "london": (8, 16),   # 08:00 - 16:00 UTC
        "new_york": (14, 21), # 14:00 - 21:00 UTC
    }

    for sess_name in sessions:
        if sess_name not in session_defs:
            continue

        start_hour, end_hour = session_defs[sess_name]
        df_copy = df.copy()
        hours = pd.Series(timestamps, index=df_copy.index).dt.hour

        if start_hour < end_hour:
            mask = (hours >= start_hour) & (hours < end_hour)
        else:
            mask = (hours >= start_hour) | (hours < end_hour)

        sess_data = df_copy[mask]
        if len(sess_data) == 0:
            continue

        # Get previous session (not current)
        sess_data_copy = sess_data.copy()
        sess_data_copy["date"] = pd.Series(sess_data.index, index=sess_data_copy.index).dt.date
        sess_dates = sorted(sess_data_copy["date"].unique())

        if len(sess_dates) >= 2:
            prev_sess = sess_data_copy[sess_data_copy["date"] == sess_dates[-2]]
            if len(prev_sess) > 0:
                sh = float(prev_sess["high"].max())
                sl = float(prev_sess["low"].min())
                prefix = sess_name[:2].upper()

                elements.append(ChartElement(
                    type="hline",
                    id=f"session_{sess_name}_h",
                    props={
                        "price": round(sh, 2),
                        "color": "rgba(180,140,255,0.6)",
                        "width": 1,
                        "style": "dashed",
                        "label": f"{prefix}H {sh:.2f}",
                    },
                ))
                elements.append(ChartElement(
                    type="hline",
                    id=f"session_{sess_name}_l",
                    props={
                        "price": round(sl, 2),
                        "color": "rgba(180,140,255,0.6)",
                        "width": 1,
                        "style": "dashed",
                        "label": f"{prefix}L {sl:.2f}",
                    },
                ))

    return ChartPatternResult(
        pattern_type="session_levels",
        elements=elements,
        metadata={
            "total_detected": len(elements),
            "displayed": len(elements),
            "sessions": sessions,
        },
    )


# ─── Round Numbers (Psychological Levels) ───

def detect_round_numbers(
    df: pd.DataFrame,
    interval_size: float = 0,
) -> ChartPatternResult:
    """Detect round / psychological price levels.

    Auto-detects appropriate interval based on price range if interval_size=0.
    """
    last_close = float(df["close"].iloc[-1])
    price_range = float(df["high"].max() - df["low"].min())

    # Auto-detect interval
    if interval_size <= 0:
        if last_close > 10000:
            interval_size = 500  # e.g. NQ
        elif last_close > 3000:
            interval_size = 100  # e.g. ES
        elif last_close > 1000:
            interval_size = 50
        elif last_close > 100:
            interval_size = 10
        elif last_close > 10:
            interval_size = 1
        else:
            interval_size = 0.5

    # Generate levels within the visible price range
    low = float(df["low"].min())
    high = float(df["high"].max())

    # Expand range slightly
    margin = price_range * 0.05
    start = (low - margin) // interval_size * interval_size
    end = high + margin

    elements: List[ChartElement] = []
    level = start
    while level <= end:
        elements.append(ChartElement(
            type="hline",
            id=f"round_{int(level)}",
            props={
                "price": round(level, 2),
                "color": "rgba(150,150,150,0.3)",
                "width": 1,
                "style": "dotted",
                "label": f"{level:.0f}",
            },
        ))
        level += interval_size

    if len(elements) > MAX_ELEMENTS:
        # Keep levels closest to current price
        elements.sort(key=lambda e: abs(e.props["price"] - last_close))
        elements = elements[:MAX_ELEMENTS]

    return ChartPatternResult(
        pattern_type="round_numbers",
        elements=elements,
        metadata={
            "total_detected": len(elements),
            "displayed": len(elements),
            "params": {"interval_size": interval_size},
        },
    )


# ─── VWAP Bands ───

def detect_vwap_bands(
    df: pd.DataFrame,
    std_dev_bands: List[float] | None = None,
    anchor: str = "session",
) -> ChartPatternResult:
    """Compute VWAP + standard deviation bands.

    Anchor can be 'session' (daily reset) or 'full' (entire dataset).
    """
    if std_dev_bands is None:
        std_dev_bands = [1.0, 2.0]

    timestamps = df.index
    elements: List[ChartElement] = []

    if anchor == "session":
        # Group by date and compute VWAP per day, use only last day
        df_copy = df.copy()
        df_copy["date"] = pd.Series(timestamps, index=df_copy.index).dt.date
        dates = sorted(df_copy["date"].unique())

        if dates:
            # Use last trading day for VWAP
            last_date = dates[-1]
            day_data = df_copy[df_copy["date"] == last_date]

            if len(day_data) > 0:
                vwap_vals, vwap_std = _compute_vwap_with_std(day_data)

                # VWAP line
                vwap_points = []
                for idx in range(len(day_data)):
                    if not np.isnan(vwap_vals[idx]):
                        vwap_points.append({
                            "time": ts_to_unix(day_data.index[idx]),
                            "value": round(float(vwap_vals[idx]), 2),
                        })

                if vwap_points:
                    elements.append(ChartElement(
                        type="line",
                        id="vwap_main",
                        props={
                            "data": vwap_points,
                            "color": "rgba(60,130,255,0.9)",
                            "width": 2,
                            "style": "solid",
                            "label": "VWAP",
                        },
                    ))

                    # SD bands
                    for sd in std_dev_bands:
                        upper_points = []
                        lower_points = []
                        for idx in range(len(day_data)):
                            if not np.isnan(vwap_vals[idx]) and not np.isnan(vwap_std[idx]):
                                t = ts_to_unix(day_data.index[idx])
                                upper_points.append({
                                    "time": t,
                                    "value": round(float(vwap_vals[idx] + sd * vwap_std[idx]), 2),
                                })
                                lower_points.append({
                                    "time": t,
                                    "value": round(float(vwap_vals[idx] - sd * vwap_std[idx]), 2),
                                })

                        if upper_points:
                            elements.append(ChartElement(
                                type="line",
                                id=f"vwap_upper_{sd}",
                                props={
                                    "data": upper_points,
                                    "color": "rgba(60,130,255,0.4)",
                                    "width": 1,
                                    "style": "dashed",
                                    "label": f"+{sd}SD",
                                },
                            ))
                        if lower_points:
                            elements.append(ChartElement(
                                type="line",
                                id=f"vwap_lower_{sd}",
                                props={
                                    "data": lower_points,
                                    "color": "rgba(60,130,255,0.4)",
                                    "width": 1,
                                    "style": "dashed",
                                    "label": f"-{sd}SD",
                                },
                            ))
    else:
        # Full dataset VWAP
        vwap_vals = compute_vwap(df)
        last_vwap = float(vwap_vals[-1]) if not np.isnan(vwap_vals[-1]) else None

        if last_vwap is not None:
            elements.append(ChartElement(
                type="hline",
                id="vwap_full",
                props={
                    "price": round(last_vwap, 2),
                    "color": "rgba(60,130,255,0.9)",
                    "width": 2,
                    "style": "solid",
                    "label": f"VWAP {last_vwap:.2f}",
                },
            ))

    return ChartPatternResult(
        pattern_type="vwap_bands",
        elements=elements,
        metadata={
            "total_detected": len(elements),
            "displayed": len(elements),
            "params": {
                "std_dev_bands": std_dev_bands,
                "anchor": anchor,
            },
        },
    )


def _compute_vwap_with_std(df: pd.DataFrame):
    """Compute VWAP and running standard deviation for a session."""
    tp = (df["high"].values + df["low"].values + df["close"].values) / 3.0
    vol = df["volume"].values.astype(float)

    cum_tp_vol = np.cumsum(tp * vol)
    cum_vol = np.cumsum(vol)

    with np.errstate(divide="ignore", invalid="ignore"):
        vwap = np.where(cum_vol > 0, cum_tp_vol / cum_vol, np.nan)

    # Running variance: E[X^2] - E[X]^2
    cum_tp2_vol = np.cumsum(tp**2 * vol)
    with np.errstate(divide="ignore", invalid="ignore"):
        variance = np.where(
            cum_vol > 0,
            cum_tp2_vol / cum_vol - vwap**2,
            np.nan,
        )
    variance = np.maximum(variance, 0)  # Clamp numerical noise
    std = np.sqrt(variance)

    return vwap, std
