"use client";

import { motion } from "framer-motion";
import type { BacktestMetrics } from "@/lib/types";

interface BacktestResultsProps {
  metrics: BacktestMetrics | null;
  strategyName?: string;
}

function MetricCell({
  label,
  value,
  color,
  index = 0,
}: {
  label: string;
  value: string;
  color?: string;
  index?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.025, duration: 0.2 }}
      className="px-3 py-2"
      style={{ borderRight: "1px solid var(--border-subtle)" }}
    >
      <div
        className="text-[9px] uppercase tracking-widest mb-0.5"
        style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
      >
        {label}
      </div>
      <div
        className="text-[13px] font-semibold tabular-nums"
        style={{
          color: color || "var(--text-primary)",
          fontFamily: "var(--font-mono)",
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>
    </motion.div>
  );
}

export default function BacktestResults({
  metrics,
  strategyName,
}: BacktestResultsProps) {
  if (!metrics) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2" style={{ color: "var(--text-muted)" }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.3 }}>
          <path d="M3 3v18h18" />
          <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
        </svg>
        <p className="text-[11px] font-mono">Run a strategy to see results</p>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* Strategy name banner */}
      {strategyName && (
        <div
          className="px-3 py-1.5 text-[10px] font-mono font-medium truncate"
          style={{
            color: "var(--accent-bright)",
            borderBottom: "1px solid var(--border-subtle)",
            background: "var(--accent-muted)",
          }}
        >
          {strategyName}
        </div>
      )}

      {/* Bloomberg-style metric grid — single horizontal row */}
      <div
        className="flex overflow-x-auto"
        style={{ borderBottom: "1px solid var(--divider)" }}
      >
        <MetricCell
          label="Trades"
          value={metrics.totalTrades.toString()}
          index={0}
        />
        <MetricCell
          label="Win Rate"
          value={`${(metrics.winRate * 100).toFixed(1)}%`}
          color={metrics.winRate >= 0.5 ? "var(--buy)" : "var(--sell)"}
          index={1}
        />
        <MetricCell
          label="Net P/L"
          value={`${metrics.totalReturn >= 0 ? "+" : ""}$${metrics.totalReturn.toFixed(0)}`}
          color={metrics.totalReturn >= 0 ? "var(--buy)" : "var(--sell)"}
          index={2}
        />
        <MetricCell
          label="Return"
          value={`${metrics.totalReturnPct >= 0 ? "+" : ""}${metrics.totalReturnPct.toFixed(1)}%`}
          color={metrics.totalReturnPct >= 0 ? "var(--buy)" : "var(--sell)"}
          index={3}
        />
        <MetricCell
          label="Max DD"
          value={`$${metrics.maxDrawdown.toFixed(0)}`}
          color="var(--sell)"
          index={4}
        />
        <MetricCell
          label="Profit Factor"
          value={metrics.profitFactor === Infinity ? "\u221e" : metrics.profitFactor.toFixed(2)}
          color={metrics.profitFactor >= 1.5 ? "var(--buy)" : "var(--text-secondary)"}
          index={5}
        />
        <MetricCell
          label="Sharpe"
          value={metrics.sharpeRatio.toFixed(2)}
          color={metrics.sharpeRatio >= 1 ? "var(--buy)" : "var(--text-secondary)"}
          index={6}
        />
      </div>

      {/* Secondary metrics row */}
      <div className="flex overflow-x-auto">
        <MetricCell
          label="Avg Win"
          value={`$${metrics.avgWin.toFixed(0)}`}
          color="var(--buy)"
          index={7}
        />
        <MetricCell
          label="Avg Loss"
          value={`$${metrics.avgLoss.toFixed(0)}`}
          color="var(--sell)"
          index={8}
        />
        <MetricCell
          label="Max Wins"
          value={metrics.maxConsecutiveWins.toString()}
          index={9}
        />
        <MetricCell
          label="Max Losses"
          value={metrics.maxConsecutiveLosses.toString()}
          index={10}
        />
        <MetricCell
          label="DD %"
          value={`${metrics.maxDrawdownPct.toFixed(1)}%`}
          color="var(--sell)"
          index={11}
        />
        <MetricCell
          label="Loss Rate"
          value={`${(metrics.lossRate * 100).toFixed(1)}%`}
          index={12}
        />
      </div>
    </motion.div>
  );
}
