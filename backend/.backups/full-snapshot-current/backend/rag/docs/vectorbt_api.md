# VectorBT API Reference for Strategy Generation

## Portfolio.from_signals()

The primary entry point for backtesting with boolean signal arrays.

```python
import vectorbt as vbt

pf = vbt.Portfolio.from_signals(
    close=close_prices,       # pd.Series of close prices
    entries=entries,           # Boolean array: True = enter long
    exits=exits,              # Boolean array: True = exit long
    short_entries=short_entries,  # Optional: True = enter short
    short_exits=short_exits,     # Optional: True = exit short
    init_cash=100000,         # Starting capital
    fees=0.001,               # Commission as fraction (0.1%)
    slippage=0.001,           # Slippage as fraction
    size=1.0,                 # Position size
    size_type="amount",       # "amount" or "value" or "percent"
    accumulate=False,         # Don't add to existing positions
    freq="1D",                # Data frequency
)
```

## Portfolio Results

```python
# Total return
pf.total_return()

# Sharpe ratio (annualized)
pf.sharpe_ratio()

# Max drawdown
pf.max_drawdown()

# Equity curve
pf.value()  # pd.Series of portfolio value over time

# Trade records
pf.trades.records_readable  # DataFrame with Entry/Exit prices, PnL, etc.
# Columns: Entry Index, Exit Index, Avg Entry Price, Avg Exit Price,
#           Size, Direction, PnL, Return

# Stats
pf.stats()  # Full statistics summary
```

## Signal Generation Patterns

### Crossover Detection
```python
# Fast crosses above slow
entries = (fast > slow) & (fast.shift(1) <= slow.shift(1))
# Fast crosses below slow
exits = (fast < slow) & (fast.shift(1) >= slow.shift(1))
```

### Threshold Crossing
```python
# RSI crosses above oversold
entries = (rsi > 30) & (rsi.shift(1) <= 30)
# RSI crosses above overbought
exits = (rsi > 70) & (rsi.shift(1) <= 70)
```

### Band Breakout
```python
# Price breaks above upper band
entries = (close > upper_band) & (close.shift(1) <= upper_band.shift(1))
# Price breaks below lower band
exits = (close < lower_band) & (close.shift(1) >= lower_band.shift(1))
```

## Important Notes

- All signal arrays must be numpy boolean arrays with same length as close prices
- Use .fillna(False) before .values to convert pandas Series to numpy
- Signals are processed in order: if entries[i] and exits[i] are both True, entry takes priority
- VectorBT handles position management — strategies just provide signals
- For parameter sweeps, create strategies with configurable parameters via self.params

## Technical Analysis with `ta` Library

```python
import ta

# EMA
ema = ta.trend.EMAIndicator(close, window=20).ema_indicator()

# SMA
sma = ta.trend.SMAIndicator(close, window=20).sma_indicator()

# RSI
rsi = ta.momentum.RSIIndicator(close, window=14).rsi()

# MACD
macd = ta.trend.MACD(close, window_slow=26, window_fast=12, window_sign=9)
macd_line = macd.macd()
signal_line = macd.macd_signal()
histogram = macd.macd_diff()

# Bollinger Bands
bb = ta.volatility.BollingerBands(close, window=20, window_dev=2)
upper = bb.bollinger_hband()
middle = bb.bollinger_mavg()
lower = bb.bollinger_lband()

# ATR
atr = ta.volatility.AverageTrueRange(high, low, close, window=14).average_true_range()

# Stochastic
stoch = ta.momentum.StochasticOscillator(high, low, close, window=14, smooth_window=3)
k = stoch.stoch()
d = stoch.stoch_signal()
```
