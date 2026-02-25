"use client";

import React, { useState, useMemo } from "react";
import type { HeatmapData } from "@/lib/types";

interface HeatmapTabProps {
  data: HeatmapData;
}

/**
 * SVG heatmap for 2-parameter sweep results.
 * X-axis and Y-axis are parameter values, color intensity = metric value.
 * Click a cell to see full metrics for that combination.
 */
export default function HeatmapTab({ data }: HeatmapTabProps) {
  const [selectedCell, setSelectedCell] = useState<{
    x: number;
    y: number;
    value: number;
    metrics: Record<string, number>;
  } | null>(null);

  const { xValues, yValues, cells, xParam, yParam, metric } = data;

  // Build cell lookup — must be before early return (hooks can't be conditional)
  const cellMap = useMemo(() => {
    const map = new Map<string, (typeof cells)[0]>();
    for (const cell of cells) {
      map.set(`${cell.x}_${cell.y}`, cell);
    }
    return map;
  }, [cells]);

  if (!cells.length || !xValues.length || !yValues.length) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ height: "100%", color: "var(--text-muted)", fontSize: 12, fontFamily: "var(--font-mono)" }}
      >
        No heatmap data — run a parameter sweep first
      </div>
    );
  }

  // Compute color scale bounds
  const values = cells.map((c) => c.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  // Layout
  const cellWidth = 60;
  const cellHeight = 40;
  const labelWidth = 80;
  const labelHeight = 30;
  const svgWidth = labelWidth + xValues.length * cellWidth + 20;
  const svgHeight = labelHeight + yValues.length * cellHeight + 40;

  const getColor = (value: number): string => {
    const t = (value - minVal) / range;
    // Red (bad) -> Yellow -> Green (good)
    if (t < 0.5) {
      const r = 220;
      const g = Math.round(60 + t * 2 * 180);
      const b = 60;
      return `rgb(${r},${g},${b})`;
    } else {
      const r = Math.round(220 - (t - 0.5) * 2 * 180);
      const g = 200;
      const b = 60;
      return `rgb(${r},${g},${b})`;
    }
  };

  return (
    <div className="flex flex-col gap-3 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <span
            className="text-xs font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            Parameter Heatmap
          </span>
          <span
            className="text-xs ml-2"
            style={{ color: "var(--text-tertiary)" }}
          >
            {xParam} x {yParam} | Metric: {metric}
          </span>
        </div>
        <span
          className="text-xs"
          style={{ color: "var(--text-tertiary)" }}
        >
          {cells.length} combinations
        </span>
      </div>

      {/* SVG Heatmap */}
      <div className="overflow-auto">
        <svg
          width={svgWidth}
          height={svgHeight}
          style={{ fontFamily: "monospace" }}
        >
          {/* X-axis labels */}
          {xValues.map((xVal, xi) => (
            <text
              key={`xl-${xi}`}
              x={labelWidth + xi * cellWidth + cellWidth / 2}
              y={labelHeight - 5}
              textAnchor="middle"
              fontSize={10}
              fill="var(--text-secondary)"
            >
              {xVal}
            </text>
          ))}

          {/* X-axis title */}
          <text
            x={labelWidth + (xValues.length * cellWidth) / 2}
            y={12}
            textAnchor="middle"
            fontSize={11}
            fill="var(--text-primary)"
            fontWeight="500"
          >
            {xParam}
          </text>

          {/* Y-axis labels */}
          {yValues.map((yVal, yi) => (
            <text
              key={`yl-${yi}`}
              x={labelWidth - 8}
              y={labelHeight + yi * cellHeight + cellHeight / 2 + 4}
              textAnchor="end"
              fontSize={10}
              fill="var(--text-secondary)"
            >
              {yVal}
            </text>
          ))}

          {/* Y-axis title */}
          <text
            x={10}
            y={labelHeight + (yValues.length * cellHeight) / 2}
            textAnchor="middle"
            fontSize={11}
            fill="var(--text-primary)"
            fontWeight="500"
            transform={`rotate(-90, 10, ${
              labelHeight + (yValues.length * cellHeight) / 2
            })`}
          >
            {yParam}
          </text>

          {/* Cells */}
          {xValues.map((xVal, xi) =>
            yValues.map((yVal, yi) => {
              const cell = cellMap.get(`${xVal}_${yVal}`);
              if (!cell) return null;

              const isSelected =
                selectedCell?.x === xVal && selectedCell?.y === yVal;

              return (
                <g key={`cell-${xi}-${yi}`}>
                  <rect
                    x={labelWidth + xi * cellWidth}
                    y={labelHeight + yi * cellHeight}
                    width={cellWidth - 1}
                    height={cellHeight - 1}
                    fill={getColor(cell.value)}
                    opacity={0.8}
                    stroke={isSelected ? "var(--accent)" : "var(--bg-primary)"}
                    strokeWidth={isSelected ? 2 : 0.5}
                    rx={2}
                    style={{ cursor: "pointer" }}
                    onClick={() => setSelectedCell(cell)}
                  />
                  <text
                    x={labelWidth + xi * cellWidth + cellWidth / 2}
                    y={labelHeight + yi * cellHeight + cellHeight / 2 + 4}
                    textAnchor="middle"
                    fontSize={9}
                    fill="#000"
                    fontWeight="500"
                    style={{ pointerEvents: "none" }}
                  >
                    {cell.value.toFixed(2)}
                  </text>
                </g>
              );
            })
          )}

          {/* Color scale legend */}
          <defs>
            <linearGradient id="heatmap-gradient" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="rgb(220,60,60)" />
              <stop offset="50%" stopColor="rgb(220,240,60)" />
              <stop offset="100%" stopColor="rgb(40,200,60)" />
            </linearGradient>
          </defs>
          <rect
            x={labelWidth}
            y={svgHeight - 18}
            width={xValues.length * cellWidth}
            height={8}
            fill="url(#heatmap-gradient)"
            rx={2}
          />
          <text
            x={labelWidth}
            y={svgHeight - 4}
            fontSize={9}
            fill="var(--text-tertiary)"
          >
            {minVal.toFixed(2)}
          </text>
          <text
            x={labelWidth + xValues.length * cellWidth}
            y={svgHeight - 4}
            fontSize={9}
            fill="var(--text-tertiary)"
            textAnchor="end"
          >
            {maxVal.toFixed(2)}
          </text>
        </svg>
      </div>

      {/* Selected cell details */}
      {selectedCell && (
        <div
          className="p-3 rounded border"
          style={{
            backgroundColor: "var(--bg-secondary)",
            borderColor: "var(--border-secondary)",
          }}
        >
          <div className="flex items-center gap-3 mb-2">
            <span
              className="text-xs font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              {xParam}={selectedCell.x}, {yParam}={selectedCell.y}
            </span>
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: "var(--accent-bg)",
                color: "var(--accent)",
              }}
            >
              {metric}: {selectedCell.value.toFixed(4)}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(selectedCell.metrics)
              .filter(([k]) => !k.startsWith("params") && !k.startsWith("error"))
              .slice(0, 12)
              .map(([key, value]) => (
                <div key={key} className="flex flex-col">
                  <span
                    className="text-[10px]"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {key.replace(/_/g, " ")}
                  </span>
                  <span
                    className="text-xs font-mono"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {typeof value === "number" ? value.toFixed(2) : String(value)}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
