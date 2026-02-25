# aFindr V2 — Full Platform Expansion Design

## Overview

Transform the current MVP trading platform into a feature-complete full platform matching the PRD specification. This involves: new layout with dual navbars, pure black theme, full-screen AI Copilot overlay, floating trade widget with functional order placement, positions/orders bottom panel, symbols search modal, and integrated playback controls.

## Approach: Layered Evolution

Incrementally transform existing components while adding new ones. Each phase builds on the last, preserving working features (tick replay, chart, AI chat).

## Architecture

### Layout Grid

```
NAVBAR1 (82px)  — Feature buttons: Copilot, Risk, Monitoring, Kill Switch, Session, Symbols, Dashboard, Settings
NAVBAR2 (64px)  — Trading context: Symbol, Balance/Equity/P&L, Timeframes, Indicators, Chart AI
LEFT SIDEBAR    — Drawing tools (45px)
CHART           — TradingView canvas + Floating Bid/Ask widget overlay
BOTTOM PANEL    — Tabs: Positions|Orders|History|Balance + integrated playback
STATUS BAR      — Connection, latency, clock
OVERLAYS        — Copilot (fullscreen), Symbols (modal), Risk Mgmt (modal), Settings (sidebar)
```

### New Components

1. **Navbar1** (~250 lines) — Top nav with pill-shaped buttons (border-radius: 30px). Contains: AI Copilot trigger, Risk Management trigger, Monitoring dropdown, Kill Switch trigger, AI Analysis dropdown, Session selector, Symbols search (Ctrl+S), Dashboard dropdown, Notification bell, Settings trigger.

2. **Navbar2** (~200 lines) — Account context bar. Contains: Symbol selector with logo, Balance/Equity/Unrealized P&L metric groups, Chart type toggle, Timeframe pills (moved from CommandBar), Indicators button, Alerts button, Chart AI trigger, Trade button (Ctrl+A), Quick Order.

3. **CopilotOverlay** (~350 lines) — Full-screen AI chat. Reuses existing Anthropic backend + conversation state. New UI: solid black overlay at z-index 10000, greeting with gradient text effect, pill-shaped textarea input (666px wide, 55px tall, border-radius 30px), "New Chat" / "History" sidebar, transparent bg toggle, large "CoPilot" watermark, reasoning mode toggle, send button.

4. **FloatingTradeWidget** (~200 lines) — Draggable Bid/Ask pill. Shows last price +/- spread. Red bid button, blue ask button, spread display, eye toggle, drag handle. Functional: clicking bid/ask creates a position at current price.

5. **PositionsPanel** (~300 lines) — Replaces current TradingPanel as bottom panel. Tabs: Positions(count)/Orders(count)/History/Balance. Table columns: Instrument, Side, Size, Entry Price, Created At, Stop Loss, Take Profit, Commission, P/L, Trade ID, Action. "Close All Positions" button. Integrated playback controls on the same header row.

6. **SymbolsSearch** (~250 lines) — Modal overlay. Search input, category tabs (All/CFDs/Futures/Forex/Crypto/Indexes/Metals/Commodities/Stocks), favorites toggle, symbol rows with pair name, description, stats (win rate, open positions, P&L), mini sparkline, "Launch Chart" button.

7. **SettingsPanel** (~200 lines) — Right-slide sidebar. Layout toggles (show top light, moonballs, black background), website title, notification settings, one-click trading toggle, trade execution sound, big lot threshold, social links, sign out.

8. **RiskManagement** (~150 lines) — Modal. Max open positions, allowed symbols, require SL/TP checkbox, max loss per trade %, preset SL/TP based on balance %. Glass blur overlay pattern.

9. **LeftSidebar** (~100 lines) — Drawing tools column (45px wide). Icon buttons: Cursor, Trend Line, Channels, Fibonacci, Pitchfork, Measure, Text, Ruler, Magnet, Lock, Visibility, Delete. Visual only for now.

### State Management — Trading Engine

New hook: `useTradingEngine()` in `src/hooks/useTradingEngine.ts`

```typescript
interface Position {
  id: string;
  symbol: string;
  side: "long" | "short";
  size: number;
  entryPrice: number;
  entryTime: number;
  stopLoss: number | null;
  takeProfit: number | null;
  commission: number;
}

interface AccountState {
  balance: number;
  equity: number;
  unrealizedPnl: number;
  positions: Position[];
  orders: Order[];
  tradeHistory: ClosedTrade[];
}

// Returns:
// accountState, placeTrade(side, size, sl?, tp?), closePosition(id),
// closeAllPositions(), closeAllProfitable(), closeAllLosing(),
// updatePrices(currentPrice) — recalculates unrealized P&L
```

Initial balance: $25,000 (configurable via session).

### Theme Updates (globals.css)

- `--bg: #000000` (pure black)
- `--bg-raised: #0a0a0a`
- Navbar pill buttons: `border-radius: 30px; background: rgb(0,0,0); padding: 0 18px; height: 30px`
- Modal overlay: `backdrop-filter: blur(20px); background: rgba(0,0,0,0.25); z-index: 20000`
- Borders: `0.667px solid rgba(255,255,255,0.25)`
- New classes: `.nav-pill`, `.modal-overlay`, `.modal-content`, `.metric-group`
- Gradient text: `color: transparent; background: linear-gradient(to right, #fff, #aaa); -webkit-background-clip: text`

### Playback Integration

Move playback controls from standalone ReplayControls into PositionsPanel header row:
```
[Trading Panel] [Trade (Ctrl+A)] | ◄ Select | [1d ▾] | ▶ Play | ▶▶ Step | [progress] | [1X ▾]
```

Keep calendar/time tumbler accessible via date click in the playback section.

### Keyboard Shortcuts

- `Ctrl+S` — Open Symbols search
- `Ctrl+A` — Place trade
- `Escape` — Close any overlay/modal
- Kill switch hotkeys — user-configurable

## Implementation Order

1. Theme + globals.css update (pure black, new classes)
2. Navbar1 + Navbar2 components (replaces CommandBar)
3. LeftSidebar (drawing tools column)
4. PositionsPanel (replaces TradingPanel, integrates playback)
5. useTradingEngine hook + FloatingTradeWidget
6. CopilotOverlay (wraps existing AI backend)
7. SymbolsSearch modal
8. RiskManagement + Settings modals
9. Page.tsx layout restructure (wire everything together)
10. Polish: animations, keyboard shortcuts, responsive sizing

## Files to Create
- `src/components/Navbar1/Navbar1.tsx`
- `src/components/Navbar2/Navbar2.tsx`
- `src/components/CopilotOverlay/CopilotOverlay.tsx`
- `src/components/FloatingTradeWidget/FloatingTradeWidget.tsx`
- `src/components/PositionsPanel/PositionsPanel.tsx`
- `src/components/SymbolsSearch/SymbolsSearch.tsx`
- `src/components/SettingsPanel/SettingsPanel.tsx`
- `src/components/RiskManagement/RiskManagement.tsx`
- `src/components/LeftSidebar/LeftSidebar.tsx`
- `src/hooks/useTradingEngine.ts`

## Files to Modify
- `src/styles/globals.css` — Theme updates, new utility classes
- `src/app/page.tsx` — Complete layout restructure
- `src/lib/types.ts` — Position, Order, AccountState types
- `src/app/layout.tsx` — Add Inter Display font
