# Agent Control Mode Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** When Alphy manipulates UI controls (interval, symbol, page, panels), a frosted glass overlay appears, an animated cursor moves to and "clicks" the target control, and the action fires — the user watches their own UI being operated in real-time.

**Architecture:** Backend `control_ui` tool emits `ui_action` SSE events. Frontend `useAgentControl` hook queues actions and executes them sequentially with animated delays. `AgentControlOverlay` renders the glass layer, cursor, element highlights, and status pill. Existing UI elements get `data-agent-target` attributes for cursor targeting.

**Tech Stack:** React, framer-motion (already installed), CSS backdrop-filter, existing SSE streaming infrastructure.

---

### Task 1: Add `data-agent-target` attributes to UI controls

These attributes are how the cursor finds elements to animate toward. No behavioral changes — just adding invisible attributes.

**Files:**
- Modify: `src/components/Navbar2/Navbar2.tsx`
- Modify: `src/components/PageNav/PageNav.tsx`
- Modify: `src/app/page.tsx`

**Step 1: Add targets to interval buttons in Navbar2.tsx**

At line 209, the interval `<button>` element. Add `data-agent-target`:

```tsx
<button
  key={i.value}
  onClick={() => onIntervalChange(i.value)}
  data-agent-target={`interval-${i.value}`}
  className="relative px-2.5 py-1 text-xs font-medium rounded-md transition-colors"
```

At line 139, the symbol selector button. Add:

```tsx
<button
  onClick={onOpenSymbolSearch}
  data-agent-target="symbol-search"
  className="flex items-center gap-2 px-2 py-1 rounded-lg transition-all"
```

**Step 2: Add targets to page tabs in PageNav.tsx**

At line 62, the page `<motion.button>`. Add:

```tsx
<motion.button
  key={page.id}
  onClick={() => onPageChange(page.id)}
  data-agent-target={`page-${page.id}`}
  className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium transition-colors"
```

**Step 3: Add targets to panel toggle buttons in page.tsx**

Find each panel toggle button and add the appropriate `data-agent-target`. These are scattered in the layout — the copilot toggle, strategy tester tab, etc. At minimum, tag the Alphy side panel toggle button with `data-agent-target="panel-alphySidePanel"`.

Search for `setShowBottomPanel`, `setShowStrategyTester`, `setShowIndicatorSearch` in page.tsx and add attributes to their trigger buttons/elements.

**Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: Clean build, no errors.

---

### Task 2: Create the `useAgentControl` hook

The core execution engine: receives UI actions, queues them, positions the cursor, executes with delays.

**Files:**
- Create: `src/hooks/useAgentControl.ts`

**Step 1: Create the hook**

```typescript
/**
 * useAgentControl — orchestrates agent UI takeover.
 *
 * Receives UI action events from the agent stream, queues them,
 * and executes them sequentially with animated cursor movement.
 */

"use client";

import { useState, useCallback, useRef, useEffect } from "react";

export interface UIAction {
  action: "set_interval" | "set_symbol" | "set_page" | "toggle_panel" | "set_drawing_tool";
  value: string;
  label?: string;
}

export interface CursorPosition {
  x: number;
  y: number;
}

export interface AgentControlState {
  /** Whether the agent is currently controlling the UI */
  isActive: boolean;
  /** Current animated cursor position */
  cursorPosition: CursorPosition;
  /** The element currently highlighted (agent-target id) */
  highlightedTarget: string | null;
  /** Human-readable status text */
  statusLabel: string;
  /** Current action index / total for progress */
  progress: { current: number; total: number };
}

interface AgentControlHandlers {
  setInterval: (v: string) => void;
  setSymbol: (v: string) => void;
  setCurrentPage: (v: string) => void;
  togglePanel: (panel: string) => void;
  setDrawingTool: (v: string) => void;
}

const CURSOR_MOVE_MS = 500;
const PRE_CLICK_PAUSE_MS = 400;
const POST_CLICK_PAUSE_MS = 300;
const OVERLAY_FADE_IN_MS = 400;
const OVERLAY_LINGER_MS = 600;

export function useAgentControl(handlers: AgentControlHandlers) {
  const [state, setState] = useState<AgentControlState>({
    isActive: false,
    cursorPosition: { x: -100, y: -100 },
    highlightedTarget: null,
    statusLabel: "",
    progress: { current: 0, total: 0 },
  });

  const queueRef = useRef<UIAction[]>([]);
  const processingRef = useRef(false);
  const cancelledRef = useRef(false);

  const sleep = (ms: number) =>
    new Promise<void>((resolve) => {
      const id = setTimeout(resolve, ms);
      // Check cancellation periodically
      const check = setInterval(() => {
        if (cancelledRef.current) {
          clearTimeout(id);
          clearInterval(check);
          resolve();
        }
      }, 50);
      setTimeout(() => clearInterval(check), ms + 100);
    });

  const getTargetRect = (targetId: string): DOMRect | null => {
    const el = document.querySelector(`[data-agent-target="${targetId}"]`);
    return el ? el.getBoundingClientRect() : null;
  };

  const resolveTargetId = (action: UIAction): string => {
    switch (action.action) {
      case "set_interval": return `interval-${action.value}`;
      case "set_symbol": return "symbol-search";
      case "set_page": return `page-${action.value}`;
      case "toggle_panel": return `panel-${action.value}`;
      case "set_drawing_tool": return `tool-${action.value}`;
      default: return "";
    }
  };

  const executeAction = (action: UIAction) => {
    switch (action.action) {
      case "set_interval":
        handlers.setInterval(action.value);
        break;
      case "set_symbol":
        handlers.setSymbol(action.value);
        break;
      case "set_page":
        handlers.setCurrentPage(action.value);
        break;
      case "toggle_panel":
        handlers.togglePanel(action.value);
        break;
      case "set_drawing_tool":
        handlers.setDrawingTool(action.value);
        break;
    }
  };

  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    cancelledRef.current = false;

    const actions = [...queueRef.current];
    queueRef.current = [];

    if (actions.length === 0) {
      processingRef.current = false;
      return;
    }

    // Activate overlay
    setState((prev) => ({
      ...prev,
      isActive: true,
      progress: { current: 0, total: actions.length },
      statusLabel: actions[0].label || "Taking control...",
    }));

    await sleep(OVERLAY_FADE_IN_MS);

    for (let i = 0; i < actions.length; i++) {
      if (cancelledRef.current) break;

      const action = actions[i];
      const targetId = resolveTargetId(action);

      // Update status
      setState((prev) => ({
        ...prev,
        statusLabel: action.label || `${action.action}: ${action.value}`,
        progress: { current: i + 1, total: actions.length },
      }));

      // Highlight target element
      setState((prev) => ({ ...prev, highlightedTarget: targetId }));

      // Move cursor to target
      const rect = getTargetRect(targetId);
      if (rect) {
        setState((prev) => ({
          ...prev,
          cursorPosition: {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          },
        }));
      }

      // Wait for cursor to arrive
      await sleep(CURSOR_MOVE_MS);
      if (cancelledRef.current) break;

      // Pause before "clicking"
      await sleep(PRE_CLICK_PAUSE_MS);
      if (cancelledRef.current) break;

      // Execute the action
      executeAction(action);

      // Post-click pause
      await sleep(POST_CLICK_PAUSE_MS);

      // Clear highlight
      setState((prev) => ({ ...prev, highlightedTarget: null }));
    }

    // Linger then deactivate
    if (!cancelledRef.current) {
      setState((prev) => ({ ...prev, statusLabel: "Done", highlightedTarget: null }));
      await sleep(OVERLAY_LINGER_MS);
    }

    setState({
      isActive: false,
      cursorPosition: { x: -100, y: -100 },
      highlightedTarget: null,
      statusLabel: "",
      progress: { current: 0, total: 0 },
    });

    processingRef.current = false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handlers]);

  const enqueueActions = useCallback(
    (actions: UIAction[]) => {
      queueRef.current.push(...actions);
      processQueue();
    },
    [processQueue]
  );

  const cancelControl = useCallback(() => {
    cancelledRef.current = true;
    queueRef.current = [];
    setState({
      isActive: false,
      cursorPosition: { x: -100, y: -100 },
      highlightedTarget: null,
      statusLabel: "",
      progress: { current: 0, total: 0 },
    });
    processingRef.current = false;
  }, []);

  return {
    ...state,
    enqueueActions,
    cancelControl,
  };
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: Clean build.

---

### Task 3: Create the `AgentControlOverlay` component

The visual layer: glass overlay, animated cursor, element highlight portal, status pill.

**Files:**
- Create: `src/components/AgentControl/AgentControlOverlay.tsx`

**Step 1: Create the component**

```tsx
/**
 * AgentControlOverlay — frosted glass overlay with animated cursor
 * that appears when Alphy takes control of the UI.
 */

"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface AgentControlOverlayProps {
  isActive: boolean;
  cursorPosition: { x: number; y: number };
  highlightedTarget: string | null;
  statusLabel: string;
  progress: { current: number; total: number };
  onCancel: () => void;
}

export default function AgentControlOverlay({
  isActive,
  cursorPosition,
  highlightedTarget,
  statusLabel,
  progress,
  onCancel,
}: AgentControlOverlayProps) {
  const highlightRef = useRef<{ top: number; left: number; width: number; height: number } | null>(null);

  // Track highlighted element position
  useEffect(() => {
    if (!highlightedTarget) {
      highlightRef.current = null;
      return;
    }
    const el = document.querySelector(`[data-agent-target="${highlightedTarget}"]`);
    if (el) {
      const rect = el.getBoundingClientRect();
      highlightRef.current = {
        top: rect.top - 4,
        left: rect.left - 4,
        width: rect.width + 8,
        height: rect.height + 8,
      };
    }
  }, [highlightedTarget]);

  const highlightRect = highlightRef.current;

  return (
    <AnimatePresence>
      {isActive && (
        <>
          {/* Glass overlay */}
          <motion.div
            key="agent-glass"
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{ opacity: 1, backdropFilter: "blur(6px) saturate(120%)" }}
            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            onClick={onCancel}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9998,
              background: "rgba(10, 14, 30, 0.35)",
              pointerEvents: "auto",
              cursor: "default",
            }}
          />

          {/* Element highlight */}
          <AnimatePresence>
            {highlightRect && (
              <motion.div
                key="agent-highlight"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                style={{
                  position: "fixed",
                  top: highlightRect.top,
                  left: highlightRect.left,
                  width: highlightRect.width,
                  height: highlightRect.height,
                  borderRadius: 8,
                  border: "2px solid rgba(0, 200, 255, 0.6)",
                  boxShadow: "0 0 20px rgba(0, 200, 255, 0.15), 0 0 40px rgba(0, 200, 255, 0.08)",
                  zIndex: 10001,
                  pointerEvents: "none",
                }}
              />
            )}
          </AnimatePresence>

          {/* Agent cursor */}
          <motion.div
            key="agent-cursor"
            animate={{
              x: cursorPosition.x - 6,
              y: cursorPosition.y - 6,
            }}
            transition={{
              type: "spring",
              stiffness: 120,
              damping: 20,
              mass: 0.8,
            }}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: "#00C2FF",
              boxShadow: "0 0 12px rgba(0, 194, 255, 0.6), 0 0 30px rgba(0, 194, 255, 0.2)",
              zIndex: 10002,
              pointerEvents: "none",
            }}
          >
            {/* Pulsing ring */}
            <motion.div
              animate={{ scale: [1, 2.5], opacity: [0.6, 0] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
              style={{
                position: "absolute",
                inset: -2,
                borderRadius: "50%",
                border: "1.5px solid rgba(0, 194, 255, 0.5)",
              }}
            />
          </motion.div>

          {/* Status pill */}
          <motion.div
            key="agent-status"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            style={{
              position: "fixed",
              top: 16,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 10003,
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 16px",
              borderRadius: 20,
              background: "rgba(20, 24, 40, 0.75)",
              backdropFilter: "blur(12px) saturate(150%)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              boxShadow: "0 4px 24px rgba(0, 0, 0, 0.3)",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "rgba(255, 255, 255, 0.9)",
              pointerEvents: "auto",
            }}
          >
            {/* Pulsing dot */}
            <span style={{ position: "relative", width: 8, height: 8, flexShrink: 0 }}>
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  background: "#00C2FF",
                }}
              />
              <motion.span
                animate={{ scale: [1, 2], opacity: [0.8, 0] }}
                transition={{ duration: 1, repeat: Infinity }}
                style={{
                  position: "absolute",
                  inset: -2,
                  borderRadius: "50%",
                  background: "rgba(0, 194, 255, 0.4)",
                }}
              />
            </span>

            <span>{statusLabel}</span>

            {progress.total > 1 && (
              <span style={{ opacity: 0.5 }}>
                {progress.current}/{progress.total}
              </span>
            )}

            <button
              onClick={onCancel}
              style={{
                marginLeft: 4,
                padding: "2px 8px",
                borderRadius: 10,
                border: "1px solid rgba(255, 100, 100, 0.3)",
                background: "rgba(255, 80, 80, 0.15)",
                color: "rgba(255, 150, 150, 0.9)",
                fontSize: 10,
                fontFamily: "var(--font-mono)",
                cursor: "pointer",
              }}
            >
              Stop
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: Clean build.

---

### Task 4: Add `ui_action` SSE event parsing to `useAgentStream`

The streaming hook needs to recognize the new event type and surface it.

**Files:**
- Modify: `src/hooks/useAgentStream.ts`

**Step 1: Add UIActionEvent interface and state**

After the existing `ErrorEvent` interface (~line 67), add:

```typescript
export interface UIActionEvent {
  run_id: string;
  actions: { action: string; value: string; label?: string }[];
}
```

Add to `StreamChatRequest` (already has `active_scripts`):
No change needed — the actions flow as SSE events, not request params.

Add new state inside `useAgentStream`:
```typescript
const [uiActions, setUIActions] = useState<UIActionEvent[]>([]);
```

Reset it at stream start alongside other resets.

**Step 2: Parse `ui_action` events in the SSE switch block**

In the `switch (eventType)` block (~line 214), add before `default`:

```typescript
case "ui_action": {
  const uiAction = data as UIActionEvent;
  setUIActions((prev) => [...prev, uiAction]);
  break;
}
```

**Step 3: Expose uiActions in the return value**

Add `uiActions` to the return object and `UseAgentStreamReturn` interface.

**Step 4: Verify**

Run: `npx tsc --noEmit`

---

### Task 5: Add `control_ui` backend tool

The agent calls this tool to emit UI control actions.

**Files:**
- Modify: `backend/agent/tools.py` (add tool schema + handler)
- Modify: `backend/agent/agent_runner.py` (emit `ui_action` SSE events + add to auto-approved + add timeout)

**Step 1: Add tool schema to TOOLS list in tools.py**

Add after the `manage_chart_scripts` tool entry:

```python
{
    "name": "control_ui",
    "description": "Take control of the user's UI to navigate, change chart settings, or prepare the workspace. Use when you need to switch intervals, change symbols, navigate to different pages, toggle panels, or activate drawing tools. The user will see you controlling their screen in real-time with an animated cursor.",
    "input_schema": {
        "type": "object",
        "properties": {
            "actions": {
                "type": "array",
                "description": "Sequence of UI actions to perform. Executed one at a time with visual animation.",
                "items": {
                    "type": "object",
                    "properties": {
                        "action": {
                            "type": "string",
                            "enum": ["set_interval", "set_symbol", "set_page", "toggle_panel", "set_drawing_tool"],
                            "description": "The UI action to perform",
                        },
                        "value": {
                            "type": "string",
                            "description": "The value to set. Intervals: 1m,5m,15m,30m,1h,4h,1d,1wk. Pages: trade,dashboard,portfolio,news,alpha,settings. Panels: strategyTester,indicatorSearch,riskMgmt,bottomPanel,alphySidePanel. Drawing tools: crosshair,trendline,hline,vline,ray,arrow,rectangle,channel,fib,measure,text,brush,eraser.",
                        },
                        "label": {
                            "type": "string",
                            "description": "Human-readable description shown to the user, e.g. 'Switching to 1-minute chart'",
                        },
                    },
                    "required": ["action", "value"],
                },
            },
        },
        "required": ["actions"],
    },
},
```

**Step 2: Add handler in tools.py**

After `handle_manage_chart_scripts`:

```python
async def handle_control_ui(args: dict) -> str:
    """Handle control_ui tool call.

    Returns the actions as structured data. The agent_runner will
    emit these as ui_action SSE events for the frontend to animate.
    """
    actions = args.get("actions", [])
    if not actions:
        return json.dumps({"error": "No actions provided"})

    valid_actions = []
    for a in actions:
        action_type = a.get("action")
        value = a.get("value", "")
        label = a.get("label", "")
        if action_type in ("set_interval", "set_symbol", "set_page", "toggle_panel", "set_drawing_tool"):
            valid_actions.append({"action": action_type, "value": value, "label": label})

    if not valid_actions:
        return json.dumps({"error": "No valid actions"})

    return json.dumps({
        "ui_actions": valid_actions,
        "message": f"Executing {len(valid_actions)} UI action(s)",
    })
```

**Step 3: Register in TOOL_HANDLERS**

```python
"manage_chart_scripts": handle_manage_chart_scripts,
"control_ui": handle_control_ui,
"get_trading_summary": handle_get_trading_summary,
```

**Step 4: In agent_runner.py — add to AUTO_APPROVED_TOOLS and TOOL_TIMEOUTS**

```python
# AUTO_APPROVED_TOOLS
"manage_chart_scripts",
"control_ui",

# TOOL_TIMEOUTS
"manage_chart_scripts": 5,
"control_ui": 5,
```

**Step 5: In agent_runner.py — emit `ui_action` SSE events when control_ui results come back**

In the tool result tracking section (after `elif tool_name in ("detect_chart_patterns"...`), add:

```python
elif tool_name == "control_ui" and "error" not in result_data:
    ui_actions = result_data.get("ui_actions", [])
    if ui_actions:
        yield SSEEvent(
            event="ui_action",
            data={"run_id": run_id, "actions": ui_actions},
        )
```

This is special because it yields a new SSE event type *during tool result processing*, before the tool_result event. The frontend will receive the `ui_action` event and begin the overlay animation immediately.

**Step 6: Verify**

Run: `python3 -c "import py_compile; py_compile.compile('backend/agent/tools.py', doraise=True); py_compile.compile('backend/agent/agent_runner.py', doraise=True); print('OK')"`

---

### Task 6: Wire everything together in page.tsx

Connect the hook, overlay component, and action dispatching.

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Import the new hook and component**

Near the top imports:

```typescript
import { useAgentControl } from "@/hooks/useAgentControl";
import AgentControlOverlay from "@/components/AgentControl/AgentControlOverlay";
```

**Step 2: Set up the hook with handler references**

After the existing `useChartScripts` section, add:

```typescript
// ═══════════════════════════════════════════════
// AGENT CONTROL MODE
// ═══════════════════════════════════════════════
const agentControl = useAgentControl({
  setInterval: (v) => setInterval(v),
  setSymbol: (v) => setSymbol(v),
  setCurrentPage: (v) => setCurrentPage(v as AppPage),
  togglePanel: (panel) => {
    switch (panel) {
      case "strategyTester": setShowStrategyTester((p) => !p); break;
      case "indicatorSearch": setShowIndicatorSearch((p) => !p); break;
      case "riskMgmt": setShowRiskMgmt((p) => !p); break;
      case "bottomPanel": setShowBottomPanel((p) => !p); break;
      case "alphySidePanel": setShowAlphySidePanel((p) => !p); break;
    }
  },
  setDrawingTool: (v) => setDrawingTool(v as DrawingTool),
});
```

**Step 3: Connect agent stream UI actions to the control hook**

In both `handleSubmitStreaming` and `handleSubmit`, after tool events are processed, check for `ui_action` events from the stream. The simplest way: add a `useEffect` that watches `agentStream.uiActions`:

```typescript
// Dispatch agent UI actions to control overlay
useEffect(() => {
  if (agentStream.uiActions.length === 0) return;
  const latest = agentStream.uiActions[agentStream.uiActions.length - 1];
  if (latest?.actions) {
    agentControl.enqueueActions(latest.actions);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [agentStream.uiActions.length]);
```

**Step 4: Render the overlay in the JSX**

At the top of the return JSX (before other content, so it overlays everything):

```tsx
<AgentControlOverlay
  isActive={agentControl.isActive}
  cursorPosition={agentControl.cursorPosition}
  highlightedTarget={agentControl.highlightedTarget}
  statusLabel={agentControl.statusLabel}
  progress={agentControl.progress}
  onCancel={agentControl.cancelControl}
/>
```

**Step 5: Verify**

Run: `npx tsc --noEmit`
Expected: Clean build.

---

### Task 7: Add UI control instructions to agent prompt

Tell the agent when and how to use `control_ui`.

**Files:**
- Modify: `backend/agent/prompts.py`

**Step 1: Add to capabilities list**

After the `manage_chart_scripts` line:

```
- control_ui: Take direct control of the user's interface — switch chart intervals, change symbols, navigate pages, toggle panels, activate drawing tools. The user sees you controlling their screen in real-time with an animated cursor. Use this when you need to prepare the workspace before analysis.
```

**Step 2: Add UI control section to prompt**

After the "Drawing Examples" section, add:

```
UI Control (Agent Takeover):
When you need to change the user's workspace before performing analysis, use control_ui. This gives you direct control of their interface — they'll see an animated cursor moving to and clicking controls on their screen.

When to use control_ui:
- User says "analyze NQ on 1 minute" and chart is on 1d -> control_ui(set_interval, "1m") first, then fetch data
- User says "show me the portfolio" -> control_ui(set_page, "portfolio")
- User says "switch to ES" -> control_ui(set_symbol, "ES=F")
- User says "open the strategy tester" -> control_ui(toggle_panel, "strategyTester")
- User says "draw a trendline" -> control_ui(set_drawing_tool, "trendline")

You can batch multiple actions: control_ui(actions=[{set_page: "trade"}, {set_interval: "1m"}])

IMPORTANT: Always provide a human-readable label for each action so the user knows what you're doing:
- label: "Switching to 1-minute chart"
- label: "Navigating to trade view"
- label: "Opening strategy tester"

Do NOT use control_ui for things that don't change visible controls (like fetching data or adding indicators — those have their own mechanisms).
```

**Step 3: Verify**

Run: `python3 -c "import py_compile; py_compile.compile('backend/agent/prompts.py', doraise=True); print('OK')"`

---

### Task 8: Final integration test and polish

**Step 1: Full build check**

Run: `npx tsc --noEmit && python3 -c "import py_compile; [py_compile.compile(f, doraise=True) for f in ['backend/agent/tools.py', 'backend/agent/agent_runner.py', 'backend/agent/prompts.py', 'backend/routers/chat_stream.py']]; print('All OK')"`

**Step 2: Verify SSE event flow manually**

Check that the `ui_action` SSE event is yielded from `agent_runner.py` by reading through the tool result tracking logic. The flow should be:

1. Agent calls `control_ui` tool
2. `handle_control_ui` returns JSON with `ui_actions` array
3. Agent runner detects `tool_name == "control_ui"` and yields `SSEEvent(event="ui_action", data=...)`
4. Frontend `useAgentStream` parses the `ui_action` event and adds to `uiActions` state
5. `page.tsx` useEffect detects new uiActions and calls `agentControl.enqueueActions()`
6. `useAgentControl` activates overlay, animates cursor, executes actions
7. `AgentControlOverlay` renders the glass + cursor + highlights + status pill

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add Alphy agent control mode with frosted glass overlay

When Alphy needs to manipulate UI controls (change interval, navigate
pages, toggle panels), a frosted glass overlay drops over the window
and an animated cursor moves to and clicks the target control.

- New control_ui backend tool for agent to emit UI actions
- New ui_action SSE event type for real-time control streaming
- AgentControlOverlay component with glass tint, animated cursor, status pill
- useAgentControl hook for action queuing and sequential execution
- data-agent-target attributes on interval, page, and panel controls"
```
