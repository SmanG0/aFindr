"""SQLite connection manager and schema initialization."""
from __future__ import annotations

import os
import sqlite3
from contextlib import contextmanager

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "afindr.db")


@contextmanager
def get_db():
    """Context manager for SQLite connections with WAL mode and Row factory."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    """Create all tables if they don't exist."""
    with get_db() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS positions (
                id TEXT PRIMARY KEY,
                symbol TEXT NOT NULL,
                side TEXT NOT NULL CHECK(side IN ('long', 'short')),
                size REAL NOT NULL,
                entry_price REAL NOT NULL,
                entry_time INTEGER NOT NULL,
                stop_loss REAL,
                take_profit REAL,
                commission REAL NOT NULL DEFAULT 0,
                source TEXT NOT NULL DEFAULT 'manual'
                    CHECK(source IN ('manual', 'backtest', 'strategy')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS trades (
                id TEXT PRIMARY KEY,
                symbol TEXT NOT NULL,
                side TEXT NOT NULL CHECK(side IN ('long', 'short')),
                size REAL NOT NULL,
                entry_price REAL NOT NULL,
                exit_price REAL NOT NULL,
                entry_time INTEGER NOT NULL,
                exit_time INTEGER NOT NULL,
                stop_loss REAL,
                take_profit REAL,
                pnl REAL NOT NULL,
                pnl_points REAL NOT NULL,
                commission REAL NOT NULL DEFAULT 0,
                source TEXT NOT NULL DEFAULT 'manual'
                    CHECK(source IN ('manual', 'backtest', 'strategy')),
                strategy_name TEXT,
                backtest_run_id TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (backtest_run_id) REFERENCES backtest_runs(id)
            );

            CREATE TABLE IF NOT EXISTS backtest_runs (
                id TEXT PRIMARY KEY,
                strategy_name TEXT NOT NULL,
                code TEXT,
                params TEXT,
                symbol TEXT NOT NULL,
                interval TEXT NOT NULL,
                initial_balance REAL NOT NULL DEFAULT 50000,
                metrics TEXT,
                equity_curve TEXT,
                monte_carlo TEXT,
                trade_count INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS account_snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp INTEGER NOT NULL,
                balance REAL NOT NULL,
                equity REAL NOT NULL,
                unrealized_pnl REAL NOT NULL DEFAULT 0,
                position_count INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS schema_version (
                version INTEGER PRIMARY KEY
            );

            CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);
            CREATE INDEX IF NOT EXISTS idx_trades_source ON trades(source);
            CREATE INDEX IF NOT EXISTS idx_trades_exit_time ON trades(exit_time);
            CREATE INDEX IF NOT EXISTS idx_positions_symbol ON positions(symbol);
            CREATE INDEX IF NOT EXISTS idx_backtest_runs_created ON backtest_runs(created_at);
            CREATE INDEX IF NOT EXISTS idx_account_snapshots_ts ON account_snapshots(timestamp);
        """)

    run_migrations()


def _get_schema_version(conn) -> int:
    """Get current schema version."""
    try:
        row = conn.execute("SELECT MAX(version) FROM schema_version").fetchone()
        return row[0] if row[0] is not None else 0
    except sqlite3.OperationalError:
        return 0


def run_migrations():
    """Run pending schema migrations."""
    with get_db() as conn:
        current = _get_schema_version(conn)

        if current < 1:
            # Migration 1: add run_type column to backtest_runs
            try:
                conn.execute(
                    "ALTER TABLE backtest_runs ADD COLUMN run_type TEXT NOT NULL DEFAULT 'backtest'"
                )
            except sqlite3.OperationalError:
                pass  # Column already exists
            conn.execute("INSERT OR IGNORE INTO schema_version (version) VALUES (1)")

        if current < 2:
            # Migration 2: create walk_forward_results table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS walk_forward_results (
                    id TEXT PRIMARY KEY,
                    backtest_run_id TEXT NOT NULL,
                    num_windows INTEGER NOT NULL,
                    is_ratio REAL NOT NULL,
                    robustness_ratio REAL NOT NULL,
                    windows TEXT,
                    aggregate_oos_metrics TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (backtest_run_id) REFERENCES backtest_runs(id)
                )
            """)
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_wf_backtest_run ON walk_forward_results(backtest_run_id)"
            )
            conn.execute("INSERT OR IGNORE INTO schema_version (version) VALUES (2)")
