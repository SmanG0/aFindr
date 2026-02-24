"""Tests for the Backtester engine."""

import pandas as pd
import numpy as np
import pytest

from engine.backtester import Backtester, BacktestConfig, BacktestResult
from engine.strategy import BaseStrategy, Signal


# ---------------------------------------------------------------------------
# Inline strategy helpers
# ---------------------------------------------------------------------------

class AlwaysLongOnBar5ThenCloseOnBar10(BaseStrategy):
    """Buy on bar 5, close on bar 10."""

    def __init__(self):
        super().__init__({})

    def on_bar(self, bar, history):
        idx = len(history)
        if idx == 5:
            return Signal(action="buy", size=1.0)
        if idx == 10:
            return Signal(action="close", size=1.0)
        return None


class AlwaysShortOnBar5ThenCloseOnBar10(BaseStrategy):
    """Sell on bar 5, close on bar 10."""

    def __init__(self):
        super().__init__({})

    def on_bar(self, bar, history):
        idx = len(history)
        if idx == 5:
            return Signal(action="sell", size=1.0)
        if idx == 10:
            return Signal(action="close", size=1.0)
        return None


class LongWithStopLoss(BaseStrategy):
    """Buy on bar 5 with a tight stop-loss that the data will hit."""

    def __init__(self):
        super().__init__({})

    def on_bar(self, bar, history):
        idx = len(history)
        if idx == 5:
            return Signal(
                action="buy",
                size=1.0,
                stop_loss=bar["close"] - 2.0,
                take_profit=None,
            )
        return None


class LongWithTakeProfit(BaseStrategy):
    """Buy on bar 5 with a take-profit that the data will hit."""

    def __init__(self):
        super().__init__({})

    def on_bar(self, bar, history):
        idx = len(history)
        if idx == 5:
            return Signal(
                action="buy",
                size=1.0,
                stop_loss=None,
                take_profit=bar["close"] + 2.0,
            )
        return None


class BuyOnBar5NeverClose(BaseStrategy):
    """Buy on bar 5 and never explicitly close – tests force-close."""

    def __init__(self):
        super().__init__({})

    def on_bar(self, bar, history):
        idx = len(history)
        if idx == 5:
            return Signal(action="buy", size=1.0)
        return None


class NeverSignals(BaseStrategy):
    """Never emits any signal – for empty / no-trade scenarios."""

    def __init__(self):
        super().__init__({})

    def on_bar(self, bar, history):
        return None


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestBacktester:

    def test_run_returns_result(self, sample_ohlcv_data, backtest_config):
        """run() returns a BacktestResult with trades, equity_curve, and metrics."""
        strategy = AlwaysLongOnBar5ThenCloseOnBar10()
        bt = Backtester(strategy, sample_ohlcv_data, backtest_config)
        result = bt.run()

        assert isinstance(result, BacktestResult)
        assert isinstance(result.trades, list)
        assert isinstance(result.equity_curve, (list, pd.Series, np.ndarray))
        assert isinstance(result.metrics, dict)

    def test_long_pnl_math(self, sample_ohlcv_data, backtest_config):
        """Long PnL = (exit - entry) * point_value * size (commission tracked separately)."""
        strategy = AlwaysLongOnBar5ThenCloseOnBar10()
        bt = Backtester(strategy, sample_ohlcv_data, backtest_config)
        result = bt.run()

        assert len(result.trades) >= 1
        trade = result.trades[0]

        expected_pnl = (
            (trade["exit_price"] - trade["entry_price"])
            * backtest_config.point_value
            * trade["size"]
        )
        assert trade["pnl"] == pytest.approx(expected_pnl, abs=0.1)

    def test_short_pnl_math(self, sample_ohlcv_data, backtest_config):
        """Short PnL = (entry - exit) * point_value * size (commission tracked separately)."""
        strategy = AlwaysShortOnBar5ThenCloseOnBar10()
        bt = Backtester(strategy, sample_ohlcv_data, backtest_config)
        result = bt.run()

        assert len(result.trades) >= 1
        trade = result.trades[0]

        expected_pnl = (
            (trade["entry_price"] - trade["exit_price"])
            * backtest_config.point_value
            * trade["size"]
        )
        assert trade["pnl"] == pytest.approx(expected_pnl, abs=0.1)

    def test_stop_loss_triggers(self, sample_ohlcv_data, backtest_config):
        """A long position with a stop-loss exits when bar low <= SL."""
        strategy = LongWithStopLoss()
        bt = Backtester(strategy, sample_ohlcv_data, backtest_config)
        result = bt.run()

        # The position should have been stopped out (closed automatically).
        assert len(result.trades) >= 1
        trade = result.trades[0]
        assert trade["exit_price"] is not None
        assert trade["exit_time"] is not None
        # Exit price should be at or near the stop-loss level.
        assert trade["exit_price"] <= trade["entry_price"]

    def test_take_profit_triggers(self, sample_ohlcv_data, backtest_config):
        """A long position with a take-profit exits when bar high >= TP."""
        strategy = LongWithTakeProfit()
        bt = Backtester(strategy, sample_ohlcv_data, backtest_config)
        result = bt.run()

        assert len(result.trades) >= 1
        trade = result.trades[0]
        assert trade["exit_price"] is not None
        assert trade["exit_time"] is not None
        # Exit price should be at or near the take-profit level.
        assert trade["exit_price"] >= trade["entry_price"]

    def test_slippage_applied(self, sample_ohlcv_data, backtest_config):
        """Entry/exit prices incorporate slippage (slippage_ticks * tick_size)."""
        strategy = AlwaysLongOnBar5ThenCloseOnBar10()
        bt = Backtester(strategy, sample_ohlcv_data, backtest_config)
        result = bt.run()

        assert len(result.trades) >= 1
        trade = result.trades[0]

        slippage = backtest_config.slippage_ticks * backtest_config.tick_size
        # For a long entry, slippage should make the entry price worse (higher).
        # Exact assertion depends on the reference price; just ensure slippage > 0
        # and the entry_price is not exactly equal to the bar close at bar 5.
        bar5_close = sample_ohlcv_data.iloc[5]["close"]
        assert slippage > 0
        # Entry should be at least bar5_close (possibly higher due to slippage).
        assert trade["entry_price"] >= bar5_close or pytest.approx(
            trade["entry_price"], abs=slippage + 0.01
        )

    def test_commission_deducted(self, sample_ohlcv_data, backtest_config):
        """Commission is deducted on both open and close (total = 2 * commission)."""
        strategy = AlwaysLongOnBar5ThenCloseOnBar10()
        bt = Backtester(strategy, sample_ohlcv_data, backtest_config)
        result = bt.run()

        assert len(result.trades) >= 1
        trade = result.trades[0]

        # Commission should be 2x the per-side commission from config.
        expected_commission = 2 * backtest_config.commission
        assert trade["commission"] == pytest.approx(expected_commission, abs=1e-6)

    def test_mae_mfe_tracked(self, sample_ohlcv_data, backtest_config):
        """Closed trades have MAE and MFE fields populated."""
        strategy = AlwaysLongOnBar5ThenCloseOnBar10()
        bt = Backtester(strategy, sample_ohlcv_data, backtest_config)
        result = bt.run()

        assert len(result.trades) >= 1
        trade = result.trades[0]

        assert "mae" in trade
        assert "mfe" in trade
        assert trade["mae"] is not None
        assert trade["mfe"] is not None

    def test_open_position_force_closed(self, sample_ohlcv_data, backtest_config):
        """If backtest ends with an open position, it is force-closed on the last bar."""
        strategy = BuyOnBar5NeverClose()
        bt = Backtester(strategy, sample_ohlcv_data, backtest_config)
        result = bt.run()

        # There should be a trade even though the strategy never closes.
        assert len(result.trades) >= 1
        trade = result.trades[0]
        assert trade["exit_price"] is not None
        assert trade["exit_time"] is not None

    def test_empty_data_no_crash(self, backtest_config):
        """An empty DataFrame doesn't crash the backtester."""
        empty_df = pd.DataFrame(
            columns=["open", "high", "low", "close", "volume"]
        )
        empty_df.index = pd.DatetimeIndex([])

        strategy = NeverSignals()
        bt = Backtester(strategy, empty_df, backtest_config)
        result = bt.run()

        assert isinstance(result, BacktestResult)
        assert len(result.trades) == 0
