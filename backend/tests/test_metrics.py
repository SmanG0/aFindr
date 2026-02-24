"""Tests for the calculate_metrics function."""

import pytest

from engine.metrics import calculate_metrics


INITIAL_BALANCE = 50_000

EXPECTED_KEYS = {
    "total_trades",
    "win_rate",
    "loss_rate",
    "total_return",
    "total_return_pct",
    "max_drawdown",
    "max_drawdown_pct",
    "max_consecutive_losses",
    "max_consecutive_wins",
    "profit_factor",
    "sharpe_ratio",
    "avg_win",
    "avg_loss",
    "sortino_ratio",
    "calmar_ratio",
    "recovery_factor",
    "expectancy",
    "expectancy_ratio",
    "payoff_ratio",
}


def _make_trades(pnls):
    """Helper: create minimal trade dicts from a list of PnL values."""
    return [{"pnl": pnl} for pnl in pnls]


class TestCalculateMetrics:

    def test_empty_trades(self):
        """Empty trade list returns zeros/defaults for all keys."""
        metrics = calculate_metrics([], INITIAL_BALANCE)

        assert metrics["total_trades"] == 0
        assert metrics["win_rate"] == 0
        assert metrics["loss_rate"] == 0
        assert metrics["total_return"] == 0
        assert metrics["total_return_pct"] == 0
        assert metrics["max_drawdown"] == 0
        assert metrics["max_drawdown_pct"] == 0
        assert metrics["profit_factor"] == 0
        assert metrics["sharpe_ratio"] == 0

    def test_win_rate(self):
        """3 wins + 2 losses => win_rate = 0.6."""
        trades = _make_trades([100, 200, 150, -50, -80])
        metrics = calculate_metrics(trades, INITIAL_BALANCE)

        assert metrics["total_trades"] == 5
        assert metrics["win_rate"] == pytest.approx(0.6, abs=1e-6)
        assert metrics["loss_rate"] == pytest.approx(0.4, abs=1e-6)

    def test_profit_factor(self):
        """profit_factor = gross_profit / abs(gross_loss)."""
        trades = _make_trades([100, 200, 150, -50, -80])
        metrics = calculate_metrics(trades, INITIAL_BALANCE)

        gross_profit = 100 + 200 + 150  # 450
        gross_loss = abs(-50) + abs(-80)  # 130
        expected_pf = gross_profit / gross_loss  # ~3.46

        assert metrics["profit_factor"] == pytest.approx(expected_pf, rel=0.01)

    def test_max_drawdown(self):
        """max_drawdown should be a negative value for a mixed PnL series."""
        trades = _make_trades([500, -200, -300, 100, -150])
        metrics = calculate_metrics(trades, INITIAL_BALANCE)

        # After the first trade the equity peaks, then the two losses create
        # a drawdown.  The exact value depends on implementation, but it
        # must be negative (or zero at most).
        assert metrics["max_drawdown"] <= 0

    def test_sharpe_ratio(self):
        """Sharpe ratio is non-zero for a mix of winning and losing trades."""
        trades = _make_trades([100, -50, 200, -30, 150, -80, 120])
        metrics = calculate_metrics(trades, INITIAL_BALANCE)

        assert metrics["sharpe_ratio"] != 0

    def test_all_keys_present(self):
        """All 20 expected metric keys are present in the result dict."""
        trades = _make_trades([100, -50])
        metrics = calculate_metrics(trades, INITIAL_BALANCE)

        missing = EXPECTED_KEYS - set(metrics.keys())
        assert missing == set(), f"Missing metric keys: {missing}"

    def test_sortino_ratio(self):
        """Sortino ratio is non-zero for a mix of winning and losing trades."""
        trades = _make_trades([100, -50, 200, -30, 150, -80, 120])
        metrics = calculate_metrics(trades, INITIAL_BALANCE)

        assert metrics["sortino_ratio"] != 0

    def test_consecutive_streaks(self):
        """3 wins then 2 losses: max_consecutive_wins=3, max_consecutive_losses=2."""
        trades = _make_trades([100, 200, 150, -50, -80])
        metrics = calculate_metrics(trades, INITIAL_BALANCE)

        assert metrics["max_consecutive_wins"] == 3
        assert metrics["max_consecutive_losses"] == 2
