/**
 * useChartScripts — state management for chart script overlays.
 *
 * Persists scripts to localStorage + Convex, evaluates visible scripts
 * against candle data via useMemo.
 */

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useConvexUserId } from "@/components/ConvexClientProvider";
import type { Candle } from "@/lib/types";
import type { ChartScript, ChartScriptResult } from "@/lib/chart-scripts";
import { evaluateChartScript } from "@/lib/chart-scripts";

const STORAGE_KEY = "afindr_chart_scripts";

export function useChartScripts(candles: Candle[]) {
  const [scripts, setScripts] = useState<ChartScript[]>([]);

  // ─── Convex sync ───
  const { userId } = useConvexUserId();
  const convexScripts = useQuery(api.charts.listScripts, userId ? { userId } : "skip");
  const upsertScriptMut = useMutation(api.charts.upsertScript);
  const removeScriptMut = useMutation(api.charts.removeScript);

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

  // Convex reconciliation
  const convexReconciledRef = useRef(false);
  useEffect(() => {
    if (!userId || convexScripts === undefined || convexReconciledRef.current) return;
    convexReconciledRef.current = true;
    if (convexScripts && convexScripts.length > 0) {
      // Convex has data → map to ChartScript[], update localStorage
      const mapped: ChartScript[] = convexScripts.map((cs) => ({
        id: cs.scriptId,
        name: cs.name,
        visible: cs.visible,
        elements: JSON.parse(cs.elementsJson),
        generators: JSON.parse(cs.generatorsJson),
      }));
      setScripts(mapped);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(mapped)); } catch { /* ignore */ }
    } else {
      // Convex empty → seed individual scripts from localStorage
      const current = scripts;
      for (const s of current) {
        upsertScriptMut({
          userId,
          scriptId: s.id,
          name: s.name,
          visible: s.visible,
          elementsJson: JSON.stringify(s.elements),
          generatorsJson: JSON.stringify(s.generators),
        });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, convexScripts]);

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
      // Replace if same ID exists
      const existsIdx = prev.findIndex((s) => s.id === script.id);
      if (existsIdx >= 0) {
        const next = [...prev];
        next[existsIdx] = script;
        return next;
      }

      // Deduplicate by generator types: if new script has generators matching
      // an existing script's generators, replace the old one (handles color/style updates).
      // Also clean up the replaced script from Convex.
      if (script.generators.length > 0) {
        const newGenTypes = new Set(script.generators.map((g) => g.type));
        const matchIdx = prev.findIndex((s) =>
          s.generators.length > 0 &&
          s.generators.length === script.generators.length &&
          s.generators.every((g) => newGenTypes.has(g.type))
        );
        if (matchIdx >= 0) {
          // Remove old script from Convex if IDs differ
          const oldId = prev[matchIdx].id;
          if (oldId !== script.id && userId) {
            removeScriptMut({ userId, scriptId: oldId });
          }
          const next = [...prev];
          next[matchIdx] = script;
          return next;
        }
      }

      // Deduplicate by name: if new script has the same name as an existing one,
      // treat it as an update (covers element-only scripts like pattern detections)
      const nameMatchIdx = prev.findIndex((s) => s.name === script.name);
      if (nameMatchIdx >= 0) {
        const oldId = prev[nameMatchIdx].id;
        if (oldId !== script.id && userId) {
          removeScriptMut({ userId, scriptId: oldId });
        }
        const next = [...prev];
        next[nameMatchIdx] = script;
        return next;
      }

      return [...prev, script];
    });
    // Dual-write to Convex
    if (userId) {
      upsertScriptMut({
        userId,
        scriptId: script.id,
        name: script.name,
        visible: script.visible,
        elementsJson: JSON.stringify(script.elements),
        generatorsJson: JSON.stringify(script.generators),
      });
    }
  }, [userId, upsertScriptMut, removeScriptMut]);

  const removeScript = useCallback((id: string) => {
    setScripts((prev) => prev.filter((s) => s.id !== id));
    if (userId) {
      removeScriptMut({ userId, scriptId: id });
    }
  }, [userId, removeScriptMut]);

  const toggleScript = useCallback((id: string) => {
    setScripts((prev) => {
      const updated = prev.map((s) => (s.id === id ? { ...s, visible: !s.visible } : s));
      // Dual-write the toggled script to Convex
      const toggled = updated.find((s) => s.id === id);
      if (userId && toggled) {
        upsertScriptMut({
          userId,
          scriptId: toggled.id,
          name: toggled.name,
          visible: toggled.visible,
          elementsJson: JSON.stringify(toggled.elements),
          generatorsJson: JSON.stringify(toggled.generators),
        });
      }
      return updated;
    });
  }, [userId, upsertScriptMut]);

  const clearAllScripts = useCallback(() => {
    // Remove each from Convex
    if (userId) {
      for (const s of scripts) {
        removeScriptMut({ userId, scriptId: s.id });
      }
    }
    setScripts([]);
  }, [userId, scripts, removeScriptMut]);

  const updateScriptByName = useCallback((name: string, updates: Record<string, string>) => {
    const validStyle = updates.style as "solid" | "dashed" | "dotted" | undefined;
    setScripts(prev => prev.map(s => {
      if (!s.name.toLowerCase().includes(name.toLowerCase())) return s;
      const updated = { ...s };
      updated.elements = s.elements.map(el => ({
        ...el,
        ...(updates.color && { color: updates.color }),
        ...(updates.width && { width: Number(updates.width) }),
        ...(validStyle && { style: validStyle }),
        ...(updates.opacity && { opacity: Number(updates.opacity) }),
      })) as typeof s.elements;
      updated.generators = s.generators.map(gen => ({
        ...gen,
        ...(updates.color && { color: updates.color }),
        ...(updates.width && { width: Number(updates.width) }),
        ...(validStyle && { style: validStyle }),
      })) as typeof s.generators;
      // Dual-write to Convex
      if (userId) {
        upsertScriptMut({
          userId,
          scriptId: updated.id,
          name: updated.name,
          visible: updated.visible,
          elementsJson: JSON.stringify(updated.elements),
          generatorsJson: JSON.stringify(updated.generators),
        });
      }
      return updated;
    }));
  }, [userId, upsertScriptMut]);

  const deleteScriptByName = useCallback((name: string) => {
    setScripts(prev => {
      const match = prev.find(s => s.name.toLowerCase().includes(name.toLowerCase()));
      if (match) {
        if (userId) removeScriptMut({ userId, scriptId: match.id });
        return prev.filter(s => s.id !== match.id);
      }
      return prev;
    });
  }, [userId, removeScriptMut]);

  return {
    scripts,
    scriptResults,
    addScript,
    removeScript,
    toggleScript,
    clearAllScripts,
    updateScriptByName,
    deleteScriptByName,
  };
}
