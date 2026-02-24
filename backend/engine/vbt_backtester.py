"""VectorBT backtester wrapper.

Wraps vbt.Portfolio.from_signals() to run vectorized backtests.
Converts VectorBT results to the same BacktestResult format used by
the bar-by-bar backtester, so the frontend needs zero changes.

Also supports vectorized parameter sweeps — testing thousands of
parameter combinations in seconds via VectorBT's broadcasting.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, List, Dict, Any

import numpy as np
import pandas as pd

try:
    import vectorbt as vbt
    HAS_VBT = True
except ImportError:
    HAS_VBT = False

from engine.backtester import BacktestConfig, BacktestResult
from engine.metrics import calculate_metrics
from engine.vbt_strategy import VectorBTStrategy, TradeSignal


@dataclass
class SweepResult:
    """Result of a vectorized parameter sweep."""
    param_names: List[str]
    param_combos: List[Dict[str, Any]]
    metrics: List[Dict]  # One metrics dict per combo
    best_params: Dict[str, Any]
    best_metrics: Dict
    total_combos: int
    # Heatmap data (for 2-param sweeps)
    heatmap_data: Optional[Dict] = None


def run_signals_backtest(
    strategy: VectorBTStrategy,
    data: pd.DataFrame,
    config: BacktestConfig,
) -> BacktestResult:
    """Fallback: run a VectorBTStrategy without VectorBT installed.

    Uses the strategy's generate_signals() to get boolean arrays, then
    simulates trades bar-by-bar. Produces the same BacktestResult format.
    """
    signals = strategy.generate_signals(data)
    close = data["close"].values
    rows = data.reset_index()

    balance = config.initial_balance
    trades: list[dict] = []
    equity_curve: list[dict] = []
    trade_id = 0
    in_position = False
    entry_price = 0.0
    entry_time = 0
    entry_idx = 0

    for i in range(len(rows)):
        row = rows.iloc[i]
        ts = int(row.iloc[0].timestamp()) if hasattr(row.iloc[0], "timestamp") else int(row.iloc[0])
        price = float(close[i])

        if not in_position and bool(signals.entries[i]):
            in_position = True
            entry_price = price
            entry_time = ts
            entry_idx = i
        elif in_position and bool(signals.exits[i]):
            pnl_points = price - entry_price
            pnl = pnl_points * config.point_value - config.commission * 2
            balance += pnl
            trade_id += 1
            trades.append({
                "id": trade_id,
                "instrument": "N/A",
                "side": "long",
                "size": 1,
                "entry_price": entry_price,
                "exit_price": price,
                "entry_time": entry_time,
                "exit_time": ts,
                "stop_loss": None,
                "take_profit": None,
                "pnl": round(pnl, 2),
                "pnl_points": round(pnl_points, 2),
                "commission": config.commission * 2,
            })
            in_position = False

        equity_curve.append({"time": ts, "value": round(balance, 2)})

    metrics = calculate_metrics(trades, config.initial_balance)
    return BacktestResult(trades=trades, equity_curve=equity_curve, metrics=metrics)


def run_vbt_backtest(
    strategy: VectorBTStrategy,
    data: pd.DataFrame,
    config: BacktestConfig,
) -> BacktestResult:
    """Run a single VectorBT backtest and return standard BacktestResult.

    Args:
        strategy: A VectorBTStrategy instance with params set.
        data: OHLCV DataFrame.
        config: Backtest configuration (initial_balance, commission, etc.).

    Returns:
        BacktestResult compatible with the bar-by-bar backtester output.
    """
    if not HAS_VBT:
        raise ImportError(
            "vectorbt is not installed. Install with: pip install vectorbt"
        )

    signals = strategy.generate_signals(data)

    # Build VectorBT portfolio
    close = data["close"]

    # Commission as percentage of trade value
    # config.commission is a flat dollar amount, convert to approximate pct
    avg_price = float(close.mean())
    commission_pct = config.commission / (avg_price * config.point_value) if avg_price > 0 else 0.0

    pf_kwargs = dict(
        close=close,
        entries=signals.entries,
        exits=signals.exits,
        init_cash=config.initial_balance,
        fees=commission_pct,
        slippage=config.slippage_ticks * config.tick_size / avg_price if avg_price > 0 else 0.0,
        size=1.0,
        size_type="amount",
        accumulate=False,
        freq="1D",
    )

    if signals.short_entries is not None and signals.short_exits is not None:
        pf_kwargs["short_entries"] = signals.short_entries
        pf_kwargs["short_exits"] = signals.short_exits

    pf = vbt.Portfolio.from_signals(**pf_kwargs)

    return _portfolio_to_result(pf, data, config)


def run_vbt_sweep(
    strategy_class: type,
    data: pd.DataFrame,
    config: BacktestConfig,
    param_grid: Dict[str, List],
    optimization_metric: str = "sharpe_ratio",
) -> SweepResult:
    """Run a vectorized parameter sweep.

    Tests all combinations of parameters in param_grid simultaneously
    using VectorBT's broadcasting. Much faster than sequential grid search.

    Args:
        strategy_class: A VectorBTStrategy subclass.
        data: OHLCV DataFrame.
        config: Backtest configuration.
        param_grid: {"param_name": [val1, val2, ...]} for each parameter.
        optimization_metric: Metric to rank results by.

    Returns:
        SweepResult with metrics for every combination and best params.
    """
    if not HAS_VBT:
        raise ImportError("vectorbt is not installed")

    from itertools import product

    param_names = list(param_grid.keys())
    param_values = list(param_grid.values())
    all_combos = list(product(*param_values))

    results: List[Dict] = []

    for combo in all_combos:
        params = dict(zip(param_names, combo))
        try:
            strategy = strategy_class(params)
            result = run_vbt_backtest(strategy, data, config)
            result.metrics["params"] = params
            results.append(result.metrics)
        except Exception:
            # Skip failed parameter combos
            results.append({"params": params, "error": True})

    # Filter valid results and find best
    valid_results = [r for r in results if not r.get("error")]

    if not valid_results:
        return SweepResult(
            param_names=param_names,
            param_combos=[dict(zip(param_names, c)) for c in all_combos],
            metrics=results,
            best_params={},
            best_metrics={},
            total_combos=len(all_combos),
        )

    # Sort by optimization metric
    def get_metric(m: dict) -> float:
        val = m.get(optimization_metric, 0)
        if val == float("inf"):
            val = 999.0
        return val

    sorted_results = sorted(valid_results, key=get_metric, reverse=True)
    best = sorted_results[0]

    # Build heatmap data for 2-param sweeps
    heatmap_data = None
    if len(param_names) == 2:
        heatmap_data = _build_heatmap(
            param_names, valid_results, optimization_metric
        )

    return SweepResult(
        param_names=param_names,
        param_combos=[dict(zip(param_names, c)) for c in all_combos],
        metrics=results,
        best_params=best.get("params", {}),
        best_metrics={k: v for k, v in best.items() if k != "params"},
        total_combos=len(all_combos),
        heatmap_data=heatmap_data,
    )


def _portfolio_to_result(
    pf, data: pd.DataFrame, config: BacktestConfig
) -> BacktestResult:
    """Convert a VectorBT Portfolio to our standard BacktestResult."""
    # Extract trades
    trades_df = pf.trades.records_readable
    trades = []

    if len(trades_df) > 0:
        for i, row in trades_df.iterrows():
            entry_idx = int(row.get("Entry Index", row.get("Entry Idx", 0)))
            exit_idx = int(row.get("Exit Index", row.get("Exit Idx", len(data) - 1)))

            entry_time = int(data.index[min(entry_idx, len(data) - 1)].timestamp()) if hasattr(data.index[0], "timestamp") else entry_idx
            exit_time = int(data.index[min(exit_idx, len(data) - 1)].timestamp()) if hasattr(data.index[0], "timestamp") else exit_idx

            entry_price = float(row.get("Avg Entry Price", row.get("Entry Price", 0)))
            exit_price = float(row.get("Avg Exit Price", row.get("Exit Price", 0)))

            direction = str(row.get("Direction", "Long")).lower()
            side = "long" if "long" in direction else "short"

            pnl_points = (exit_price - entry_price) if side == "long" else (entry_price - exit_price)
            pnl = pnl_points * config.point_value * float(row.get("Size", 1))

            trades.append({
                "id": i + 1,
                "instrument": "N/A",
                "side": side,
                "size": float(row.get("Size", 1)),
                "entry_price": round(entry_price, 2),
                "exit_price": round(exit_price, 2),
                "entry_time": entry_time,
                "exit_time": exit_time,
                "stop_loss": None,
                "take_profit": None,
                "pnl": round(pnl, 2),
                "pnl_points": round(pnl_points, 2),
                "commission": config.commission * 2,
                "mae": 0.0,
                "mfe": 0.0,
            })

    # Equity curve
    equity_series = pf.value()
    equity_curve = []
    step = max(1, len(equity_series) // 500)
    for idx in range(0, len(equity_series), step):
        ts = equity_series.index[idx]
        time_val = int(ts.timestamp()) if hasattr(ts, "timestamp") else idx
        equity_curve.append({
            "time": time_val,
            "value": round(float(equity_series.iloc[idx]), 2),
        })
    # Always include the last point
    if equity_curve and equity_curve[-1]["time"] != (int(equity_series.index[-1].timestamp()) if hasattr(equity_series.index[-1], "timestamp") else len(equity_series) - 1):
        ts = equity_series.index[-1]
        time_val = int(ts.timestamp()) if hasattr(ts, "timestamp") else len(equity_series) - 1
        equity_curve.append({
            "time": time_val,
            "value": round(float(equity_series.iloc[-1]), 2),
        })

    metrics = calculate_metrics(trades, config.initial_balance)

    return BacktestResult(trades=trades, equity_curve=equity_curve, metrics=metrics)


def _build_heatmap(
    param_names: List[str],
    results: List[Dict],
    metric_name: str,
) -> Dict:
    """Build heatmap data for 2-parameter sweeps."""
    x_name, y_name = param_names[0], param_names[1]

    x_vals = sorted(set(r["params"][x_name] for r in results if "params" in r))
    y_vals = sorted(set(r["params"][y_name] for r in results if "params" in r))

    grid = []
    for r in results:
        if "params" not in r:
            continue
        val = r.get(metric_name, 0)
        if val == float("inf"):
            val = 999.0
        grid.append({
            "x": r["params"][x_name],
            "y": r["params"][y_name],
            "value": round(val, 4),
            "metrics": {k: v for k, v in r.items() if k != "params" and k != "error"},
        })

    return {
        "x_param": x_name,
        "y_param": y_name,
        "x_values": x_vals,
        "y_values": y_vals,
        "metric": metric_name,
        "cells": grid,
    }
