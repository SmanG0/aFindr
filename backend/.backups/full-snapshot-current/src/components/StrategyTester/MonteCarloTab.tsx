"use client";

import type { MonteCarloResult } from "@/lib/types";

interface MonteCarloTabProps {
  result: MonteCarloResult | null;
}

function StatCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "6px 12px", minWidth: 100 }}>
      <span style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", fontFamily: "var(--font-mono)" }}>{label}</span>
      <span className="tabular-nums" style={{ fontSize: 12, fontWeight: 600, color: color || "var(--text-primary)", fontFamily: "var(--font-mono)" }}>{value}</span>
    </div>
  );
}

export default function MonteCarloTab({ result }: MonteCarloTabProps) {
  if (!result) {
    return (
      <div className="flex items-center justify-center" style={{ height: "100%", color: "var(--text-muted)", fontSize: 12, fontFamily: "var(--font-mono)" }}>
        No Monte Carlo simulation — backtest first, then Alphy will run MC automatically
      </div>
    );
  }

  const { equityPercentiles: ep } = result;
  const tradeCount = ep.p50.length;

  // Build SVG fan chart
  const w = 600;
  const h = 200;
  const allVals = [...ep.p5, ...ep.p95];
  const minV = Math.min(...allVals);
  const maxV = Math.max(...allVals);
  const range = maxV - minV || 1;
  const toX = (i: number) => (i / (tradeCount - 1)) * w;
  const toY = (v: number) => h - ((v - minV) / range) * (h - 20) - 10;

  const makePath = (arr: number[]) => arr.map((v, i) => `${toX(i)},${toY(v)}`).join(" ");

  // Build area between two percentile lines
  const makeArea = (upper: number[], lower: number[]) => {
    const top = upper.map((v, i) => `${toX(i)},${toY(v)}`).join(" ");
    const bottom = [...lower].reverse().map((v, i) => `${toX(tradeCount - 1 - i)},${toY(v)}`).join(" ");
    return `${top} ${bottom}`;
  };

  return (
    <div style={{ overflow: "auto", height: "100%" }}>
      {/* Stats bar */}
      <div style={{ display: "flex", flexWrap: "wrap", borderBottom: "1px solid var(--divider)", background: "rgba(236,227,213,0.02)" }}>
        <StatCell label="Simulations" value={result.numSimulations.toLocaleString()} />
        <StatCell label="P(Ruin)" value={`${(result.probabilityOfRuin * 100).toFixed(1)}%`} color={result.probabilityOfRuin > 0.1 ? "var(--sell)" : "var(--buy)"} />
        <StatCell label="P(Profit)" value={`${(result.probabilityOfProfit * 100).toFixed(1)}%`} color={result.probabilityOfProfit >= 0.5 ? "var(--buy)" : "var(--sell)"} />
        <StatCell label="Mean Return" value={`$${result.meanReturn.toFixed(0)}`} color={result.meanReturn >= 0 ? "var(--buy)" : "var(--sell)"} />
        <StatCell label="Median Return" value={`$${result.medianReturn.toFixed(0)}`} color={result.medianReturn >= 0 ? "var(--buy)" : "var(--sell)"} />
        <StatCell label="Std Dev" value={`$${result.stdReturn.toFixed(0)}`} />
        <StatCell label="5th Pctile" value={`$${result.percentile5.toFixed(0)}`} color="var(--sell)" />
        <StatCell label="95th Pctile" value={`$${result.percentile95.toFixed(0)}`} color="var(--buy)" />
        <StatCell label="Worst DD" value={`$${Math.abs(result.worstMaxDrawdown).toFixed(0)}`} color="var(--sell)" />
      </div>

      {/* Fan chart */}
      {tradeCount > 1 && (
        <div style={{ padding: "8px 12px" }}>
          <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Equity Distribution ({tradeCount} trades, {result.numSimulations} sims)
          </div>
          <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: h }} preserveAspectRatio="none">
            {/* p5-p95 band (lightest) */}
            <polygon points={makeArea(ep.p95, ep.p5)} fill="rgba(59,130,246,0.08)" />
            {/* p25-p75 band (medium) */}
            <polygon points={makeArea(ep.p75, ep.p25)} fill="rgba(59,130,246,0.15)" />
            {/* p50 median line */}
            <polyline points={makePath(ep.p50)} fill="none" stroke="rgba(59,130,246,0.9)" strokeWidth="2" />
            {/* Zero line */}
            {minV < 0 && maxV > 0 && (
              <line x1="0" y1={toY(0)} x2={w} y2={toY(0)} stroke="rgba(236,227,213,0.15)" strokeWidth="0.5" strokeDasharray="4 4" />
            )}
          </svg>
          <div style={{ display: "flex", gap: 16, marginTop: 4, fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
            <span><span style={{ display: "inline-block", width: 10, height: 3, background: "rgba(59,130,246,0.08)", marginRight: 4, verticalAlign: "middle" }} />p5-p95</span>
            <span><span style={{ display: "inline-block", width: 10, height: 3, background: "rgba(59,130,246,0.15)", marginRight: 4, verticalAlign: "middle" }} />p25-p75</span>
            <span><span style={{ display: "inline-block", width: 10, height: 2, background: "rgba(59,130,246,0.9)", marginRight: 4, verticalAlign: "middle" }} />Median</span>
          </div>
        </div>
      )}
    </div>
  );
}
