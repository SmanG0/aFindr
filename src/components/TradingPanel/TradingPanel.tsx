"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Trade, BacktestMetrics } from "@/lib/types";
import BacktestResults from "@/components/BacktestResults/BacktestResults";

interface TradingPanelProps {
  trades: Trade[];
  metrics: BacktestMetrics | null;
  equityCurve: { time: number; value: number }[];
  strategyName?: string;
}

type Tab = "results" | "trades" | "equity";

export default function TradingPanel({
  trades,
  metrics,
  equityCurve,
  strategyName,
}: TradingPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>("results");

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "results", label: "Overview" },
    { id: "trades", label: "Trades", count: trades.length || undefined },
    { id: "equity", label: "Equity" },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "var(--bg-raised)", borderTop: "1px solid var(--divider)" }}>
      {/* ─── Tab Bar (Hyperliquid style — minimal, bottom-border active indicator) ─── */}
      <div className="flex items-center h-9 px-2 gap-0 flex-shrink-0" style={{ borderBottom: "1px solid var(--divider)" }}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="relative h-9 px-3 text-[11px] font-medium transition-colors"
              style={{
                color: isActive ? "var(--text-primary)" : "var(--text-muted)",
                fontFamily: "var(--font-mono)",
              }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = "var(--text-secondary)"; }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = isActive ? "var(--text-primary)" : "var(--text-muted)"; }}
            >
              {isActive && (
                <motion.div
                  layoutId="trading-tab-indicator"
                  className="absolute bottom-0 left-1 right-1 h-[2px]"
                  style={{ background: "var(--accent)", borderRadius: "1px 1px 0 0" }}
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    className="text-[9px] px-1.5 py-0.5 rounded-full"
                    style={{
                      background: isActive ? "var(--accent-muted)" : "rgba(236,227,213,0.04)",
                      color: isActive ? "var(--accent-bright)" : "var(--text-muted)",
                    }}
                  >
                    {tab.count}
                  </span>
                )}
              </span>
            </button>
          );
        })}

        {/* Right side: Quick stats */}
        {metrics && (
          <div className="ml-auto flex items-center gap-4 pr-2">
            <div className="text-[10px] font-mono flex items-center gap-1.5">
              <span style={{ color: "var(--text-muted)" }}>P/L</span>
              <span
                className="font-semibold tabular-nums"
                style={{ color: metrics.totalReturn >= 0 ? "var(--buy)" : "var(--sell)" }}
              >
                {metrics.totalReturn >= 0 ? "+" : ""}${metrics.totalReturn.toFixed(0)}
              </span>
            </div>
            <div className="text-[10px] font-mono flex items-center gap-1.5">
              <span style={{ color: "var(--text-muted)" }}>WR</span>
              <span
                className="font-semibold tabular-nums"
                style={{ color: metrics.winRate >= 0.5 ? "var(--buy)" : "var(--sell)" }}
              >
                {(metrics.winRate * 100).toFixed(0)}%
              </span>
            </div>
            <div className="text-[10px] font-mono flex items-center gap-1.5">
              <span style={{ color: "var(--text-muted)" }}>Sharpe</span>
              <span className="tabular-nums" style={{ color: "var(--text-secondary)" }}>
                {metrics.sharpeRatio.toFixed(2)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ─── Tab Content ─── */}
      <div className="flex-1 overflow-y-auto overflow-x-auto">
        <AnimatePresence mode="wait">
          {activeTab === "results" && (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
            >
              <BacktestResults metrics={metrics} strategyName={strategyName} />
            </motion.div>
          )}

          {activeTab === "trades" && (
            <motion.div
              key="trades"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
            >
              {trades.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 gap-2" style={{ color: "var(--text-muted)" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.4 }}>
                    <path d="M3 3v18h18" />
                    <path d="M7 16l4-4 4 4 5-5" />
                  </svg>
                  <p className="text-[11px] font-mono">No trades yet</p>
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Side</th>
                      <th style={{ textAlign: "right" }}>Entry</th>
                      <th style={{ textAlign: "right" }}>Exit</th>
                      <th style={{ textAlign: "right" }}>Points</th>
                      <th style={{ textAlign: "right" }}>P/L</th>
                      <th style={{ textAlign: "right" }}>Comm</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.map((trade, index) => (
                      <motion.tr
                        key={trade.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.015 }}
                      >
                        <td className="tabular-nums" style={{ color: "var(--text-muted)" }}>{trade.id}</td>
                        <td>
                          <span className={trade.side === "long" ? "chip chip-buy" : "chip chip-sell"}>
                            {trade.side}
                          </span>
                        </td>
                        <td className="tabular-nums" style={{ textAlign: "right" }}>{trade.entryPrice.toFixed(2)}</td>
                        <td className="tabular-nums" style={{ textAlign: "right" }}>{trade.exitPrice.toFixed(2)}</td>
                        <td className="tabular-nums" style={{ textAlign: "right", color: trade.pnlPoints >= 0 ? "var(--buy)" : "var(--sell)" }}>
                          {trade.pnlPoints >= 0 ? "+" : ""}{trade.pnlPoints.toFixed(2)}
                        </td>
                        <td className="tabular-nums font-semibold" style={{ textAlign: "right", color: trade.pnl >= 0 ? "var(--buy)" : "var(--sell)" }}>
                          {trade.pnl >= 0 ? "+" : ""}${trade.pnl.toFixed(0)}
                        </td>
                        <td className="tabular-nums" style={{ textAlign: "right", color: "var(--text-muted)" }}>
                          ${trade.commission.toFixed(2)}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              )}
            </motion.div>
          )}

          {activeTab === "equity" && (
            <motion.div
              key="equity"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="p-3"
            >
              {equityCurve.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 gap-2" style={{ color: "var(--text-muted)" }}>
                  <p className="text-[11px] font-mono">No equity data yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span style={{ color: "var(--text-muted)" }}>
                      Equity · {equityCurve.length} pts
                    </span>
                    <span
                      className="font-semibold tabular-nums"
                      style={{
                        color:
                          equityCurve[equityCurve.length - 1]?.value >= equityCurve[0]?.value
                            ? "var(--buy)"
                            : "var(--sell)",
                      }}
                    >
                      ${equityCurve[equityCurve.length - 1]?.value.toFixed(0) ?? "0"}
                    </span>
                  </div>
                  {/* Equity curve bar visualization */}
                  <div className="h-20 flex items-end gap-px rounded-lg overflow-hidden glass-inset p-1.5">
                    {equityCurve.map((point, i) => {
                      const min = Math.min(...equityCurve.map((p) => p.value));
                      const max = Math.max(...equityCurve.map((p) => p.value));
                      const range = max - min || 1;
                      const height = ((point.value - min) / range) * 100;
                      return (
                        <motion.div
                          key={i}
                          className="flex-1 rounded-sm"
                          initial={{ height: 0 }}
                          animate={{ height: `${height}%` }}
                          transition={{ delay: i * 0.002, duration: 0.2 }}
                          style={{
                            background: point.value >= equityCurve[0].value
                              ? "var(--buy)"
                              : "var(--sell)",
                            opacity: 0.4,
                            minWidth: "1px",
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
