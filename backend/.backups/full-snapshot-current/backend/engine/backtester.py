from __future__ import annotations
from dataclasses import dataclass
from typing import Optional, List, Dict
import pandas as pd
from engine.strategy import BaseStrategy, Signal
from engine.metrics import calculate_metrics


@dataclass
class BacktestConfig:
    initial_balance: float = 25000.0
    commission: float = 2.50
    slippage_ticks: int = 1
    point_value: float = 20.0
    tick_size: float = 0.25


@dataclass
class Position:
    side: str
    size: float
    entry_price: float
    entry_time: int
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None


@dataclass
class BacktestResult:
    trades: list[dict]
    equity_curve: list[dict]
    metrics: dict


class Backtester:
    def __init__(self, strategy: BaseStrategy, data: pd.DataFrame, config: BacktestConfig):
        self.strategy = strategy
        self.data = data
        self.config = config
        self.balance = config.initial_balance
        self.position: Optional[Position] = None
        self.trades: list[dict] = []
        self.equity_curve: list[dict] = []
        self.trade_id = 0
        self._current_mae = 0.0  # Max Adverse Excursion (worst unrealized loss)
        self._current_mfe = 0.0  # Max Favorable Excursion (best unrealized gain)

    def run(self) -> BacktestResult:
        rows = self.data.reset_index()
        for i in range(len(rows)):
            row = rows.iloc[i]
            bar = {
                "time": int(row.iloc[0].timestamp()) if hasattr(row.iloc[0], "timestamp") else int(row.iloc[0]),
                "open": float(row["open"]),
                "high": float(row["high"]),
                "low": float(row["low"]),
                "close": float(row["close"]),
                "volume": float(row["volume"]),
            }
            history = self.data.iloc[:i + 1]

            if self.position:
                self._check_sl_tp(bar)

            # Track MAE/MFE while position is open
            if self.position:
                if self.position.side == "long":
                    excursion = (bar["close"] - self.position.entry_price) * self.config.point_value * self.position.size
                else:
                    excursion = (self.position.entry_price - bar["close"]) * self.config.point_value * self.position.size
                self._current_mfe = max(self._current_mfe, excursion)
                self._current_mae = min(self._current_mae, excursion)

            if not self.position:
                signal = self.strategy.on_bar(bar, history)
                if signal and signal.action in ("buy", "sell"):
                    self._open_position(bar, signal)
            else:
                signal = self.strategy.on_bar(bar, history)
                if signal and signal.action == "close":
                    self._close_position(bar)
                elif signal and signal.action in ("buy", "sell"):
                    side = "long" if signal.action == "buy" else "short"
                    if side != self.position.side:
                        self._close_position(bar)
                        self._open_position(bar, signal)

            self.equity_curve.append({
                "time": bar["time"],
                "value": round(self._current_equity(bar["close"]), 2),
            })

        if self.position:
            last_bar = {"time": self.equity_curve[-1]["time"], "close": float(rows.iloc[-1]["close"])}
            self._close_position(last_bar)

        metrics = calculate_metrics(self.trades, self.config.initial_balance)
        return BacktestResult(trades=self.trades, equity_curve=self.equity_curve, metrics=metrics)

    def _open_position(self, bar, signal):
        slippage = self.config.slippage_ticks * self.config.tick_size
        side = "long" if signal.action == "buy" else "short"
        entry_price = bar["close"] + slippage if side == "long" else bar["close"] - slippage
        self.balance -= self.config.commission
        self._current_mae = 0.0
        self._current_mfe = 0.0
        self.position = Position(
            side=side, size=signal.size, entry_price=entry_price,
            entry_time=bar["time"], stop_loss=signal.stop_loss, take_profit=signal.take_profit,
        )

    def _close_position(self, bar):
        if not self.position:
            return
        slippage = self.config.slippage_ticks * self.config.tick_size
        if self.position.side == "long":
            exit_price = bar["close"] - slippage
            pnl_points = exit_price - self.position.entry_price
        else:
            exit_price = bar["close"] + slippage
            pnl_points = self.position.entry_price - exit_price
        pnl = pnl_points * self.config.point_value * self.position.size
        self.balance += pnl - self.config.commission
        self.trade_id += 1
        self.trades.append({
            "id": self.trade_id, "instrument": "N/A", "side": self.position.side,
            "size": self.position.size, "entry_price": round(self.position.entry_price, 2),
            "exit_price": round(exit_price, 2), "entry_time": self.position.entry_time,
            "exit_time": bar["time"], "stop_loss": self.position.stop_loss,
            "take_profit": self.position.take_profit, "pnl": round(pnl, 2),
            "pnl_points": round(pnl_points, 2), "commission": self.config.commission * 2,
            "mae": round(self._current_mae, 2), "mfe": round(self._current_mfe, 2),
        })
        self.position = None

    def _check_sl_tp(self, bar):
        if not self.position:
            return
        if self.position.side == "long":
            if self.position.stop_loss and bar["low"] <= self.position.stop_loss:
                self._close_at_price(bar, self.position.stop_loss)
            elif self.position.take_profit and bar["high"] >= self.position.take_profit:
                self._close_at_price(bar, self.position.take_profit)
        else:
            if self.position.stop_loss and bar["high"] >= self.position.stop_loss:
                self._close_at_price(bar, self.position.stop_loss)
            elif self.position.take_profit and bar["low"] <= self.position.take_profit:
                self._close_at_price(bar, self.position.take_profit)

    def _close_at_price(self, bar, price):
        if not self.position:
            return
        pnl_points = (price - self.position.entry_price) if self.position.side == "long" else (self.position.entry_price - price)
        pnl = pnl_points * self.config.point_value * self.position.size
        self.balance += pnl - self.config.commission
        self.trade_id += 1
        self.trades.append({
            "id": self.trade_id, "instrument": "N/A", "side": self.position.side,
            "size": self.position.size, "entry_price": round(self.position.entry_price, 2),
            "exit_price": round(price, 2), "entry_time": self.position.entry_time,
            "exit_time": bar["time"], "stop_loss": self.position.stop_loss,
            "take_profit": self.position.take_profit, "pnl": round(pnl, 2),
            "pnl_points": round(pnl_points, 2), "commission": self.config.commission * 2,
            "mae": round(self._current_mae, 2), "mfe": round(self._current_mfe, 2),
        })
        self.position = None

    def _current_equity(self, current_price):
        equity = self.balance
        if self.position:
            if self.position.side == "long":
                unrealized = (current_price - self.position.entry_price) * self.config.point_value * self.position.size
            else:
                unrealized = (self.position.entry_price - current_price) * self.config.point_value * self.position.size
            equity += unrealized
        return equity
