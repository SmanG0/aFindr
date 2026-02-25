"""Shared test fixtures for the aFindr backend test suite."""
from __future__ import annotations

import os
import tempfile

import numpy as np
import pandas as pd
import pytest

from engine.backtester import BacktestConfig


@pytest.fixture
def sample_ohlcv_data():
    """Generate 500 synthetic OHLCV bars with seed=42."""
    rng = np.random.default_rng(42)
    n = 500
    base_price = 20000.0
    dates = pd.date_range("2024-01-01", periods=n, freq="D")

    prices = [base_price]
    for _ in range(n - 1):
        change = rng.normal(0, 50)
        prices.append(prices[-1] + change)

    closes = np.array(prices)
    highs = closes + rng.uniform(10, 80, n)
    lows = closes - rng.uniform(10, 80, n)
    opens = closes + rng.uniform(-30, 30, n)
    volumes = rng.integers(1000, 50000, n).astype(float)

    df = pd.DataFrame({
        "open": opens,
        "high": highs,
        "low": lows,
        "close": closes,
        "volume": volumes,
    }, index=dates)
    return df


@pytest.fixture
def backtest_config():
    """Default NQ backtest config."""
    return BacktestConfig(
        initial_balance=50000,
        commission=2.50,
        slippage_ticks=1,
        point_value=20.0,
        tick_size=0.25,
    )


@pytest.fixture
def temp_db(tmp_path):
    """Create an isolated SQLite database for testing."""
    import db.database as db_mod
    original_path = db_mod.DB_PATH
    test_db_path = str(tmp_path / "test_afindr.db")
    db_mod.DB_PATH = test_db_path
    db_mod.init_db()
    yield test_db_path
    db_mod.DB_PATH = original_path
