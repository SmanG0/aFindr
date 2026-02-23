from __future__ import annotations

from typing import List, Dict

import numpy as np


def calculate_metrics(trades: List[Dict], initial_balance: float) -> dict:
    if not trades:
        return {
            "total_trades": 0, "win_rate": 0.0, "loss_rate": 0.0,
            "total_return": 0.0, "total_return_pct": 0.0,
            "max_drawdown": 0.0, "max_drawdown_pct": 0.0,
            "max_consecutive_losses": 0, "max_consecutive_wins": 0,
            "profit_factor": 0.0, "sharpe_ratio": 0.0,
            "avg_win": 0.0, "avg_loss": 0.0,
        }

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
        "profit_factor": round(gross_profit / gross_loss, 2) if gross_loss > 0 else float("inf"),
        "sharpe_ratio": round(sharpe, 2),
        "avg_win": round(float(np.mean(wins)), 2) if wins else 0.0,
        "avg_loss": round(float(np.mean(losses)), 2) if losses else 0.0,
    }
