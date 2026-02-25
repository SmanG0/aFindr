"""Trade & position CRUD + analytics queries."""
from __future__ import annotations

import json
import time
from typing import Any

from db.database import get_db


# ── Positions ──

def insert_position(pos: dict) -> None:
    with get_db() as conn:
        conn.execute(
            """INSERT OR REPLACE INTO positions
               (id, symbol, side, size, entry_price, entry_time,
                stop_loss, take_profit, commission, source)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                pos["id"], pos["symbol"], pos["side"], pos["size"],
                pos["entry_price"], pos["entry_time"],
                pos.get("stop_loss"), pos.get("take_profit"),
                pos.get("commission", 0), pos.get("source", "manual"),
            ),
        )


def delete_position(position_id: str) -> dict | None:
    """Remove a position and return it (for moving to trades)."""
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM positions WHERE id = ?", (position_id,)
        ).fetchone()
        if row:
            conn.execute("DELETE FROM positions WHERE id = ?", (position_id,))
            return dict(row)
    return None


def get_open_positions() -> list[dict]:
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM positions ORDER BY entry_time DESC").fetchall()
        return [dict(r) for r in rows]


def bulk_sync_positions(positions: list[dict]) -> None:
    """Full sync: replace all positions with the provided list."""
    with get_db() as conn:
        conn.execute("DELETE FROM positions")
        for pos in positions:
            conn.execute(
                """INSERT INTO positions
                   (id, symbol, side, size, entry_price, entry_time,
                    stop_loss, take_profit, commission, source)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    pos["id"], pos["symbol"], pos["side"], pos["size"],
                    pos["entry_price"], pos["entry_time"],
                    pos.get("stop_loss"), pos.get("take_profit"),
                    pos.get("commission", 0), pos.get("source", "manual"),
                ),
            )


# ── Trades ──

def insert_trade(trade: dict) -> None:
    with get_db() as conn:
        conn.execute(
            """INSERT OR REPLACE INTO trades
               (id, symbol, side, size, entry_price, exit_price,
                entry_time, exit_time, stop_loss, take_profit,
                pnl, pnl_points, commission, source,
                strategy_name, backtest_run_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                trade["id"], trade["symbol"], trade["side"], trade["size"],
                trade["entry_price"], trade["exit_price"],
                trade["entry_time"], trade["exit_time"],
                trade.get("stop_loss"), trade.get("take_profit"),
                trade["pnl"], trade["pnl_points"],
                trade.get("commission", 0), trade.get("source", "manual"),
                trade.get("strategy_name"), trade.get("backtest_run_id"),
            ),
        )


def bulk_sync_trades(trades: list[dict]) -> None:
    """Full sync: upsert all closed trades (manual source only)."""
    with get_db() as conn:
        # Only clear manual trades — preserve backtest/strategy trades
        conn.execute("DELETE FROM trades WHERE source = 'manual'")
        for trade in trades:
            conn.execute(
                """INSERT OR REPLACE INTO trades
                   (id, symbol, side, size, entry_price, exit_price,
                    entry_time, exit_time, stop_loss, take_profit,
                    pnl, pnl_points, commission, source)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    trade["id"], trade["symbol"], trade["side"], trade["size"],
                    trade["entry_price"], trade["exit_price"],
                    trade["entry_time"], trade["exit_time"],
                    trade.get("stop_loss"), trade.get("take_profit"),
                    trade["pnl"], trade["pnl_points"],
                    trade.get("commission", 0), "manual",
                ),
            )


def get_trades(
    symbol: str | None = None,
    source: str | None = None,
    limit: int = 100,
    offset: int = 0,
    since: int | None = None,
    until: int | None = None,
) -> list[dict]:
    clauses = []
    params: list[Any] = []
    if symbol:
        clauses.append("symbol = ?")
        params.append(symbol)
    if source:
        clauses.append("source = ?")
        params.append(source)
    if since:
        clauses.append("exit_time >= ?")
        params.append(since)
    if until:
        clauses.append("exit_time <= ?")
        params.append(until)

    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    query = f"SELECT * FROM trades {where} ORDER BY exit_time DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    with get_db() as conn:
        rows = conn.execute(query, params).fetchall()
        return [dict(r) for r in rows]


def get_trade_analytics(
    symbol: str | None = None,
    since: int | None = None,
) -> dict:
    clauses = []
    params: list[Any] = []
    if symbol:
        clauses.append("symbol = ?")
        params.append(symbol)
    if since:
        clauses.append("exit_time >= ?")
        params.append(since)

    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""

    with get_db() as conn:
        # Basic stats
        row = conn.execute(f"""
            SELECT
                COUNT(*) as total_trades,
                SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins,
                SUM(CASE WHEN pnl <= 0 THEN 1 ELSE 0 END) as losses,
                SUM(pnl) as total_pnl,
                AVG(CASE WHEN pnl > 0 THEN pnl END) as avg_win,
                AVG(CASE WHEN pnl <= 0 THEN pnl END) as avg_loss,
                SUM(CASE WHEN pnl > 0 THEN pnl ELSE 0 END) as gross_profit,
                SUM(CASE WHEN pnl < 0 THEN ABS(pnl) ELSE 0 END) as gross_loss
            FROM trades {where}
        """, params).fetchone()

        total = row["total_trades"] or 0
        wins = row["wins"] or 0
        gross_profit = row["gross_profit"] or 0
        gross_loss = row["gross_loss"] or 0

        # P&L by symbol
        pnl_by_symbol = {}
        for r in conn.execute(f"""
            SELECT symbol, SUM(pnl) as total_pnl, COUNT(*) as trade_count
            FROM trades {where}
            GROUP BY symbol ORDER BY total_pnl DESC
        """, params).fetchall():
            pnl_by_symbol[r["symbol"]] = {
                "total_pnl": round(r["total_pnl"], 2),
                "trade_count": r["trade_count"],
            }

        # P&L by day of week
        pnl_by_day = {}
        for r in conn.execute(f"""
            SELECT
                CASE CAST(strftime('%w', exit_time / 1000, 'unixepoch') AS INTEGER)
                    WHEN 0 THEN 'Sunday' WHEN 1 THEN 'Monday'
                    WHEN 2 THEN 'Tuesday' WHEN 3 THEN 'Wednesday'
                    WHEN 4 THEN 'Thursday' WHEN 5 THEN 'Friday'
                    WHEN 6 THEN 'Saturday'
                END as day_name,
                SUM(pnl) as total_pnl,
                COUNT(*) as trade_count
            FROM trades {where}
            GROUP BY day_name
        """, params).fetchall():
            pnl_by_day[r["day_name"]] = {
                "total_pnl": round(r["total_pnl"], 2),
                "trade_count": r["trade_count"],
            }

        return {
            "total_trades": total,
            "wins": wins,
            "losses": row["losses"] or 0,
            "win_rate": round(wins / total * 100, 1) if total > 0 else 0,
            "total_pnl": round(row["total_pnl"] or 0, 2),
            "avg_win": round(row["avg_win"] or 0, 2),
            "avg_loss": round(row["avg_loss"] or 0, 2),
            "profit_factor": round(gross_profit / gross_loss, 2) if gross_loss > 0 else 9999.99 if gross_profit > 0 else 0,
            "pnl_by_symbol": pnl_by_symbol,
            "pnl_by_day": pnl_by_day,
        }


# ── Account Snapshots ──

def insert_account_snapshot(snapshot: dict) -> None:
    with get_db() as conn:
        conn.execute(
            """INSERT INTO account_snapshots
               (timestamp, balance, equity, unrealized_pnl, position_count)
               VALUES (?, ?, ?, ?, ?)""",
            (
                snapshot.get("timestamp", int(time.time() * 1000)),
                snapshot["balance"],
                snapshot["equity"],
                snapshot.get("unrealized_pnl", 0),
                snapshot.get("position_count", 0),
            ),
        )


def get_account_snapshots(limit: int = 500) -> list[dict]:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM account_snapshots ORDER BY timestamp DESC LIMIT ?",
            (limit,),
        ).fetchall()
        return [dict(r) for r in rows]
