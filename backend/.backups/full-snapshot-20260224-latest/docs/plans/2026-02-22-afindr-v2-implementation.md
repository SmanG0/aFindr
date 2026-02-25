# aFindr V2 — Full Platform Expansion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the MVP into a feature-complete full platform with dual navbars, pure black theme, full-screen AI Copilot, functional floating trade widget, positions/orders panel, and symbols search.

**Architecture:** Layered evolution — update theme first, then build new components independently, then wire them into a restructured page.tsx layout. Trading engine lives in a custom hook. Overlays (Copilot, Symbols, Risk, Settings) are portal-style fixed overlays.

**Tech Stack:** Next.js 15, React 19, TradingView Lightweight Charts v5, Tailwind CSS v4, Framer Motion 11, Anthropic SDK (backend)

---

### Task 1: Theme & Design System Update

**Files:**
- Modify: `src/styles/globals.css:3-69` (CSS custom properties)
- Modify: `src/styles/globals.css` (append new utility classes)

**Step 1: Update CSS custom properties to pure black theme**

In `src/styles/globals.css`, change lines 3-69:

```css
:root {
  /* ─── Core Background (Pure Black — matches aFindr) ─── */
  --bg: #000000;
  --bg-raised: #0a0a0a;
  --bg-surface: #0f0f0f;
  --bg-overlay: #141414;

  /* ─── Glass System ─── */
  --glass: rgba(255,255,255,0.025);
  --glass-border: rgba(255,255,255,0.06);
  --glass-hover: rgba(255,255,255,0.045);
  --glass-elevated: rgba(255,255,255,0.06);
  --glass-active: rgba(255,255,255,0.08);

  /* ─── Accent System ─── */
  --accent: #6366f1;
  --accent-bright: #818cf8;
  --accent-glow: rgba(99,102,241,0.15);
  --accent-muted: rgba(99,102,241,0.06);

  /* ─── Semantic Colors ─── */
  --buy: #22ab94;
  --buy-muted: rgba(34,171,148,0.12);
  --sell: #f23645;
  --sell-muted: rgba(242,54,69,0.12);
  --warning: #f59e0b;
  --warning-muted: rgba(245,158,11,0.12);
  --link: #1e53e5;

  /* ─── Text Hierarchy ─── */
  --text-primary: rgba(255,255,255,0.93);
  --text-secondary: rgba(255,255,255,0.6);
  --text-muted: rgba(255,255,255,0.28);
  --text-disabled: rgba(255,255,255,0.12);

  /* ─── Typography ─── */
  --font-mono: 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;

  /* ─── Borders (aFindr uses ultra-thin 0.667px) ─── */
  --divider: rgba(255,255,255,0.06);
  --border-subtle: rgba(255,255,255,0.04);
  --border-interactive: rgba(255,255,255,0.1);
  --border-panel: 0.667px solid rgba(255,255,255,0.25);

  /* ─── Shadows ─── */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
  --shadow-md: 0 4px 16px rgba(0,0,0,0.4);
  --shadow-lg: 0 8px 32px rgba(0,0,0,0.5);
  --shadow-xl: 0 16px 48px rgba(0,0,0,0.6);

  /* ─── Transitions ─── */
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1);
  --duration-fast: 100ms;
  --duration-normal: 200ms;
  --duration-slow: 400ms;

  /* ─── Spacing ─── */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 20px;
  --radius-pill: 30px;

  /* Legacy aliases */
  --background: var(--bg);
  --background-secondary: var(--glass);
  --background-tertiary: var(--glass-hover);
  --border: var(--glass-border);
}
```

Key changes: `--bg` → `#000000`, `--buy` → `#22ab94` (aFindr teal), `--sell` → `#f23645` (aFindr red), added `--link`, `--border-panel`, `--radius-pill`.

**Step 2: Add new utility classes at end of globals.css**

Append these after the existing `.noise-overlay` class:

```css
/* ─── Nav Pill Button (aFindr navbar1 style) ─── */
.nav-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 18px;
  border-radius: var(--radius-pill);
  background: rgb(0, 0, 0);
  color: rgb(255, 255, 255);
  font-size: 13px;
  font-weight: 400;
  border: none;
  cursor: pointer;
  transition: background var(--duration-fast) ease;
  white-space: nowrap;
}
.nav-pill:hover {
  background: rgba(255, 255, 255, 0.08);
}
.nav-pill.active {
  background: rgba(255, 255, 255, 0.12);
}

/* ─── Modal Overlay (Glass blur) ─── */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 20000;
  background: rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-content {
  border-radius: 18px;
  padding: 26px;
  width: 520px;
  max-height: 82vh;
  overflow: hidden auto;
  color: rgb(255, 255, 255);
  background: rgba(10, 10, 10, 0.95);
  border: 0.667px solid rgba(255, 255, 255, 0.15);
  box-shadow: var(--shadow-xl);
}

/* ─── Gradient Text (Modal titles, copilot greeting) ─── */
.gradient-title {
  color: rgba(0, 0, 0, 0);
  background: linear-gradient(to right, #fff, #aaa);
  -webkit-background-clip: text;
  background-clip: text;
  font-family: "Inter Display", var(--font-inter), Arial, sans-serif;
  font-size: 22px;
  font-weight: 500;
  text-align: center;
}

/* ─── Metric Group (navbar2 account info) ─── */
.metric-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.metric-group .metric-label {
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.metric-group .metric-value {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

/* ─── Panel Separator (ultra-thin aFindr style) ─── */
.panel-border-top {
  border-top: 0.667px solid rgba(255, 255, 255, 0.25);
}
.panel-border-bottom {
  border-bottom: 0.667px solid rgba(255, 255, 255, 0.25);
}

/* ─── Copilot Watermark ─── */
.copilot-watermark {
  font-size: 100px;
  font-weight: 800;
  color: rgba(255, 255, 255, 0.03);
  text-align: center;
  user-select: none;
  pointer-events: none;
  letter-spacing: 0.02em;
}

/* ─── Copilot Input (pill textarea) ─── */
.copilot-input {
  background: rgb(0, 0, 0);
  color: rgb(255, 255, 255);
  border: 0.667px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-pill);
  padding: 0 56px;
  font-size: 13px;
  height: 55px;
  width: 666px;
  max-width: 90vw;
  outline: none;
  resize: none;
}
.copilot-input::placeholder {
  color: var(--text-muted);
}

/* ─── Floating Trade Widget ─── */
.trade-widget {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgb(31, 31, 31);
  border-radius: var(--radius-pill);
  padding: 4px 6px;
}
.trade-widget .bid-btn {
  background: var(--sell);
  color: white;
  border: none;
  border-radius: 20px;
  padding: 4px 12px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  font-variant-numeric: tabular-nums;
}
.trade-widget .ask-btn {
  background: var(--link);
  color: white;
  border: none;
  border-radius: 20px;
  padding: 4px 12px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  font-variant-numeric: tabular-nums;
}

/* ─── Settings Panel Slide ─── */
.settings-slide {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 340px;
  z-index: 15000;
  background: rgba(5, 5, 5, 0.98);
  border-left: 0.667px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(20px);
  overflow-y: auto;
  padding: 24px;
}
```

**Step 3: Run build to verify**

Run: `npm run build`
Expected: Build succeeds with no errors.

**Step 4: Commit**

```bash
git add src/styles/globals.css
git commit -m "feat: update theme to pure black + add aFindr utility classes"
```

---

### Task 2: Add Trading Engine Types

**Files:**
- Modify: `src/lib/types.ts` (append new interfaces after line 125)

**Step 1: Add Position, Order, ClosedTrade, AccountState types**

Append to end of `src/lib/types.ts`:

```typescript
// ─── Simulated Trading Engine Types ───

export interface Position {
  id: string;
  symbol: string;
  side: "long" | "short";
  size: number;
  entryPrice: number;
  entryTime: number;
  stopLoss: number | null;
  takeProfit: number | null;
  commission: number;
  unrealizedPnl: number;
}

export interface Order {
  id: string;
  symbol: string;
  side: "long" | "short";
  size: number;
  type: "market" | "limit" | "stop";
  price: number | null;
  status: "pending" | "filled" | "cancelled";
  createdAt: number;
}

export interface ClosedTrade {
  id: string;
  symbol: string;
  side: "long" | "short";
  size: number;
  entryPrice: number;
  exitPrice: number;
  entryTime: number;
  exitTime: number;
  stopLoss: number | null;
  takeProfit: number | null;
  pnl: number;
  pnlPoints: number;
  commission: number;
}

export interface AccountState {
  balance: number;
  equity: number;
  unrealizedPnl: number;
  positions: Position[];
  orders: Order[];
  tradeHistory: ClosedTrade[];
}

export interface RiskSettings {
  maxOpenPositions: number | null;
  allowedSymbols: string[];
  requireSlTp: boolean;
  maxLossPerTradePct: number | null;
  presetSlPct: number | null;
  presetTpPct: number | null;
}

export interface AppSettings {
  oneClickTrading: boolean;
  tradeExecutionSound: boolean;
  showNotifications: boolean;
  notificationDuration: number;
  showTradeHistoryOnChart: boolean;
  bigLotThreshold: number;
}
```

**Step 2: Run build to verify**

Run: `npm run build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add trading engine types (Position, Order, AccountState)"
```

---

### Task 3: Create Trading Engine Hook

**Files:**
- Create: `src/hooks/useTradingEngine.ts`

**Step 1: Create the hook**

Create `src/hooks/useTradingEngine.ts` with full simulated trading logic:
- `placeTrade(symbol, side, size, currentPrice, sl?, tp?)` — creates Position at current price, deducts commission
- `closePosition(id, currentPrice)` — closes position, calculates P&L, moves to tradeHistory
- `closeAllPositions(currentPrice)` — closes all open positions
- `closeAllProfitable(currentPrice)` / `closeAllLosing(currentPrice)`
- `updatePrices(currentPrice)` — recalculates unrealized P&L for all positions
- Commission: based on CONTRACTS[symbol].pointValue (e.g., NQ=F → $4.10 per trade)
- Initial balance: $25,000

**Step 2: Run build**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/hooks/useTradingEngine.ts
git commit -m "feat: add useTradingEngine hook with simulated order placement"
```

---

### Task 4: Create Navbar1 Component

**Files:**
- Create: `src/components/Navbar1/Navbar1.tsx`

**Step 1: Build the component**

PRD reference: Section 6, `.navbar1` is 82px tall flex row with pill-shaped buttons (`nav-pill` class). Contains:
- Left: [AI Copilot] [◄ collapse] [Risk Management] [Monitoring ▾] [Kill Switch] [AI Analysis ▾]
- Center/Right: [Session ▾] [Symbols (Ctrl+S)] [Dashboard ▾] [🔔] [Settings]

Props:
```typescript
interface Navbar1Props {
  onOpenCopilot: () => void;
  onOpenRiskMgmt: () => void;
  onOpenSymbols: () => void;
  onOpenSettings: () => void;
}
```

Each button uses the `.nav-pill` class. Symbols search button has the special glass style (`rgba(0,0,0,0.5)` + `backdrop-filter: blur(10px)`). Use SVG icons inline (sparkle for AI Copilot, shield for Risk, bell for notifications, gear for settings).

**Step 2: Run build, fix any errors**

**Step 3: Commit**

---

### Task 5: Create Navbar2 Component

**Files:**
- Create: `src/components/Navbar2/Navbar2.tsx`

**Step 1: Build the component**

PRD reference: Section 7, `.navbar2` is 64px tall. Contains:
- Left: Symbol selector (current symbol with change button)
- Center: Balance / Equity / Unrealized P&L metric groups (use `.metric-group` class)
- Right: Timeframe pills (moved from old CommandBar), Chart AI button, Trade button (Ctrl+A)

Props:
```typescript
interface Navbar2Props {
  symbol: string;
  onSymbolChange: (symbol: string) => void;
  interval: string;
  onIntervalChange: (interval: string) => void;
  tickMode: boolean;
  onTickModeChange: (enabled: boolean) => void;
  accountState: AccountState;
  onOpenTrade: () => void;
}
```

Move the interval selector logic from old CommandBar into this component. Keep the TradingView pill-style with animated `layoutId`.

**Step 2: Run build**

**Step 3: Commit**

---

### Task 6: Create LeftSidebar Component

**Files:**
- Create: `src/components/LeftSidebar/LeftSidebar.tsx`

**Step 1: Build the component**

PRD reference: Section 10, `.left-column` is ~45px wide. Vertical stack of icon buttons for drawing tools. Visual only — no functionality yet.

Icons (top to bottom): Cursor (crosshair), Trend Line, Channels, Fibonacci, Measure, Text, Ruler, Magnet, Lock, Visibility, Delete. All use `toolbar-btn` class.

**Step 2: Run build**

**Step 3: Commit**

---

### Task 7: Create FloatingTradeWidget Component

**Files:**
- Create: `src/components/FloatingTradeWidget/FloatingTradeWidget.tsx`

**Step 1: Build the component**

PRD reference: Section 11. Draggable pill widget (287px × 37px) with:
- Eye icon toggle (show/hide)
- Bid price button (red, `--sell` color)
- Spread value display
- Ask price button (blue, `--link` color)
- Grid icon for settings

Uses `trade-widget`, `bid-btn`, `ask-btn` classes. Draggable via React state (mousedown/mousemove/mouseup on the widget body). Positioned absolutely over the chart.

Props:
```typescript
interface FloatingTradeWidgetProps {
  currentPrice: number;
  spread: number;
  symbol: string;
  onBuy: (price: number) => void;
  onSell: (price: number) => void;
}
```

Bid = currentPrice - spread/2, Ask = currentPrice + spread/2.

**Step 2: Run build**

**Step 3: Commit**

---

### Task 8: Create PositionsPanel Component

**Files:**
- Create: `src/components/PositionsPanel/PositionsPanel.tsx`

**Step 1: Build the component**

PRD reference: Section 12 + 13. Replaces old TradingPanel. Combines positions table + integrated playback controls.

Top row (tab bar + playback):
```
[Positions(N)] [Orders(N)] [History] [Balance] | [▶ Play] [▶▶ Step] [progress bar] [1X ▾] | [Close All]
```

Tab content:
- **Positions tab**: Table with columns: Instrument, Side, Size, Entry Price, Created At, Stop Loss, Take Profit, Commission, Unrealized P/L, Action (close button). Uses `.data-table` class.
- **Orders tab**: Pending orders table (similar columns + status)
- **History tab**: Closed trades table (adds Exit Price, Exit Time, Realized P/L)
- **Balance tab**: Shows balance history / equity curve

Props:
```typescript
interface PositionsPanelProps {
  accountState: AccountState;
  onClosePosition: (id: string) => void;
  onCloseAll: () => void;
  // Replay props (moved from ReplayControls)
  replayState: ReplayState;
  onPlay: () => void;
  onPause: () => void;
  onStep: () => void;
  onReset: () => void;
  onSpeedChange: (speed: number) => void;
  onSeek: (index: number) => void;
  candles: { time: number }[];
}
```

**Step 2: Run build**

**Step 3: Commit**

---

### Task 9: Create CopilotOverlay Component

**Files:**
- Create: `src/components/CopilotOverlay/CopilotOverlay.tsx`

**Step 1: Build the component**

PRD reference: Section 14. Full-screen AI chat overlay.

Structure:
```
┌──────────────────────────────────────────────┐
│ [Logo] [New Chat] [History]       [□ bg] [✕] │
│                                              │
│            Good Evening, Trader              │
│         How can I help you today?            │
│                                              │
│    ┌──────────────────────────────────┐       │
│    │ ⊕ Ask Zero anything           ➤ │       │
│    └──────────────────────────────────┘       │
│                                              │
│    Zero has access to your trading data...   │
│                                              │
│              ═══════════════                 │
│                CoPilot                       │
│            (watermark text)                  │
└──────────────────────────────────────────────┘
```

Uses existing `sendChatMessage` API + conversation state passed as props. UI: solid black overlay at z-index 10000. Uses `.gradient-title` for greeting, `.copilot-input` for textarea, `.copilot-watermark` for watermark. AnimatePresence for open/close animation.

Props:
```typescript
interface CopilotOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  symbol: string;
}
```

When messages exist, show them in a scrollable chat view above the input. Messages use the same bubble style as current ChatPanel but full-width.

**Step 2: Run build**

**Step 3: Commit**

---

### Task 10: Create SymbolsSearch Component

**Files:**
- Create: `src/components/SymbolsSearch/SymbolsSearch.tsx`

**Step 1: Build the component**

PRD reference: Section 20. Modal overlay with:
- Search input at top
- Category tabs: All | Futures (filter by CONTRACTS)
- Symbol rows: symbol name, description, "From 2012-07-01", stats (win rate from accountState), "Launch Chart" button
- Favorites toggle (local state, no persistence needed)

Uses `.modal-overlay` pattern but wider (600px). Ctrl+S keyboard shortcut to open.

Props:
```typescript
interface SymbolsSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSymbol: (symbol: string) => void;
  currentSymbol: string;
  accountState: AccountState;
}
```

**Step 2: Run build**

**Step 3: Commit**

---

### Task 11: Create RiskManagement Component

**Files:**
- Create: `src/components/RiskManagement/RiskManagement.tsx`

**Step 1: Build the component**

PRD reference: Section 15. Modal with form fields:
- Max Open Positions (number input)
- Allowed Symbols (text input + Add button + chip list)
- Require Stop Loss or Take Profit (checkbox)
- Maximum Loss Per Trade (number input, %)
- Preset SL/TP Based on Balance (checkboxes + number inputs)

Uses `.modal-overlay` + `.modal-content` classes. Inputs use bottom-border-only style per PRD.

Props:
```typescript
interface RiskManagementProps {
  isOpen: boolean;
  onClose: () => void;
  settings: RiskSettings;
  onUpdateSettings: (settings: RiskSettings) => void;
}
```

**Step 2: Run build**

**Step 3: Commit**

---

### Task 12: Create SettingsPanel Component

**Files:**
- Create: `src/components/SettingsPanel/SettingsPanel.tsx`

**Step 1: Build the component**

PRD reference: Section 22. Right-slide sidebar panel (`.settings-slide` class).

Contains toggles and inputs for:
- One-Click Trading
- Trade Execution Sound
- Show Notifications + duration
- Show Trade History on Chart
- Big Lot Threshold

Bottom: social links (X/Twitter, Discord), "Charts by TradingView" link, version number.

Uses AnimatePresence for slide-in/out from right edge.

Props:
```typescript
interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
}
```

**Step 2: Run build**

**Step 3: Commit**

---

### Task 13: Restructure page.tsx Layout

**Files:**
- Modify: `src/app/page.tsx` (major restructure)

**Step 1: Rewrite page.tsx with new layout**

This is the integration task. Replace old layout with:

```
<div className="flex flex-col h-screen" style={{ background: "var(--bg)", padding: "0 7px 7px" }}>
  <Navbar1 ... />
  <Navbar2 ... />
  <div className="flex flex-1 min-h-0">
    <LeftSidebar />
    <div className="flex-1 flex flex-col min-w-0 relative">
      <Chart ... />
      <FloatingTradeWidget ... />  {/* absolute positioned over chart */}
    </div>
  </div>
  <PositionsPanel ... />  {/* resizable, includes playback */}
  <StatusBar ... />

  {/* Overlays */}
  <CopilotOverlay ... />
  <SymbolsSearch ... />
  <RiskManagement ... />
  <SettingsPanel ... />
</div>
```

Key state additions:
- `const trading = useTradingEngine()` — trading engine hook
- `showCopilot`, `showSymbols`, `showRiskMgmt`, `showSettings` — overlay toggles
- `riskSettings: RiskSettings`, `appSettings: AppSettings` — settings state
- Remove old CommandBar, ChatPanel sidebar, ReplayControls (functionality moved into PositionsPanel)
- Keep all existing data loading, replay timer, tick mode logic
- Wire `trading.updatePrices(currentPrice)` into a useEffect that updates whenever displayCandles changes

Compute `currentPrice` from the latest visible candle's close price.

**Step 2: Run build and fix errors**

Run: `npm run build`
Expected: May have import errors — fix them iteratively.

**Step 3: Test in browser**

Run: `npm run dev`
Navigate to http://localhost:3000, verify:
- Dual navbars visible
- Chart renders with data
- Left sidebar shows drawing tool icons
- Bottom panel has Positions/Orders/History tabs
- Clicking AI Copilot opens full-screen overlay
- Clicking Symbols opens search modal
- Floating trade widget visible over chart

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: restructure layout with dual navbars, positions panel, and overlays"
```

---

### Task 14: Add Keyboard Shortcuts

**Files:**
- Modify: `src/app/page.tsx` (add useEffect for keyboard listeners)

**Step 1: Add global keyboard shortcut handler**

Add a useEffect in page.tsx:
```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Ctrl+S — Symbols search
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      setShowSymbols(true);
    }
    // Ctrl+A — Place trade (open trade widget focus)
    if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
      e.preventDefault();
      // Focus trade widget or open trade dialog
    }
    // Escape — Close any overlay
    if (e.key === 'Escape') {
      setShowCopilot(false);
      setShowSymbols(false);
      setShowRiskMgmt(false);
      setShowSettings(false);
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, []);
```

**Step 2: Run build**

**Step 3: Commit**

---

### Task 15: Polish & Final Build

**Files:**
- Various touch-ups across all new components

**Step 1: Verify all components render correctly**

Run: `npm run dev` and check each feature:
- [ ] Navbar1 pills render at correct size/shape
- [ ] Navbar2 shows Balance/Equity/P&L
- [ ] Left sidebar drawing icons visible
- [ ] Chart renders candlesticks
- [ ] Floating trade widget draggable
- [ ] Bid/Ask buttons place trades (check positions tab)
- [ ] Close position works
- [ ] Copilot overlay opens/closes with animation
- [ ] Copilot chat sends messages via Anthropic API
- [ ] Symbols search filters and selects
- [ ] Risk management form saves settings
- [ ] Settings panel slides in/out
- [ ] Playback controls work (play, pause, step, seek)
- [ ] Tick mode still works
- [ ] Keyboard shortcuts (Ctrl+S, Escape)

**Step 2: Fix any visual issues**

Common fixes:
- z-index stacking (chart crosshair vs floating widget)
- Overflow handling on bottom panel resize
- Font rendering on pill buttons

**Step 3: Final build**

Run: `npm run build`
Expected: Clean build, no warnings.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: aFindr V2 complete — dual navbars, copilot, trading engine, positions panel"
```

---

## Summary

| Task | Component | Est. Lines | Dependencies |
|------|-----------|-----------|-------------|
| 1 | Theme/CSS | ~120 new | None |
| 2 | Types | ~80 new | None |
| 3 | useTradingEngine | ~180 | Task 2 |
| 4 | Navbar1 | ~250 | Task 1 |
| 5 | Navbar2 | ~200 | Task 1, 2 |
| 6 | LeftSidebar | ~100 | Task 1 |
| 7 | FloatingTradeWidget | ~200 | Task 1, 3 |
| 8 | PositionsPanel | ~350 | Task 1, 2, 3 |
| 9 | CopilotOverlay | ~350 | Task 1 |
| 10 | SymbolsSearch | ~250 | Task 1, 2 |
| 11 | RiskManagement | ~150 | Task 1, 2 |
| 12 | SettingsPanel | ~200 | Task 1, 2 |
| 13 | page.tsx restructure | ~700 rewrite | Tasks 3-12 |
| 14 | Keyboard shortcuts | ~30 | Task 13 |
| 15 | Polish | ~50 fixes | Task 13 |

**Parallelizable groups:**
- Group A (independent): Tasks 1, 2 (theme + types)
- Group B (after A): Tasks 3, 4, 5, 6, 9, 10, 11, 12 (all components, independent of each other)
- Group C (after A+3): Tasks 7, 8 (depend on trading engine)
- Group D (after all): Tasks 13, 14, 15 (integration)

**Total new code: ~2,900 lines**
