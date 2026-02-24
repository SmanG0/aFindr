import { useState, useCallback } from "react";

export interface IterationResult {
  iteration: number;
  strategyName: string;
  strategyDescription: string;
  code: string;
  parameters: Record<string, unknown>;
  metrics: Record<string, number>;
  monteCarlo: Record<string, unknown> | null;
  feedback: string | null;
  status: "pending" | "approved" | "rejected";
  timestamp: number;
}

export interface IterativeSession {
  sessionId: string;
  userPrompt: string;
  symbol: string;
  interval: string;
  currentIteration: number;
  maxIterations: number;
  status: "running" | "awaiting_approval" | "completed" | "failed";
  targetMetric: string;
  targetValue: number;
  iterations: IterationResult[];
  createdAt: number;
}

interface UseIterativeLoopReturn {
  session: IterativeSession | null;
  isLoading: boolean;
  error: string | null;
  start: (params: StartParams) => Promise<void>;
  approve: () => Promise<void>;
  reject: (feedback?: string) => Promise<void>;
  nextIteration: () => Promise<void>;
}

interface StartParams {
  prompt: string;
  symbol?: string;
  period?: string;
  interval?: string;
  initialBalance?: number;
  maxIterations?: number;
  targetMetric?: string;
  targetValue?: number;
}

const API_BASE = "/api/iterations";

function transformSession(raw: Record<string, unknown>): IterativeSession {
  const iterations = (raw.iterations as Record<string, unknown>[]) || [];
  return {
    sessionId: raw.session_id as string,
    userPrompt: raw.user_prompt as string,
    symbol: raw.symbol as string,
    interval: raw.interval as string,
    currentIteration: raw.current_iteration as number,
    maxIterations: raw.max_iterations as number,
    status: raw.status as IterativeSession["status"],
    targetMetric: raw.target_metric as string,
    targetValue: raw.target_value as number,
    createdAt: raw.created_at as number,
    iterations: iterations.map((it) => ({
      iteration: it.iteration as number,
      strategyName: it.strategy_name as string,
      strategyDescription: it.strategy_description as string,
      code: it.code as string,
      parameters: (it.parameters as Record<string, unknown>) || {},
      metrics: (it.metrics as Record<string, number>) || {},
      monteCarlo: (it.monte_carlo as Record<string, unknown>) || null,
      feedback: (it.feedback as string) || null,
      status: it.status as IterationResult["status"],
      timestamp: it.timestamp as number,
    })),
  };
}

export function useIterativeLoop(): UseIterativeLoopReturn {
  const [session, setSession] = useState<IterativeSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async (params: StartParams) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: params.prompt,
          symbol: params.symbol || "NQ=F",
          period: params.period || "1y",
          interval: params.interval || "1d",
          initial_balance: params.initialBalance || 25000,
          max_iterations: params.maxIterations || 5,
          target_metric: params.targetMetric || "sharpe_ratio",
          target_value: params.targetValue || 1.5,
        }),
      });
      if (!res.ok) throw new Error(`Start failed: ${res.statusText}`);
      const data = await res.json();
      setSession(transformSession(data));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const approve = useCallback(async () => {
    if (!session) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/${session.sessionId}/approve`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`Approve failed: ${res.statusText}`);
      const data = await res.json();
      setSession(transformSession(data));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  const reject = useCallback(
    async (feedback: string = "") => {
      if (!session) return;
      setIsLoading(true);
      try {
        const res = await fetch(`${API_BASE}/${session.sessionId}/reject`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ feedback }),
        });
        if (!res.ok) throw new Error(`Reject failed: ${res.statusText}`);
        const data = await res.json();
        setSession(transformSession(data));
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setIsLoading(false);
      }
    },
    [session]
  );

  const nextIteration = useCallback(async () => {
    if (!session) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/${session.sessionId}/next`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`Next failed: ${res.statusText}`);
      const data = await res.json();
      setSession(transformSession(data));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  return { session, isLoading, error, start, approve, reject, nextIteration };
}
