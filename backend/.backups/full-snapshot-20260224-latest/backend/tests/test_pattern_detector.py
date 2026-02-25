"""Tests for the trade pattern detector engine."""

import sys
import os
import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from engine.pattern_detector import analyze_trade_patterns


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def sample_ohlcv_data():
    """Generate 500 bars of synthetic OHLCV data with an hourly datetime index."""
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
def sample_trades(sample_ohlcv_data):
    """Build a handful of fake trades aligned to the OHLCV index timestamps."""
    idx = sample_ohlcv_data.index
    trades = [
        {
            "id": "t1",
            "entry_time": int(idx[20].timestamp()),
            "exit_time": int(idx[40].timestamp()),
            "pnl": 150.0,
            "mae": -30.0,
            "mfe": 200.0,
            "side": "long",
        },
        {
            "id": "t2",
            "entry_time": int(idx[60].timestamp()),
            "exit_time": int(idx[90].timestamp()),
            "pnl": -80.0,
            "mae": -120.0,
            "mfe": 50.0,
            "side": "long",
        },
        {
            "id": "t3",
            "entry_time": int(idx[120].timestamp()),
            "exit_time": int(idx[150].timestamp()),
            "pnl": 220.0,
            "mae": -15.0,
            "mfe": 250.0,
            "side": "long",
        },
        {
            "id": "t4",
            "entry_time": int(idx[200].timestamp()),
            "exit_time": int(idx[230].timestamp()),
            "pnl": -40.0,
            "mae": -90.0,
            "mfe": 30.0,
            "side": "short",
        },
        {
            "id": "t5",
            "entry_time": int(idx[300].timestamp()),
            "exit_time": int(idx[340].timestamp()),
            "pnl": 100.0,
            "mae": -25.0,
            "mfe": 180.0,
            "side": "long",
        },
    ]
    return trades


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestAnalyzeTradePatterns:
    """Tests for analyze_trade_patterns."""

    def test_empty_trades(self, sample_ohlcv_data):
        """An empty trade list returns total_trades_analyzed == 0."""
        result = analyze_trade_patterns([], sample_ohlcv_data, lookback=10)
        assert result.total_trades_analyzed == 0

    def test_hourly_patterns(self, sample_trades, sample_ohlcv_data):
        """best_entry_hours is a list when trades are provided."""
        result = analyze_trade_patterns(
            sample_trades, sample_ohlcv_data, lookback=10
        )
        assert isinstance(result.best_entry_hours, list)

    def test_setup_quality_scores(self, sample_trades, sample_ohlcv_data):
        """trade_scores contains dicts with a 'score' key."""
        result = analyze_trade_patterns(
            sample_trades, sample_ohlcv_data, lookback=10
        )
        assert isinstance(result.trade_scores, list)
        for entry in result.trade_scores:
            assert "score" in entry, f"Missing 'score' key in trade_scores entry: {entry}"

    def test_mae_mfe_analysis(self, sample_trades, sample_ohlcv_data):
        """MAE/MFE averages are numeric values."""
        result = analyze_trade_patterns(
            sample_trades, sample_ohlcv_data, lookback=10
        )
        for attr in (
            "avg_mae_winners",
            "avg_mfe_winners",
            "avg_mae_losers",
            "avg_mfe_losers",
        ):
            value = getattr(result, attr)
            assert isinstance(value, (int, float)), (
                f"{attr} should be numeric, got {type(value)}"
            )
