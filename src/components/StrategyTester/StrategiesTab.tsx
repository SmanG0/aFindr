"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchStrategies, fetchStrategy } from "@/lib/api";
import type { StrategySummary } from "@/lib/api";

interface StrategiesTabProps {
  onLoadStrategy: (data: Record<string, unknown>) => void;
}

export default function StrategiesTab({ onLoadStrategy }: StrategiesTabProps) {
  const [strategies, setStrategies] = useState<StrategySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingFile, setLoadingFile] = useState<string | null>(null);

  useEffect(() => {
    fetchStrategies()
      .then((res) => setStrategies(res.strategies))
      .catch(() => setStrategies([]))
      .finally(() => setLoading(false));
  }, []);

  const handleLoad = useCallback(async (filename: string) => {
    setLoadingFile(filename);
    try {
      const data = await fetchStrategy(filename);
      onLoadStrategy(data);
    } catch (err) {
      console.error("Failed to load strategy:", err);
    } finally {
      setLoadingFile(null);
    }
  }, [onLoadStrategy]);

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height: "100%", color: "var(--text-muted)", fontSize: 12, fontFamily: "var(--font-mono)" }}>
        Loading strategies...
      </div>
    );
  }

  if (strategies.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height: "100%", color: "var(--text-muted)", fontSize: 12, fontFamily: "var(--font-mono)" }}>
        No saved strategies — ask Alphy to backtest a strategy to save it
      </div>
    );
  }

  return (
    <div style={{ overflow: "auto", height: "100%" }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Symbol</th>
            <th>Interval</th>
            <th>Date</th>
            <th>Features</th>
            <th style={{ textAlign: "center" }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {strategies.map((s) => (
            <tr key={s.filename}>
              <td>
                <div style={{ color: "var(--text-primary)", fontWeight: 500 }}>{s.name}</div>
                {s.description && <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>{s.description.slice(0, 60)}{s.description.length > 60 ? "..." : ""}</div>}
              </td>
              <td className="tabular-nums">{s.symbol}</td>
              <td>{s.interval}</td>
              <td style={{ fontSize: 10 }}>{s.date}</td>
              <td>
                <div style={{ display: "flex", gap: 4 }}>
                  {s.hasBacktest && <span className="chip chip-accent">BT</span>}
                  {s.hasMonteCarlo && <span className="chip chip-neutral">MC</span>}
                  {s.hasWalkForward && <span className="chip chip-neutral">WF</span>}
                </div>
              </td>
              <td style={{ textAlign: "center" }}>
                <button
                  onClick={() => handleLoad(s.filename)}
                  disabled={loadingFile === s.filename}
                  style={{
                    padding: "3px 10px",
                    borderRadius: 4,
                    fontSize: 10,
                    fontFamily: "var(--font-mono)",
                    fontWeight: 600,
                    background: "var(--accent-muted)",
                    color: "var(--accent-bright)",
                    border: "none",
                    cursor: loadingFile === s.filename ? "wait" : "pointer",
                    opacity: loadingFile === s.filename ? 0.5 : 1,
                    transition: "all 100ms ease",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--accent-glow)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "var(--accent-muted)"; }}
                >
                  {loadingFile === s.filename ? "Loading..." : "Load"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
