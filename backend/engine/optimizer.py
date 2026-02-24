"""Strategy parameter optimizer.

Supports grid search and random search over strategy parameter space.
Returns ranked parameter combinations with full metrics.
"""
from __future__ import annotations

from dataclasses import dataclass, asdict
from itertools import product
from typing import List, Dict

import numpy as np
import pandas as pd

from engine.backtester import Backtester, BacktestConfig
from engine.metrics import calculate_metrics


@dataclass
class OptimizationResult:
    method: str  # "grid" or "random"
    total_combinations: int
    evaluated: int
    best_params: dict
    best_metric_value: float
    optimization_metric: str
    results: List[Dict]  # [{params, metrics, rank}] — top N
    sensitivity: Dict[str, float]  # {param_name: abs_correlation_with_metric}

    def to_dict(self) -> dict:
        return asdict(self)


def grid_search(
    strategy_class: type,
    data: pd.DataFrame,
    config: BacktestConfig,
    param_grid: Dict[str, List],
    optimization_metric: str = "profit_factor",
    top_n: int = 20,
) -> OptimizationResult:
    """Exhaustive grid search over parameter space.

    Args:
        strategy_class: A BaseStrategy subclass.
        data: OHLCV DataFrame.
        config: Backtest configuration.
        param_grid: {"param_name": [val1, val2, ...], ...}
        optimization_metric: Metric to maximize (key from calculate_metrics output).
        top_n: Number of top results to return.
    """
    param_names = list(param_grid.keys())
    param_values = list(param_grid.values())
    all_combos = list(product(*param_values))

    results = []
    for combo in all_combos:
        params = dict(zip(param_names, combo))
        try:
            strategy = strategy_class(params)
            bt = Backtester(strategy, data, config)
            result = bt.run()
            metric_val = result.metrics.get(optimization_metric, 0)
            if metric_val == float("inf"):
                metric_val = 999.0
            results.append({
                "params": params,
                "metrics": result.metrics,
                "metric_value": round(metric_val, 4),
            })
        except Exception:
            continue

    # Sort by optimization metric descending
    results.sort(key=lambda x: x["metric_value"], reverse=True)

    # Parameter sensitivity: |correlation| of each param with the metric
    sensitivity: Dict[str, float] = {}
    if len(results) > 5:
        metric_values = np.array([r["metric_value"] for r in results])
        for pname in param_names:
            param_vals = np.array([float(r["params"][pname]) for r in results])
            if np.std(param_vals) > 0 and np.std(metric_values) > 0:
                corr = float(np.corrcoef(param_vals, metric_values)[0, 1])
                sensitivity[pname] = round(abs(corr), 3)
            else:
                sensitivity[pname] = 0.0

    best = results[0] if results else {"params": {}, "metric_value": 0}

    # Add rank to top results
    for i, r in enumerate(results[:top_n]):
        r["rank"] = i + 1

    return OptimizationResult(
        method="grid",
        total_combinations=len(all_combos),
        evaluated=len(results),
        best_params=best["params"],
        best_metric_value=best["metric_value"],
        optimization_metric=optimization_metric,
        results=results[:top_n],
        sensitivity=sensitivity,
    )


def random_search(
    strategy_class: type,
    data: pd.DataFrame,
    config: BacktestConfig,
    param_ranges: Dict[str, Dict],
    optimization_metric: str = "profit_factor",
    num_trials: int = 100,
    top_n: int = 20,
    seed: int = 42,
) -> OptimizationResult:
    """Random search over parameter space.

    Args:
        strategy_class: A BaseStrategy subclass.
        data: OHLCV DataFrame.
        config: Backtest configuration.
        param_ranges: {"param_name": {"min": 5, "max": 30, "step": 1}, ...}
                      or {"param_name": {"values": [1, 2, 3]}}
        optimization_metric: Metric to maximize.
        num_trials: Number of random parameter combos to test.
        top_n: Number of top results to return.
        seed: Random seed for reproducibility.
    """
    rng = np.random.default_rng(seed)

    results = []
    for _ in range(num_trials):
        params: dict = {}
        for name, spec in param_ranges.items():
            if "values" in spec:
                params[name] = rng.choice(spec["values"]).item()
            else:
                low = spec.get("min", 1)
                high = spec.get("max", 100)
                step = spec.get("step", 1)
                val = int(rng.integers(low // step, high // step + 1) * step)
                params[name] = val

        try:
            strategy = strategy_class(params)
            bt = Backtester(strategy, data, config)
            result = bt.run()
            metric_val = result.metrics.get(optimization_metric, 0)
            if metric_val == float("inf"):
                metric_val = 999.0
            results.append({
                "params": params,
                "metrics": result.metrics,
                "metric_value": round(metric_val, 4),
            })
        except Exception:
            continue

    results.sort(key=lambda x: x["metric_value"], reverse=True)
    best = results[0] if results else {"params": {}, "metric_value": 0}

    for i, r in enumerate(results[:top_n]):
        r["rank"] = i + 1

    return OptimizationResult(
        method="random",
        total_combinations=num_trials,
        evaluated=len(results),
        best_params=best["params"],
        best_metric_value=best["metric_value"],
        optimization_metric=optimization_metric,
        results=results[:top_n],
        sensitivity={},
    )
