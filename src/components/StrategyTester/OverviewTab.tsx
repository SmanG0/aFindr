"use client";

import type { BacktestMetrics } from "@/lib/types";

interface OverviewTabProps {
  metrics: BacktestMetrics | null;
  equityCurve: { time: number; value: number }[];
  strategyName: string;
}

function MetricCell({ label, value, color, suffix }: { label: string; value: string | number; color?: string; suffix?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "6px 12px", minWidth: 90 }}>
      <span style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", fontFamily: "var(--font-mono)" }}>{label}</span>
      <span className="tabular-nums" style={{ fontSize: 13, fontWeight: 600, color: color || "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
        {value}{suffix || ""}
      </span>
    </div>
  );
}

export default function OverviewTab({ metrics, equityCurve, strategyName }: OverviewTabProps) {
  if (!metrics) {
    return (
      <div className="flex items-center justify-center" style={{ height: "100%", color: "var(--text-muted)", fontSize: 12, fontFamily: "var(--font-mono)" }}>
        No backtest results — ask Alphy to run a backtest
      </div>
    );
  }

  const pnlColor = metrics.totalReturn >= 0 ? "var(--buy)" : "var(--sell)";
  const ddColor = "var(--sell)";

  // SVG equity curve
  const curvePoints = equityCurve.length > 0 ? (() => {
    const vals = equityCurve.map(e => e.value);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = max - min || 1;
    const w = 400;
    const h = 60;
    return vals.map((v, i) => `${(i / (vals.length - 1)) * w},${h - ((v - min) / range) * h}`).join(" ");
  })() : "";

  return (
    <div style={{ padding: "8px 0", overflow: "auto", height: "100%" }}>
      {strategyName && (
        <div style={{ padding: "0 12px 6px", fontSize: 11, color: "var(--text-secondary)", fontFamily: "var(--font-mono)", fontWeight: 600 }}>
          {strategyName}
        </div>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", borderBottom: "1px solid var(--divider)" }}>
        <MetricCell label="Total Trades" value={metrics.totalTrades} />
        <MetricCell label="Win Rate" value={`${(metrics.winRate * 100).toFixed(1)}%`} color={metrics.winRate >= 0.5 ? "var(--buy)" : "var(--sell)"} />
        <MetricCell label="Total Return" value={`$${metrics.totalReturn.toFixed(2)}`} color={pnlColor} />
        <MetricCell label="Return %" value={`${metrics.totalReturnPct.toFixed(2)}%`} color={pnlColor} />
        <MetricCell label="Max Drawdown" value={`$${Math.abs(metrics.maxDrawdown).toFixed(2)}`} color={ddColor} />
        <MetricCell label="Max DD %" value={`${Math.abs(metrics.maxDrawdownPct).toFixed(2)}%`} color={ddColor} />
        <MetricCell label="Profit Factor" value={metrics.profitFactor.toFixed(2)} color={metrics.profitFactor >= 1 ? "var(--buy)" : "var(--sell)"} />
        <MetricCell label="Sharpe" value={metrics.sharpeRatio.toFixed(2)} color={metrics.sharpeRatio >= 1 ? "var(--buy)" : "var(--text-secondary)"} />
        <MetricCell label="Avg Win" value={`$${metrics.avgWin.toFixed(2)}`} color="var(--buy)" />
        <MetricCell label="Avg Loss" value={`$${Math.abs(metrics.avgLoss).toFixed(2)}`} color="var(--sell)" />
        <MetricCell label="Consec Wins" value={metrics.maxConsecutiveWins} />
        <MetricCell label="Consec Losses" value={metrics.maxConsecutiveLosses} color="var(--sell)" />
        {metrics.sortinoRatio !== undefined && <MetricCell label="Sortino" value={metrics.sortinoRatio.toFixed(2)} />}
        {metrics.calmarRatio !== undefined && <MetricCell label="Calmar" value={metrics.calmarRatio.toFixed(2)} />}
        {metrics.recoveryFactor !== undefined && <MetricCell label="Recovery" value={metrics.recoveryFactor.toFixed(2)} />}
        {metrics.expectancy !== undefined && <MetricCell label="Expectancy" value={`$${metrics.expectancy.toFixed(2)}`} color={metrics.expectancy >= 0 ? "var(--buy)" : "var(--sell)"} />}
        {metrics.payoffRatio !== undefined && <MetricCell label="Payoff" value={metrics.payoffRatio.toFixed(2)} />}
      </div>

      {curvePoints && (
        <div style={{ padding: "8px 12px" }}>
          <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Equity Curve</div>
          <svg viewBox="0 0 400 60" style={{ width: "100%", maxWidth: 500, height: 60 }}>
            <defs>
              <linearGradient id="eq-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={metrics.totalReturn >= 0 ? "var(--buy)" : "var(--sell)"} stopOpacity="0.3" />
                <stop offset="100%" stopColor={metrics.totalReturn >= 0 ? "var(--buy)" : "var(--sell)"} stopOpacity="0.02" />
              </linearGradient>
            </defs>
            <polygon points={`0,60 ${curvePoints} 400,60`} fill="url(#eq-grad)" />
            <polyline points={curvePoints} fill="none" stroke={metrics.totalReturn >= 0 ? "var(--buy)" : "var(--sell)"} strokeWidth="1.5" />
          </svg>
        </div>
      )}
    </div>
  );
}
