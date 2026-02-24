/**
 * useChartScripts — state management for chart script overlays.
 *
 * Persists scripts to localStorage, evaluates visible scripts
 * against candle data via useMemo.
 */

import { useState, useMemo, useCallback, useEffect } from "react";
import type { Candle } from "@/lib/types";
import type { ChartScript, ChartScriptResult } from "@/lib/chart-scripts";
import { evaluateChartScript } from "@/lib/chart-scripts";

const STORAGE_KEY = "afindr_chart_scripts";

export function useChartScripts(candles: Candle[]) {
  const [scripts, setScripts] = useState<ChartScript[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as ChartScript[];
        if (Array.isArray(parsed)) setScripts(parsed);
      }
    } catch {
      /* ignore corrupt data */
    }
  }, []);

  // Persist to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(scripts));
    } catch {
      /* ignore quota errors */
    }
  }, [scripts]);

  // Evaluate visible scripts against candles
  const scriptResults: ChartScriptResult[] = useMemo(() => {
    return scripts
      .filter((s) => s.visible)
      .map((s) => evaluateChartScript(s, candles));
  }, [scripts, candles]);

  const addScript = useCallback((script: ChartScript) => {
    setScripts((prev) => {
      // Replace if same ID exists, otherwise append
      const exists = prev.findIndex((s) => s.id === script.id);
      if (exists >= 0) {
        const next = [...prev];
        next[exists] = script;
        return next;
      }
      return [...prev, script];
    });
  }, []);

  const removeScript = useCallback((id: string) => {
    setScripts((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const toggleScript = useCallback((id: string) => {
    setScripts((prev) =>
      prev.map((s) => (s.id === id ? { ...s, visible: !s.visible } : s)),
    );
  }, []);

  const clearAllScripts = useCallback(() => {
    setScripts([]);
  }, []);

  return {
    scripts,
    scriptResults,
    addScript,
    removeScript,
    toggleScript,
    clearAllScripts,
  };
}
