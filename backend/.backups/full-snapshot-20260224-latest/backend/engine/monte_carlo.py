"""Monte Carlo simulation suite on trade sequences.

Three methods + composite robustness scoring:
1. Reshuffle — random permutation of trade order (original)
2. Resample — bootstrap sampling with replacement
3. Trade Skip — randomly skip X% of trades
4. Full — run all three and compute robustness score + grade
"""
from __future__ import annotations

from dataclasses import dataclass, asdict, field
from typing import List, Dict, Optional

import numpy as np


@dataclass
class MonteCarloResult:
    num_simulations: int
    num_trades: int
    # Return distribution
    mean_return: float
    median_return: float
    std_return: float
    percentile_5: float
    percentile_25: float
    percentile_75: float
    percentile_95: float
    # Drawdown distribution
    mean_max_drawdown: float
    median_max_drawdown: float
    worst_max_drawdown: float
    percentile_95_drawdown: float
    # Risk
    probability_of_ruin: float  # % of sims that hit ruin threshold
    probability_of_profit: float  # % of sims ending positive
    # Equity curve percentiles (for fan chart)
    equity_percentiles: Dict[str, List[float]]  # p5, p25, p50, p75, p95
    # Method used
    method: str = "reshuffle"
    # Robustness (populated in full mode)
    robustness_score: Optional[float] = None  # 0-100
    robustness_grade: Optional[str] = None    # A+ through F
    # Sub-results (populated in full mode)
    sub_results: Optional[Dict[str, dict]] = None

    def to_dict(self) -> dict:
        return asdict(self)


def _simulate(
    pnls: np.ndarray,
    initial_balance: float,
    num_simulations: int,
    ruin_threshold_pct: float,
    rng: np.random.Generator,
    sampler: str = "reshuffle",
    skip_pct: float = 10.0,
) -> MonteCarloResult:
    """Core simulation loop supporting different sampling strategies."""
    n_trades = len(pnls)

    if n_trades == 0:
        return MonteCarloResult(
            num_simulations=0, num_trades=0, method=sampler,
            mean_return=0, median_return=0, std_return=0,
            percentile_5=0, percentile_25=0, percentile_75=0, percentile_95=0,
            mean_max_drawdown=0, median_max_drawdown=0,
            worst_max_drawdown=0, percentile_95_drawdown=0,
            probability_of_ruin=0, probability_of_profit=0,
            equity_percentiles={"p5": [], "p25": [], "p50": [], "p75": [], "p95": []},
        )

    ruin_level = initial_balance * (1 - ruin_threshold_pct / 100.0)

    final_returns = np.zeros(num_simulations)
    max_drawdowns = np.zeros(num_simulations)
    ruin_count = 0

    # For fan chart we use a fixed-length equity array
    # Skip method produces shorter sequences, so pad
    max_len = n_trades + 1
    all_equity = np.zeros((num_simulations, max_len))

    for i in range(num_simulations):
        if sampler == "reshuffle":
            sim_pnls = rng.permutation(pnls)
        elif sampler == "resample":
            # Bootstrap: sample with replacement
            indices = rng.integers(0, n_trades, size=n_trades)
            sim_pnls = pnls[indices]
        elif sampler == "skip":
            # Randomly skip skip_pct% of trades
            n_skip = max(1, int(n_trades * skip_pct / 100.0))
            keep_mask = np.ones(n_trades, dtype=bool)
            skip_indices = rng.choice(n_trades, size=n_skip, replace=False)
            keep_mask[skip_indices] = False
            sim_pnls_raw = pnls[keep_mask]
            # Pad to same length for fan chart
            sim_pnls = np.zeros(n_trades)
            sim_pnls[:len(sim_pnls_raw)] = sim_pnls_raw
        else:
            sim_pnls = rng.permutation(pnls)

        equity = np.empty(max_len)
        equity[0] = initial_balance
        np.cumsum(sim_pnls, out=equity[1:])
        equity[1:] += initial_balance

        all_equity[i] = equity
        final_returns[i] = equity[-1] - initial_balance

        peak = np.maximum.accumulate(equity)
        dd = equity - peak
        max_drawdowns[i] = float(dd.min())

        if equity.min() <= ruin_level:
            ruin_count += 1

    # Compute equity percentiles (subsample for large trade counts)
    step = max(1, n_trades // 200)
    indices = list(range(0, max_len, step))
    if indices[-1] != n_trades:
        indices.append(n_trades)
    sampled = all_equity[:, indices]

    equity_percentiles = {
        "p5": np.percentile(sampled, 5, axis=0).round(2).tolist(),
        "p25": np.percentile(sampled, 25, axis=0).round(2).tolist(),
        "p50": np.percentile(sampled, 50, axis=0).round(2).tolist(),
        "p75": np.percentile(sampled, 75, axis=0).round(2).tolist(),
        "p95": np.percentile(sampled, 95, axis=0).round(2).tolist(),
    }

    return MonteCarloResult(
        num_simulations=num_simulations,
        num_trades=n_trades,
        method=sampler,
        mean_return=round(float(np.mean(final_returns)), 2),
        median_return=round(float(np.median(final_returns)), 2),
        std_return=round(float(np.std(final_returns)), 2),
        percentile_5=round(float(np.percentile(final_returns, 5)), 2),
        percentile_25=round(float(np.percentile(final_returns, 25)), 2),
        percentile_75=round(float(np.percentile(final_returns, 75)), 2),
        percentile_95=round(float(np.percentile(final_returns, 95)), 2),
        mean_max_drawdown=round(float(np.mean(max_drawdowns)), 2),
        median_max_drawdown=round(float(np.median(max_drawdowns)), 2),
        worst_max_drawdown=round(float(np.min(max_drawdowns)), 2),
        percentile_95_drawdown=round(float(np.percentile(max_drawdowns, 5)), 2),
        probability_of_ruin=round(ruin_count / num_simulations * 100, 2),
        probability_of_profit=round(float(np.sum(final_returns > 0)) / num_simulations * 100, 2),
        equity_percentiles=equity_percentiles,
    )


def _compute_robustness(
    reshuffle: MonteCarloResult,
    resample: MonteCarloResult,
    skip: MonteCarloResult,
) -> tuple:
    """Compute composite robustness score (0-100) and letter grade.

    Factors:
    - Probability of profit across all methods (40%)
    - Low probability of ruin (30%)
    - Consistency of returns across methods (20%)
    - Low max drawdown severity (10%)
    """
    # Profit probability component (0-40)
    avg_profit_prob = np.mean([
        reshuffle.probability_of_profit,
        resample.probability_of_profit,
        skip.probability_of_profit,
    ])
    profit_score = min(40, avg_profit_prob * 0.4)

    # Ruin probability component (0-30, inverted — lower ruin = higher score)
    avg_ruin_prob = np.mean([
        reshuffle.probability_of_ruin,
        resample.probability_of_ruin,
        skip.probability_of_ruin,
    ])
    ruin_score = max(0, 30 * (1 - avg_ruin_prob / 100.0))

    # Consistency component (0-20)
    # Low coefficient of variation across method median returns
    returns = [reshuffle.median_return, resample.median_return, skip.median_return]
    avg_ret = np.mean(np.abs(returns)) if np.mean(np.abs(returns)) > 0 else 1
    cv = np.std(returns) / avg_ret if avg_ret > 0 else 1
    consistency_score = max(0, 20 * (1 - min(cv, 1)))

    # Drawdown component (0-10)
    avg_worst_dd = np.mean([
        abs(reshuffle.worst_max_drawdown),
        abs(resample.worst_max_drawdown),
        abs(skip.worst_max_drawdown),
    ])
    # Scale: 0% DD = 10, 50%+ DD = 0
    initial_balance = abs(reshuffle.mean_return - reshuffle.median_return) + abs(reshuffle.median_return) + 50000
    dd_ratio = min(avg_worst_dd / max(initial_balance, 1), 0.5) * 2
    dd_score = max(0, 10 * (1 - dd_ratio))

    total_score = round(profit_score + ruin_score + consistency_score + dd_score, 1)
    total_score = max(0, min(100, total_score))

    # Letter grade
    if total_score >= 95:
        grade = "A+"
    elif total_score >= 90:
        grade = "A"
    elif total_score >= 85:
        grade = "A-"
    elif total_score >= 80:
        grade = "B+"
    elif total_score >= 75:
        grade = "B"
    elif total_score >= 70:
        grade = "B-"
    elif total_score >= 65:
        grade = "C+"
    elif total_score >= 60:
        grade = "C"
    elif total_score >= 55:
        grade = "C-"
    elif total_score >= 50:
        grade = "D+"
    elif total_score >= 45:
        grade = "D"
    elif total_score >= 40:
        grade = "D-"
    else:
        grade = "F"

    return total_score, grade


def run_monte_carlo(
    trade_pnls: List[float],
    initial_balance: float = 50000.0,
    num_simulations: int = 1000,
    ruin_threshold_pct: float = 50.0,
    seed: int = 42,
    method: str = "reshuffle",
    skip_pct: float = 10.0,
) -> MonteCarloResult:
    """Run Monte Carlo simulation on trade P&Ls.

    Args:
        trade_pnls: List of per-trade P&L values from a backtest.
        initial_balance: Starting account balance.
        num_simulations: Number of simulations to run per method.
        ruin_threshold_pct: Ruin = losing this % of initial balance.
        seed: Random seed for reproducibility.
        method: "reshuffle" | "resample" | "skip" | "full".
                "full" runs all three methods and computes robustness score.
        skip_pct: Percentage of trades to skip (for "skip" method).

    Returns:
        MonteCarloResult with distribution statistics.
        In "full" mode, includes robustness_score, robustness_grade, and sub_results.
    """
    rng = np.random.default_rng(seed)
    pnls = np.array(trade_pnls, dtype=np.float64)

    if method == "full":
        # Run all three methods
        reshuffle = _simulate(pnls, initial_balance, num_simulations, ruin_threshold_pct, rng, "reshuffle")
        resample = _simulate(pnls, initial_balance, num_simulations, ruin_threshold_pct, rng, "resample")
        skip = _simulate(pnls, initial_balance, num_simulations, ruin_threshold_pct, rng, "skip", skip_pct)

        score, grade = _compute_robustness(reshuffle, resample, skip)

        # Use reshuffle as primary result (most standard) but attach sub-results
        result = reshuffle
        result.method = "full"
        result.robustness_score = score
        result.robustness_grade = grade
        result.sub_results = {
            "reshuffle": reshuffle.to_dict(),
            "resample": resample.to_dict(),
            "skip": skip.to_dict(),
        }
        return result
    else:
        return _simulate(pnls, initial_balance, num_simulations, ruin_threshold_pct, rng, method, skip_pct)
