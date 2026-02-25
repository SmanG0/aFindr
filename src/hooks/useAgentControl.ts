/**
 * useAgentControl — orchestrates agent UI takeover.
 *
 * Receives UI action events from the agent stream, queues them,
 * and executes them sequentially with animated cursor movement.
 */

"use client";

import { useState, useCallback, useRef } from "react";

export interface UIAction {
  action: "set_interval" | "set_symbol" | "set_page" | "toggle_panel" | "set_drawing_tool" | "set_theme" | "open_section";
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
  setTheme?: (v: string) => void;
  openSection?: (v: string) => void;
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
      case "set_theme": return "settings-theme";
      case "open_section": return `page-${action.value}`;
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
      case "set_theme":
        handlers.setTheme?.(action.value);
        break;
      case "open_section":
        handlers.setCurrentPage(action.value);
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
