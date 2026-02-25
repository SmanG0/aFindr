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
}

export interface ToolResultEvent {
  run_id: string;
  tool_name: string;
  status: "success" | "error" | "denied";
  result?: Record<string, unknown>;
}

export interface ApprovalRequestEvent {
  run_id: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_use_id: string;
  message: string;
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
  duration_ms?: number;
  hit_max_rounds?: boolean;
}

export interface ErrorEvent {
  error: string;
  run_id?: string;
}

// ─── Tool Event (for UI display) ───

export interface ToolEvent {
  id: string;
  tool_name: string;
  status: "running" | "success" | "error" | "denied" | "pending_approval";
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
      setIsStreaming(true);

      // Create abort controller
      const controller = new AbortController();
      abortControllerRef.current = controller;

      let doneEvent: DoneEvent | null = null;

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
          }),
          signal: controller.signal,
        });

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
                      id: `${start.tool_name}_${Date.now()}`,
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
                      te.tool_name === res.tool_name && te.status === "running"
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
  };
}
