"""Backtest run persistence — CRUD for backtest_runs and associated trades."""
from __future__ import annotations

import json
import uuid

from db.database import get_db


def insert_backtest_run(
    strategy_name: str,
    symbol: str,
    interval: str,
    trades: list[dict],
    metrics: dict | None = None,
    equity_curve: list | None = None,
    monte_carlo: dict | None = None,
    code: str | None = None,
    params: dict | None = None,
    initial_balance: float = 50000,
    run_type: str = "backtest",
) -> str:
    """Persist a backtest run and its trades. Returns the run ID."""
    run_id = f"bt_{uuid.uuid4().hex[:12]}"

    with get_db() as conn:
        conn.execute(
            """INSERT INTO backtest_runs
               (id, strategy_name, code, params, symbol, interval,
                initial_balance, metrics, equity_curve, monte_carlo, trade_count, run_type)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                run_id, strategy_name, code,
                json.dumps(params) if params else None,
                symbol, interval, initial_balance,
                json.dumps(metrics) if metrics else None,
                json.dumps(equity_curve) if equity_curve else None,
                json.dumps(monte_carlo) if monte_carlo else None,
                len(trades),
                run_type,
            ),
        )

        # Bulk-insert trades with source='backtest'
        for i, t in enumerate(trades):
            trade_id = f"{run_id}_t{i}"
            conn.execute(
                """INSERT INTO trades
                   (id, symbol, side, size, entry_price, exit_price,
                    entry_time, exit_time, stop_loss, take_profit,
                    pnl, pnl_points, commission, source,
                    strategy_name, backtest_run_id)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    trade_id,
                    t.get("instrument", symbol),
                    t.get("side", "long"),
                    t.get("size", 1),
                    t.get("entry_price", 0),
                    t.get("exit_price", 0),
                    t.get("entry_time", 0),
                    t.get("exit_time", 0),
                    t.get("stop_loss"),
                    t.get("take_profit"),
                    t.get("pnl", 0),
                    t.get("pnl_points", 0),
                    t.get("commission", 0),
                    "backtest",
                    strategy_name,
                    run_id,
                ),
            )

    return run_id


def list_backtest_runs(limit: int = 50) -> list[dict]:
    with get_db() as conn:
        rows = conn.execute(
            """SELECT id, strategy_name, symbol, interval, initial_balance,
                      metrics, trade_count, created_at
               FROM backtest_runs
               ORDER BY created_at DESC LIMIT ?""",
            (limit,),
        ).fetchall()

        result = []
        for r in rows:
            entry = dict(r)
            if entry.get("metrics"):
                entry["metrics"] = json.loads(entry["metrics"])
            result.append(entry)
        return result


def get_backtest_run(run_id: str) -> dict | None:
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM backtest_runs WHERE id = ?", (run_id,)
        ).fetchone()
        if not row:
            return None
        entry = dict(row)
        for field in ("metrics", "equity_curve", "monte_carlo", "params"):
            if entry.get(field):
                entry[field] = json.loads(entry[field])
        return entry


def get_backtest_trades(run_id: str) -> list[dict]:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM trades WHERE backtest_run_id = ? ORDER BY entry_time",
            (run_id,),
        ).fetchall()
        return [dict(r) for r in rows]


def insert_walk_forward_result(
    backtest_run_id: str,
    num_windows: int,
    is_ratio: float,
    robustness_ratio: float,
    windows: list[dict] | None = None,
    aggregate_oos_metrics: dict | None = None,
) -> str:
    """Persist walk-forward analysis results linked to a backtest run."""
    wf_id = f"wf_{uuid.uuid4().hex[:12]}"
    with get_db() as conn:
        conn.execute(
            """INSERT INTO walk_forward_results
               (id, backtest_run_id, num_windows, is_ratio, robustness_ratio,
                windows, aggregate_oos_metrics)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                wf_id, backtest_run_id, num_windows, is_ratio, robustness_ratio,
                json.dumps(windows) if windows else None,
                json.dumps(aggregate_oos_metrics) if aggregate_oos_metrics else None,
            ),
        )
    return wf_id


def get_walk_forward_results(backtest_run_id: str) -> dict | None:
    """Get walk-forward results for a backtest run."""
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM walk_forward_results WHERE backtest_run_id = ?",
            (backtest_run_id,),
        ).fetchone()
        if not row:
            return None
        entry = dict(row)
        for field in ("windows", "aggregate_oos_metrics"):
            if entry.get(field):
                entry[field] = json.loads(entry[field])
        return entry
