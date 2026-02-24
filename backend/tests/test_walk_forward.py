"""Tests for the walk-forward optimization engine."""

import sys
import os
import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from engine.backtester import BacktestConfig
from engine.walk_forward import run_walk_forward
from engine.strategy import BaseStrategy, Signal


# ---------------------------------------------------------------------------
# Simple strategy used by all tests
# ---------------------------------------------------------------------------

class SimpleBuyStrategy(BaseStrategy):
    """Buys when the current close is above the previous close."""

    def on_bar(self, bar, history):
        period = self.params.get("period", 10)
        if len(history) < period + 2:
            return None
        if bar["close"] > history["close"].iloc[-2]:
            return Signal(action="buy", size=1.0)
        return Signal(action="close")


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def sample_ohlcv_data():
    """Generate 500 bars of synthetic OHLCV data."""
    np.random.seed(0)
    dates = pd.date_range(start="2024-01-01", periods=500, freq="1h")
    close = 100 + np.cumsum(np.random.randn(500) * 0.5)
    high = close + np.abs(np.random.randn(500) * 0.3)
    low = close - np.abs(np.random.randn(500) * 0.3)
    open_ = close + np.random.randn(500) * 0.2
    volume = np.random.randint(1000, 50000, size=500).astype(float)
    df = pd.DataFrame(
        {"open": open_, "high": high, "low": low, "close": close, "volume": volume},
        index=dates,
    )
    return df


@pytest.fixture
def backtest_config():
    """Default backtest configuration."""
    return BacktestConfig(
        initial_balance=100000,
        commission=2.50,
        slippage_ticks=1,
        point_value=20.0,
        tick_size=0.25,
    )


PARAM_GRID = {"period": [5, 10, 15]}


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestRunWalkForward:
    """Tests for run_walk_forward."""

    def test_window_count(self, sample_ohlcv_data, backtest_config):
        """Number of windows in result matches the requested count (or close)."""
        result = run_walk_forward(
            strategy_class=SimpleBuyStrategy,
            data=sample_ohlcv_data,
            config=backtest_config,
            param_grid=PARAM_GRID,
            num_windows=3,
            is_ratio=0.7,
            optimization_metric="profit_factor",
        )
        # Some windows may be skipped if data is insufficient, but we expect
        # the reported num_windows to match the length of the windows list.
        assert result.num_windows == len(result.windows)
        assert result.num_windows >= 1

    def test_robustness_ratio(self, sample_ohlcv_data, backtest_config):
        """Robustness ratio is a non-negative float."""
        result = run_walk_forward(
            strategy_class=SimpleBuyStrategy,
            data=sample_ohlcv_data,
            config=backtest_config,
            param_grid=PARAM_GRID,
            num_windows=3,
            is_ratio=0.7,
            optimization_metric="profit_factor",
        )
        assert isinstance(result.robustness_ratio, float)
        assert result.robustness_ratio >= 0.0

    def test_oos_trades_aggregated(self, sample_ohlcv_data, backtest_config):
        """Out-of-sample trades are aggregated into a list."""
        result = run_walk_forward(
            strategy_class=SimpleBuyStrategy,
            data=sample_ohlcv_data,
            config=backtest_config,
            param_grid=PARAM_GRID,
            num_windows=3,
            is_ratio=0.7,
            optimization_metric="profit_factor",
        )
        assert isinstance(result.oos_trades, list)

    def test_best_params_selected(self, sample_ohlcv_data, backtest_config):
        """Each window dict contains a best_params key."""
        result = run_walk_forward(
            strategy_class=SimpleBuyStrategy,
            data=sample_ohlcv_data,
            config=backtest_config,
            param_grid=PARAM_GRID,
            num_windows=3,
            is_ratio=0.7,
            optimization_metric="profit_factor",
        )
        for window in result.windows:
            assert "best_params" in window, f"Window missing best_params: {window}"
