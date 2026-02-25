# Liquid Glass UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the MVP trading platform into a premium Apple Vision Pro-style glass UI with Framer Motion animations.

**Architecture:** In-place rework of existing components. Install framer-motion, update CSS variables to glass tokens, then update each component file to use glass panels + animations. No structural changes to state management or data flow.

**Tech Stack:** Framer Motion 11, Tailwind CSS 4, CSS backdrop-filter, existing Next.js 15 + React 19

---

### Task 1: Install Framer Motion + Bug Fixes

**Files:**
- Modify: `package.json`
- Create: `backend/.env.example`
- Modify: `backend/agent/strategy_agent.py`

**Step 1: Install framer-motion**

Run: `npm install framer-motion`

**Step 2: Create .env.example**

```
ANTHROPIC_API_KEY=your-api-key-here
```

**Step 3: Fix async/sync mismatch in strategy_agent.py**

The Anthropic Python SDK `client.messages.create` is synchronous. Wrap it with `asyncio.to_thread` or just make the function sync and let FastAPI handle it:

```python
# In backend/agent/strategy_agent.py, change:
# async def generate_strategy(  →  def generate_strategy(
# And in backend/routers/chat.py, change:
# strategy_result = await generate_strategy(...)  →  strategy_result = generate_strategy(...)
```

Actually simpler: just remove `async` from `generate_strategy` since `client.messages.create` is sync, and use `run_in_executor` in the router. But simplest is just making `generate_strategy` sync and calling from a sync context in FastAPI (FastAPI handles sync route functions in threadpool automatically).

Change `backend/routers/chat.py` route to be sync:
```python
@router.post("")
def chat(req: ChatRequest):  # removed async
```

And `generate_strategy` is already fine as sync (remove the async keyword).

**Step 4: Commit**

```bash
git add package.json package-lock.json backend/.env.example backend/agent/strategy_agent.py backend/routers/chat.py
git commit -m "fix: install framer-motion, add .env.example, fix async mismatch"
```

---

### Task 2: Glass CSS Foundation

**Files:**
- Modify: `src/styles/globals.css`

**Step 1: Replace CSS variables with glass tokens**

Replace entire `:root` block and add glass utility classes:

```css
@import "tailwindcss";

:root {
  --bg: #050508;
  --glass: rgba(255,255,255,0.03);
  --glass-border: rgba(255,255,255,0.06);
  --glass-hover: rgba(255,255,255,0.05);
  --glass-elevated: rgba(255,255,255,0.07);
  --accent: #6366f1;
  --accent-glow: rgba(99,102,241,0.15);
  --accent-muted: rgba(99,102,241,0.08);
  --buy: #34d399;
  --sell: #f87171;
  --text-primary: rgba(255,255,255,0.92);
  --text-secondary: rgba(255,255,255,0.5);
  --text-muted: rgba(255,255,255,0.25);
}

body {
  background: var(--bg);
  color: var(--text-primary);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif;
  margin: 0;
  padding: 0;
  overflow: hidden;
  height: 100vh;
  -webkit-font-smoothing: antialiased;
}

* {
  box-sizing: border-box;
}

.glass {
  background: var(--glass);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid var(--glass-border);
  box-shadow: 0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05);
}

.glass-hover {
  transition: background 200ms ease, border-color 200ms ease;
}
.glass-hover:hover {
  background: var(--glass-hover);
  border-color: rgba(255,255,255,0.1);
}

.glass-elevated {
  background: var(--glass-elevated);
  backdrop-filter: blur(24px) saturate(200%);
  -webkit-backdrop-filter: blur(24px) saturate(200%);
  border: 1px solid rgba(255,255,255,0.08);
  box-shadow: 0 12px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06);
}

.glow-accent {
  box-shadow: 0 0 20px rgba(99,102,241,0.3), 0 0 60px rgba(99,102,241,0.1);
}

::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.1);
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(255,255,255,0.2);
}
```

**Step 2: Verify build passes**

Run: `npm run build`
Expected: Build succeeds (CSS changes only)

**Step 3: Commit**

```bash
git add src/styles/globals.css
git commit -m "feat: replace flat dark theme with glass CSS foundation"
```

---

### Task 3: Glass CommandBar

**Files:**
- Modify: `src/components/CommandBar/CommandBar.tsx`

Replace entire component with glass version. Key changes:
- Floating glass pill container with 12px margin, rounded-2xl
- Symbol chips with active indigo ring
- Interval buttons with layoutId sliding indicator
- Input with indigo glow on focus
- Framer motion AnimatePresence for loading state

**Step 1: Rewrite CommandBar.tsx**

Full replacement — use `motion.div` wrappers, `glass` CSS class on container, indigo-glow focus ring on input, `layoutId="interval-indicator"` for the active interval tab.

**Step 2: Verify build**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/components/CommandBar/CommandBar.tsx
git commit -m "feat: glass command bar with floating pill layout"
```

---

### Task 4: Glass ChatPanel

**Files:**
- Modify: `src/components/ChatPanel/ChatPanel.tsx`

Key changes:
- Glass sidebar container with rounded corners
- User bubbles → indigo-tinted glass
- Assistant bubbles → neutral glass
- AnimatePresence for message enter animations
- Stagger children on message list
- Loading pulse with indigo dot

**Step 1: Rewrite ChatPanel.tsx**

Use `motion.div` with `initial={{ opacity: 0, y: 10 }}` `animate={{ opacity: 1, y: 0 }}` for each message.

**Step 2: Verify build**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/components/ChatPanel/ChatPanel.tsx
git commit -m "feat: glass chat panel with animated message bubbles"
```

---

### Task 5: Glass ReplayControls

**Files:**
- Modify: `src/components/ReplayControls/ReplayControls.tsx`

Key changes:
- Glass overlay strip floating at bottom of chart
- Play button with pulse animation when active
- Progress bar → styled indigo track with glow
- Speed chips with pill styling and active ring

**Step 1: Rewrite ReplayControls.tsx**

**Step 2: Verify build**

**Step 3: Commit**

```bash
git add src/components/ReplayControls/ReplayControls.tsx
git commit -m "feat: glass replay controls with animated play button"
```

---

### Task 6: Glass BacktestResults + TradingPanel

**Files:**
- Modify: `src/components/BacktestResults/BacktestResults.tsx`
- Modify: `src/components/TradingPanel/TradingPanel.tsx`

Key changes:
- MetricCard → glass cards with gradient top borders (green for positive, red for negative)
- Cards cascade in with 50ms stagger using `motion.div` + `variants`
- Tab indicator slides with `layoutId`
- Trade table rows animate in
- Equity curve bars animate height

**Step 1: Rewrite BacktestResults.tsx**

**Step 2: Rewrite TradingPanel.tsx**

**Step 3: Verify build**

**Step 4: Commit**

```bash
git add src/components/BacktestResults/BacktestResults.tsx src/components/TradingPanel/TradingPanel.tsx
git commit -m "feat: glass trading panel with animated metrics cascade"
```

---

### Task 7: Glass Chart Container

**Files:**
- Modify: `src/components/Chart/Chart.tsx`

Key changes:
- Update chart background from `#000000` to `#050508`
- Grid lines from `#111111` to `rgba(255,255,255,0.04)`
- Crosshair color → indigo accent
- Container wrapper gets glass border + rounded corners
- Chart candle colors → updated buy/sell (emerald/red-400)

**Step 1: Update Chart.tsx colors**

**Step 2: Verify build**

**Step 3: Commit**

```bash
git add src/components/Chart/Chart.tsx
git commit -m "feat: update chart colors for glass theme"
```

---

### Task 8: Glass Dashboard Layout + Page Load Animation

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/layout.tsx`

Key changes:
- All panels get 12px gaps (padding on body, gap between panels)
- Floating layout instead of edge-to-edge
- Staggered page load animation: command bar → chart → side panel → bottom panel
- Chat panel toggle animates with spring physics
- Add Inter font from Google Fonts in layout.tsx
- Wrap children in AnimatePresence

**Step 1: Update layout.tsx to load Inter font**

**Step 2: Rewrite page.tsx layout with glass gaps and motion wrappers**

**Step 3: Verify build**

**Step 4: Commit**

```bash
git add src/app/page.tsx src/app/layout.tsx
git commit -m "feat: glass dashboard layout with staggered page load animation"
```

---

### Task 9: Final Build + Visual QA

**Step 1: Run full build**

Run: `npm run build`
Expected: Clean build, no errors

**Step 2: Start dev servers and visual check**

Run: `npm run dev`
Check: All glass panels render, animations play, chart loads data

**Step 3: Final commit if any tweaks needed**
