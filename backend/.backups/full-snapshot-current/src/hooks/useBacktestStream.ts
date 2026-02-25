import { useState, useEffect, useCallback, useRef } from "react";

export interface BacktestProgress {
  type: "progress" | "complete" | "error" | "keepalive";
  runId: string;
  phase: string;
  progress: number;
  message?: string;
  data?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
}

interface UseBacktestStreamReturn {
  progress: BacktestProgress | null;
  isConnected: boolean;
  connect: (runId: string) => void;
  disconnect: () => void;
}

const WS_BASE =
  typeof window !== "undefined"
    ? `ws://${window.location.hostname}:8000`
    : "ws://localhost:8000";

export function useBacktestStream(): UseBacktestStreamReturn {
  const [progress, setProgress] = useState<BacktestProgress | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const disconnect = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const connect = useCallback(
    (runId: string) => {
      disconnect();

      const ws = new WebSocket(`${WS_BASE}/ws/backtest/${runId}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        // Keepalive ping every 20s
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send("ping");
          }
        }, 20000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "keepalive") return;
          setProgress(data as BacktestProgress);

          // Auto-disconnect on complete or error
          if (data.type === "complete" || data.type === "error") {
            setTimeout(() => disconnect(), 1000);
          }
        } catch {
          // Ignore non-JSON messages (like "pong")
        }
      };

      ws.onerror = () => {
        setIsConnected(false);
      };

      ws.onclose = () => {
        setIsConnected(false);
      };
    },
    [disconnect]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  return { progress, isConnected, connect, disconnect };
}
