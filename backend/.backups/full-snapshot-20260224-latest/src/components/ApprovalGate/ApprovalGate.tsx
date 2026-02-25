"use client";

import React, { useState } from "react";
import type { IterationResult } from "@/hooks/useIterativeLoop";

interface ApprovalGateProps {
  current: IterationResult;
  previous?: IterationResult;
  iterationNumber: number;
  maxIterations: number;
  onApprove: () => void;
  onReject: (feedback: string) => void;
  isLoading?: boolean;
}

/**
 * Approval gate modal for the iterative agent loop.
 * Shows strategy summary, metrics delta vs previous iteration,
 * Monte Carlo grade, and approve/reject buttons.
 */
export default function ApprovalGate({
  current,
  previous,
  iterationNumber,
  maxIterations,
  onApprove,
  onReject,
  isLoading = false,
}: ApprovalGateProps) {
  const [feedback, setFeedback] = useState("");
  const [showCode, setShowCode] = useState(false);

  const metrics = current.metrics;
  const prevMetrics = previous?.metrics;
  const mcRaw = current.monteCarlo;
  const robustnessGrade = (mcRaw?.robustnessGrade ?? "") as string;
  const robustnessScore = (mcRaw?.robustnessScore ?? 0) as number;
  const probabilityOfRuin = (mcRaw?.probabilityOfRuin ?? mcRaw?.probability_of_ruin ?? 0) as number;
  const probabilityOfProfit = (mcRaw?.probabilityOfProfit ?? mcRaw?.probability_of_profit ?? 0) as number;

  const getDelta = (key: string): { value: number; improved: boolean } | null => {
    if (!prevMetrics || !metrics[key] || !prevMetrics[key]) return null;
    const delta = metrics[key] - prevMetrics[key];
    // For drawdown metrics, lower is better
    const improved =
      key.includes("drawdown") || key.includes("loss") || key.includes("ruin")
        ? delta < 0
        : delta > 0;
    return { value: delta, improved };
  };

  const metricRows: { label: string; key: string; format: (v: number) => string }[] = [
    { label: "Sharpe Ratio", key: "sharpe_ratio", format: (v) => v.toFixed(2) },
    { label: "Profit Factor", key: "profit_factor", format: (v) => v.toFixed(2) },
    { label: "Win Rate", key: "win_rate", format: (v) => `${(v * 100).toFixed(1)}%` },
    { label: "Total Return", key: "total_return", format: (v) => `$${v.toFixed(0)}` },
    { label: "Max Drawdown", key: "max_drawdown_pct", format: (v) => `${v.toFixed(1)}%` },
    { label: "Sortino Ratio", key: "sortino_ratio", format: (v) => v.toFixed(2) },
    { label: "Total Trades", key: "total_trades", format: (v) => String(v) },
    { label: "Expectancy", key: "expectancy", format: (v) => `$${v.toFixed(0)}` },
  ];

  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{
        backgroundColor: "var(--bg-secondary)",
        borderColor: "var(--border-secondary)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: "var(--border-secondary)" }}
      >
        <div className="flex items-center gap-3">
          <span
            className="text-sm font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            Iteration {iterationNumber} / {maxIterations}
          </span>
          {robustnessGrade && (
            <span
              className="px-2 py-0.5 rounded text-xs font-bold"
              style={{
                backgroundColor:
                  robustnessGrade.startsWith("A")
                    ? "rgba(34,197,94,0.2)"
                    : robustnessGrade.startsWith("B")
                    ? "rgba(59,130,246,0.2)"
                    : robustnessGrade.startsWith("C")
                    ? "rgba(234,179,8,0.2)"
                    : "rgba(239,68,68,0.2)",
                color:
                  robustnessGrade.startsWith("A")
                    ? "#22c55e"
                    : robustnessGrade.startsWith("B")
                    ? "#3b82f6"
                    : robustnessGrade.startsWith("C")
                    ? "#eab308"
                    : "#ef4444",
              }}
            >
              {robustnessGrade}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowCode(!showCode)}
          className="text-xs px-2 py-1 rounded"
          style={{
            border: "1px solid var(--border-secondary)",
            color: "var(--text-secondary)",
          }}
        >
          {showCode ? "Metrics" : "Code"}
        </button>
      </div>

      {/* Strategy Info */}
      <div className="px-4 py-2 border-b" style={{ borderColor: "var(--border-secondary)" }}>
        <div className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
          {current.strategyName}
        </div>
        <div className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>
          {current.strategyDescription}
        </div>
      </div>

      {/* Content */}
      {showCode ? (
        <pre
          className="p-3 text-xs font-mono overflow-auto max-h-64"
          style={{
            backgroundColor: "var(--bg-primary)",
            color: "var(--text-secondary)",
          }}
        >
          {current.code}
        </pre>
      ) : (
        <div className="p-3">
          {/* Metrics Grid */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            {metricRows.map(({ label, key, format }) => {
              const value = metrics[key];
              const delta = getDelta(key);
              return (
                <div key={key} className="flex items-center justify-between">
                  <span
                    className="text-xs"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {label}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="text-xs font-mono"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {value !== undefined ? format(value) : "N/A"}
                    </span>
                    {delta && (
                      <span
                        className="text-[10px] font-mono"
                        style={{
                          color: delta.improved ? "#22c55e" : "#ef4444",
                        }}
                      >
                        {delta.value > 0 ? "+" : ""}
                        {key.includes("pct") || key === "win_rate"
                          ? `${(delta.value * (key === "win_rate" ? 100 : 1)).toFixed(1)}%`
                          : delta.value.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Monte Carlo Summary */}
          {mcRaw && (
            <div
              className="mt-3 pt-3 border-t grid grid-cols-3 gap-2"
              style={{ borderColor: "var(--border-secondary)" }}
            >
              <div className="flex flex-col">
                <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                  P(Ruin)
                </span>
                <span
                  className="text-xs font-mono"
                  style={{
                    color: probabilityOfRuin > 10 ? "#ef4444" : "var(--text-primary)",
                  }}
                >
                  {probabilityOfRuin.toFixed(1)}%
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                  P(Profit)
                </span>
                <span className="text-xs font-mono" style={{ color: "var(--text-primary)" }}>
                  {probabilityOfProfit.toFixed(1)}%
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                  Robustness
                </span>
                <span className="text-xs font-mono" style={{ color: "var(--text-primary)" }}>
                  {robustnessScore}/100
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div
        className="px-4 py-3 border-t flex items-center gap-3"
        style={{ borderColor: "var(--border-secondary)" }}
      >
        <div className="flex-1">
          <input
            type="text"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Feedback for next iteration..."
            className="w-full text-xs px-3 py-1.5 rounded outline-none"
            style={{
              backgroundColor: "var(--bg-primary)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-secondary)",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && feedback.trim()) {
                onReject(feedback);
                setFeedback("");
              }
            }}
          />
        </div>
        <button
          onClick={() => {
            onReject(feedback || "Improve the strategy");
            setFeedback("");
          }}
          disabled={isLoading}
          className="text-xs px-3 py-1.5 rounded font-medium"
          style={{
            backgroundColor: "rgba(239,68,68,0.15)",
            color: "#ef4444",
            opacity: isLoading ? 0.5 : 1,
          }}
        >
          Reject
        </button>
        <button
          onClick={onApprove}
          disabled={isLoading}
          className="text-xs px-4 py-1.5 rounded font-medium"
          style={{
            backgroundColor: "var(--accent)",
            color: "var(--bg-primary)",
            opacity: isLoading ? 0.5 : 1,
          }}
        >
          Approve
        </button>
      </div>
    </div>
  );
}
