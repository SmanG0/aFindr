# Quantitative Trading Strategy Patterns

## Trend Following

### Moving Average Crossover
Entry: Fast MA crosses above slow MA.
Exit: Fast MA crosses below slow MA.
Variants: SMA, EMA, WMA, DEMA, TEMA.
Key parameters: fast_period (5-20), slow_period (20-200).
Best on: Trending markets, daily timeframes. Poor in ranging markets.

### Breakout
Entry: Price breaks above N-period high.
Exit: Price breaks below N-period low or trailing stop.
Key parameters: lookback_period (10-50), atr_multiplier for stops.
Best on: Volatile markets after consolidation.

### SuperTrend
Entry: Price closes above SuperTrend line.
Exit: Price closes below SuperTrend line.
Based on ATR bands around HL2 midpoint.
Key parameters: atr_period (7-14), multiplier (1.5-3.0).

### ADX Trend Strength Filter
Combine with any trend system. Only enter when ADX > 25.
Entry: DI+ crosses above DI- AND ADX > threshold.
Exit: DI+ crosses below DI- OR ADX drops below threshold.
Key parameters: adx_period (14), threshold (20-30).

## Mean Reversion

### RSI Oversold/Overbought
Entry: RSI crosses above oversold level (30).
Exit: RSI crosses above overbought level (70).
For shorts: reverse the levels.
Key parameters: rsi_period (7-21), oversold (20-35), overbought (65-80).

### Bollinger Band Mean Reversion
Entry: Price touches/crosses lower band.
Exit: Price reaches middle band (SMA).
Key parameters: bb_period (15-25), std_dev (1.5-2.5).

### Stochastic Oscillator
Entry: %K crosses above %D in oversold zone.
Exit: %K crosses below %D in overbought zone.
Key parameters: k_period (5-21), d_period (3-5), oversold (15-25), overbought (75-85).

### VWAP Reversion
Entry: Price deviates > 1 std below VWAP.
Exit: Price returns to VWAP.
Intraday only — VWAP resets each session.
Best on: 1-15 minute charts, liquid markets.

## Momentum

### MACD
Entry: MACD line crosses above signal line (or histogram > 0).
Exit: MACD line crosses below signal line.
Key parameters: fast (8-15), slow (21-30), signal (7-12).

### Rate of Change (ROC)
Entry: ROC exceeds positive threshold.
Exit: ROC drops below zero.
Key parameters: period (5-20), threshold (1-5%).

### Relative Strength
Compare instrument return vs benchmark over lookback period.
Entry: Relative strength > 1 and rising.
Exit: Relative strength < 1 or declining.

## Volatility

### ATR-Based Stops
Dynamic stop-loss: entry_price - N * ATR.
Trailing stop: highest_high - N * ATR.
Common multipliers: 1.5-3.0 ATR.
Period: 14 is standard, 7 for more responsive.

### Volatility Breakout (Keltner Channel)
Entry: Price breaks above EMA + N * ATR.
Exit: Price falls below EMA.
Similar to Bollinger but uses ATR instead of std dev.
Key parameters: ema_period (20), atr_period (10), atr_mult (1.5-2.5).

## Multi-Factor / Confluence

### Score-Based Entry
Assign points for each confirming factor:
- Trend alignment (EMA slope): +1
- Momentum (RSI in range): +1
- Volume confirmation (above average): +1
- Volatility (ATR expanding): +1
Enter when score >= threshold (e.g., 3 out of 4).

### Filter Stacking
Primary signal + confirmation filter:
1. Primary: EMA crossover
2. Filter 1: ADX > 25 (trending)
3. Filter 2: Volume > 1.5x average
4. Filter 3: RSI not overbought

## Risk Management Patterns

### Fixed Stop-Loss
Set SL at fixed points/percentage below entry.
Simple but doesn't adapt to volatility.

### ATR-Based Stop-Loss
SL = entry_price - N * ATR(14).
Adapts to current market volatility.
N = 1.5-3.0 typical.

### Risk-Reward Ratio
TP = entry + (entry - SL) * R:R ratio.
Common ratios: 1.5:1, 2:1, 3:1.
Higher ratio = fewer wins but larger winners.

### Position Sizing
Fixed fractional: risk X% of capital per trade.
Kelly criterion: optimal fraction based on win rate and payoff ratio.
Anti-Martingale: increase size after wins, decrease after losses.

## Evaluation Metrics

### Must-Track Metrics
- Sharpe Ratio: Risk-adjusted return (> 1.0 good, > 2.0 excellent)
- Sortino Ratio: Penalizes downside only (> 1.5 good)
- Max Drawdown: Largest peak-to-trough decline (< 20% for most strategies)
- Profit Factor: Gross profit / gross loss (> 1.5 good)
- Win Rate: Percentage of winning trades
- Expectancy: Average P&L per trade
- Recovery Factor: Net profit / max drawdown (> 3.0 robust)

### Red Flags
- Sharpe < 0.5 and drawdown > 30%: strategy is unprofitable risk-adjusted
- Win rate > 90%: likely curve-fitted or has rare catastrophic losses
- Profit factor < 1.0: strategy loses money
- Large gap between in-sample and out-of-sample performance: overfitting
