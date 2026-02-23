# Repla Trading Platform — Design Document

**Date:** 2026-02-22
**Status:** Approved

## Overview

AI-powered futures trading backtester with bar-by-bar replay. Users describe trading strategies in natural language, an AI agent generates executable strategy code, runs backtests against historical data, and displays results on interactive charts with replay capability.

## Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Next.js (App Router) + React | UI, routing, BFF API routes |
| Charting | TradingView Lightweight Charts | Candlestick charts, overlays, markers |
| Backend | Python FastAPI | Backtesting engine, AI agent, data fetching |
| AI | Claude Agent SDK (Python) | Natural language → strategy code generation |
| Data | Yahoo Finance (yfinance) | OHLCV historical data for futures |

## Architecture

**Approach:** Monolith — Next.js frontend with Python FastAPI backend in same repo.

```
Next.js App
├── Frontend (React + TradingView Lightweight Charts)
├── API Routes (BFF layer, proxies to FastAPI)
└── Python FastAPI (backtesting engine, spawned as separate process)
    ├── Claude Agent SDK (strategy generation)
    ├── yfinance (data fetching)
    └── pandas/numpy (backtest computation)
```

## MVP Features

1. **Candlestick chart** — TradingView Lightweight Charts, dark theme, buy/sell markers, equity curve overlay
2. **AI chat panel** — sidebar for conversational strategy refinement with context memory
3. **Command bar** — top input for quick strategy generation + immediate backtest
4. **Backtesting engine** — Python-based, bar-by-bar strategy execution against OHLCV data
5. **Backtest results panel** — win rate, max drawdown, return %, trades table, equity curve
6. **Bar-by-bar replay** — playback controls (play, step, speed), progress indicator, client-side candle reveal

## Post-MVP Features

- Monte Carlo simulation
- Trading journal
- AI Journal (AI-generated performance summaries)
- Calendar view
- Alerts system (equity, P/L, position conditions)
- Export data

## Supported Instruments

| Contract | Yahoo Symbol | Point Value | Tick Size |
|----------|-------------|-------------|-----------|
| NQ (Nasdaq 100) | `NQ=F` | $20/point | 0.25 |
| MNQ (Micro Nasdaq) | `MNQ=F` | $2/point | 0.25 |
| ES (S&P 500) | `ES=F` | $50/point | 0.25 |
| Gold (GC) | `GC=F` | $100/point | 0.10 |

- **Continuous contracts** (`NQ=F`) for backtesting — longest history
- **Quarterly contracts** available for near-term accuracy
- Data layer handles symbol mapping between both

## Project Structure

```
repla-trading/
├── package.json
├── next.config.js
├── tsconfig.json
├── .env.example
│
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── api/
│   │       ├── chat/route.ts
│   │       ├── backtest/route.ts
│   │       ├── data/route.ts
│   │       └── replay/route.ts
│   │
│   ├── components/
│   │   ├── Chart/
│   │   ├── TradingPanel/
│   │   ├── ChatPanel/
│   │   ├── CommandBar/
│   │   ├── BacktestResults/
│   │   └── ReplayControls/
│   │
│   ├── lib/
│   │   ├── types.ts
│   │   └── api.ts
│   │
│   └── styles/
│       └── globals.css
│
├── backend/
│   ├── requirements.txt
│   ├── main.py
│   ├── routers/
│   │   ├── chat.py
│   │   ├── backtest.py
│   │   └── data.py
│   ├── engine/
│   │   ├── backtester.py
│   │   ├── strategy.py
│   │   └── metrics.py
│   ├── agent/
│   │   ├── strategy_agent.py
│   │   └── prompts.py
│   └── data/
│       ├── fetcher.py
│       └── contracts.py
```

## Data Flow

### Flow 1: Strategy Generation + Backtest

```
User: "Buy NQ when RSI(14) crosses above 30, sell when it hits 70"
  → CommandBar/ChatPanel → POST /api/chat
  → Next.js proxy → FastAPI /chat
  → Claude Agent SDK generates Python strategy class
  → Server validates code (whitelisted imports only)
  → Strategy loaded via exec() in sandboxed scope
  → Backtester fetches NQ=F OHLCV from yfinance
  → Iterates bar-by-bar, calling strategy.on_bar()
  → Returns: trades[], equity_curve[], metrics{}
  → Frontend renders markers on chart + stats panel
```

### Flow 2: Bar-by-Bar Replay

```
User clicks Play
  → Frontend has full OHLCV dataset loaded
  → Progressively reveals candles one at a time
  → Strategy signals shown as they would have triggered
  → Positions table updates in real-time
  → Speed controlled by 1X/2X/5X/10X multiplier
  → Progress bar shows % through dataset
  → Runs entirely client-side (revealing pre-computed data)
```

## AI Agent Architecture

### Strategy Generation Agent

```python
# System prompt instructs Claude to generate BaseStrategy subclasses
# Available indicators: RSI, MACD, EMA, SMA, Bollinger Bands, ATR, VWAP, Stochastic

class BaseStrategy:
    def __init__(self, params: dict): ...
    def on_bar(self, bar: Bar, history: pd.DataFrame) -> Signal | None: ...

# Signal = { action: "buy"|"sell"|"close", size: float,
#            stop_loss: float|None, take_profit: float|None }
```

### Input Modes

| Input | Behavior |
|-------|----------|
| Command Bar | Generates strategy, immediately runs backtest, shows results |
| Chat Panel | Conversational — agent asks clarifying questions before generating |
| Chat Panel follow-up | Agent modifies existing strategy, re-runs backtest |

### Safety

- Generated code validated before execution
- Only whitelisted imports allowed (pandas, numpy, ta)
- No file I/O, no network calls in strategies
- Sandboxed exec() scope

## Backtesting Engine

### Core Classes

```python
class Backtester:
    def __init__(self, strategy, data, config):
        # config: initial_balance, commission, slippage
    def run(self) -> BacktestResult: ...

class BacktestResult:
    trades: list[Trade]
    equity_curve: list[float]
    metrics: BacktestMetrics
```

### Metrics

- Total trades, win rate, loss rate
- Total return %, return per trade
- Max drawdown (% and $)
- Max consecutive wins / losses
- Profit factor (gross profit / gross loss)
- Sharpe ratio
- Average win size vs average loss size

### Futures-Specific

- P/L calculated using point value (not just price difference)
- Commission configurable per contract
- Slippage modeled as configurable ticks

## UI Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  [CommandBar: "Describe a strategy..."]          [NQ=F ▾] [1D ▾]│
├───────────────────────────────────────────────┬─────────────────┤
│                                               │   Chat Panel    │
│           Candlestick Chart                   │   (collapsible) │
│     (TradingView Lightweight Charts)          │                 │
│   ▲ Buy markers  ▼ Sell markers               │   Conversational│
│   ── Equity curve overlay                     │   AI strategy   │
│                                               │   refinement    │
├───────────────────────────────────────────────┴─────────────────┤
│  Replay: [|◄] [►] [►|]  1d ▾  1b ▾  ██░░ 34.2%    1X ▾        │
├─────────────────────────────────────────────────────────────────┤
│  Positions  │  Orders  │  History  │  Backtest Results           │
│  (tabbed bottom panel with trades table + stats)                │
└─────────────────────────────────────────────────────────────────┘
```

### Color Scheme

- Background: `#000000` / `#0a0a0a`
- Text: `#ffffff` / `#888888`
- Buy/Long: `#22c55e` (green)
- Sell/Short: `#ef4444` (red)
- Accent: `#3b82f6` (blue)
