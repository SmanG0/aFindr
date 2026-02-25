# aFindr Trading Platform Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an AI-powered futures trading backtester with bar-by-bar replay, where users describe strategies in natural language and the AI agent generates executable code, runs backtests, and displays results.

**Architecture:** Next.js (App Router) frontend with TradingView Lightweight Charts, Python FastAPI backend with backtesting engine, Claude Agent SDK for natural language → strategy code generation. Monolith repo.

**Tech Stack:** Next.js 16, React 19, TradingView Lightweight Charts v5, lightweight-charts-indicators, Python 3.12+, FastAPI, yfinance, pandas, numpy, ta (technical analysis lib), Claude Agent SDK (Python)

---

## Task 1: Project Scaffolding — Next.js Frontend

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.js`
- Create: `.env.example`
- Create: `.gitignore`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/styles/globals.css`

**Step 1: Initialize Next.js project**

Run:
```bash
cd /Users/saahilmanji/Desktop/ClawdCode/.claude/worktrees/inspiring-darwin
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-git --yes
```
Expected: Next.js project scaffolded with App Router.

**Step 2: Install charting dependencies**

Run:
```bash
npm install lightweight-charts lightweight-charts-indicators
```

**Step 3: Create `.env.example`**

```
ANTHROPIC_API_KEY=your_api_key_here
FASTAPI_URL=http://localhost:8000
```

**Step 4: Set up dark theme in `src/styles/globals.css`**

Replace the default globals.css with aFindr-style dark theme:

```css
@import "tailwindcss";

:root {
  --background: #000000;
  --background-secondary: #0a0a0a;
  --background-tertiary: #111111;
  --border: #1a1a1a;
  --text-primary: #ffffff;
  --text-secondary: #888888;
  --text-muted: #555555;
  --accent: #3b82f6;
  --buy: #22c55e;
  --sell: #ef4444;
}

body {
  background: var(--background);
  color: var(--text-primary);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace;
  margin: 0;
  padding: 0;
  overflow: hidden;
  height: 100vh;
}

* {
  box-sizing: border-box;
}

::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: var(--background);
}
::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 3px;
}
```

**Step 5: Create root layout `src/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "aFindr",
  description: "AI-powered futures trading backtester",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
```

**Step 6: Create placeholder page `src/app/page.tsx`**

```tsx
export default function Home() {
  return (
    <div className="flex items-center justify-center h-screen">
      <h1 className="text-2xl font-mono text-white/50">aFindr</h1>
    </div>
  );
}
```

**Step 7: Verify frontend builds**

Run: `npm run build`
Expected: Build succeeds with no errors.

**Step 8: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js frontend with dark theme"
```

---

## Task 2: Project Scaffolding — Python Backend

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/main.py`
- Create: `backend/routers/__init__.py`
- Create: `backend/engine/__init__.py`
- Create: `backend/agent/__init__.py`
- Create: `backend/data/__init__.py`

**Step 1: Create `backend/requirements.txt`**

```
fastapi>=0.115.0
uvicorn[standard]>=0.30.0
yfinance>=0.2.40
pandas>=2.2.0
numpy>=1.26.0
ta>=0.11.0
claude-agent-sdk>=0.1.0
pydantic>=2.7.0
python-dotenv>=1.0.0
```

**Step 2: Create Python virtual environment and install deps**

Run:
```bash
cd /Users/saahilmanji/Desktop/ClawdCode/.claude/worktrees/inspiring-darwin/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```
Expected: All packages install successfully.

**Step 3: Create `backend/main.py`**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="aFindr API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}
```

**Step 4: Create `__init__.py` files for all backend packages**

Create empty `__init__.py` in `backend/routers/`, `backend/engine/`, `backend/agent/`, `backend/data/`.

**Step 5: Verify backend starts**

Run:
```bash
cd /Users/saahilmanji/Desktop/ClawdCode/.claude/worktrees/inspiring-darwin/backend
source venv/bin/activate
uvicorn main:app --reload --port 8000 &
curl http://localhost:8000/health
kill %1
```
Expected: Returns `{"status":"ok"}`.

**Step 6: Commit**

```bash
git add backend/
git commit -m "feat: scaffold Python FastAPI backend"
```

---

## Task 3: Shared Types — TypeScript

**Files:**
- Create: `src/lib/types.ts`

**Step 1: Define all shared TypeScript types**

```typescript
// OHLCV candle data
export interface Candle {
  time: number; // Unix timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Futures contract config
export interface ContractConfig {
  symbol: string;       // e.g. "NQ=F"
  name: string;         // e.g. "Nasdaq 100 Futures"
  pointValue: number;   // e.g. 20
  tickSize: number;     // e.g. 0.25
}

export const CONTRACTS: Record<string, ContractConfig> = {
  "NQ=F": { symbol: "NQ=F", name: "NQ (Nasdaq 100)", pointValue: 20, tickSize: 0.25 },
  "MNQ=F": { symbol: "MNQ=F", name: "MNQ (Micro Nasdaq)", pointValue: 2, tickSize: 0.25 },
  "ES=F": { symbol: "ES=F", name: "ES (S&P 500)", pointValue: 50, tickSize: 0.25 },
  "GC=F": { symbol: "GC=F", name: "GC (Gold)", pointValue: 100, tickSize: 0.10 },
};

// Trade record from backtest
export interface Trade {
  id: number;
  instrument: string;
  side: "long" | "short";
  size: number;
  entryPrice: number;
  exitPrice: number;
  entryTime: number;
  exitTime: number;
  stopLoss: number | null;
  takeProfit: number | null;
  pnl: number;           // Dollar P/L (using point value)
  pnlPoints: number;     // Points P/L
  commission: number;
}

// Backtest result metrics
export interface BacktestMetrics {
  totalTrades: number;
  winRate: number;
  lossRate: number;
  totalReturn: number;
  totalReturnPct: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  maxConsecutiveLosses: number;
  maxConsecutiveWins: number;
  profitFactor: number;
  sharpeRatio: number;
  avgWin: number;
  avgLoss: number;
}

// Full backtest result
export interface BacktestResult {
  trades: Trade[];
  equityCurve: { time: number; value: number }[];
  metrics: BacktestMetrics;
  strategyName: string;
  strategyDescription: string;
}

// Strategy generated by AI
export interface GeneratedStrategy {
  code: string;
  name: string;
  description: string;
  parameters: Record<string, number | string>;
}

// Chat message
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  strategyResult?: BacktestResult;
}

// Replay state
export interface ReplayState {
  isPlaying: boolean;
  currentBarIndex: number;
  totalBars: number;
  speed: number; // 1, 2, 5, 10
  progress: number; // 0-100
}

// API request/response types
export interface ChatRequest {
  message: string;
  symbol: string;
  timeframe: string;
  conversationHistory: { role: string; content: string }[];
}

export interface ChatResponse {
  message: string;
  strategy?: GeneratedStrategy;
  backtestResult?: BacktestResult;
}

export interface DataRequest {
  symbol: string;
  period: string; // e.g. "1y", "6mo", "3mo"
  interval: string; // e.g. "1d", "1h", "15m"
}
```

**Step 2: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add shared TypeScript types"
```

---

## Task 4: Data Layer — Yahoo Finance Fetcher

**Files:**
- Create: `backend/data/contracts.py`
- Create: `backend/data/fetcher.py`
- Create: `backend/routers/data.py`
- Test: `backend/tests/test_fetcher.py`

**Step 1: Write failing test for data fetcher**

Create `backend/tests/__init__.py` (empty) and `backend/tests/test_fetcher.py`:

```python
import pytest
from backend.data.fetcher import fetch_ohlcv
from backend.data.contracts import CONTRACTS, get_contract_config


def test_contracts_config():
    assert "NQ=F" in CONTRACTS
    config = get_contract_config("NQ=F")
    assert config["point_value"] == 20
    assert config["tick_size"] == 0.25


@pytest.mark.asyncio
async def test_fetch_ohlcv_returns_dataframe():
    df = await fetch_ohlcv("NQ=F", period="5d", interval="1d")
    assert not df.empty
    assert "open" in df.columns
    assert "high" in df.columns
    assert "low" in df.columns
    assert "close" in df.columns
    assert "volume" in df.columns
```

**Step 2: Run test to verify it fails**

Run:
```bash
cd /Users/saahilmanji/Desktop/ClawdCode/.claude/worktrees/inspiring-darwin
source backend/venv/bin/activate
pip install pytest pytest-asyncio
python -m pytest backend/tests/test_fetcher.py -v
```
Expected: FAIL — modules don't exist yet.

**Step 3: Implement `backend/data/contracts.py`**

```python
CONTRACTS = {
    "NQ=F": {
        "symbol": "NQ=F",
        "name": "NQ (Nasdaq 100)",
        "point_value": 20,
        "tick_size": 0.25,
    },
    "MNQ=F": {
        "symbol": "MNQ=F",
        "name": "MNQ (Micro Nasdaq)",
        "point_value": 2,
        "tick_size": 0.25,
    },
    "ES=F": {
        "symbol": "ES=F",
        "name": "ES (S&P 500)",
        "point_value": 50,
        "tick_size": 0.25,
    },
    "GC=F": {
        "symbol": "GC=F",
        "name": "GC (Gold)",
        "point_value": 100,
        "tick_size": 0.10,
    },
}


def get_contract_config(symbol: str) -> dict:
    if symbol not in CONTRACTS:
        raise ValueError(f"Unknown contract: {symbol}. Available: {list(CONTRACTS.keys())}")
    return CONTRACTS[symbol]
```

**Step 4: Implement `backend/data/fetcher.py`**

```python
import yfinance as yf
import pandas as pd


async def fetch_ohlcv(
    symbol: str,
    period: str = "1y",
    interval: str = "1d",
) -> pd.DataFrame:
    """Fetch OHLCV data from Yahoo Finance."""
    ticker = yf.Ticker(symbol)
    df = ticker.history(period=period, interval=interval)

    if df.empty:
        raise ValueError(f"No data returned for {symbol}")

    df = df.rename(columns={
        "Open": "open",
        "High": "high",
        "Low": "low",
        "Close": "close",
        "Volume": "volume",
    })
    df = df[["open", "high", "low", "close", "volume"]]
    df.index.name = "timestamp"
    return df
```

**Step 5: Run tests to verify they pass**

Run: `python -m pytest backend/tests/test_fetcher.py -v`
Expected: Both tests PASS.

**Step 6: Implement `backend/routers/data.py`**

```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from backend.data.fetcher import fetch_ohlcv
from backend.data.contracts import CONTRACTS, get_contract_config

router = APIRouter(prefix="/api/data", tags=["data"])


class DataRequest(BaseModel):
    symbol: str
    period: str = "1y"
    interval: str = "1d"


@router.get("/contracts")
async def list_contracts():
    return CONTRACTS


@router.post("/ohlcv")
async def get_ohlcv(req: DataRequest):
    try:
        get_contract_config(req.symbol)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    try:
        df = await fetch_ohlcv(req.symbol, req.period, req.interval)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    candles = []
    for ts, row in df.iterrows():
        candles.append({
            "time": int(ts.timestamp()),
            "open": round(row["open"], 2),
            "high": round(row["high"], 2),
            "low": round(row["low"], 2),
            "close": round(row["close"], 2),
            "volume": int(row["volume"]),
        })
    return {"symbol": req.symbol, "candles": candles, "count": len(candles)}
```

**Step 7: Register router in `backend/main.py`**

Add to `backend/main.py`:
```python
from backend.routers.data import router as data_router
app.include_router(data_router)
```

**Step 8: Commit**

```bash
git add backend/
git commit -m "feat: add Yahoo Finance data fetcher with futures contract support"
```

---

## Task 5: Backtesting Engine

**Files:**
- Create: `backend/engine/strategy.py`
- Create: `backend/engine/backtester.py`
- Create: `backend/engine/metrics.py`
- Test: `backend/tests/test_backtester.py`

**Step 1: Write failing tests for the backtester**

Create `backend/tests/test_backtester.py`:

```python
import pytest
import pandas as pd
import numpy as np
from backend.engine.strategy import BaseStrategy, Signal
from backend.engine.backtester import Backtester, BacktestConfig
from backend.engine.metrics import calculate_metrics


class SimpleBuyAndHold(BaseStrategy):
    """Buy on first bar, hold forever."""
    def on_bar(self, bar: dict, history: pd.DataFrame) -> Signal | None:
        if len(history) == 1:
            return Signal(action="buy", size=1)
        return None


def make_test_data(n: int = 100) -> pd.DataFrame:
    """Generate synthetic OHLCV data."""
    np.random.seed(42)
    prices = 18000 + np.cumsum(np.random.randn(n) * 20)
    data = {
        "open": prices,
        "high": prices + np.abs(np.random.randn(n) * 10),
        "low": prices - np.abs(np.random.randn(n) * 10),
        "close": prices + np.random.randn(n) * 5,
        "volume": np.random.randint(1000, 10000, n),
    }
    timestamps = pd.date_range("2025-01-01", periods=n, freq="D")
    return pd.DataFrame(data, index=timestamps)


def test_backtester_runs():
    data = make_test_data()
    strategy = SimpleBuyAndHold({})
    config = BacktestConfig(initial_balance=50000, commission=2.50, point_value=20)
    bt = Backtester(strategy, data, config)
    result = bt.run()
    assert len(result.equity_curve) == len(data)
    assert result.metrics["total_trades"] >= 1


def test_calculate_metrics_empty():
    metrics = calculate_metrics([], 50000)
    assert metrics["total_trades"] == 0
    assert metrics["win_rate"] == 0.0
```

**Step 2: Run tests to verify they fail**

Run: `python -m pytest backend/tests/test_backtester.py -v`
Expected: FAIL — modules don't exist yet.

**Step 3: Implement `backend/engine/strategy.py`**

```python
from dataclasses import dataclass
import pandas as pd


@dataclass
class Signal:
    action: str  # "buy", "sell", "close"
    size: float = 1.0
    stop_loss: float | None = None
    take_profit: float | None = None


class BaseStrategy:
    """Base class all generated strategies must extend."""

    def __init__(self, params: dict):
        self.params = params

    def on_bar(self, bar: dict, history: pd.DataFrame) -> Signal | None:
        """Called for each bar. Return a Signal or None."""
        raise NotImplementedError
```

**Step 4: Implement `backend/engine/metrics.py`**

```python
import numpy as np


def calculate_metrics(trades: list[dict], initial_balance: float) -> dict:
    if not trades:
        return {
            "total_trades": 0,
            "win_rate": 0.0,
            "loss_rate": 0.0,
            "total_return": 0.0,
            "total_return_pct": 0.0,
            "max_drawdown": 0.0,
            "max_drawdown_pct": 0.0,
            "max_consecutive_losses": 0,
            "max_consecutive_wins": 0,
            "profit_factor": 0.0,
            "sharpe_ratio": 0.0,
            "avg_win": 0.0,
            "avg_loss": 0.0,
        }

    pnls = [t["pnl"] for t in trades]
    wins = [p for p in pnls if p > 0]
    losses = [p for p in pnls if p <= 0]

    # Consecutive wins/losses
    max_consec_wins = 0
    max_consec_losses = 0
    current_wins = 0
    current_losses = 0
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

    # Sharpe ratio (annualized, assuming daily trades)
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
        "avg_win": round(np.mean(wins), 2) if wins else 0.0,
        "avg_loss": round(np.mean(losses), 2) if losses else 0.0,
    }
```

**Step 5: Implement `backend/engine/backtester.py`**

```python
from dataclasses import dataclass
import pandas as pd
from backend.engine.strategy import BaseStrategy, Signal
from backend.engine.metrics import calculate_metrics


@dataclass
class BacktestConfig:
    initial_balance: float = 50000.0
    commission: float = 2.50  # per side, per contract
    slippage_ticks: int = 1
    point_value: float = 20.0  # NQ default
    tick_size: float = 0.25


@dataclass
class Position:
    side: str  # "long" or "short"
    size: float
    entry_price: float
    entry_time: int
    stop_loss: float | None = None
    take_profit: float | None = None


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
        self.position: Position | None = None
        self.trades: list[dict] = []
        self.equity_curve: list[dict] = []
        self.trade_id = 0

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
            history = self.data.iloc[: i + 1]

            # Check stop loss / take profit
            if self.position:
                self._check_sl_tp(bar)

            # Get strategy signal
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

        # Close any open position at end
        if self.position:
            last_bar = {
                "time": self.equity_curve[-1]["time"],
                "close": float(rows.iloc[-1]["close"]),
            }
            self._close_position(last_bar)

        metrics = calculate_metrics(self.trades, self.config.initial_balance)
        return BacktestResult(
            trades=self.trades,
            equity_curve=self.equity_curve,
            metrics=metrics,
        )

    def _open_position(self, bar: dict, signal: Signal):
        slippage = self.config.slippage_ticks * self.config.tick_size
        side = "long" if signal.action == "buy" else "short"
        entry_price = bar["close"] + slippage if side == "long" else bar["close"] - slippage
        self.balance -= self.config.commission
        self.position = Position(
            side=side,
            size=signal.size,
            entry_price=entry_price,
            entry_time=bar["time"],
            stop_loss=signal.stop_loss,
            take_profit=signal.take_profit,
        )

    def _close_position(self, bar: dict):
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
            "id": self.trade_id,
            "instrument": "N/A",
            "side": self.position.side,
            "size": self.position.size,
            "entry_price": round(self.position.entry_price, 2),
            "exit_price": round(exit_price, 2),
            "entry_time": self.position.entry_time,
            "exit_time": bar["time"],
            "stop_loss": self.position.stop_loss,
            "take_profit": self.position.take_profit,
            "pnl": round(pnl, 2),
            "pnl_points": round(pnl_points, 2),
            "commission": self.config.commission * 2,
        })
        self.position = None

    def _check_sl_tp(self, bar: dict):
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

    def _close_at_price(self, bar: dict, price: float):
        if not self.position:
            return
        if self.position.side == "long":
            pnl_points = price - self.position.entry_price
        else:
            pnl_points = self.position.entry_price - price
        pnl = pnl_points * self.config.point_value * self.position.size
        self.balance += pnl - self.config.commission
        self.trade_id += 1
        self.trades.append({
            "id": self.trade_id,
            "instrument": "N/A",
            "side": self.position.side,
            "size": self.position.size,
            "entry_price": round(self.position.entry_price, 2),
            "exit_price": round(price, 2),
            "entry_time": self.position.entry_time,
            "exit_time": bar["time"],
            "stop_loss": self.position.stop_loss,
            "take_profit": self.position.take_profit,
            "pnl": round(pnl, 2),
            "pnl_points": round(pnl_points, 2),
            "commission": self.config.commission * 2,
        })
        self.position = None

    def _current_equity(self, current_price: float) -> float:
        equity = self.balance
        if self.position:
            if self.position.side == "long":
                unrealized = (current_price - self.position.entry_price) * self.config.point_value * self.position.size
            else:
                unrealized = (self.position.entry_price - current_price) * self.config.point_value * self.position.size
            equity += unrealized
        return equity
```

**Step 6: Run tests to verify they pass**

Run: `python -m pytest backend/tests/test_backtester.py -v`
Expected: All tests PASS.

**Step 7: Commit**

```bash
git add backend/
git commit -m "feat: add backtesting engine with strategy base class and metrics"
```

---

## Task 6: AI Strategy Agent

**Files:**
- Create: `backend/agent/prompts.py`
- Create: `backend/agent/strategy_agent.py`
- Create: `backend/agent/sandbox.py`
- Create: `backend/routers/chat.py`

**Step 1: Create `backend/agent/prompts.py`**

```python
STRATEGY_SYSTEM_PROMPT = """You are a quantitative trading strategy developer. When the user describes a trading strategy in natural language, you generate a Python class that extends BaseStrategy.

## Rules:
1. Your strategy class MUST extend BaseStrategy
2. You MUST implement the on_bar(self, bar: dict, history: pd.DataFrame) -> Signal | None method
3. bar has keys: time, open, high, low, close, volume
4. history is a pandas DataFrame with columns: open, high, low, close, volume
5. Return Signal(action="buy"|"sell"|"close", size=1.0, stop_loss=float|None, take_profit=float|None) or None
6. You may ONLY import: pandas, numpy, ta (technical analysis library)
7. Available ta indicators via the `ta` library: ta.momentum.RSIIndicator, ta.trend.MACD, ta.trend.EMAIndicator, ta.trend.SMAIndicator, ta.volatility.BollingerBands, ta.volatility.AverageTrueRange, ta.momentum.StochasticOscillator
8. Do NOT use any file I/O, network calls, or print statements
9. Strategy class name must be descriptive (e.g., RSICrossoverStrategy)

## Output format:
Respond with ONLY a JSON object:
{
  "name": "StrategyName",
  "description": "Brief description of the strategy logic",
  "parameters": {"param1": value1, "param2": value2},
  "code": "full Python code as a string"
}

## Example:
User: "Buy when RSI crosses above 30, sell when RSI crosses above 70, 50 point stop loss"

{
  "name": "RSIMeanReversion",
  "description": "RSI mean reversion - buy on oversold bounce, sell on overbought",
  "parameters": {"rsi_period": 14, "oversold": 30, "overbought": 70, "stop_loss_points": 50},
  "code": "import pandas as pd\\nimport numpy as np\\nimport ta\\nfrom backend.engine.strategy import BaseStrategy, Signal\\n\\nclass RSIMeanReversion(BaseStrategy):\\n    def on_bar(self, bar, history):\\n        if len(history) < 15:\\n            return None\\n        rsi = ta.momentum.RSIIndicator(history['close'], window=14).rsi()\\n        current_rsi = rsi.iloc[-1]\\n        prev_rsi = rsi.iloc[-2]\\n        if prev_rsi <= 30 and current_rsi > 30:\\n            return Signal(action='buy', size=1.0, stop_loss=bar['close'] - 50)\\n        if current_rsi > 70:\\n            return Signal(action='close')\\n        return None"
}
"""
```

**Step 2: Create `backend/agent/sandbox.py`**

```python
import ast
import re

ALLOWED_IMPORTS = {"pandas", "numpy", "ta", "pd", "np"}
FORBIDDEN_PATTERNS = [
    r"open\s*\(",
    r"__import__",
    r"exec\s*\(",
    r"eval\s*\(",
    r"os\.",
    r"sys\.",
    r"subprocess",
    r"import\s+os",
    r"import\s+sys",
    r"import\s+subprocess",
    r"import\s+socket",
    r"import\s+http",
    r"import\s+urllib",
    r"import\s+requests",
]


def validate_strategy_code(code: str) -> tuple[bool, str]:
    """Validate that generated strategy code is safe to execute."""
    # Check forbidden patterns
    for pattern in FORBIDDEN_PATTERNS:
        if re.search(pattern, code):
            return False, f"Forbidden pattern found: {pattern}"

    # Parse AST to check imports
    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        return False, f"Syntax error: {e}"

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                module = alias.name.split(".")[0]
                if module not in ALLOWED_IMPORTS and module != "backend":
                    return False, f"Forbidden import: {alias.name}"
        elif isinstance(node, ast.ImportFrom):
            if node.module:
                module = node.module.split(".")[0]
                if module not in ALLOWED_IMPORTS and module != "backend":
                    return False, f"Forbidden import from: {node.module}"

    return True, "OK"


def execute_strategy_code(code: str) -> type:
    """Execute validated strategy code and return the strategy class."""
    namespace = {}
    exec(code, namespace)

    # Find the strategy class (subclass of BaseStrategy)
    from backend.engine.strategy import BaseStrategy
    for value in namespace.values():
        if isinstance(value, type) and issubclass(value, BaseStrategy) and value is not BaseStrategy:
            return value

    raise ValueError("No BaseStrategy subclass found in generated code")
```

**Step 3: Create `backend/agent/strategy_agent.py`**

```python
import json
import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions, AssistantMessage, TextBlock
from backend.agent.prompts import STRATEGY_SYSTEM_PROMPT


async def generate_strategy(
    user_message: str,
    conversation_history: list[dict] | None = None,
) -> dict:
    """Use Claude to generate a trading strategy from natural language."""
    prompt_parts = []
    if conversation_history:
        for msg in conversation_history:
            prompt_parts.append(f"{msg['role'].upper()}: {msg['content']}")
    prompt_parts.append(f"USER: {user_message}")
    full_prompt = "\n".join(prompt_parts)

    options = ClaudeAgentOptions(
        system_prompt=STRATEGY_SYSTEM_PROMPT,
        max_turns=1,
    )

    response_text = ""
    async for message in query(prompt=full_prompt, options=options):
        if isinstance(message, AssistantMessage):
            for block in message.content:
                if isinstance(block, TextBlock):
                    response_text += block.text

    # Parse JSON response
    # Try to extract JSON from the response (handle markdown code blocks)
    json_match = response_text
    if "```json" in response_text:
        start = response_text.index("```json") + 7
        end = response_text.index("```", start)
        json_match = response_text[start:end].strip()
    elif "```" in response_text:
        start = response_text.index("```") + 3
        end = response_text.index("```", start)
        json_match = response_text[start:end].strip()

    try:
        result = json.loads(json_match)
    except json.JSONDecodeError:
        return {
            "error": "Failed to parse strategy response",
            "raw_response": response_text,
        }

    return result
```

**Step 4: Create `backend/routers/chat.py`**

```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from backend.agent.strategy_agent import generate_strategy
from backend.agent.sandbox import validate_strategy_code, execute_strategy_code
from backend.engine.backtester import Backtester, BacktestConfig
from backend.data.fetcher import fetch_ohlcv
from backend.data.contracts import get_contract_config

router = APIRouter(prefix="/api/chat", tags=["chat"])


class ChatRequest(BaseModel):
    message: str
    symbol: str = "NQ=F"
    period: str = "1y"
    interval: str = "1d"
    initial_balance: float = 50000.0
    conversation_history: list[dict] = []


@router.post("")
async def chat(req: ChatRequest):
    # Generate strategy from natural language
    strategy_result = await generate_strategy(
        req.message, req.conversation_history
    )

    if "error" in strategy_result:
        return {
            "message": strategy_result.get("raw_response", "Failed to generate strategy"),
            "strategy": None,
            "backtest_result": None,
        }

    code = strategy_result.get("code", "")

    # Validate code safety
    is_valid, validation_msg = validate_strategy_code(code)
    if not is_valid:
        return {
            "message": f"Generated code failed validation: {validation_msg}",
            "strategy": strategy_result,
            "backtest_result": None,
        }

    # Execute strategy and run backtest
    try:
        strategy_class = execute_strategy_code(code)
        strategy_instance = strategy_class(strategy_result.get("parameters", {}))
    except Exception as e:
        return {
            "message": f"Failed to load strategy: {str(e)}",
            "strategy": strategy_result,
            "backtest_result": None,
        }

    try:
        df = await fetch_ohlcv(req.symbol, req.period, req.interval)
        contract = get_contract_config(req.symbol)
        config = BacktestConfig(
            initial_balance=req.initial_balance,
            point_value=contract["point_value"],
            tick_size=contract["tick_size"],
        )
        bt = Backtester(strategy_instance, df, config)
        result = bt.run()
    except Exception as e:
        return {
            "message": f"Backtest failed: {str(e)}",
            "strategy": strategy_result,
            "backtest_result": None,
        }

    return {
        "message": f"Strategy '{strategy_result['name']}' backtested successfully on {req.symbol}.",
        "strategy": {
            "name": strategy_result.get("name"),
            "description": strategy_result.get("description"),
            "parameters": strategy_result.get("parameters"),
            "code": code,
        },
        "backtest_result": {
            "trades": result.trades,
            "equity_curve": result.equity_curve,
            "metrics": result.metrics,
            "strategy_name": strategy_result.get("name"),
            "strategy_description": strategy_result.get("description"),
        },
    }
```

**Step 5: Register chat router in `backend/main.py`**

Add:
```python
from backend.routers.chat import router as chat_router
app.include_router(chat_router)
```

**Step 6: Commit**

```bash
git add backend/
git commit -m "feat: add AI strategy agent with Claude SDK and code sandbox"
```

---

## Task 7: Next.js API Proxy Routes

**Files:**
- Create: `src/app/api/chat/route.ts`
- Create: `src/app/api/data/route.ts`

**Step 1: Create `src/app/api/chat/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";

const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8000";

export async function POST(request: NextRequest) {
  const body = await request.json();

  const res = await fetch(`${FASTAPI_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return NextResponse.json(data);
}
```

**Step 2: Create `src/app/api/data/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";

const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8000";

export async function POST(request: NextRequest) {
  const body = await request.json();

  const res = await fetch(`${FASTAPI_URL}/api/data/ohlcv`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return NextResponse.json(data);
}

export async function GET() {
  const res = await fetch(`${FASTAPI_URL}/api/data/contracts`);
  const data = await res.json();
  return NextResponse.json(data);
}
```

**Step 3: Create `src/lib/api.ts`**

```typescript
import type {
  ChatRequest,
  ChatResponse,
  DataRequest,
  Candle,
  ContractConfig,
} from "./types";

const API_BASE = "/api";

export async function sendChatMessage(req: ChatRequest): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`Chat failed: ${res.statusText}`);
  return res.json();
}

export async function fetchOHLCV(
  req: DataRequest
): Promise<{ symbol: string; candles: Candle[]; count: number }> {
  const res = await fetch(`${API_BASE}/data`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`Data fetch failed: ${res.statusText}`);
  return res.json();
}

export async function fetchContracts(): Promise<Record<string, ContractConfig>> {
  const res = await fetch(`${API_BASE}/data`);
  if (!res.ok) throw new Error(`Contracts fetch failed: ${res.statusText}`);
  return res.json();
}
```

**Step 4: Commit**

```bash
git add src/
git commit -m "feat: add Next.js API proxy routes and frontend API client"
```

---

## Task 8: Chart Component

**Files:**
- Create: `src/components/Chart/Chart.tsx`
- Create: `src/components/Chart/index.ts`

**Step 1: Create `src/components/Chart/Chart.tsx`**

This is the core TradingView Lightweight Charts wrapper. Uses v5 API with `createSeriesMarkers`.

```tsx
"use client";

import { useEffect, useRef, useCallback } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  ColorType,
  type IChartApi,
  type ISeriesApi,
} from "lightweight-charts";
import { createSeriesMarkers } from "lightweight-charts";
import type { Candle, Trade } from "@/lib/types";

interface ChartProps {
  candles: Candle[];
  trades?: Trade[];
  equityCurve?: { time: number; value: number }[];
  visibleBars?: number; // For replay mode — only show this many bars
}

export default function Chart({ candles, trades, equityCurve, visibleBars }: ChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  const initChart = useCallback(() => {
    if (!containerRef.current) return;

    // Dispose existing chart
    if (chartRef.current) {
      chartRef.current.remove();
    }

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#000000" },
        textColor: "#888888",
      },
      grid: {
        vertLines: { color: "#1a1a1a" },
        horzLines: { color: "#1a1a1a" },
      },
      crosshair: {
        vertLine: { color: "#3b82f6", width: 1, style: 2 },
        horzLine: { color: "#3b82f6", width: 1, style: 2 },
      },
      timeScale: {
        borderColor: "#1a1a1a",
        timeVisible: true,
      },
      rightPriceScale: {
        borderColor: "#1a1a1a",
      },
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    const visibleCandles = visibleBars
      ? candles.slice(0, visibleBars)
      : candles;

    candleSeries.setData(
      visibleCandles.map((c) => ({
        time: c.time as any,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );

    // Add trade markers
    if (trades && trades.length > 0) {
      const markers = trades.flatMap((t) => [
        {
          time: t.entryTime as any,
          position: (t.side === "long" ? "belowBar" : "aboveBar") as any,
          color: t.side === "long" ? "#22c55e" : "#ef4444",
          shape: (t.side === "long" ? "arrowUp" : "arrowDown") as any,
          text: `${t.side === "long" ? "BUY" : "SELL"} @ ${t.entryPrice}`,
        },
        {
          time: t.exitTime as any,
          position: "inBar" as any,
          color: "#3b82f6",
          shape: "circle" as any,
          text: `EXIT @ ${t.exitPrice} (${t.pnl >= 0 ? "+" : ""}$${t.pnl})`,
        },
      ]);

      markers.sort((a, b) => (a.time as number) - (b.time as number));
      createSeriesMarkers(candleSeries, markers);
    }

    // Add equity curve overlay
    if (equityCurve && equityCurve.length > 0) {
      const equitySeries = chart.addSeries(LineSeries, {
        color: "#3b82f6",
        lineWidth: 2,
        priceScaleId: "equity",
      });
      chart.priceScale("equity").applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      });
      equitySeries.setData(
        equityCurve.map((e) => ({
          time: e.time as any,
          value: e.value,
        }))
      );
    }

    chart.timeScale().fitContent();
    chartRef.current = chart;
    candleSeriesRef.current = candleSeries as any;
  }, [candles, trades, equityCurve, visibleBars]);

  useEffect(() => {
    initChart();

    const handleResize = () => {
      if (chartRef.current && containerRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [initChart]);

  return <div ref={containerRef} className="w-full h-full" />;
}
```

**Step 2: Create `src/components/Chart/index.ts`**

```typescript
export { default as Chart } from "./Chart";
```

**Step 3: Verify it builds**

Run: `npm run build`
Expected: Builds with no type errors.

**Step 4: Commit**

```bash
git add src/components/Chart/
git commit -m "feat: add TradingView Lightweight Charts component with markers and equity overlay"
```

---

## Task 9: Command Bar Component

**Files:**
- Create: `src/components/CommandBar/CommandBar.tsx`
- Create: `src/components/CommandBar/index.ts`

**Step 1: Create `src/components/CommandBar/CommandBar.tsx`**

```tsx
"use client";

import { useState, useRef } from "react";
import type { ContractConfig } from "@/lib/types";
import { CONTRACTS } from "@/lib/types";

interface CommandBarProps {
  onSubmit: (message: string) => void;
  selectedSymbol: string;
  onSymbolChange: (symbol: string) => void;
  selectedTimeframe: string;
  onTimeframeChange: (timeframe: string) => void;
  isLoading: boolean;
}

const TIMEFRAMES = ["1d", "1h", "15m", "5m"];

export default function CommandBar({
  onSubmit,
  selectedSymbol,
  onSymbolChange,
  selectedTimeframe,
  onTimeframeChange,
  isLoading,
}: CommandBarProps) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSubmit(input.trim());
    setInput("");
  };

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b" style={{ borderColor: "var(--border)", background: "var(--background-secondary)" }}>
      <form onSubmit={handleSubmit} className="flex-1">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder='Describe a strategy... (e.g., "Buy NQ when RSI crosses above 30")'
          disabled={isLoading}
          className="w-full bg-transparent text-white placeholder-gray-500 outline-none font-mono text-sm"
        />
      </form>

      {isLoading && (
        <div className="text-xs text-blue-400 animate-pulse">Generating...</div>
      )}

      <select
        value={selectedSymbol}
        onChange={(e) => onSymbolChange(e.target.value)}
        className="bg-transparent text-white text-xs border px-2 py-1 rounded cursor-pointer"
        style={{ borderColor: "var(--border)" }}
      >
        {Object.entries(CONTRACTS).map(([key, contract]) => (
          <option key={key} value={key} className="bg-black">
            {contract.name}
          </option>
        ))}
      </select>

      <select
        value={selectedTimeframe}
        onChange={(e) => onTimeframeChange(e.target.value)}
        className="bg-transparent text-white text-xs border px-2 py-1 rounded cursor-pointer"
        style={{ borderColor: "var(--border)" }}
      >
        {TIMEFRAMES.map((tf) => (
          <option key={tf} value={tf} className="bg-black">
            {tf}
          </option>
        ))}
      </select>
    </div>
  );
}
```

**Step 2: Create `src/components/CommandBar/index.ts`**

```typescript
export { default as CommandBar } from "./CommandBar";
```

**Step 3: Commit**

```bash
git add src/components/CommandBar/
git commit -m "feat: add command bar with symbol and timeframe selectors"
```

---

## Task 10: Chat Panel Component

**Files:**
- Create: `src/components/ChatPanel/ChatPanel.tsx`
- Create: `src/components/ChatPanel/index.ts`

**Step 1: Create `src/components/ChatPanel/ChatPanel.tsx`**

```tsx
"use client";

import { useState, useRef, useEffect } from "react";
import type { ChatMessage } from "@/lib/types";

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (message: string) => void;
  isLoading: boolean;
  isOpen: boolean;
  onToggle: () => void;
}

export default function ChatPanel({
  messages,
  onSend,
  isLoading,
  isOpen,
  onToggle,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSend(input.trim());
    setInput("");
  };

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="absolute right-4 top-4 z-10 px-3 py-1 text-xs border rounded"
        style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
      >
        Chat
      </button>
    );
  }

  return (
    <div
      className="flex flex-col h-full border-l"
      style={{
        borderColor: "var(--border)",
        background: "var(--background-secondary)",
        width: "350px",
        minWidth: "350px",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <span className="text-sm font-mono" style={{ color: "var(--text-secondary)" }}>
          AI Strategy Chat
        </span>
        <button
          onClick={onToggle}
          className="text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          Close
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8" style={{ color: "var(--text-muted)" }}>
            <p className="text-sm">Describe a trading strategy to get started.</p>
            <p className="text-xs mt-2">e.g., &quot;RSI crossover on NQ with 50 point stop loss&quot;</p>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`text-sm font-mono ${
              msg.role === "user" ? "text-right" : ""
            }`}
          >
            <div
              className={`inline-block px-3 py-2 rounded max-w-[90%] ${
                msg.role === "user"
                  ? "bg-blue-500/20 text-blue-300"
                  : "text-gray-300"
              }`}
              style={
                msg.role === "assistant"
                  ? { background: "var(--background-tertiary)" }
                  : {}
              }
            >
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="text-sm text-blue-400 animate-pulse font-mono">
            Thinking...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="p-3 border-t"
        style={{ borderColor: "var(--border)" }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Refine your strategy..."
          disabled={isLoading}
          className="w-full bg-transparent text-white placeholder-gray-600 outline-none font-mono text-sm"
        />
      </form>
    </div>
  );
}
```

**Step 2: Create `src/components/ChatPanel/index.ts`**

```typescript
export { default as ChatPanel } from "./ChatPanel";
```

**Step 3: Commit**

```bash
git add src/components/ChatPanel/
git commit -m "feat: add AI chat panel component"
```

---

## Task 11: Replay Controls Component

**Files:**
- Create: `src/components/ReplayControls/ReplayControls.tsx`
- Create: `src/components/ReplayControls/index.ts`

**Step 1: Create `src/components/ReplayControls/ReplayControls.tsx`**

```tsx
"use client";

import type { ReplayState } from "@/lib/types";

interface ReplayControlsProps {
  replayState: ReplayState;
  onPlay: () => void;
  onPause: () => void;
  onStepBack: () => void;
  onStepForward: () => void;
  onSpeedChange: (speed: number) => void;
  onReset: () => void;
}

const SPEEDS = [1, 2, 5, 10];

export default function ReplayControls({
  replayState,
  onPlay,
  onPause,
  onStepBack,
  onStepForward,
  onSpeedChange,
  onReset,
}: ReplayControlsProps) {
  return (
    <div
      className="flex items-center gap-4 px-4 py-2 border-y text-xs font-mono"
      style={{
        borderColor: "var(--border)",
        background: "var(--background-secondary)",
        color: "var(--text-secondary)",
      }}
    >
      <span style={{ color: "var(--text-muted)" }}>Replay</span>

      {/* Controls */}
      <div className="flex items-center gap-1">
        <button onClick={onReset} className="px-2 py-1 hover:text-white" title="Reset">
          {"⏮"}
        </button>
        <button onClick={onStepBack} className="px-2 py-1 hover:text-white" title="Step back">
          {"◀"}
        </button>
        {replayState.isPlaying ? (
          <button onClick={onPause} className="px-2 py-1 hover:text-white" title="Pause">
            {"⏸"}
          </button>
        ) : (
          <button onClick={onPlay} className="px-2 py-1 hover:text-white" title="Play">
            {"▶"}
          </button>
        )}
        <button onClick={onStepForward} className="px-2 py-1 hover:text-white" title="Step forward">
          {"▶▶"}
        </button>
      </div>

      {/* Progress bar */}
      <div className="flex-1 h-1 rounded" style={{ background: "var(--border)" }}>
        <div
          className="h-full rounded"
          style={{
            width: `${replayState.progress}%`,
            background: "var(--accent)",
          }}
        />
      </div>

      <span>{replayState.progress.toFixed(1)}%</span>

      <span>
        {replayState.currentBarIndex}/{replayState.totalBars}
      </span>

      {/* Speed selector */}
      <select
        value={replayState.speed}
        onChange={(e) => onSpeedChange(Number(e.target.value))}
        className="bg-transparent text-white text-xs border px-2 py-1 rounded cursor-pointer"
        style={{ borderColor: "var(--border)" }}
      >
        {SPEEDS.map((s) => (
          <option key={s} value={s} className="bg-black">
            {s}X
          </option>
        ))}
      </select>
    </div>
  );
}
```

**Step 2: Create `src/components/ReplayControls/index.ts`**

```typescript
export { default as ReplayControls } from "./ReplayControls";
```

**Step 3: Commit**

```bash
git add src/components/ReplayControls/
git commit -m "feat: add bar-by-bar replay controls component"
```

---

## Task 12: Trading Panel + Backtest Results Components

**Files:**
- Create: `src/components/TradingPanel/TradingPanel.tsx`
- Create: `src/components/TradingPanel/index.ts`
- Create: `src/components/BacktestResults/BacktestResults.tsx`
- Create: `src/components/BacktestResults/index.ts`

**Step 1: Create `src/components/BacktestResults/BacktestResults.tsx`**

```tsx
"use client";

import type { BacktestMetrics } from "@/lib/types";

interface BacktestResultsProps {
  metrics: BacktestMetrics | null;
  strategyName?: string;
}

export default function BacktestResults({ metrics, strategyName }: BacktestResultsProps) {
  if (!metrics) {
    return (
      <div className="p-4 text-center" style={{ color: "var(--text-muted)" }}>
        <p className="text-sm font-mono">No backtest results yet.</p>
        <p className="text-xs mt-1">Describe a strategy to get started.</p>
      </div>
    );
  }

  const stats = [
    { label: "Total Trades", value: metrics.totalTrades },
    { label: "Win Rate", value: `${(metrics.winRate * 100).toFixed(1)}%` },
    { label: "Total Return", value: `$${metrics.totalReturn.toLocaleString()}` },
    { label: "Return %", value: `${metrics.totalReturnPct.toFixed(1)}%` },
    { label: "Max Drawdown", value: `${metrics.maxDrawdownPct.toFixed(1)}%` },
    { label: "Profit Factor", value: metrics.profitFactor === Infinity ? "∞" : metrics.profitFactor.toFixed(2) },
    { label: "Sharpe Ratio", value: metrics.sharpeRatio.toFixed(2) },
    { label: "Max Consec Losses", value: metrics.maxConsecutiveLosses },
    { label: "Max Consec Wins", value: metrics.maxConsecutiveWins },
    { label: "Avg Win", value: `$${metrics.avgWin.toLocaleString()}` },
    { label: "Avg Loss", value: `$${metrics.avgLoss.toLocaleString()}` },
  ];

  return (
    <div className="p-4">
      {strategyName && (
        <div className="text-sm font-mono mb-3" style={{ color: "var(--accent)" }}>
          {strategyName}
        </div>
      )}
      <div className="grid grid-cols-4 gap-x-6 gap-y-2">
        {stats.map((stat) => (
          <div key={stat.label} className="flex justify-between text-xs font-mono">
            <span style={{ color: "var(--text-muted)" }}>{stat.label}</span>
            <span className="text-white">{stat.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Create `src/components/TradingPanel/TradingPanel.tsx`**

```tsx
"use client";

import { useState } from "react";
import type { Trade, BacktestMetrics } from "@/lib/types";
import { BacktestResults } from "@/components/BacktestResults";

interface TradingPanelProps {
  trades: Trade[];
  metrics: BacktestMetrics | null;
  strategyName?: string;
}

type Tab = "positions" | "history" | "results";

export default function TradingPanel({ trades, metrics, strategyName }: TradingPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>("results");

  const tabs: { key: Tab; label: string }[] = [
    { key: "positions", label: `Positions (0)` },
    { key: "history", label: `History (${trades.length})` },
    { key: "results", label: "Backtest Results" },
  ];

  return (
    <div
      className="border-t flex flex-col"
      style={{
        borderColor: "var(--border)",
        background: "var(--background)",
        height: "200px",
        minHeight: "200px",
      }}
    >
      {/* Tabs */}
      <div className="flex border-b" style={{ borderColor: "var(--border)" }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="px-4 py-2 text-xs font-mono border-r"
            style={{
              borderColor: "var(--border)",
              color: activeTab === tab.key ? "var(--text-primary)" : "var(--text-muted)",
              background: activeTab === tab.key ? "var(--background-secondary)" : "transparent",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "results" && (
          <BacktestResults metrics={metrics} strategyName={strategyName} />
        )}

        {activeTab === "history" && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr style={{ color: "var(--text-muted)" }}>
                  <th className="text-left px-3 py-2">Instrument</th>
                  <th className="text-left px-3 py-2">Side</th>
                  <th className="text-right px-3 py-2">Size</th>
                  <th className="text-right px-3 py-2">Entry</th>
                  <th className="text-right px-3 py-2">Exit</th>
                  <th className="text-right px-3 py-2">P/L</th>
                  <th className="text-right px-3 py-2">Points</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t) => (
                  <tr
                    key={t.id}
                    className="border-t"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <td className="px-3 py-1 text-white">{t.instrument}</td>
                    <td
                      className="px-3 py-1"
                      style={{ color: t.side === "long" ? "var(--buy)" : "var(--sell)" }}
                    >
                      {t.side}
                    </td>
                    <td className="px-3 py-1 text-right text-white">{t.size}</td>
                    <td className="px-3 py-1 text-right text-white">{t.entryPrice}</td>
                    <td className="px-3 py-1 text-right text-white">{t.exitPrice}</td>
                    <td
                      className="px-3 py-1 text-right"
                      style={{ color: t.pnl >= 0 ? "var(--buy)" : "var(--sell)" }}
                    >
                      {t.pnl >= 0 ? "+" : ""}${t.pnl}
                    </td>
                    <td
                      className="px-3 py-1 text-right"
                      style={{ color: t.pnlPoints >= 0 ? "var(--buy)" : "var(--sell)" }}
                    >
                      {t.pnlPoints >= 0 ? "+" : ""}{t.pnlPoints}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "positions" && (
          <div className="p-4 text-center text-xs font-mono" style={{ color: "var(--text-muted)" }}>
            No positions yet!
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 3: Create index files for both components.**

**Step 4: Commit**

```bash
git add src/components/TradingPanel/ src/components/BacktestResults/
git commit -m "feat: add trading panel with history table and backtest results display"
```

---

## Task 13: Main Dashboard Page — Wire Everything Together

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Implement the main dashboard page**

This wires all components together: Chart, CommandBar, ChatPanel, ReplayControls, TradingPanel.

```tsx
"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Chart } from "@/components/Chart";
import { CommandBar } from "@/components/CommandBar";
import { ChatPanel } from "@/components/ChatPanel";
import { ReplayControls } from "@/components/ReplayControls";
import { TradingPanel } from "@/components/TradingPanel";
import { sendChatMessage, fetchOHLCV } from "@/lib/api";
import type {
  Candle,
  Trade,
  BacktestResult,
  BacktestMetrics,
  ChatMessage,
  ReplayState,
} from "@/lib/types";

export default function Home() {
  // Data state
  const [candles, setCandles] = useState<Candle[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [equityCurve, setEquityCurve] = useState<{ time: number; value: number }[]>([]);
  const [metrics, setMetrics] = useState<BacktestMetrics | null>(null);
  const [strategyName, setStrategyName] = useState<string>("");

  // UI state
  const [selectedSymbol, setSelectedSymbol] = useState("NQ=F");
  const [selectedTimeframe, setSelectedTimeframe] = useState("1d");
  const [chatOpen, setChatOpen] = useState(true);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Replay state
  const [replayState, setReplayState] = useState<ReplayState>({
    isPlaying: false,
    currentBarIndex: 0,
    totalBars: 0,
    speed: 1,
    progress: 0,
  });
  const replayTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load initial data
  useEffect(() => {
    loadData(selectedSymbol, "1y", selectedTimeframe);
  }, [selectedSymbol, selectedTimeframe]);

  const loadData = async (symbol: string, period: string, interval: string) => {
    try {
      const data = await fetchOHLCV({ symbol, period, interval });
      setCandles(data.candles);
      setReplayState((prev) => ({
        ...prev,
        totalBars: data.candles.length,
        currentBarIndex: data.candles.length,
        progress: 100,
      }));
    } catch (err) {
      console.error("Failed to load data:", err);
    }
  };

  // Send strategy message
  const handleSendMessage = useCallback(
    async (message: string) => {
      setIsLoading(true);

      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: "user",
        content: message,
        timestamp: Date.now(),
      };
      setChatMessages((prev) => [...prev, userMsg]);

      try {
        const conversationHistory = chatMessages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const response = await sendChatMessage({
          message,
          symbol: selectedSymbol,
          timeframe: selectedTimeframe,
          conversationHistory,
        });

        const assistantMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: response.message,
          timestamp: Date.now(),
        };
        setChatMessages((prev) => [...prev, assistantMsg]);

        if (response.backtestResult) {
          const result = response.backtestResult;
          setTrades(result.trades);
          setEquityCurve(result.equity_curve);
          setStrategyName(result.strategy_name);

          // Map snake_case from backend to camelCase for frontend
          setMetrics({
            totalTrades: result.metrics.total_trades,
            winRate: result.metrics.win_rate,
            lossRate: result.metrics.loss_rate,
            totalReturn: result.metrics.total_return,
            totalReturnPct: result.metrics.total_return_pct,
            maxDrawdown: result.metrics.max_drawdown,
            maxDrawdownPct: result.metrics.max_drawdown_pct,
            maxConsecutiveLosses: result.metrics.max_consecutive_losses,
            maxConsecutiveWins: result.metrics.max_consecutive_wins,
            profitFactor: result.metrics.profit_factor,
            sharpeRatio: result.metrics.sharpe_ratio,
            avgWin: result.metrics.avg_win,
            avgLoss: result.metrics.avg_loss,
          });
        }
      } catch (err) {
        const errorMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `Error: ${err instanceof Error ? err.message : "Something went wrong"}`,
          timestamp: Date.now(),
        };
        setChatMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsLoading(false);
      }
    },
    [chatMessages, selectedSymbol, selectedTimeframe]
  );

  // Replay controls
  const playReplay = useCallback(() => {
    if (replayState.currentBarIndex >= candles.length) {
      setReplayState((prev) => ({ ...prev, currentBarIndex: 1, progress: 0 }));
    }
    setReplayState((prev) => ({ ...prev, isPlaying: true }));
  }, [candles.length, replayState.currentBarIndex]);

  const pauseReplay = useCallback(() => {
    setReplayState((prev) => ({ ...prev, isPlaying: false }));
  }, []);

  const stepForward = useCallback(() => {
    setReplayState((prev) => {
      const next = Math.min(prev.currentBarIndex + 1, candles.length);
      return { ...prev, currentBarIndex: next, progress: (next / candles.length) * 100 };
    });
  }, [candles.length]);

  const stepBack = useCallback(() => {
    setReplayState((prev) => {
      const next = Math.max(prev.currentBarIndex - 1, 1);
      return { ...prev, currentBarIndex: next, progress: (next / candles.length) * 100 };
    });
  }, [candles.length]);

  const resetReplay = useCallback(() => {
    setReplayState((prev) => ({
      ...prev,
      isPlaying: false,
      currentBarIndex: 1,
      progress: 0,
    }));
  }, []);

  // Replay timer
  useEffect(() => {
    if (replayState.isPlaying) {
      replayTimerRef.current = setInterval(() => {
        setReplayState((prev) => {
          const next = prev.currentBarIndex + 1;
          if (next > candles.length) {
            return { ...prev, isPlaying: false, currentBarIndex: candles.length, progress: 100 };
          }
          return { ...prev, currentBarIndex: next, progress: (next / candles.length) * 100 };
        });
      }, 1000 / replayState.speed);
    }
    return () => {
      if (replayTimerRef.current) clearInterval(replayTimerRef.current);
    };
  }, [replayState.isPlaying, replayState.speed, candles.length]);

  const visibleBars =
    replayState.currentBarIndex < candles.length
      ? replayState.currentBarIndex
      : undefined;

  return (
    <div className="flex flex-col h-screen">
      {/* Command bar */}
      <CommandBar
        onSubmit={handleSendMessage}
        selectedSymbol={selectedSymbol}
        onSymbolChange={setSelectedSymbol}
        selectedTimeframe={selectedTimeframe}
        onTimeframeChange={setSelectedTimeframe}
        isLoading={isLoading}
      />

      {/* Main content: chart + chat */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative">
          {candles.length > 0 ? (
            <Chart
              candles={candles}
              trades={trades}
              equityCurve={equityCurve}
              visibleBars={visibleBars}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm font-mono" style={{ color: "var(--text-muted)" }}>
                Loading chart data...
              </p>
            </div>
          )}
        </div>
        <ChatPanel
          messages={chatMessages}
          onSend={handleSendMessage}
          isLoading={isLoading}
          isOpen={chatOpen}
          onToggle={() => setChatOpen(!chatOpen)}
        />
      </div>

      {/* Replay controls */}
      <ReplayControls
        replayState={replayState}
        onPlay={playReplay}
        onPause={pauseReplay}
        onStepBack={stepBack}
        onStepForward={stepForward}
        onSpeedChange={(speed) => setReplayState((prev) => ({ ...prev, speed }))}
        onReset={resetReplay}
      />

      {/* Bottom panel */}
      <TradingPanel
        trades={trades}
        metrics={metrics}
        strategyName={strategyName}
      />
    </div>
  );
}
```

**Step 2: Verify full build**

Run: `npm run build`
Expected: Build succeeds with no type errors.

**Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: wire up main dashboard with chart, chat, replay, and trading panel"
```

---

## Task 14: Integration Testing — Full Stack

**Step 1: Start both servers and test the full flow**

Terminal 1 — Backend:
```bash
cd /Users/saahilmanji/Desktop/ClawdCode/.claude/worktrees/inspiring-darwin/backend
source venv/bin/activate
uvicorn main:app --reload --port 8000
```

Terminal 2 — Frontend:
```bash
cd /Users/saahilmanji/Desktop/ClawdCode/.claude/worktrees/inspiring-darwin
npm run dev
```

**Step 2: Test data endpoint**

```bash
curl -X POST http://localhost:8000/api/data/ohlcv \
  -H "Content-Type: application/json" \
  -d '{"symbol": "NQ=F", "period": "3mo", "interval": "1d"}'
```
Expected: JSON with candles array.

**Step 3: Test chat endpoint (requires ANTHROPIC_API_KEY)**

```bash
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Buy when RSI crosses above 30, sell when above 70. 50 point stop loss.", "symbol": "NQ=F"}'
```
Expected: JSON with strategy, backtest_result, and message.

**Step 4: Open browser to http://localhost:3000**

Verify: Dark theme dashboard loads, chart shows NQ candles, command bar and chat panel are visible.

**Step 5: Commit final state**

```bash
git add -A
git commit -m "feat: complete MVP — full stack integration working"
```

---

## Task 15: Dev Scripts and Documentation

**Files:**
- Modify: `package.json` (add dev scripts)
- Create: `backend/run.sh`

**Step 1: Add convenience scripts to `package.json`**

Add to scripts section:
```json
{
  "dev:frontend": "next dev",
  "dev:backend": "cd backend && source venv/bin/activate && uvicorn main:app --reload --port 8000",
  "dev": "concurrently \"npm run dev:frontend\" \"npm run dev:backend\""
}
```

Run: `npm install concurrently --save-dev`

**Step 2: Create `backend/run.sh`**

```bash
#!/bin/bash
cd "$(dirname "$0")"
source venv/bin/activate
uvicorn main:app --reload --port 8000
```

Run: `chmod +x backend/run.sh`

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: add dev convenience scripts"
```
