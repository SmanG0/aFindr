"use client";

import type { WalkForwardResult } from "@/lib/types";

interface WalkForwardTabProps {
  result: WalkForwardResult | null;
}

export default function WalkForwardTab({ result }: WalkForwardTabProps) {
  if (!result) {
    return (
      <div className="flex items-center justify-center" style={{ height: "100%", color: "var(--text-muted)", fontSize: 12, fontFamily: "var(--font-mono)" }}>
        No walk-forward analysis — ask Alphy to run walk-forward optimization
      </div>
    );
  }

  const robColor = result.robustnessRatio >= 0.5 ? "var(--buy)" : result.robustnessRatio >= 0.3 ? "var(--warning)" : "var(--sell)";

  return (
    <div style={{ overflow: "auto", height: "100%" }}>
      {/* Summary bar */}
      <div style={{ display: "flex", flexWrap: "wrap", borderBottom: "1px solid var(--divider)", background: "rgba(236,227,213,0.02)", padding: "4px 0" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "6px 12px" }}>
          <span style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", fontFamily: "var(--font-mono)" }}>Windows</span>
          <span className="tabular-nums" style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>{result.numWindows}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "6px 12px" }}>
          <span style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", fontFamily: "var(--font-mono)" }}>Robustness</span>
          <span className="tabular-nums" style={{ fontSize: 12, fontWeight: 600, color: robColor, fontFamily: "var(--font-mono)" }}>{result.robustnessRatio.toFixed(2)}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "6px 12px" }}>
          <span style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", fontFamily: "var(--font-mono)" }}>IS/OOS Ratio</span>
          <span className="tabular-nums" style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>{result.isRatio.toFixed(1)}</span>
        </div>
        {result.aggregateOosMetrics.total_return !== undefined && (
          <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "6px 12px" }}>
            <span style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", fontFamily: "var(--font-mono)" }}>OOS Return</span>
            <span className="tabular-nums" style={{ fontSize: 12, fontWeight: 600, color: result.aggregateOosMetrics.total_return >= 0 ? "var(--buy)" : "var(--sell)", fontFamily: "var(--font-mono)" }}>
              ${result.aggregateOosMetrics.total_return.toFixed(0)}
            </span>
          </div>
        )}
      </div>

      {/* Windows table */}
      <table className="data-table">
        <thead>
          <tr>
            <th>#</th>
            <th>IS Period</th>
            <th>OOS Period</th>
            <th style={{ textAlign: "right" }}>IS Bars</th>
            <th style={{ textAlign: "right" }}>OOS Bars</th>
            <th style={{ textAlign: "right" }}>IS Return</th>
            <th style={{ textAlign: "right" }}>OOS Return</th>
            <th style={{ textAlign: "right" }}>IS Sharpe</th>
            <th style={{ textAlign: "right" }}>OOS Sharpe</th>
          </tr>
        </thead>
        <tbody>
          {result.windows.map((w) => {
            const isReturn = w.isMetrics.total_return ?? w.isMetrics.totalReturn ?? 0;
            const oosReturn = w.oosMetrics.total_return ?? w.oosMetrics.totalReturn ?? 0;
            const isSharpe = w.isMetrics.sharpe_ratio ?? w.isMetrics.sharpeRatio ?? 0;
            const oosSharpe = w.oosMetrics.sharpe_ratio ?? w.oosMetrics.sharpeRatio ?? 0;
            return (
              <tr key={w.windowIndex}>
                <td style={{ color: "var(--text-primary)", fontWeight: 500 }}>{w.windowIndex + 1}</td>
                <td style={{ fontSize: 10 }}>{w.isStart} — {w.isEnd}</td>
                <td style={{ fontSize: 10 }}>{w.oosStart} — {w.oosEnd}</td>
                <td className="tabular-nums" style={{ textAlign: "right" }}>{w.isBars}</td>
                <td className="tabular-nums" style={{ textAlign: "right" }}>{w.oosBars}</td>
                <td className="tabular-nums" style={{ textAlign: "right", color: isReturn >= 0 ? "var(--buy)" : "var(--sell)" }}>
                  ${isReturn.toFixed(0)}
                </td>
                <td className="tabular-nums" style={{ textAlign: "right", color: oosReturn >= 0 ? "var(--buy)" : "var(--sell)", fontWeight: 600 }}>
                  ${oosReturn.toFixed(0)}
                </td>
                <td className="tabular-nums" style={{ textAlign: "right" }}>{isSharpe.toFixed(2)}</td>
                <td className="tabular-nums" style={{ textAlign: "right" }}>{oosSharpe.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
