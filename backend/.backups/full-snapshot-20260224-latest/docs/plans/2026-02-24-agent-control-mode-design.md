# Alphy Agent Control Mode — Design

## Context

When Alphy needs to manipulate the UI (change interval, navigate pages, toggle panels, activate drawing tools), a frosted glass overlay drops over the window. An animated cursor moves to the target control, the element highlights with a cyan glow, and the action fires. The user watches their own UI being operated — like a ghost controlling their screen.

Inspired by Cursor's agent browser control, but novel: no existing AI tool uses a glassmorphism overlay. This makes it visually differentiated and premium.

## Architecture: 3 Layers

### Layer 1 — Backend: Agent emits UI actions via SSE

New SSE event type: `ui_action`. The agent decides it needs to change the interval, so instead of embedding it in text, it emits a structured action event.

```
event: ui_action
data: { "action": "set_interval", "value": "1m", "label": "Switching to 1-minute chart" }
```

**Action types:**

| Action | Value | Example |
|--------|-------|---------|
| `set_interval` | interval string | `"1m"`, `"5m"`, `"15m"`, `"1h"`, `"4h"`, `"1d"`, `"1wk"` |
| `set_symbol` | ticker string | `"NQ=F"`, `"AAPL"`, `"ES=F"` |
| `set_page` | page name | `"trade"`, `"portfolio"`, `"news"`, `"alpha"`, `"dashboard"`, `"settings"` |
| `toggle_panel` | panel id | `"strategyTester"`, `"indicatorSearch"`, `"riskMgmt"`, `"bottomPanel"`, `"alphySidePanel"` |
| `set_drawing_tool` | tool name | `"trendline"`, `"fib"`, `"rectangle"`, `"hline"`, `"vline"`, `"ray"`, `"crosshair"` |

Implementation: New backend tool `control_ui` that the agent calls. The tool handler returns a `[UI_ACTION:...]` control tag. The agent runner detects these tags and emits them as `ui_action` SSE events instead of embedding them in text.

### Layer 2 — Frontend: Action Queue + Execution Engine

New hook: `useAgentControl`

Receives `ui_action` events from `useAgentStream`, queues them, and executes them sequentially with animated delays:

1. Activate overlay (glass tint fades in, 400ms)
2. For each action in queue:
   - Resolve target element via `data-agent-target` attribute
   - Move cursor to element center (smooth easing, ~500ms)
   - Highlight element (cyan glow bounding box, appears 100ms before cursor arrives)
   - Pause 400ms (let user see what's about to happen)
   - Execute action (call the actual setter)
   - Ripple animation on "click" (200ms)
   - Brief pause (300ms), then next action
3. After all actions complete + 600ms delay, fade out overlay

### Layer 3 — Visual: AgentControlOverlay Component

New component: `src/components/AgentControl/AgentControlOverlay.tsx`

**Glass overlay:**
- Fixed position, full viewport, z-index 9999
- `backdrop-filter: blur(6px) saturate(120%)`
- Background: `rgba(10, 14, 30, 0.35)` (dark blue tint)
- Fades in/out with `cubic-bezier(0.4, 0, 0.2, 1)` over 400ms
- Pointer events: none (except for the "Take back control" button)

**Agent cursor:**
- 12px cyan dot (`#00C2FF`) with pulsing ring animation (scale 1 -> 2, opacity 1 -> 0, looping)
- Moves via `transform: translate3d(x, y, 0)` with `transition: transform 500ms cubic-bezier(0.4, 0, 0.2, 1)`
- On "click": ripple burst animation expanding outward (3 concentric rings)

**Element highlight:**
- Target element gets `box-shadow: 0 0 0 2px rgba(0, 200, 255, 0.6), 0 0 20px rgba(0, 200, 255, 0.15)`
- Subtle scale pulse: `transform: scale(1.02)` then back over 300ms
- Highlight appears 100ms before cursor arrives, fades 200ms after action

**Status pill:**
- Floating at top-center of viewport
- Glassmorphism styled: `backdrop-filter: blur(12px)`, `rgba(255, 255, 255, 0.1)` bg, white border
- Shows: pulsing cyan dot + action label ("Switching to 1-minute chart...")
- "Take back control" button (warm/red accent)

## Element Targeting

UI elements get `data-agent-target` attributes:

```tsx
// Navbar2.tsx — interval buttons
<button data-agent-target="interval-1m">1m</button>
<button data-agent-target="interval-5m">5m</button>

// PageNav.tsx — page tabs
<button data-agent-target="page-portfolio">Portfolio</button>

// Drawing toolbar
<button data-agent-target="tool-trendline">Trendline</button>

// Panel toggles
<button data-agent-target="panel-strategyTester">Strategy Tester</button>
```

Target ID convention:
- `interval-{value}` for intervals
- `symbol-search` for the symbol search trigger
- `page-{name}` for pages
- `panel-{name}` for panels
- `tool-{name}` for drawing tools

## Interruption

User clicks anywhere during agent control:
- Overlay dissolves instantly (200ms)
- Action queue clears
- Status pill shows "Control returned to you" briefly
- Any in-progress animation cancels

## What Triggers the Overlay

Only `ui_action` SSE events trigger the overlay. These represent visible UI control changes.

**Does NOT trigger overlay:**
- Text responses
- Tool calls (fetch_market_data, run_backtest, etc.)
- Adding indicators via `[INDICATOR:...]` tags
- Adding/updating/deleting chart scripts
- Any data-only operation

## Backend Tool: control_ui

```python
{
    "name": "control_ui",
    "description": "Take control of the user's UI to navigate, change settings, or prepare the workspace. Use when you need to switch intervals, change symbols, navigate pages, or set up the workspace before analysis.",
    "input_schema": {
        "properties": {
            "actions": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "action": { "enum": ["set_interval", "set_symbol", "set_page", "toggle_panel", "set_drawing_tool"] },
                        "value": { "type": "string" },
                        "label": { "type": "string", "description": "Human-readable description of what you're doing" }
                    },
                    "required": ["action", "value"]
                }
            }
        },
        "required": ["actions"]
    }
}
```

The tool can batch multiple actions in one call (e.g., switch to 1m + navigate to trade page).

## Agent Prompt Addition

```
UI Control:
When you need to change the chart interval, switch symbols, navigate to a different page, or toggle panels — use control_ui.
This gives you direct control of the user's interface. The user will see you navigating their screen in real-time.
- "analyze NQ on 1 minute" -> control_ui(actions=[{action: "set_interval", value: "1m"}]) then fetch data
- "show me the portfolio" -> control_ui(actions=[{action: "set_page", value: "portfolio"}])
- "draw a trendline" -> control_ui(actions=[{action: "set_drawing_tool", value: "trendline"}])
Always narrate what you're doing: "Let me switch to the 1-minute chart..."
```

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/components/AgentControl/AgentControlOverlay.tsx` | **Create** — Glass overlay + cursor + status pill |
| `src/hooks/useAgentControl.ts` | **Create** — Action queue, execution engine, cursor positioning |
| `src/hooks/useAgentStream.ts` | **Modify** — Parse new `ui_action` SSE events |
| `src/app/page.tsx` | **Modify** — Wire up AgentControlOverlay, pass setters to control hook |
| `src/components/Navbar2/Navbar2.tsx` | **Modify** — Add `data-agent-target` attributes to interval buttons |
| `src/components/PageNav/PageNav.tsx` | **Modify** — Add `data-agent-target` to page tabs |
| `backend/agent/tools.py` | **Modify** — Add `control_ui` tool schema + handler |
| `backend/agent/agent_runner.py` | **Modify** — Emit `ui_action` SSE events from control_ui results |
| `backend/agent/prompts.py` | **Modify** — Add UI control instructions to system prompt |
| `backend/routers/chat_stream.py` | No change (SSE events already flow through) |
