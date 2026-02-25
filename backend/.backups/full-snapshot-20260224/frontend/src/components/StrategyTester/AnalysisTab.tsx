"use client";

import type { TradeAnalysisResult } from "@/lib/types";

interface AnalysisTabProps {
  result: TradeAnalysisResult | null;
}

export default function AnalysisTab({ result }: AnalysisTabProps) {
  if (!result) {
    return (
      <div className="flex items-center justify-center" style={{ height: "100%", color: "var(--text-muted)", fontSize: 12, fontFamily: "var(--font-mono)" }}>
        No trade analysis — run a backtest to see pattern analysis
      </div>
    );
  }

  const maxHourPnl = Math.max(...result.bestEntryHours.map(h => Math.abs(h.avgPnl)), 1);
  const maxDayPnl = Math.max(...result.bestEntryDays.map(d => Math.abs(d.avgPnl)), 1);

  return (
    <div style={{ overflow: "auto", height: "100%", padding: "8px 12px", display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Best Entry Hours */}
      <div>
        <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", fontFamily: "var(--font-mono)", marginBottom: 6 }}>
          Best Entry Hours ({result.totalTradesAnalyzed} trades)
        </div>
        <div style={{ display: "flex", gap: 2, alignItems: "end", height: 50 }}>
          {result.bestEntryHours.map((h) => {
            const barH = Math.max(2, (Math.abs(h.avgPnl) / maxHourPnl) * 50);
            const color = h.avgPnl >= 0 ? "var(--buy)" : "var(--sell)";
            return (
              <div key={h.hour} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, minWidth: 0 }} title={`Hour ${h.hour}: Avg PnL $${h.avgPnl.toFixed(0)}, WR ${(h.winRate * 100).toFixed(0)}%, ${h.tradeCount} trades`}>
                <div style={{ width: "100%", maxWidth: 14, height: barH, background: color, borderRadius: "2px 2px 0 0", opacity: 0.7 }} />
                <span style={{ fontSize: 8, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: 2 }}>{h.hour}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Best Entry Days */}
      <div>
        <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", fontFamily: "var(--font-mono)", marginBottom: 6 }}>
          Best Entry Days
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "end", height: 50 }}>
          {result.bestEntryDays.map((d) => {
            const barH = Math.max(2, (Math.abs(d.avgPnl) / maxDayPnl) * 50);
            const color = d.avgPnl >= 0 ? "var(--buy)" : "var(--sell)";
            return (
              <div key={d.dayName} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }} title={`${d.dayName}: Avg PnL $${d.avgPnl.toFixed(0)}, WR ${(d.winRate * 100).toFixed(0)}%, ${d.tradeCount} trades`}>
                <div style={{ width: "100%", maxWidth: 24, height: barH, background: color, borderRadius: "2px 2px 0 0", opacity: 0.7 }} />
                <span style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: 2 }}>{d.dayName.slice(0, 3)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* MAE/MFE Comparison */}
      <div>
        <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", fontFamily: "var(--font-mono)", marginBottom: 6 }}>
          Winners vs Losers
        </div>
        <div style={{ display: "flex", gap: 24 }}>
          <div>
            <div style={{ fontSize: 10, color: "var(--buy)", fontFamily: "var(--font-mono)", marginBottom: 4, fontWeight: 600 }}>WINNERS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, fontFamily: "var(--font-mono)" }}>
              <div style={{ color: "var(--text-secondary)" }}>Avg MAE: <span className="tabular-nums" style={{ color: "var(--text-primary)" }}>${result.avgMaeWinners.toFixed(0)}</span></div>
              <div style={{ color: "var(--text-secondary)" }}>Avg MFE: <span className="tabular-nums" style={{ color: "var(--text-primary)" }}>${result.avgMfeWinners.toFixed(0)}</span></div>
              <div style={{ color: "var(--text-secondary)" }}>Avg Score: <span className="tabular-nums" style={{ color: "var(--text-primary)" }}>{result.avgScoreWinners.toFixed(2)}</span></div>
              <div style={{ color: "var(--text-secondary)" }}>Avg ATR: <span className="tabular-nums" style={{ color: "var(--text-primary)" }}>{result.avgAtrBeforeWinners.toFixed(2)}</span></div>
            </div>
          </div>
          <div style={{ width: 1, background: "var(--divider)" }} />
          <div>
            <div style={{ fontSize: 10, color: "var(--sell)", fontFamily: "var(--font-mono)", marginBottom: 4, fontWeight: 600 }}>LOSERS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, fontFamily: "var(--font-mono)" }}>
              <div style={{ color: "var(--text-secondary)" }}>Avg MAE: <span className="tabular-nums" style={{ color: "var(--text-primary)" }}>${result.avgMaeLosers.toFixed(0)}</span></div>
              <div style={{ color: "var(--text-secondary)" }}>Avg MFE: <span className="tabular-nums" style={{ color: "var(--text-primary)" }}>${result.avgMfeLosers.toFixed(0)}</span></div>
              <div style={{ color: "var(--text-secondary)" }}>Avg Score: <span className="tabular-nums" style={{ color: "var(--text-primary)" }}>{result.avgScoreLosers.toFixed(2)}</span></div>
              <div style={{ color: "var(--text-secondary)" }}>Avg ATR: <span className="tabular-nums" style={{ color: "var(--text-primary)" }}>{result.avgAtrBeforeLosers.toFixed(2)}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
