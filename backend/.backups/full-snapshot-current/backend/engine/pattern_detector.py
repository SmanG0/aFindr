"""Entry/exit pattern detection and setup quality scoring.

Analyzes trade history + price data to identify:
- Time-of-day patterns (which hours produce best trades)
- Day-of-week patterns
- Pre-entry momentum/volatility conditions
- Post-exit continuation analysis
- Setup quality scoring based on multiple factors
"""
from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import List, Dict, Optional
from datetime import datetime

import numpy as np
import pandas as pd


@dataclass
class PatternAnalysis:
    total_trades_analyzed: int
    # Time patterns
    best_entry_hours: List[Dict]   # [{hour, avg_pnl, trade_count, win_rate}]
    best_entry_days: List[Dict]    # [{day_name, avg_pnl, trade_count, win_rate}]
    # Setup quality
    trade_scores: List[Dict]       # [{trade_id, score, factors}]
    avg_score_winners: float
    avg_score_losers: float
    # Pre-entry conditions
    avg_atr_before_winners: float
    avg_atr_before_losers: float
    momentum_before_winners: float
    momentum_before_losers: float
    # Trade efficiency
    avg_mae_winners: float
    avg_mae_losers: float
    avg_mfe_winners: float
    avg_mfe_losers: float
    # Continuation (price movement after exit in same direction)
    avg_continuation_after_win: float
    avg_continuation_after_loss: float

    def to_dict(self) -> dict:
        return asdict(self)


def analyze_trade_patterns(
    trades: List[Dict],
    data: pd.DataFrame,
    lookback: int = 10,
) -> PatternAnalysis:
    """Analyze trade patterns against price data.

    Args:
        trades: List of trade dicts from backtester (with entry_time, exit_time, pnl, mae, mfe).
        data: OHLCV DataFrame with datetime index.
        lookback: Bars to look back for pre-entry conditions.

    Returns:
        PatternAnalysis with time patterns, quality scores, and conditions.
    """
    if not trades or len(data) < lookback + 1:
        return _empty_result()

    # Pre-compute indicators on the full dataset
    closes = data["close"].values
    highs = data["high"].values
    lows = data["low"].values

    # ATR (14-period)
    tr = np.maximum(
        highs[1:] - lows[1:],
        np.maximum(
            np.abs(highs[1:] - closes[:-1]),
            np.abs(lows[1:] - closes[:-1]),
        ),
    )
    atr = pd.Series(np.concatenate([[np.nan], tr])).rolling(14).mean().values

    # Momentum (rate of change over lookback)
    momentum = np.zeros(len(closes))
    for i in range(lookback, len(closes)):
        if closes[i - lookback] > 0:
            momentum[i] = (closes[i] - closes[i - lookback]) / closes[i - lookback] * 100

    # Build time index for fast bar lookup
    timestamps = data.index
    ts_map: Dict[int, int] = {}
    for idx, ts in enumerate(timestamps):
        unix = int(ts.timestamp()) if hasattr(ts, "timestamp") else int(ts)
        ts_map[unix] = idx

    # Analyze each trade
    hourly: Dict[int, List[float]] = {}
    daily: Dict[int, List[float]] = {}
    trade_scores: List[Dict] = []
    winners_atr: List[float] = []
    losers_atr: List[float] = []
    winners_momentum: List[float] = []
    losers_momentum: List[float] = []
    winners_mae: List[float] = []
    losers_mae: List[float] = []
    winners_mfe: List[float] = []
    losers_mfe: List[float] = []
    continuations_win: List[float] = []
    continuations_loss: List[float] = []

    for trade in trades:
        entry_time = trade.get("entry_time", 0)
        exit_time = trade.get("exit_time", 0)
        pnl = trade.get("pnl", 0)
        mae = trade.get("mae", 0)
        mfe = trade.get("mfe", 0)
        is_winner = pnl > 0

        # Find bar index for entry
        bar_idx = ts_map.get(entry_time)
        if bar_idx is None:
            # Find nearest bar
            diffs = np.abs(np.array(list(ts_map.keys())) - entry_time)
            if len(diffs) > 0:
                nearest_ts = list(ts_map.keys())[np.argmin(diffs)]
                bar_idx = ts_map[nearest_ts]
            else:
                continue

        # Time patterns
        try:
            entry_dt = datetime.fromtimestamp(entry_time)
            hour = entry_dt.hour
            day = entry_dt.weekday()
            hourly.setdefault(hour, []).append(pnl)
            daily.setdefault(day, []).append(pnl)
        except (OSError, ValueError):
            pass

        # Pre-entry conditions
        if bar_idx is not None and bar_idx >= lookback:
            entry_atr = atr[bar_idx] if bar_idx < len(atr) and not np.isnan(atr[bar_idx]) else 0
            entry_mom = momentum[bar_idx] if bar_idx < len(momentum) else 0

            if is_winner:
                winners_atr.append(entry_atr)
                winners_momentum.append(entry_mom)
            else:
                losers_atr.append(entry_atr)
                losers_momentum.append(entry_mom)

        # MAE/MFE
        if is_winner:
            winners_mae.append(mae)
            winners_mfe.append(mfe)
        else:
            losers_mae.append(mae)
            losers_mfe.append(mfe)

        # Post-exit continuation (5 bars after exit)
        exit_idx = ts_map.get(exit_time)
        if exit_idx is not None and exit_idx + 5 < len(closes):
            continuation = closes[exit_idx + 5] - closes[exit_idx]
            side = trade.get("side", "long")
            if side == "short":
                continuation = -continuation
            if is_winner:
                continuations_win.append(continuation)
            else:
                continuations_loss.append(continuation)

        # Setup quality score (0-100)
        score_factors = {}

        # Factor 1: Trend alignment (momentum direction matches trade side)
        if bar_idx is not None and bar_idx < len(momentum):
            mom = momentum[bar_idx]
            side = trade.get("side", "long")
            aligned = (side == "long" and mom > 0) or (side == "short" and mom < 0)
            score_factors["trend_alignment"] = 25 if aligned else 0
        else:
            score_factors["trend_alignment"] = 0

        # Factor 2: Volatility (moderate ATR is better)
        if bar_idx is not None and bar_idx < len(atr) and not np.isnan(atr[bar_idx]):
            atr_val = atr[bar_idx]
            median_atr = float(np.nanmedian(atr))
            if median_atr > 0:
                atr_ratio = atr_val / median_atr
                # Sweet spot: 0.7-1.3x median ATR
                if 0.7 <= atr_ratio <= 1.3:
                    score_factors["volatility"] = 25
                elif 0.5 <= atr_ratio <= 2.0:
                    score_factors["volatility"] = 15
                else:
                    score_factors["volatility"] = 5
            else:
                score_factors["volatility"] = 0
        else:
            score_factors["volatility"] = 0

        # Factor 3: Risk/reward (MFE vs MAE)
        if mae != 0:
            rr_ratio = abs(mfe / mae) if mae != 0 else 0
            score_factors["risk_reward"] = min(25, int(rr_ratio * 10))
        else:
            score_factors["risk_reward"] = 12

        # Factor 4: Win (outcome bonus)
        score_factors["outcome"] = 25 if is_winner else 0

        total_score = sum(score_factors.values())
        trade_scores.append({
            "trade_id": trade.get("id", 0),
            "score": total_score,
            "factors": score_factors,
            "pnl": pnl,
        })

    # Aggregate hourly patterns
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    best_hours = []
    for h, pnls in sorted(hourly.items()):
        best_hours.append({
            "hour": h,
            "avg_pnl": round(float(np.mean(pnls)), 2),
            "trade_count": len(pnls),
            "win_rate": round(sum(1 for p in pnls if p > 0) / len(pnls), 3) if pnls else 0,
        })
    best_hours.sort(key=lambda x: x["avg_pnl"], reverse=True)

    best_days = []
    for d, pnls in sorted(daily.items()):
        best_days.append({
            "day_name": day_names[d] if d < len(day_names) else str(d),
            "avg_pnl": round(float(np.mean(pnls)), 2),
            "trade_count": len(pnls),
            "win_rate": round(sum(1 for p in pnls if p > 0) / len(pnls), 3) if pnls else 0,
        })
    best_days.sort(key=lambda x: x["avg_pnl"], reverse=True)

    # Score averages
    winner_scores = [s["score"] for s in trade_scores if s["pnl"] > 0]
    loser_scores = [s["score"] for s in trade_scores if s["pnl"] <= 0]

    return PatternAnalysis(
        total_trades_analyzed=len(trades),
        best_entry_hours=best_hours,
        best_entry_days=best_days,
        trade_scores=trade_scores[:50],  # Cap at 50 for response size
        avg_score_winners=round(float(np.mean(winner_scores)), 1) if winner_scores else 0,
        avg_score_losers=round(float(np.mean(loser_scores)), 1) if loser_scores else 0,
        avg_atr_before_winners=round(float(np.mean(winners_atr)), 2) if winners_atr else 0,
        avg_atr_before_losers=round(float(np.mean(losers_atr)), 2) if losers_atr else 0,
        momentum_before_winners=round(float(np.mean(winners_momentum)), 3) if winners_momentum else 0,
        momentum_before_losers=round(float(np.mean(losers_momentum)), 3) if losers_momentum else 0,
        avg_mae_winners=round(float(np.mean(winners_mae)), 2) if winners_mae else 0,
        avg_mae_losers=round(float(np.mean(losers_mae)), 2) if losers_mae else 0,
        avg_mfe_winners=round(float(np.mean(winners_mfe)), 2) if winners_mfe else 0,
        avg_mfe_losers=round(float(np.mean(losers_mfe)), 2) if losers_mfe else 0,
        avg_continuation_after_win=round(float(np.mean(continuations_win)), 2) if continuations_win else 0,
        avg_continuation_after_loss=round(float(np.mean(continuations_loss)), 2) if continuations_loss else 0,
    )


def _empty_result() -> PatternAnalysis:
    return PatternAnalysis(
        total_trades_analyzed=0,
        best_entry_hours=[], best_entry_days=[],
        trade_scores=[],
        avg_score_winners=0, avg_score_losers=0,
        avg_atr_before_winners=0, avg_atr_before_losers=0,
        momentum_before_winners=0, momentum_before_losers=0,
        avg_mae_winners=0, avg_mae_losers=0,
        avg_mfe_winners=0, avg_mfe_losers=0,
        avg_continuation_after_win=0, avg_continuation_after_loss=0,
    )
