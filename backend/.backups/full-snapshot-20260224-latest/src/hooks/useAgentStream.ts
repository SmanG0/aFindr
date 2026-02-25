/**
 * useAgentStream — SSE-based hook for streaming agent responses.
 *
 * Connects to POST /api/chat/stream and processes Server-Sent Events
 * in real-time: text tokens, tool execution, approval gates, results.
 *
 * This is the NEW streaming alternative to the blocking sendChatMessage().
 * The existing REST chat API is preserved and still works as fallback.
 *
 * NOTE: Added as part of the Agent SDK + SSE migration.
 *       Backup of original files: backend/.backups/pre-agent-sdk/
 *
 * Usage:
 *   const { streamMessage, streamingText, toolEvents, isStreaming, result } = useAgentStream();
 *   await streamMessage({ message: "Backtest RSI on NQ", symbol: "NQ=F" });
 *   // streamingText updates token-by-token
 *   // toolEvents shows tool execution status
 *   // result has the final ChatResponse-compatible payload
 */

import { useState, useCallback, useRef } from "react";

// ─── SSE Event Types (match backend agent_runner.py) ───

export interface TextDeltaEvent {
  text: string;
  run_id: string;
}

export interface ToolStartEvent {
  run_id: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_use_id?: string;
}

export interface ToolResultEvent {
  run_id: string;
  tool_name: string;
  tool_use_id?: string;
  status: "success" | "error" | "denied" | "timeout";
  result?: Record<string, unknown>;
  message?: string;
}

export interface ApprovalRequestEvent {
  run_id: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_use_id: string;
  message: string;
}

export interface TokenUsage {
  total_input_tokens: number;
  total_output_tokens: number;
  estimated_cost_usd: number;
  by_model?: Record<string, {
    input_tokens: number;
    output_tokens: number;
    estimated_cost_usd: number;
  }>;
}

export interface DoneEvent {
  run_id: string;
  message: string;
  strategy?: Record<string, unknown> | null;
  backtest_result?: Record<string, unknown> | null;
  pinescript?: Record<string, unknown> | null;
  monte_carlo?: Record<string, unknown> | null;
  walk_forward?: Record<string, unknown> | null;
  trade_analysis?: Record<string, unknown> | null;
  chart_script?: Record<string, unknown> | null;
  chart_scripts?: Record<string, unknown>[] | null;
  tool_data?: Record<string, unknown>[] | null;
  token_usage?: TokenUsage | null;
  duration_ms?: number;
  hit_max_rounds?: boolean;
}

export interface ErrorEvent {
  error: string;
  run_id?: string;
}

export interface UIActionEvent {
  run_id: string;
  actions: { action: string; value: string; label?: string }[];
}

export interface PositionActionEvent {
  run_id: string;
  actions: {
    action: "add" | "edit" | "remove" | "remove_all";
    symbol?: string;
    side?: string;
    size?: number;
    entry_price?: number | null;
    stop_loss?: number | null;
    take_profit?: number | null;
    updates?: Record<string, unknown>;
  }[];
}

export interface AlertActionEvent {
  run_id: string;
  actions: {
    action: "create" | "toggle" | "delete";
    type?: "price" | "news";
    symbol?: string;
    condition?: "above" | "below" | "crosses_above" | "crosses_below";
    targetPrice?: number;
    keywords?: string[];
    alertId?: string;
    active?: boolean;
  }[];
}

// ─── Tool Event (for UI display) ───

export interface ToolEvent {
  id: string;
  tool_name: string;
  status: "running" | "success" | "error" | "denied" | "timeout" | "pending_approval";
  input?: Record<string, unknown>;
  result?: Record<string, unknown>;
  timestamp: number;
}

// ─── Stream Request ───

export interface StreamChatRequest {
  message: string;
  symbol?: string;
  period?: string;
  interval?: string;
  initial_balance?: number;
  conversation_history?: { role: string; content: string }[];
  require_approval?: boolean;
  current_page?: string;
  news_headlines?: string[];
  active_scripts?: string[];
  user_profile?: {
    name?: string;
    experience?: string;
    tradingStyle?: string;
    analysisApproach?: string[];
    tradingGoals?: string[];
    markets?: string[];
    // AI memory profile fields (from Convex userMemory)
    profileSummary?: string;
    favoriteSymbols?: string[];
    strengths?: string[];
    weaknesses?: string[];
  };
  active_alerts?: {
    id: string;
    type: "price" | "news";
    symbol: string;
    condition?: string;
    targetPrice?: number;
    keywords?: string[];
    active: boolean;
  }[];
}

// ─── Hook Return ───

export interface UseAgentStreamReturn {
  /** Send a message and start streaming the response */
  streamMessage: (req: StreamChatRequest) => Promise<DoneEvent | null>;
  /** Text accumulated so far (updates token-by-token) */
  streamingText: string;
  /** Tool execution events (for showing tool cards in UI) */
  toolEvents: ToolEvent[];
  /** Whether the stream is currently active */
  isStreaming: boolean;
  /** The final done event (null until stream completes) */
  result: DoneEvent | null;
  /** Any error that occurred */
  error: string | null;
  /** Abort the current stream */
  abort: () => void;
  /** Pending approval request (null if none) */
  pendingApproval: ApprovalRequestEvent | null;
  /** UI action events from agent control_ui tool */
  uiActions: UIActionEvent[];
  /** Position action events from agent manage_holdings tool */
  positionActions: PositionActionEvent[];
  /** Alert action events from agent manage_alerts tool */
  alertActions: AlertActionEvent[];
  /** Live token usage (updates after each API round during streaming) */
  liveTokenUsage: TokenUsage | null;
}

const API_BASE = "/api/chat/stream";

export function useAgentStream(): UseAgentStreamReturn {
  const [streamingText, setStreamingText] = useState("");
  const [toolEvents, setToolEvents] = useState<ToolEvent[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [result, setResult] = useState<DoneEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingApproval, setPendingApproval] =
    useState<ApprovalRequestEvent | null>(null);
  const [uiActions, setUIActions] = useState<UIActionEvent[]>([]);
  const [positionActions, setPositionActions] = useState<PositionActionEvent[]>([]);
  const [alertActions, setAlertActions] = useState<AlertActionEvent[]>([]);
  const [liveTokenUsage, setLiveTokenUsage] = useState<TokenUsage | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const streamMessage = useCallback(
    async (req: StreamChatRequest): Promise<DoneEvent | null> => {
      // Reset state
      setStreamingText("");
      setToolEvents([]);
      setResult(null);
      setError(null);
      setPendingApproval(null);
      setUIActions([]);
      setPositionActions([]);
      setAlertActions([]);
      setLiveTokenUsage(null);
      setIsStreaming(true);

      // Create abort controller
      const controller = new AbortController();
      abortControllerRef.current = controller;

      let doneEvent: DoneEvent | null = null;

      // 30s timeout for initial connection — cleared once first byte arrives
      const connectionTimeoutId = setTimeout(() => controller.abort(), 30_000);

      try {
        const response = await fetch(API_BASE, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: req.message,
            symbol: req.symbol || "NQ=F",
            period: req.period || "1y",
            interval: req.interval || "1d",
            initial_balance: req.initial_balance || 25000,
            conversation_history: req.conversation_history || [],
            require_approval: req.require_approval || false,
            current_page: req.current_page || undefined,
            news_headlines: req.news_headlines || undefined,
            active_scripts: req.active_scripts || undefined,
            user_profile: req.user_profile || undefined,
            active_alerts: req.active_alerts || undefined,
          }),
          signal: controller.signal,
        });

        // First byte received — clear connection timeout
        clearTimeout(connectionTimeoutId);

        if (!response.ok) {
          throw new Error(`Stream failed: ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE events from buffer
          const events = buffer.split("\n\n");
          // Keep the last incomplete chunk in the buffer
          buffer = events.pop() || "";

          for (const eventBlock of events) {
            if (!eventBlock.trim()) continue;

            // Parse SSE format: "event: <type>\ndata: <json>"
            let eventType = "";
            let eventData = "";

            for (const line of eventBlock.split("\n")) {
              if (line.startsWith("event: ")) {
                eventType = line.slice(7);
              } else if (line.startsWith("data: ")) {
                eventData = line.slice(6);
              }
            }

            if (!eventType || !eventData) continue;

            try {
              const data = JSON.parse(eventData);

              switch (eventType) {
                case "text_delta": {
                  const delta = data as TextDeltaEvent;
                  setStreamingText((prev) => prev + delta.text);
                  break;
                }

                case "tool_start": {
                  const start = data as ToolStartEvent;
                  setToolEvents((prev) => [
                    ...prev,
                    {
                      id: start.tool_use_id || `${start.tool_name}_${Date.now()}`,
                      tool_name: start.tool_name,
                      status: "running",
                      input: start.tool_input,
                      timestamp: Date.now(),
                    },
                  ]);
                  break;
                }

                case "tool_result": {
                  const res = data as ToolResultEvent;
                  setToolEvents((prev) =>
                    prev.map((te) =>
                      // Match by tool_use_id when available, fall back to name+status
                      (res.tool_use_id && te.id === res.tool_use_id) ||
                      (!res.tool_use_id && te.tool_name === res.tool_name && te.status === "running")
                        ? { ...te, status: res.status, result: res.result }
                        : te
                    )
                  );
                  break;
                }

                case "approval_req": {
                  const approval = data as ApprovalRequestEvent;
                  setPendingApproval(approval);
                  setToolEvents((prev) => [
                    ...prev,
                    {
                      id: `${approval.tool_name}_approval_${Date.now()}`,
                      tool_name: approval.tool_name,
                      status: "pending_approval",
                      input: approval.tool_input,
                      timestamp: Date.now(),
                    },
                  ]);
                  break;
                }

                case "error": {
                  const err = data as ErrorEvent;
                  setError(err.error);
                  break;
                }

                case "ui_action": {
                  const uiAction = data as UIActionEvent;
                  setUIActions((prev) => [...prev, uiAction]);
                  break;
                }

                case "position_action": {
                  const posAction = data as PositionActionEvent;
                  setPositionActions((prev) => [...prev, posAction]);
                  break;
                }

                case "alert_action": {
                  const alertAction = data as AlertActionEvent;
                  setAlertActions((prev) => [...prev, alertAction]);
                  break;
                }

                case "token_update": {
                  const tu = data as TokenUsage & { run_id?: string };
                  setLiveTokenUsage({
                    total_input_tokens: tu.total_input_tokens,
                    total_output_tokens: tu.total_output_tokens,
                    estimated_cost_usd: tu.estimated_cost_usd,
                    by_model: tu.by_model,
                  });
                  break;
                }

                case "done": {
                  doneEvent = data as DoneEvent;
                  setResult(doneEvent);
                  break;
                }
              }
            } catch {
              // Skip malformed events
            }
          }
        }
      } catch (e) {
        clearTimeout(connectionTimeoutId);
        if ((e as Error).name !== "AbortError") {
          const errMsg = (e as Error).message || "Stream failed";
          setError(errMsg);
        }
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }

      return doneEvent;
    },
    []
  );

  return {
    streamMessage,
    streamingText,
    toolEvents,
    isStreaming,
    result,
    error,
    abort,
    pendingApproval,
    uiActions,
    positionActions,
    alertActions,
    liveTokenUsage,
  };
}
