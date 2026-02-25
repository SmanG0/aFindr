"""Walk-forward analysis engine.

Splits data into sequential in-sample / out-of-sample windows,
optimizes strategy parameters on in-sample, validates on out-of-sample.
Reports per-window and aggregate OOS performance + robustness ratio.

Enhanced with parameter stability metrics and recommendation engine.
"""
from __future__ import annotations

from dataclasses import dataclass, asdict
from itertools import product
from typing import List, Dict, Optional

import numpy as np
import pandas as pd

from engine.backtester import Backtester, BacktestConfig
from engine.metrics import calculate_metrics


@dataclass
class WalkForwardWindow:
    window_index: int
    is_start: str
    is_end: str
    oos_start: str
    oos_end: str
    is_bars: int
    oos_bars: int
    is_metrics: dict
    oos_metrics: dict
    best_params: dict


@dataclass
class ParamStability:
    """Parameter stability across walk-forward windows."""
    coefficient_of_variation: Dict[str, float]  # CV per parameter
    recommendation: str  # "PASS" | "CAUTION" | "FAIL"
    reasons: List[str]


@dataclass
class WalkForwardResult:
    num_windows: int
    is_ratio: float
    windows: List[Dict]
    aggregate_oos_metrics: dict
    oos_trades: List[Dict]
    oos_equity_curve: List[Dict]
    robustness_ratio: float  # OOS profit factor / IS profit factor
    # Enhanced stability metrics
    param_stability: Optional[Dict] = None

    def to_dict(self) -> dict:
        return asdict(self)


def _compute_param_stability(windows: List[WalkForwardWindow]) -> ParamStability:
    """Compute parameter stability across walk-forward windows.

    Low coefficient of variation (CV) across windows = parameters are stable.
    High CV = parameters change dramatically, suggesting overfitting.
    """
    if len(windows) < 2:
        return ParamStability(
            coefficient_of_variation={},
            recommendation="CAUTION",
            reasons=["Not enough windows to assess stability (need >= 2)"],
        )

    # Collect parameter values across windows
    param_values: Dict[str, List[float]] = {}
    for w in windows:
        for param_name, param_val in w.best_params.items():
            if isinstance(param_val, (int, float)):
                if param_name not in param_values:
                    param_values[param_name] = []
                param_values[param_name].append(float(param_val))

    # Compute coefficient of variation for each parameter
    cv_dict: Dict[str, float] = {}
    for param_name, values in param_values.items():
        mean = np.mean(values)
        std = np.std(values)
        cv = float(std / abs(mean)) if abs(mean) > 0 else float("inf")
        cv_dict[param_name] = round(cv, 4)

    # Generate recommendation
    reasons: List[str] = []
    max_cv = max(cv_dict.values()) if cv_dict else 0

    # Check OOS consistency
    oos_pfs = [w.oos_metrics.get("profit_factor", 0) for w in windows]
    oos_pfs_valid = [pf for pf in oos_pfs if pf != float("inf")]
    oos_negative_windows = sum(1 for pf in oos_pfs_valid if pf < 1.0)

    # Robustness checks
    if max_cv > 0.5:
        reasons.append(f"High parameter instability (max CV={max_cv:.2f}). Optimal parameters change significantly across windows.")
    if max_cv <= 0.2 and cv_dict:
        reasons.append(f"Parameters are stable across windows (max CV={max_cv:.2f}).")

    if oos_negative_windows > len(windows) * 0.5:
        reasons.append(f"{oos_negative_windows}/{len(windows)} OOS windows have profit factor < 1.0.")

    if oos_negative_windows == 0 and oos_pfs_valid:
        reasons.append("All OOS windows are profitable.")

    # OOS equity progression
    oos_returns = [w.oos_metrics.get("total_return", 0) for w in windows]
    if len(oos_returns) >= 3:
        # Check for degrading performance
        first_half = np.mean(oos_returns[:len(oos_returns)//2])
        second_half = np.mean(oos_returns[len(oos_returns)//2:])
        if second_half < first_half * 0.5 and first_half > 0:
            reasons.append("Performance degradation: later windows show significantly worse returns.")

    # Final recommendation
    if max_cv > 0.5 or oos_negative_windows > len(windows) * 0.5:
        recommendation = "FAIL"
    elif max_cv > 0.3 or oos_negative_windows > len(windows) * 0.25:
        recommendation = "CAUTION"
    else:
        recommendation = "PASS"

    if not reasons:
        reasons.append("Insufficient data to form recommendation.")

    return ParamStability(
        coefficient_of_variation=cv_dict,
        recommendation=recommendation,
        reasons=reasons,
    )


def run_walk_forward(
    strategy_class: type,
    data: pd.DataFrame,
    config: BacktestConfig,
    param_grid: Dict[str, List],
    num_windows: int = 5,
    is_ratio: float = 0.7,
    optimization_metric: str = "profit_factor",
) -> WalkForwardResult:
    """Run walk-forward analysis with rolling windows.

    Args:
        strategy_class: A BaseStrategy subclass.
        data: OHLCV DataFrame.
        config: Backtest configuration.
        param_grid: {"param_name": [val1, val2, ...]} for optimization.
        num_windows: Number of IS/OOS windows.
        is_ratio: Fraction of each window used for in-sample (0.5-0.9).
        optimization_metric: Metric to maximize during IS optimization.

    Returns:
        WalkForwardResult with per-window and aggregate OOS performance,
        including parameter stability metrics and recommendation.
    """
    total_bars = len(data)
    window_size = total_bars // num_windows
    is_size = int(window_size * is_ratio)

    windows: List[WalkForwardWindow] = []
    all_oos_trades: List[Dict] = []
    all_oos_equity: List[Dict] = []
    running_balance = config.initial_balance

    param_names = list(param_grid.keys())
    param_values = list(param_grid.values())
    all_combos = list(product(*param_values))

    for w in range(num_windows):
        start_idx = w * window_size
        is_end_idx = start_idx + is_size
        oos_end_idx = min(start_idx + window_size, total_bars)

        is_data = data.iloc[start_idx:is_end_idx]
        oos_data = data.iloc[is_end_idx:oos_end_idx]

        if len(is_data) < 20 or len(oos_data) < 5:
            continue

        # Grid search on in-sample
        best_params: dict = {}
        best_metric_value = -float("inf")

        for combo in all_combos:
            params = dict(zip(param_names, combo))
            try:
                strategy = strategy_class(params)
                bt = Backtester(strategy, is_data, config)
                result = bt.run()
                metric_val = result.metrics.get(optimization_metric, 0)
                if metric_val == float("inf"):
                    metric_val = 999.0
                if metric_val > best_metric_value:
                    best_metric_value = metric_val
                    best_params = params
            except Exception:
                continue

        if not best_params:
            best_params = {k: v[len(v) // 2] for k, v in param_grid.items()}

        # Run in-sample with best params for reporting
        is_strategy = strategy_class(best_params)
        is_bt = Backtester(is_strategy, is_data, config)
        is_result = is_bt.run()

        # Run out-of-sample with best params
        oos_config = BacktestConfig(
            initial_balance=running_balance,
            commission=config.commission,
            slippage_ticks=config.slippage_ticks,
            point_value=config.point_value,
            tick_size=config.tick_size,
        )
        oos_strategy = strategy_class(best_params)
        oos_bt = Backtester(oos_strategy, oos_data, oos_config)
        oos_result = oos_bt.run()

        if oos_result.equity_curve:
            running_balance = oos_result.equity_curve[-1]["value"]

        all_oos_trades.extend(oos_result.trades)
        all_oos_equity.extend(oos_result.equity_curve)

        windows.append(WalkForwardWindow(
            window_index=w,
            is_start=str(is_data.index[0]),
            is_end=str(is_data.index[-1]),
            oos_start=str(oos_data.index[0]),
            oos_end=str(oos_data.index[-1]),
            is_bars=len(is_data),
            oos_bars=len(oos_data),
            is_metrics=is_result.metrics,
            oos_metrics=oos_result.metrics,
            best_params=best_params,
        ))

    # Aggregate OOS metrics
    aggregate_oos = calculate_metrics(all_oos_trades, config.initial_balance)

    # Robustness ratio = OOS profit factor / avg IS profit factor
    is_pfs = []
    for w in windows:
        pf = w.is_metrics.get("profit_factor", 0)
        if pf != float("inf"):
            is_pfs.append(pf)
    avg_is_pf = float(np.mean(is_pfs)) if is_pfs else 0
    oos_pf = aggregate_oos.get("profit_factor", 0)
    if oos_pf == float("inf"):
        oos_pf = 999.0
    robustness = round(oos_pf / avg_is_pf, 3) if avg_is_pf > 0 else 0.0

    # Compute parameter stability metrics
    stability = _compute_param_stability(windows)

    return WalkForwardResult(
        num_windows=len(windows),
        is_ratio=is_ratio,
        windows=[asdict(w) for w in windows],
        aggregate_oos_metrics=aggregate_oos,
        oos_trades=all_oos_trades,
        oos_equity_curve=all_oos_equity,
        robustness_ratio=robustness,
        param_stability=asdict(stability),
    )
