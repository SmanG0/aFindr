"""Tests for the Monte Carlo simulation engine."""

import sys
import os
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from engine.monte_carlo import run_monte_carlo


SAMPLE_PNLS = [100, -50, 200, -30, 150, -80, 120, -40, 60, -20]


class TestRunMonteCarlo:
    """Tests for run_monte_carlo."""

    def test_empty_pnls(self):
        """Empty PnL list returns a result with num_simulations=0."""
        result = run_monte_carlo([], initial_balance=50000, num_simulations=100, seed=42)
        assert result.num_simulations == 0

    def test_num_simulations(self):
        """Result num_simulations matches the requested count."""
        result = run_monte_carlo(
            SAMPLE_PNLS, initial_balance=50000, num_simulations=500, seed=42
        )
        assert result.num_simulations == 500

    def test_probability_of_ruin(self):
        """Probability of ruin is a float between 0 and 100."""
        result = run_monte_carlo(
            SAMPLE_PNLS, initial_balance=50000, num_simulations=200, seed=42
        )
        assert isinstance(result.probability_of_ruin, float)
        assert 0.0 <= result.probability_of_ruin <= 100.0

    def test_probability_of_profit(self):
        """Probability of profit is a float between 0 and 100."""
        result = run_monte_carlo(
            SAMPLE_PNLS, initial_balance=50000, num_simulations=200, seed=42
        )
        assert isinstance(result.probability_of_profit, float)
        assert 0.0 <= result.probability_of_profit <= 100.0

    def test_equity_percentiles_shape(self):
        """Each equity percentile curve has the same positive length."""
        result = run_monte_carlo(
            SAMPLE_PNLS, initial_balance=50000, num_simulations=200, seed=42
        )
        curves = result.equity_percentiles
        lengths = {
            len(curves["p5"]),
            len(curves["p25"]),
            len(curves["p50"]),
            len(curves["p75"]),
            len(curves["p95"]),
        }
        # All curves must have the same length
        assert len(lengths) == 1
        # Length must be positive
        assert lengths.pop() > 0

    def test_reproducibility_with_seed(self):
        """Running with the same seed produces identical results."""
        kwargs = dict(
            trade_pnls=SAMPLE_PNLS,
            initial_balance=50000,
            num_simulations=300,
            seed=99,
        )
        result_a = run_monte_carlo(**kwargs)
        result_b = run_monte_carlo(**kwargs)
        assert result_a.mean_return == result_b.mean_return
        assert result_a.median_return == result_b.median_return
        assert result_a.probability_of_ruin == result_b.probability_of_ruin
        assert result_a.equity_percentiles == result_b.equity_percentiles

    def test_percentile_ordering(self):
        """Final equity values respect p5 <= p25 <= p50 <= p75 <= p95."""
        result = run_monte_carlo(
            SAMPLE_PNLS, initial_balance=50000, num_simulations=500, seed=42
        )
        curves = result.equity_percentiles
        final_p5 = curves["p5"][-1]
        final_p25 = curves["p25"][-1]
        final_p50 = curves["p50"][-1]
        final_p75 = curves["p75"][-1]
        final_p95 = curves["p95"][-1]
        assert final_p5 <= final_p25 <= final_p50 <= final_p75 <= final_p95
