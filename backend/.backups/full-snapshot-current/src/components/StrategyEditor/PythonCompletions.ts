/**
 * Static completion definitions for Python + VectorBT strategy editing.
 * Provides autocomplete for common imports, strategy patterns, and ta library.
 */

export interface CompletionItem {
  label: string;
  kind: "class" | "function" | "method" | "property" | "snippet";
  detail: string;
  insertText: string;
}

export const PYTHON_COMPLETIONS: CompletionItem[] = [
  // Imports
  {
    label: "import-vbt-strategy",
    kind: "snippet",
    detail: "Import VectorBTStrategy base class",
    insertText:
      "from engine.vbt_strategy import VectorBTStrategy, TradeSignal",
  },
  {
    label: "import-base-strategy",
    kind: "snippet",
    detail: "Import BaseStrategy base class",
    insertText: "from engine.strategy import BaseStrategy, Signal",
  },
  {
    label: "import-ta",
    kind: "snippet",
    detail: "Import technical analysis library",
    insertText: "import ta",
  },
  {
    label: "import-numpy",
    kind: "snippet",
    detail: "Import numpy",
    insertText: "import numpy as np",
  },
  {
    label: "import-pandas",
    kind: "snippet",
    detail: "Import pandas",
    insertText: "import pandas as pd",
  },

  // VBT Strategy template
  {
    label: "vbt-strategy-template",
    kind: "snippet",
    detail: "VectorBT strategy class template",
    insertText: `class MyStrategyVBT(VectorBTStrategy):
    def generate_signals(self, df):
        # Calculate indicators
        fast = ta.trend.EMAIndicator(df['close'], window=self.params.get('fast', 12)).ema_indicator()
        slow = ta.trend.EMAIndicator(df['close'], window=self.params.get('slow', 26)).ema_indicator()

        # Generate signals
        entries = ((fast > slow) & (fast.shift(1) <= slow.shift(1))).fillna(False).values
        exits = ((fast < slow) & (fast.shift(1) >= slow.shift(1))).fillna(False).values

        return TradeSignal(entries=entries, exits=exits)`,
  },

  // Classic Strategy template
  {
    label: "classic-strategy-template",
    kind: "snippet",
    detail: "BaseStrategy class template",
    insertText: `class MyStrategy(BaseStrategy):
    def on_bar(self, bar, history):
        if len(history) < 20:
            return None
        # Your logic here
        return None`,
  },

  // TA indicators
  {
    label: "ta.trend.EMAIndicator",
    kind: "class",
    detail: "Exponential Moving Average",
    insertText: "ta.trend.EMAIndicator(df['close'], window=20).ema_indicator()",
  },
  {
    label: "ta.trend.SMAIndicator",
    kind: "class",
    detail: "Simple Moving Average",
    insertText: "ta.trend.SMAIndicator(df['close'], window=20).sma_indicator()",
  },
  {
    label: "ta.momentum.RSIIndicator",
    kind: "class",
    detail: "Relative Strength Index",
    insertText: "ta.momentum.RSIIndicator(df['close'], window=14).rsi()",
  },
  {
    label: "ta.trend.MACD",
    kind: "class",
    detail: "MACD indicator",
    insertText:
      "ta.trend.MACD(df['close'], window_slow=26, window_fast=12, window_sign=9)",
  },
  {
    label: "ta.volatility.BollingerBands",
    kind: "class",
    detail: "Bollinger Bands",
    insertText:
      "ta.volatility.BollingerBands(df['close'], window=20, window_dev=2)",
  },
  {
    label: "ta.volatility.AverageTrueRange",
    kind: "class",
    detail: "Average True Range",
    insertText:
      "ta.volatility.AverageTrueRange(df['high'], df['low'], df['close'], window=14).average_true_range()",
  },
  {
    label: "ta.momentum.StochasticOscillator",
    kind: "class",
    detail: "Stochastic Oscillator",
    insertText:
      "ta.momentum.StochasticOscillator(df['high'], df['low'], df['close'], window=14, smooth_window=3)",
  },

  // Signal patterns
  {
    label: "crossover-pattern",
    kind: "snippet",
    detail: "Crossover signal detection",
    insertText:
      "entries = ((fast > slow) & (fast.shift(1) <= slow.shift(1))).fillna(False).values",
  },
  {
    label: "crossunder-pattern",
    kind: "snippet",
    detail: "Crossunder signal detection",
    insertText:
      "exits = ((fast < slow) & (fast.shift(1) >= slow.shift(1))).fillna(False).values",
  },
  {
    label: "TradeSignal",
    kind: "class",
    detail: "VBT trade signal result",
    insertText: "TradeSignal(entries=entries, exits=exits)",
  },
  {
    label: "Signal-buy",
    kind: "function",
    detail: "Classic buy signal",
    insertText: "Signal(action='buy', size=1.0, stop_loss=None, take_profit=None)",
  },
  {
    label: "Signal-close",
    kind: "function",
    detail: "Classic close signal",
    insertText: "Signal(action='close')",
  },
  {
    label: "self.params.get",
    kind: "method",
    detail: "Get strategy parameter",
    insertText: "self.params.get('param_name', default_value)",
  },
];
