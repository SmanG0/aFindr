# αFindr — Complete Platform Documentation

**Compiled:** 2026-02-23  
**Source:** docs/plans/*.md

---

# Part 1: Core Design — aFindr Trading Platform

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

---

# Part 2: Data Flow

## Flow 1: Strategy Generation + Backtest

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

## Flow 2: Bar-by-Bar Replay

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

---

# Part 3: AI Agent Architecture

## Strategy Generation Agent

```python
class BaseStrategy:
    def __init__(self, params: dict): ...
    def on_bar(self, bar: Bar, history: pd.DataFrame) -> Signal | None: ...

# Signal = { action: "buy"|"sell"|"close", size: float,
#            stop_loss: float|None, take_profit: float|None }
```

**Available indicators:** RSI, MACD, EMA, SMA, Bollinger Bands, ATR, VWAP, Stochastic

## Input Modes

| Input | Behavior |
|-------|----------|
| Command Bar | Generates strategy, immediately runs backtest, shows results |
| Chat Panel | Conversational — agent asks clarifying questions before generating |
| Chat Panel follow-up | Agent modifies existing strategy, re-runs backtest |

## Safety

- Generated code validated before execution
- Only whitelisted imports allowed (pandas, numpy, ta)
- No file I/O, no network calls in strategies
- Sandboxed exec() scope

---

# Part 4: Backtesting Engine

## Core Classes

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

## Metrics

- Total trades, win rate, loss rate
- Total return %, return per trade
- Max drawdown (% and $)
- Max consecutive wins / losses
- Profit factor (gross profit / gross loss)
- Sharpe ratio
- Average win size vs average loss size

## Futures-Specific

- P/L calculated using point value (not just price difference)
- Commission configurable per contract
- Slippage modeled as configurable ticks

---

# Part 5: V2 Layout & Components

## Layout Grid

```
NAVBAR1 (82px)  — Feature buttons: Copilot, Risk, Monitoring, Kill Switch, Session, Symbols, Dashboard, Settings
NAVBAR2 (64px)  — Trading context: Symbol, Balance/Equity/P&L, Timeframes, Indicators, Chart AI
LEFT SIDEBAR    — Drawing tools (45px)
CHART           — TradingView canvas + Floating Bid/Ask widget overlay
BOTTOM PANEL    — Tabs: Positions|Orders|History|Balance + integrated playback
STATUS BAR      — Connection, latency, clock
OVERLAYS        — Copilot (fullscreen), Symbols (modal), Risk Mgmt (modal), Settings (sidebar)
```

## Components

| Component | Lines | Description |
|-----------|-------|-------------|
| **Navbar1** | ~250 | Top nav with pill-shaped buttons. Copilot, Risk, Monitoring, Kill Switch, Session, Symbols (Ctrl+S), Dashboard, Settings |
| **Navbar2** | ~200 | Account context: Symbol, Balance/Equity/P&L, Timeframes, Indicators, Chart AI, Trade (Ctrl+A) |
| **CopilotOverlay** | ~350 | Full-screen AI chat. z-index 10000, pill input 666×55px, gradient greeting, watermark |
| **FloatingTradeWidget** | ~200 | Draggable Bid/Ask pill. Red bid, blue ask. Creates position on click |
| **PositionsPanel** | ~300 | Bottom panel. Tabs: Positions/Orders/History/Balance. Integrated playback controls |
| **SymbolsSearch** | ~250 | Modal. Search, category tabs, favorites, sparklines, "Launch Chart" |
| **SettingsPanel** | ~200 | Right-slide sidebar. Theme, notifications, one-click trading, etc. |
| **RiskManagement** | ~150 | Modal. Max positions, allowed symbols, SL/TP rules, glass blur |
| **LeftSidebar** | ~100 | Drawing tools column (45px). Cursor, Trend Line, Fib, Magnet, etc. |

## Trading Engine Hook

```typescript
// useTradingEngine() in src/hooks/useTradingEngine.ts

interface Position {
  id: string; symbol: string; side: "long"|"short"; size: number;
  entryPrice: number; entryTime: number; stopLoss: number|null; takeProfit: number|null; commission: number;
}

// Returns: accountState, placeTrade(), closePosition(), closeAllPositions(),
//          updatePrices(currentPrice)
```

Initial balance: $25,000 (configurable).

---

# Part 6: UI Layout (Original)

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
└─────────────────────────────────────────────────────────────────┘
```

## Playback Integration (V2)

```
[Trading Panel] [Trade (Ctrl+A)] | ◄ Select | [1d ▾] | ▶ Play | ▶▶ Step | [progress] | [1X ▾]
```

---

# Part 7: Theme & Design System

## Core CSS Variables

| Token | Dark | Light |
|-------|------|-------|
| `--bg` | `#1a1714` / `#000000` | `#f5f2ed` |
| `--bg-raised` | `#211e1a` | `#faf8f5` |
| `--buy` | `#22ab94` | `#2e7d6e` |
| `--sell` | `#e54d4d` / `#f23645` | `#c62828` |
| `--accent` | `#c47b3a` (amber) | `#8b6f47` |
| `--text-primary` | `#ece3d5` | `#2c2620` |

## Utility Classes

- `.nav-pill` — 30px border-radius, navbar buttons
- `.modal-overlay` — backdrop blur, z-index 20000
- `.glass` — rgba background + backdrop-filter
- `.metric-group` — Balance/Equity/P&L display
- `.panel-border-top/bottom` — 0.667px aFindr-style borders

## Borders

aFindr uses ultra-thin `0.667px` borders.

---

# Part 8: Liquid Glass UI (Optional)

**Aesthetic:** Apple visionOS meets Bloomberg Terminal

## Glass Panel Recipe

```css
.glass {
  background: rgba(255,255,255,0.03);
  backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255,255,255,0.06);
  box-shadow: 0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05);
}
```

Border radii: 16px (panels), 12px (cards), 8px (buttons)

---

# Part 9: Chart Drawing Tools

## Crosshair

- **Default:** `CrosshairMode.MagnetOHLC` — snaps to nearest OHLC
- **Magnet OFF:** `CrosshairMode.Normal` (free movement)

## Plugin Architecture

- Remove: custom `DrawingOverlay.tsx`, `useDrawings.ts`
- Add: `lightweight-charts-line-tools-core` + lines/rectangle/fib plugins

## Tools (14 total)

**Lines:** Trendline, Horizontal Line, Vertical Line, Ray, Arrow, Extended Line  
**Shapes:** Rectangle, Channel  
**Fibonacci:** Fib Retracement  
**Measurement:** Measure, Ruler  
**Annotations:** Text, Brush  
**Utility:** Eraser

---

# Part 10: Portfolio Page (Robinhood-Style)

**Goal:** Two-column dashboard (portfolio hero + watchlist sidebar) + stock detail drill-down.

## Structure

- `selectedTicker: string | null` — dashboard vs stock detail
- API routes: `/api/portfolio/quotes`, `/api/portfolio/market`, `/api/portfolio/stock/[ticker]`, `/api/portfolio/stock/[ticker]/chart`
- Data: Yahoo Finance v8, CoinGecko

## Stock Detail Sections

Quote, About, Key Stats, Analyst Ratings, Peers, Chart, Order Panel sidebar

---

# Part 11: Project Structure

```
aFindr/
├── src/
│   ├── app/
│   │   ├── layout.tsx, page.tsx
│   │   └── api/
│   │       ├── chat/route.ts
│   │       ├── data/route.ts
│   │       ├── portfolio/...
│   │       └── news/...
│   ├── components/
│   │   ├── Chart/, Navbar1/, Navbar2/
│   │   ├── CopilotOverlay/, PositionsPanel/
│   │   ├── SymbolsSearch/, LeftSidebar/
│   │   ├── NewsPage/, PortfolioPage/
│   │   └── ...
│   ├── lib/ (types.ts, api.ts, theme.ts)
│   └── hooks/ (useTradingEngine.ts, useDrawings.ts)
├── backend/
│   ├── main.py, routers/
│   ├── engine/ (backtester, strategy)
│   ├── agent/ (strategy_agent)
│   └── data/ (fetcher)
└── docs/
```

---

# Part 12: Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+S` | Open Symbols search |
| `Ctrl+A` | Place trade |
| `Escape` | Close overlay/modal |
| Kill switch | User-configurable |

---

# Part 13: Implementation Order (V2)

1. Theme + globals.css
2. Navbar1 + Navbar2
3. LeftSidebar
4. PositionsPanel (with playback)
5. useTradingEngine + FloatingTradeWidget
6. CopilotOverlay
7. SymbolsSearch
8. RiskManagement + Settings
9. Page.tsx layout restructure
10. Polish
