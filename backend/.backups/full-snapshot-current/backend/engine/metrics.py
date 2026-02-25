from __future__ import annotations

from typing import List, Dict, Optional

import numpy as np
from scipy import stats as scipy_stats


def calculate_metrics(trades: List[Dict], initial_balance: float) -> dict:
    empty = {
        "total_trades": 0, "win_rate": 0.0, "loss_rate": 0.0,
        "total_return": 0.0, "total_return_pct": 0.0,
        "max_drawdown": 0.0, "max_drawdown_pct": 0.0,
        "max_consecutive_losses": 0, "max_consecutive_wins": 0,
        "profit_factor": 0.0, "sharpe_ratio": 0.0,
        "avg_win": 0.0, "avg_loss": 0.0,
        "sortino_ratio": 0.0, "calmar_ratio": 0.0,
        "recovery_factor": 0.0, "expectancy": 0.0,
        "expectancy_ratio": 0.0, "payoff_ratio": 0.0,
    }
    if not trades:
        return empty

    pnls = [t["pnl"] for t in trades]
    wins = [p for p in pnls if p > 0]
    losses = [p for p in pnls if p <= 0]

    # Consecutive wins/losses
    max_consec_wins = max_consec_losses = current_wins = current_losses = 0
    for p in pnls:
        if p > 0:
            current_wins += 1
            current_losses = 0
            max_consec_wins = max(max_consec_wins, current_wins)
        else:
            current_losses += 1
            current_wins = 0
            max_consec_losses = max(max_consec_losses, current_losses)

    # Drawdown
    equity = [initial_balance]
    for p in pnls:
        equity.append(equity[-1] + p)
    equity_arr = np.array(equity)
    peak = np.maximum.accumulate(equity_arr)
    drawdown = equity_arr - peak
    max_dd = float(drawdown.min())
    max_dd_pct = float((drawdown / peak).min()) if peak.max() > 0 else 0.0

    total_return = sum(pnls)
    gross_profit = sum(wins) if wins else 0
    gross_loss = abs(sum(losses)) if losses else 0

    # Sharpe ratio (annualized)
    if len(pnls) > 1:
        returns = np.array(pnls) / initial_balance
        sharpe = float(np.mean(returns) / np.std(returns) * np.sqrt(252)) if np.std(returns) > 0 else 0.0
    else:
        sharpe = 0.0

    # Sortino ratio (penalizes downside volatility only)
    downside_returns = np.array([p / initial_balance for p in pnls if p < 0])
    if len(downside_returns) > 1 and np.std(downside_returns) > 0:
        returns_mean = float(np.mean(np.array(pnls) / initial_balance))
        sortino = round(float(returns_mean / np.std(downside_returns) * np.sqrt(252)), 2)
    else:
        sortino = 0.0

    # Calmar ratio (annualized return / max drawdown %)
    annualized_return_pct = (total_return / initial_balance) * (252 / max(len(trades), 1)) * 100
    calmar = round(abs(annualized_return_pct / (max_dd_pct * 100)), 2) if max_dd_pct < 0 else 0.0

    # Recovery factor (net profit / max drawdown)
    recovery_factor = round(abs(total_return / max_dd), 2) if max_dd < 0 else 0.0

    # Expectancy (avg $ per trade)
    expectancy = round(total_return / len(trades), 2)

    # Expectancy ratio (expectancy / avg loss magnitude)
    avg_loss_abs = abs(float(np.mean(losses))) if losses else 1.0
    expectancy_ratio = round(expectancy / avg_loss_abs, 2) if avg_loss_abs > 0 else 0.0

    # Payoff ratio (avg win / avg loss magnitude)
    payoff_ratio = round(abs(float(np.mean(wins)) / float(np.mean(losses))), 2) if losses and wins else 0.0

    # Deflated Sharpe Ratio (Bailey & Lopez de Prado, 2014)
    dsr, dsr_pvalue = deflated_sharpe_ratio(sharpe, len(trades))

    return {
        "total_trades": len(trades),
        "win_rate": len(wins) / len(trades) if trades else 0.0,
        "loss_rate": len(losses) / len(trades) if trades else 0.0,
        "total_return": round(total_return, 2),
        "total_return_pct": round(total_return / initial_balance * 100, 2),
        "max_drawdown": round(max_dd, 2),
        "max_drawdown_pct": round(max_dd_pct * 100, 2),
        "max_consecutive_losses": max_consec_losses,
        "max_consecutive_wins": max_consec_wins,
        "profit_factor": round(gross_profit / gross_loss, 2) if gross_loss > 0 else 9999.99,
        "sharpe_ratio": round(sharpe, 2),
        "avg_win": round(float(np.mean(wins)), 2) if wins else 0.0,
        "avg_loss": round(float(np.mean(losses)), 2) if losses else 0.0,
        "sortino_ratio": sortino,
        "calmar_ratio": calmar,
        "recovery_factor": recovery_factor,
        "expectancy": expectancy,
        "expectancy_ratio": expectancy_ratio,
        "payoff_ratio": payoff_ratio,
        "deflated_sharpe_ratio": dsr,
        "dsr_pvalue": dsr_pvalue,
    }


def deflated_sharpe_ratio(
    observed_sharpe: float,
    num_trades: int,
    num_trials: int = 1,
    skewness: float = 0.0,
    kurtosis: float = 3.0,
) -> tuple:
    """Compute the Deflated Sharpe Ratio (Bailey & Lopez de Prado, 2014).

    Corrects for multiple testing bias when many parameter combinations
    are tested. A DSR p-value < 0.05 means the Sharpe is statistically
    significant even after accounting for the number of trials.

    Args:
        observed_sharpe: The observed Sharpe ratio.
        num_trades: Number of trades in the backtest.
        num_trials: Number of independent strategy variants tested.
        skewness: Skewness of returns (0 for normal).
        kurtosis: Kurtosis of returns (3 for normal).

    Returns:
        (dsr_value, p_value) tuple. Higher DSR and lower p-value = more robust.
    """
    if num_trades <= 1 or observed_sharpe == 0:
        return 0.0, 1.0

    # Expected maximum Sharpe ratio under null hypothesis (all trials are noise)
    # E[max(SR)] ≈ sqrt(2 * log(num_trials)) * (1 - euler_gamma / (2 * log(num_trials)))
    if num_trials > 1:
        euler_gamma = 0.5772156649
        e_max_sr = np.sqrt(2 * np.log(num_trials))
        if np.log(num_trials) > 0:
            e_max_sr *= (1 - euler_gamma / (2 * np.log(num_trials)))
        e_max_sr += euler_gamma / (2 * np.sqrt(2 * np.log(num_trials)))
    else:
        e_max_sr = 0.0

    # Standard error of the Sharpe ratio (Lo, 2002)
    # SE(SR) = sqrt((1 - skew*SR + (kurtosis-1)/4 * SR^2) / (num_trades - 1))
    sr = observed_sharpe
    se_sr = np.sqrt(
        (1 - skewness * sr + ((kurtosis - 1) / 4) * sr ** 2) / max(num_trades - 1, 1)
    )

    if se_sr == 0:
        return 0.0, 1.0

    # DSR test statistic
    dsr_stat = (sr - e_max_sr) / se_sr

    # P-value from standard normal CDF
    p_value = 1.0 - float(scipy_stats.norm.cdf(dsr_stat))

    return round(float(dsr_stat), 4), round(p_value, 4)
