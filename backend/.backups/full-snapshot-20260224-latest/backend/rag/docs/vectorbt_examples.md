# VectorBT Strategy Examples

## 1. EMA Crossover (Long Only)

```python
from engine.vbt_strategy import VectorBTStrategy, TradeSignal
import ta, numpy as np

class EMACrossoverVBT(VectorBTStrategy):
    def generate_signals(self, df):
        fast = ta.trend.EMAIndicator(df['close'], window=self.params.get('fast_period', 12)).ema_indicator()
        slow = ta.trend.EMAIndicator(df['close'], window=self.params.get('slow_period', 26)).ema_indicator()
        entries = ((fast > slow) & (fast.shift(1) <= slow.shift(1))).fillna(False).values
        exits = ((fast < slow) & (fast.shift(1) >= slow.shift(1))).fillna(False).values
        return TradeSignal(entries=entries, exits=exits)
```

## 2. RSI Mean Reversion (Long + Short)

```python
class RSIMeanReversionVBT(VectorBTStrategy):
    def generate_signals(self, df):
        rsi = ta.momentum.RSIIndicator(df['close'], window=self.params.get('rsi_period', 14)).rsi()
        oversold = self.params.get('oversold', 30)
        overbought = self.params.get('overbought', 70)
        entries = ((rsi > oversold) & (rsi.shift(1) <= oversold)).fillna(False).values
        exits = ((rsi > overbought) & (rsi.shift(1) <= overbought)).fillna(False).values
        short_entries = ((rsi < overbought) & (rsi.shift(1) >= overbought)).fillna(False).values
        short_exits = ((rsi < oversold) & (rsi.shift(1) >= oversold)).fillna(False).values
        return TradeSignal(entries=entries, exits=exits, short_entries=short_entries, short_exits=short_exits)
```

## 3. Bollinger Band Breakout

```python
class BollingerBreakoutVBT(VectorBTStrategy):
    def generate_signals(self, df):
        bb = ta.volatility.BollingerBands(df['close'], window=self.params.get('bb_period', 20), window_dev=self.params.get('bb_std', 2))
        upper = bb.bollinger_hband()
        lower = bb.bollinger_lband()
        entries = ((df['close'] > upper) & (df['close'].shift(1) <= upper.shift(1))).fillna(False).values
        exits = ((df['close'] < lower) & (df['close'].shift(1) >= lower.shift(1))).fillna(False).values
        return TradeSignal(entries=entries, exits=exits)
```

## 4. MACD Histogram Zero Cross

```python
class MACDZeroCrossVBT(VectorBTStrategy):
    def generate_signals(self, df):
        macd = ta.trend.MACD(df['close'], window_slow=self.params.get('slow', 26), window_fast=self.params.get('fast', 12), window_sign=self.params.get('signal', 9))
        hist = macd.macd_diff()
        entries = ((hist > 0) & (hist.shift(1) <= 0)).fillna(False).values
        exits = ((hist < 0) & (hist.shift(1) >= 0)).fillna(False).values
        return TradeSignal(entries=entries, exits=exits)
```

## 5. Stochastic Reversal

```python
class StochasticReversalVBT(VectorBTStrategy):
    def generate_signals(self, df):
        stoch = ta.momentum.StochasticOscillator(df['high'], df['low'], df['close'], window=self.params.get('k_period', 14), smooth_window=self.params.get('d_period', 3))
        k = stoch.stoch()
        d = stoch.stoch_signal()
        oversold = self.params.get('oversold', 20)
        overbought = self.params.get('overbought', 80)
        entries = ((k > d) & (k.shift(1) <= d.shift(1)) & (k < oversold)).fillna(False).values
        exits = ((k < d) & (k.shift(1) >= d.shift(1)) & (k > overbought)).fillna(False).values
        return TradeSignal(entries=entries, exits=exits)
```

## 6. ATR Channel Breakout

```python
class ATRChannelVBT(VectorBTStrategy):
    def generate_signals(self, df):
        atr = ta.volatility.AverageTrueRange(df['high'], df['low'], df['close'], window=self.params.get('atr_period', 14)).average_true_range()
        sma = ta.trend.SMAIndicator(df['close'], window=self.params.get('sma_period', 20)).sma_indicator()
        mult = self.params.get('atr_mult', 2.0)
        upper = sma + mult * atr
        lower = sma - mult * atr
        entries = ((df['close'] > upper) & (df['close'].shift(1) <= upper.shift(1))).fillna(False).values
        exits = ((df['close'] < sma) & (df['close'].shift(1) >= sma.shift(1))).fillna(False).values
        return TradeSignal(entries=entries, exits=exits)
```

## 7. Dual SMA with Volume Filter

```python
class DualSMAVolumeVBT(VectorBTStrategy):
    def generate_signals(self, df):
        fast = ta.trend.SMAIndicator(df['close'], window=self.params.get('fast', 10)).sma_indicator()
        slow = ta.trend.SMAIndicator(df['close'], window=self.params.get('slow', 30)).sma_indicator()
        vol_avg = df['volume'].rolling(20).mean()
        vol_filter = df['volume'] > vol_avg * self.params.get('vol_mult', 1.5)
        cross_up = (fast > slow) & (fast.shift(1) <= slow.shift(1))
        cross_down = (fast < slow) & (fast.shift(1) >= slow.shift(1))
        entries = (cross_up & vol_filter).fillna(False).values
        exits = cross_down.fillna(False).values
        return TradeSignal(entries=entries, exits=exits)
```

## 8. Triple EMA (TEMA Direction)

```python
class TripleEMAVBT(VectorBTStrategy):
    def generate_signals(self, df):
        ema_short = ta.trend.EMAIndicator(df['close'], window=self.params.get('short', 5)).ema_indicator()
        ema_mid = ta.trend.EMAIndicator(df['close'], window=self.params.get('mid', 13)).ema_indicator()
        ema_long = ta.trend.EMAIndicator(df['close'], window=self.params.get('long', 34)).ema_indicator()
        bullish = (ema_short > ema_mid) & (ema_mid > ema_long)
        bearish = (ema_short < ema_mid) & (ema_mid < ema_long)
        entries = (bullish & ~bullish.shift(1).fillna(False)).fillna(False).values
        exits = (bearish & ~bearish.shift(1).fillna(False)).fillna(False).values
        return TradeSignal(entries=entries, exits=exits)
```

## 9. Momentum Breakout (Rate of Change)

```python
class MomentumBreakoutVBT(VectorBTStrategy):
    def generate_signals(self, df):
        period = self.params.get('roc_period', 10)
        threshold = self.params.get('roc_threshold', 2.0)
        roc = ((df['close'] - df['close'].shift(period)) / df['close'].shift(period)) * 100
        entries = ((roc > threshold) & (roc.shift(1) <= threshold)).fillna(False).values
        exits = ((roc < 0) & (roc.shift(1) >= 0)).fillna(False).values
        return TradeSignal(entries=entries, exits=exits)
```

## 10. Mean Reversion with Bollinger %B

```python
class BollingerPercentBVBT(VectorBTStrategy):
    def generate_signals(self, df):
        bb = ta.volatility.BollingerBands(df['close'], window=self.params.get('period', 20), window_dev=self.params.get('std', 2))
        pct_b = bb.bollinger_pband()
        entries = ((pct_b > 0) & (pct_b.shift(1) <= 0)).fillna(False).values
        exits = ((pct_b > 1) & (pct_b.shift(1) <= 1)).fillna(False).values
        short_entries = ((pct_b < 1) & (pct_b.shift(1) >= 1)).fillna(False).values
        short_exits = ((pct_b < 0) & (pct_b.shift(1) >= 0)).fillna(False).values
        return TradeSignal(entries=entries, exits=exits, short_entries=short_entries, short_exits=short_exits)
```

## Parameter Sweep Pattern

All VectorBT strategies use self.params for configurable parameters.
For parameter sweeps, provide a param_grid dict:

```python
param_grid = {
    "fast_period": [5, 10, 15, 20, 25],
    "slow_period": [30, 40, 50, 60, 80, 100],
}
# Total combos: 5 * 6 = 30 tested simultaneously
```
