"use client";

import React, { useState } from "react";
import type { IterationResult } from "@/hooks/useIterativeLoop";

interface RunLogProps {
  iterations: IterationResult[];
  onSelect?: (iteration: IterationResult) => void;
}

/**
 * Timeline of iterative agent iterations.
 * Shows timestamp, metrics delta, approval status, and expandable details + code.
 */
export default function RunLog({ iterations, onSelect }: RunLogProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (!iterations.length) {
    return (
      <div
        className="flex items-center justify-center h-32 text-xs"
        style={{ color: "var(--text-tertiary)" }}
      >
        No iterations yet
      </div>
    );
  }

  return (
    <div className="flex flex-col p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span
          className="text-xs font-medium"
          style={{ color: "var(--text-primary)" }}
        >
          Iteration History
        </span>
        <span
          className="text-xs"
          style={{ color: "var(--text-tertiary)" }}
        >
          {iterations.length} iteration{iterations.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Timeline */}
      <div className="flex flex-col gap-1">
        {iterations.map((iter, index) => {
          const isExpanded = expandedIndex === index;
          const prevIter = index > 0 ? iterations[index - 1] : null;
          const metrics = iter.metrics;
          const prevMetrics = prevIter?.metrics;

          const getMetricDelta = (key: string): string => {
            if (!prevMetrics || metrics[key] === undefined || prevMetrics[key] === undefined)
              return "";
            const delta = metrics[key] - prevMetrics[key];
            const sign = delta > 0 ? "+" : "";
            return `${sign}${delta.toFixed(2)}`;
          };

          const statusColor =
            iter.status === "approved"
              ? "#22c55e"
              : iter.status === "rejected"
              ? "#ef4444"
              : "var(--accent)";

          return (
            <div
              key={index}
              className="rounded border overflow-hidden"
              style={{
                borderColor:
                  isExpanded
                    ? "var(--accent)"
                    : "var(--border-secondary)",
                backgroundColor: "var(--bg-secondary)",
              }}
            >
              {/* Row header */}
              <button
                onClick={() => {
                  setExpandedIndex(isExpanded ? null : index);
                  if (onSelect && !isExpanded) onSelect(iter);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-left"
              >
                {/* Timeline dot */}
                <div className="flex flex-col items-center">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: statusColor }}
                  />
                  {index < iterations.length - 1 && (
                    <div
                      className="w-px h-4"
                      style={{ backgroundColor: "var(--border-secondary)" }}
                    />
                  )}
                </div>

                {/* Iteration number + name */}
                <div className="flex flex-col flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs font-medium"
                      style={{ color: "var(--text-primary)" }}
                    >
                      #{iter.iteration} {iter.strategyName}
                    </span>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor:
                          iter.status === "approved"
                            ? "rgba(34,197,94,0.15)"
                            : iter.status === "rejected"
                            ? "rgba(239,68,68,0.15)"
                            : "var(--accent-bg)",
                        color: statusColor,
                      }}
                    >
                      {iter.status}
                    </span>
                  </div>
                  <span
                    className="text-[10px] truncate"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {iter.strategyDescription}
                  </span>
                </div>

                {/* Key metrics */}
                <div className="flex items-center gap-4 shrink-0">
                  <div className="flex flex-col items-end">
                    <span
                      className="text-[10px]"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      Sharpe
                    </span>
                    <div className="flex items-center gap-1">
                      <span
                        className="text-xs font-mono"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {metrics.sharpe_ratio?.toFixed(2) ?? "N/A"}
                      </span>
                      {getMetricDelta("sharpe_ratio") && (
                        <span
                          className="text-[9px] font-mono"
                          style={{
                            color: getMetricDelta("sharpe_ratio").startsWith("+")
                              ? "#22c55e"
                              : "#ef4444",
                          }}
                        >
                          {getMetricDelta("sharpe_ratio")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span
                      className="text-[10px]"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      PF
                    </span>
                    <span
                      className="text-xs font-mono"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {metrics.profit_factor?.toFixed(2) ?? "N/A"}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span
                      className="text-[10px]"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      MC Grade
                    </span>
                    <span
                      className="text-xs font-mono font-bold"
                      style={{
                        color: iter.monteCarlo?.robustnessGrade
                          ? ((iter.monteCarlo.robustnessGrade as string).startsWith("A")
                              ? "#22c55e"
                              : (iter.monteCarlo.robustnessGrade as string).startsWith("B")
                              ? "#3b82f6"
                              : "#eab308")
                          : "var(--text-tertiary)",
                      }}
                    >
                      {(iter.monteCarlo?.robustnessGrade as string) ?? "-"}
                    </span>
                  </div>
                </div>
              </button>

              {/* Expanded details */}
              {isExpanded && (
                <div
                  className="border-t px-3 py-2"
                  style={{ borderColor: "var(--border-secondary)" }}
                >
                  {/* Full metrics grid */}
                  <div className="grid grid-cols-4 gap-x-4 gap-y-1 mb-2">
                    {Object.entries(metrics)
                      .filter(([k]) => typeof metrics[k] === "number")
                      .slice(0, 16)
                      .map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <span
                            className="text-[10px]"
                            style={{ color: "var(--text-tertiary)" }}
                          >
                            {key.replace(/_/g, " ")}
                          </span>
                          <span
                            className="text-[10px] font-mono"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            {typeof value === "number" ? value.toFixed(2) : String(value)}
                          </span>
                        </div>
                      ))}
                  </div>

                  {/* Feedback */}
                  {iter.feedback && (
                    <div
                      className="text-[10px] mt-1 px-2 py-1 rounded"
                      style={{
                        backgroundColor: "rgba(239,68,68,0.1)",
                        color: "#ef4444",
                      }}
                    >
                      Feedback: {iter.feedback}
                    </div>
                  )}

                  {/* Code preview */}
                  <details className="mt-2">
                    <summary
                      className="text-[10px] cursor-pointer"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      View Code
                    </summary>
                    <pre
                      className="mt-1 p-2 rounded text-[10px] font-mono overflow-auto max-h-48"
                      style={{
                        backgroundColor: "var(--bg-primary)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {iter.code}
                    </pre>
                  </details>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
