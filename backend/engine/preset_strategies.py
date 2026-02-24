"""
Plug-and-Play Strategy Pack for aFindr
=======================================
10 strategies covering every trading archetype. Each tests different
parts of the pipeline: entry/exit models, SL/TP, position sizing,
walk-forward params, and pattern detection.

Usage via Alphy:
  "Run preset strategy 1" or "Backtest the EMA crossover"

Usage via code:
  from engine.preset_strategies import PRESET_STRATEGIES
  strat_class = PRESET_STRATEGIES[0]["class"]
"""

from __future__ import annotations
import pandas as pd
import numpy as np
import ta
from engine.strategy import BaseStrategy, Signal


# ═══════════════════════════════════════════════════════════════
# 1. EMA CROSSOVER (Trend Following - Classic)
# ═══════════════════════════════════════════════════════════════
# Tests: basic entry/exit, no SL/TP, pure signal-driven
# Walk-forward params: fast_period, slow_period

class EMACrossover(BaseStrategy):
    """Buy when fast EMA crosses above slow EMA, sell on cross below."""

    def on_bar(self, bar: dict, history: pd.DataFrame):
        fast = self.params.get("fast_period", 9)
        slow = self.params.get("slow_period", 21)
        if len(history) < slow + 2:
            return None
        ema_fast = ta.trend.EMAIndicator(history["close"], window=fast).ema_indicator()
        ema_slow = ta.trend.EMAIndicator(history["close"], window=slow).ema_indicator()
        prev_fast, curr_fast = ema_fast.iloc[-2], ema_fast.iloc[-1]
        prev_slow, curr_slow = ema_slow.iloc[-2], ema_slow.iloc[-1]
        if prev_fast <= prev_slow and curr_fast > curr_slow:
            return Signal(action="buy", size=1.0)
        if prev_fast >= prev_slow and curr_fast < curr_slow:
            return Signal(action="sell", size=1.0)
        return None


# ═══════════════════════════════════════════════════════════════
# 2. RSI MEAN REVERSION (Mean Reversion - Oscillator)
# ═══════════════════════════════════════════════════════════════
# Tests: SL/TP exits, oversold/overbought levels
# Walk-forward params: rsi_period, oversold, overbought

class RSIMeanReversion(BaseStrategy):
    """Buy on RSI oversold bounce, close on overbought. Fixed SL."""

    def on_bar(self, bar: dict, history: pd.DataFrame):
        period = self.params.get("rsi_period", 14)
        oversold = self.params.get("oversold", 30)
        overbought = self.params.get("overbought", 70)
        sl_points = self.params.get("stop_loss_points", 50)
        if len(history) < period + 2:
            return None
        rsi = ta.momentum.RSIIndicator(history["close"], window=period).rsi()
        prev_rsi, curr_rsi = rsi.iloc[-2], rsi.iloc[-1]
        if prev_rsi <= oversold and curr_rsi > oversold:
            return Signal(action="buy", size=1.0,
                          stop_loss=bar["close"] - sl_points)
        if curr_rsi > overbought:
            return Signal(action="close")
        return None


# ═══════════════════════════════════════════════════════════════
# 3. BOLLINGER BAND BREAKOUT (Volatility Breakout)
# ═══════════════════════════════════════════════════════════════
# Tests: band-based entries, dynamic SL at opposite band
# Walk-forward params: bb_period, bb_std

class BollingerBreakout(BaseStrategy):
    """Long on upper band breakout, short on lower band break. SL at middle band."""

    def on_bar(self, bar: dict, history: pd.DataFrame):
        period = self.params.get("bb_period", 20)
        std = self.params.get("bb_std", 2.0)
        if len(history) < period + 2:
            return None
        bb = ta.volatility.BollingerBands(history["close"], window=period, window_dev=std)
        upper = bb.bollinger_hband().iloc[-1]
        lower = bb.bollinger_lband().iloc[-1]
        mid = bb.bollinger_mavg().iloc[-1]
        prev_close = history["close"].iloc[-2]
        curr_close = bar["close"]
        if prev_close <= upper and curr_close > upper:
            return Signal(action="buy", size=1.0, stop_loss=mid)
        if prev_close >= lower and curr_close < lower:
            return Signal(action="sell", size=1.0, stop_loss=mid)
        return None


# ═══════════════════════════════════════════════════════════════
# 4. MACD MOMENTUM (Momentum - Histogram)
# ═══════════════════════════════════════════════════════════════
# Tests: multi-line indicator, histogram zero-cross
# Walk-forward params: fast, slow, signal

class MACDMomentum(BaseStrategy):
    """Buy when MACD histogram crosses above zero, sell on cross below."""

    def on_bar(self, bar: dict, history: pd.DataFrame):
        fast = self.params.get("fast", 12)
        slow = self.params.get("slow", 26)
        signal = self.params.get("signal", 9)
        if len(history) < slow + signal + 2:
            return None
        macd = ta.trend.MACD(history["close"], window_fast=fast,
                             window_slow=slow, window_sign=signal)
        hist = macd.macd_diff()
        prev_h, curr_h = hist.iloc[-2], hist.iloc[-1]
        if prev_h <= 0 and curr_h > 0:
            return Signal(action="buy", size=1.0)
        if prev_h >= 0 and curr_h < 0:
            return Signal(action="sell", size=1.0)
        return None


# ═══════════════════════════════════════════════════════════════
# 5. ATR TRAILING STOP (Trend + Volatility)
# ═══════════════════════════════════════════════════════════════
# Tests: dynamic SL based on ATR, trend filter with EMA
# Walk-forward params: atr_period, atr_mult, ema_period

class ATRTrailingStop(BaseStrategy):
    """Trend-following with ATR-based stop. Long above EMA, short below."""

    def __init__(self, params):
        super().__init__(params)
        self._trailing_stop = None
        self._side = None

    def on_bar(self, bar: dict, history: pd.DataFrame):
        atr_period = self.params.get("atr_period", 14)
        atr_mult = self.params.get("atr_mult", 2.0)
        ema_period = self.params.get("ema_period", 50)
        if len(history) < max(atr_period, ema_period) + 2:
            return None
        atr_val = ta.volatility.AverageTrueRange(
            history["high"], history["low"], history["close"],
            window=atr_period).average_true_range().iloc[-1]
        ema_val = ta.trend.EMAIndicator(history["close"], window=ema_period).ema_indicator().iloc[-1]
        price = bar["close"]

        # Update trailing stop for open position
        if self._side == "long" and self._trailing_stop is not None:
            new_stop = price - atr_val * atr_mult
            self._trailing_stop = max(self._trailing_stop, new_stop)
            if bar["low"] <= self._trailing_stop:
                self._side = None
                self._trailing_stop = None
                return Signal(action="close")
        elif self._side == "short" and self._trailing_stop is not None:
            new_stop = price + atr_val * atr_mult
            self._trailing_stop = min(self._trailing_stop, new_stop)
            if bar["high"] >= self._trailing_stop:
                self._side = None
                self._trailing_stop = None
                return Signal(action="close")

        # New entries
        if self._side is None:
            if price > ema_val:
                self._side = "long"
                self._trailing_stop = price - atr_val * atr_mult
                return Signal(action="buy", size=1.0,
                              stop_loss=self._trailing_stop)
            elif price < ema_val:
                self._side = "short"
                self._trailing_stop = price + atr_val * atr_mult
                return Signal(action="sell", size=1.0,
                              stop_loss=self._trailing_stop)
        return None


# ═══════════════════════════════════════════════════════════════
# 6. STOCHASTIC REVERSAL (Mean Reversion - Dual Oscillator)
# ═══════════════════════════════════════════════════════════════
# Tests: K/D cross, overbought/oversold zones, TP exit
# Walk-forward params: k_period, d_period, smooth

class StochasticReversal(BaseStrategy):
    """Buy when Stoch K crosses above D in oversold zone. TP at 50 points."""

    def on_bar(self, bar: dict, history: pd.DataFrame):
        k_period = self.params.get("k_period", 14)
        d_period = self.params.get("d_period", 3)
        tp_points = self.params.get("take_profit_points", 50)
        sl_points = self.params.get("stop_loss_points", 30)
        if len(history) < k_period + d_period + 2:
            return None
        stoch = ta.momentum.StochasticOscillator(
            history["high"], history["low"], history["close"],
            window=k_period, smooth_window=d_period)
        k = stoch.stoch().iloc[-1]
        k_prev = stoch.stoch().iloc[-2]
        d = stoch.stoch_signal().iloc[-1]
        d_prev = stoch.stoch_signal().iloc[-2]
        # K crosses above D in oversold
        if k_prev <= d_prev and k > d and k < 20:
            return Signal(action="buy", size=1.0,
                          stop_loss=bar["close"] - sl_points,
                          take_profit=bar["close"] + tp_points)
        # K crosses below D in overbought
        if k_prev >= d_prev and k < d and k > 80:
            return Signal(action="sell", size=1.0,
                          stop_loss=bar["close"] + sl_points,
                          take_profit=bar["close"] - tp_points)
        return None


# ═══════════════════════════════════════════════════════════════
# 7. SUPERTREND FOLLOWER (Trend Following - Modern)
# ═══════════════════════════════════════════════════════════════
# Tests: SuperTrend indicator, flip-based entries
# Walk-forward params: atr_period, factor

class SuperTrendFollower(BaseStrategy):
    """Follow SuperTrend direction. Flip long/short on direction change."""

    def on_bar(self, bar: dict, history: pd.DataFrame):
        atr_period = self.params.get("atr_period", 10)
        factor = self.params.get("factor", 3.0)
        if len(history) < atr_period + 3:
            return None

        atr = ta.volatility.AverageTrueRange(
            history["high"], history["low"], history["close"],
            window=atr_period).average_true_range()
        hl2 = (history["high"] + history["low"]) / 2
        upper_basic = hl2 + factor * atr
        lower_basic = hl2 - factor * atr

        closes = history["close"]
        n = len(closes)

        # Compute trailing SuperTrend bands (proper algorithm)
        final_upper = upper_basic.copy()
        final_lower = lower_basic.copy()
        direction = pd.Series(1, index=history.index)  # 1=up, -1=down

        for i in range(atr_period + 1, n):
            # Upper band: keep previous if close was above it
            if final_upper.iloc[i] < final_upper.iloc[i - 1] and closes.iloc[i - 1] > final_upper.iloc[i - 1]:
                final_upper.iloc[i] = final_upper.iloc[i - 1]
            # Lower band: keep previous if close was below it
            if final_lower.iloc[i] > final_lower.iloc[i - 1] and closes.iloc[i - 1] < final_lower.iloc[i - 1]:
                final_lower.iloc[i] = final_lower.iloc[i - 1]

            if direction.iloc[i - 1] == 1:
                direction.iloc[i] = -1 if closes.iloc[i] < final_lower.iloc[i] else 1
            else:
                direction.iloc[i] = 1 if closes.iloc[i] > final_upper.iloc[i] else -1

        prev_dir = direction.iloc[-2]
        curr_dir = direction.iloc[-1]

        if curr_dir == 1 and prev_dir == -1:
            return Signal(action="buy", size=1.0)
        if curr_dir == -1 and prev_dir == 1:
            return Signal(action="sell", size=1.0)
        return None


# ═══════════════════════════════════════════════════════════════
# 8. VWAP DEVIATION (Intraday Mean Reversion)
# ═══════════════════════════════════════════════════════════════
# Tests: VWAP-based, standard deviation bands, intraday logic
# Walk-forward params: std_mult

class VWAPDeviation(BaseStrategy):
    """Buy when price drops 2 stddev below VWAP, sell 2 above. SL at 3 stddev."""

    def on_bar(self, bar: dict, history: pd.DataFrame):
        lookback = self.params.get("lookback", 20)
        std_mult = self.params.get("std_mult", 2.0)
        sl_mult = self.params.get("sl_mult", 3.0)
        if len(history) < lookback + 2:
            return None
        # Approximate VWAP using rolling window
        tp = (history["high"] + history["low"] + history["close"]) / 3
        vol = history["volume"]
        cum_tp_vol = (tp * vol).rolling(lookback).sum()
        cum_vol = vol.rolling(lookback).sum()
        vwap = cum_tp_vol / cum_vol
        std = (history["close"] - vwap).rolling(lookback).std()

        vwap_val = vwap.iloc[-1]
        std_val = std.iloc[-1]
        if pd.isna(vwap_val) or pd.isna(std_val) or std_val == 0:
            return None
        price = bar["close"]
        upper = vwap_val + std_mult * std_val
        lower = vwap_val - std_mult * std_val
        sl_upper = vwap_val + sl_mult * std_val
        sl_lower = vwap_val - sl_mult * std_val

        if price < lower:
            return Signal(action="buy", size=1.0,
                          stop_loss=sl_lower,
                          take_profit=vwap_val)
        if price > upper:
            return Signal(action="sell", size=1.0,
                          stop_loss=sl_upper,
                          take_profit=vwap_val)
        return None


# ═══════════════════════════════════════════════════════════════
# 9. ADX TREND STRENGTH (Trend Filter + Momentum)
# ═══════════════════════════════════════════════════════════════
# Tests: ADX filter for trend strength, DI+/DI- for direction
# Walk-forward params: adx_period, adx_threshold

class ADXTrendStrength(BaseStrategy):
    """Trade only in strong trends (ADX > threshold). Direction from DI+/DI-."""

    def on_bar(self, bar: dict, history: pd.DataFrame):
        adx_period = self.params.get("adx_period", 14)
        adx_threshold = self.params.get("adx_threshold", 25)
        sl_points = self.params.get("stop_loss_points", 40)
        if len(history) < adx_period * 2:
            return None
        adx_ind = ta.trend.ADXIndicator(
            history["high"], history["low"], history["close"],
            window=adx_period)
        adx = adx_ind.adx().iloc[-1]
        di_plus = adx_ind.adx_pos().iloc[-1]
        di_minus = adx_ind.adx_neg().iloc[-1]
        prev_di_plus = adx_ind.adx_pos().iloc[-2]
        prev_di_minus = adx_ind.adx_neg().iloc[-2]
        if pd.isna(adx):
            return None
        # Only trade in strong trends
        if adx < adx_threshold:
            return None
        # DI+ crosses above DI-
        if prev_di_plus <= prev_di_minus and di_plus > di_minus:
            return Signal(action="buy", size=1.0,
                          stop_loss=bar["close"] - sl_points)
        # DI- crosses above DI+
        if prev_di_minus <= prev_di_plus and di_minus > di_plus:
            return Signal(action="sell", size=1.0,
                          stop_loss=bar["close"] + sl_points)
        return None


# ═══════════════════════════════════════════════════════════════
# 10. MULTI-FACTOR CONFLUENCE (Advanced - Combined Signals)
# ═══════════════════════════════════════════════════════════════
# Tests: multiple indicators combined, scoring system, all features
# Walk-forward params: rsi_period, ema_period, atr_period

class MultiFactorConfluence(BaseStrategy):
    """Score-based entry: EMA trend + RSI momentum + volume confirmation.
    Requires 2/3 factors aligned. ATR-based SL/TP."""

    def on_bar(self, bar: dict, history: pd.DataFrame):
        ema_period = self.params.get("ema_period", 50)
        rsi_period = self.params.get("rsi_period", 14)
        atr_period = self.params.get("atr_period", 14)
        atr_sl_mult = self.params.get("atr_sl_mult", 1.5)
        atr_tp_mult = self.params.get("atr_tp_mult", 2.5)
        vol_lookback = self.params.get("vol_lookback", 20)
        min_len = max(ema_period, rsi_period, atr_period, vol_lookback) + 2
        if len(history) < min_len:
            return None

        price = bar["close"]
        ema = ta.trend.EMAIndicator(history["close"], window=ema_period).ema_indicator().iloc[-1]
        rsi = ta.momentum.RSIIndicator(history["close"], window=rsi_period).rsi().iloc[-1]
        atr_val = ta.volatility.AverageTrueRange(
            history["high"], history["low"], history["close"],
            window=atr_period).average_true_range().iloc[-1]
        avg_vol = history["volume"].rolling(vol_lookback).mean().iloc[-1]
        curr_vol = bar["volume"]

        if pd.isna(ema) or pd.isna(rsi) or pd.isna(atr_val) or pd.isna(avg_vol):
            return None

        # Score bull/bear factors
        bull_score = 0
        bear_score = 0

        # Factor 1: EMA trend
        if price > ema:
            bull_score += 1
        else:
            bear_score += 1

        # Factor 2: RSI momentum
        if 40 < rsi < 60:
            pass  # Neutral, no score
        elif rsi <= 40:
            bull_score += 1  # Oversold = buy opportunity
        else:
            bear_score += 1  # Overbought = sell opportunity

        # Factor 3: Volume confirmation
        if curr_vol > avg_vol * 1.2:
            # High volume confirms direction
            if price > ema:
                bull_score += 1
            else:
                bear_score += 1

        sl_dist = atr_val * atr_sl_mult
        tp_dist = atr_val * atr_tp_mult

        if bull_score >= 2 and bear_score == 0:
            return Signal(action="buy", size=1.0,
                          stop_loss=price - sl_dist,
                          take_profit=price + tp_dist)
        if bear_score >= 2 and bull_score == 0:
            return Signal(action="sell", size=1.0,
                          stop_loss=price + sl_dist,
                          take_profit=price - tp_dist)
        return None


# ═══════════════════════════════════════════════════════════════
# REGISTRY
# ═══════════════════════════════════════════════════════════════

PRESET_STRATEGIES = [
    {
        "id": 1,
        "name": "EMA Crossover",
        "class": EMACrossover,
        "description": "Classic trend-following: buy when fast EMA crosses above slow EMA, sell on cross below. No SL/TP - pure signal-driven exits.",
        "category": "Trend Following",
        "default_params": {"fast_period": 9, "slow_period": 21},
        "walk_forward_grid": {
            "fast_period": [5, 9, 12, 15],
            "slow_period": [20, 30, 50],
        },
        "symbol": "NQ=F",
        "interval": "1d",
        "tests": ["entry/exit signals", "no SL/TP", "EMA calculation"],
    },
    {
        "id": 2,
        "name": "RSI Mean Reversion",
        "class": RSIMeanReversion,
        "description": "Buy when RSI bounces from oversold (30), close when overbought (70). Fixed stop loss.",
        "category": "Mean Reversion",
        "default_params": {"rsi_period": 14, "oversold": 30, "overbought": 70, "stop_loss_points": 50},
        "walk_forward_grid": {
            "rsi_period": [10, 14, 20],
            "oversold": [25, 30, 35],
            "overbought": [65, 70, 75],
        },
        "symbol": "NQ=F",
        "interval": "1d",
        "tests": ["stop loss exits", "oscillator levels", "close signal"],
    },
    {
        "id": 3,
        "name": "Bollinger Breakout",
        "class": BollingerBreakout,
        "description": "Long on upper band breakout, short on lower band break. Dynamic SL at middle band.",
        "category": "Volatility Breakout",
        "default_params": {"bb_period": 20, "bb_std": 2.0},
        "walk_forward_grid": {
            "bb_period": [15, 20, 25],
            "bb_std": [1.5, 2.0, 2.5],
        },
        "symbol": "NQ=F",
        "interval": "1d",
        "tests": ["dynamic SL", "band breakout", "both long/short"],
    },
    {
        "id": 4,
        "name": "MACD Momentum",
        "class": MACDMomentum,
        "description": "Buy when MACD histogram crosses above zero, sell on cross below. Pure momentum.",
        "category": "Momentum",
        "default_params": {"fast": 12, "slow": 26, "signal": 9},
        "walk_forward_grid": {
            "fast": [8, 12, 16],
            "slow": [21, 26, 30],
            "signal": [7, 9, 12],
        },
        "symbol": "ES=F",
        "interval": "1d",
        "tests": ["histogram zero-cross", "multi-line indicator", "ES contract"],
    },
    {
        "id": 5,
        "name": "ATR Trailing Stop",
        "class": ATRTrailingStop,
        "description": "Trend-following with ATR-based trailing stop. Long above 50 EMA, short below. Stop trails with volatility.",
        "category": "Trend + Volatility",
        "default_params": {"atr_period": 14, "atr_mult": 2.0, "ema_period": 50},
        "walk_forward_grid": {
            "atr_period": [10, 14, 20],
            "atr_mult": [1.5, 2.0, 2.5, 3.0],
            "ema_period": [30, 50, 100],
        },
        "symbol": "NQ=F",
        "interval": "1d",
        "tests": ["trailing stop logic", "stateful strategy", "ATR-based exits"],
    },
    {
        "id": 6,
        "name": "Stochastic Reversal",
        "class": StochasticReversal,
        "description": "Buy when Stoch K crosses above D in oversold zone. Both SL and TP set.",
        "category": "Mean Reversion",
        "default_params": {"k_period": 14, "d_period": 3, "take_profit_points": 50, "stop_loss_points": 30},
        "walk_forward_grid": {
            "k_period": [10, 14, 21],
            "d_period": [3, 5],
            "take_profit_points": [30, 50, 80],
        },
        "symbol": "NQ=F",
        "interval": "1d",
        "tests": ["SL + TP combined", "K/D crossover", "dual-direction"],
    },
    {
        "id": 7,
        "name": "SuperTrend Follower",
        "class": SuperTrendFollower,
        "description": "Follow SuperTrend direction changes. Flip between long and short on band breaks.",
        "category": "Trend Following",
        "default_params": {"atr_period": 10, "factor": 3.0},
        "walk_forward_grid": {
            "atr_period": [7, 10, 14],
            "factor": [2.0, 3.0, 4.0],
        },
        "symbol": "NQ=F",
        "interval": "1d",
        "tests": ["SuperTrend calc", "position flipping", "always-in-market"],
    },
    {
        "id": 8,
        "name": "VWAP Deviation",
        "class": VWAPDeviation,
        "description": "Mean reversion to VWAP. Buy at -2 stddev, sell at +2. SL at 3 stddev, TP at VWAP.",
        "category": "Mean Reversion",
        "default_params": {"lookback": 20, "std_mult": 2.0, "sl_mult": 3.0},
        "walk_forward_grid": {
            "lookback": [10, 20, 30],
            "std_mult": [1.5, 2.0, 2.5],
        },
        "symbol": "NQ=F",
        "interval": "1h",
        "tests": ["VWAP calc", "dynamic SL/TP", "intraday timeframe"],
    },
    {
        "id": 9,
        "name": "ADX Trend Strength",
        "class": ADXTrendStrength,
        "description": "Only trade in strong trends (ADX > 25). Direction from DI+/DI- crossover.",
        "category": "Trend Filter",
        "default_params": {"adx_period": 14, "adx_threshold": 25, "stop_loss_points": 40},
        "walk_forward_grid": {
            "adx_period": [10, 14, 20],
            "adx_threshold": [20, 25, 30],
        },
        "symbol": "GC=F",
        "interval": "1d",
        "tests": ["ADX filter", "DI crossover", "Gold contract"],
    },
    {
        "id": 10,
        "name": "Multi-Factor Confluence",
        "class": MultiFactorConfluence,
        "description": "Score-based: EMA trend + RSI momentum + volume surge. Needs 2/3 aligned. ATR-based SL/TP.",
        "category": "Multi-Factor",
        "default_params": {
            "ema_period": 50, "rsi_period": 14, "atr_period": 14,
            "atr_sl_mult": 1.5, "atr_tp_mult": 2.5, "vol_lookback": 20,
        },
        "walk_forward_grid": {
            "ema_period": [30, 50, 100],
            "rsi_period": [10, 14, 20],
            "atr_sl_mult": [1.0, 1.5, 2.0],
            "atr_tp_mult": [2.0, 2.5, 3.0],
        },
        "symbol": "NQ=F",
        "interval": "1d",
        "tests": ["multi-indicator scoring", "ATR SL/TP", "volume filter", "full pipeline"],
    },
]
