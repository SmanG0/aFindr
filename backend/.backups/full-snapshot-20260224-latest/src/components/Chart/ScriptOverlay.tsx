/**
 * ScriptOverlay — renders chart script elements on the lightweight-charts canvas.
 *
 * Handles all 7 element types:
 *   line   → imperative LineSeries via ref Map
 *   hline  → SVG full-width line + price label
 *   vline  → SVG full-height line + time label
 *   box    → positioned div
 *   marker → native createSeriesMarkers API
 *   label  → SVG rect + text
 *   shade  → positioned div full chart height
 */

"use client";

import { useEffect, useRef, useState } from "react";
import {
  LineSeries,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
  type Time,
  type ISeriesMarkersPluginApi,
  LineStyle,
} from "lightweight-charts";
import type { ChartScriptResult, ScriptLine } from "@/lib/chart-scripts";

interface ScriptOverlayProps {
  results: ChartScriptResult[];
  chartApi: IChartApi | null;
  seriesApi: ISeriesApi<"Candlestick"> | null;
  theme: "dark" | "light";
}

function getLineStyle(style?: string): LineStyle {
  switch (style) {
    case "dashed": return LineStyle.Dashed;
    case "dotted": return LineStyle.Dotted;
    default: return LineStyle.Solid;
  }
}

function getSvgDashArray(style?: string): string {
  switch (style) {
    case "dashed": return "6,3";
    case "dotted": return "2,2";
    default: return "";
  }
}

export default function ScriptOverlay({
  results,
  chartApi,
  seriesApi,
  theme,
}: ScriptOverlayProps) {
  // Refs for imperatively managed series
  const lineSeriesRef = useRef<Map<string, ISeriesApi<"Line">>>(new Map());
  const markersPluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const [, setTick] = useState(0); // force re-render on range change

  // Subscribe to visible range changes for coordinate recalculation
  useEffect(() => {
    if (!chartApi) return;

    let rafId: number | null = null;
    const handler = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        setTick((t) => t + 1);
      });
    };

    chartApi.timeScale().subscribeVisibleLogicalRangeChange(handler);
    return () => {
      try {
        chartApi.timeScale().unsubscribeVisibleLogicalRangeChange(handler);
      } catch { /* chart disposed */ }
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [chartApi]);

  // ─── Manage LineSeries imperatively ───
  useEffect(() => {
    if (!chartApi) return;
    const chart = chartApi;

    // Bail if chart is disposed
    try { chart.chartElement(); } catch { return; }

    // Collect all lines from all results
    const allLines = new Map<string, ScriptLine>();
    for (const r of results) {
      for (const line of r.lines) {
        allLines.set(line.id, line);
      }
    }

    // Remove series that no longer exist
    const currentIds = lineSeriesRef.current;
    for (const [id, series] of currentIds) {
      if (!allLines.has(id)) {
        try { chart.removeSeries(series); } catch { /* */ }
        currentIds.delete(id);
      }
    }

    // Add or update series
    for (const [id, line] of allLines) {
      const data = line.data.map((d) => ({
        time: d.time as UTCTimestamp,
        value: d.value,
      }));

      let series = currentIds.get(id);
      if (!series) {
        try {
          series = chart.addSeries(LineSeries, {
            color: line.color ?? "#3b82f6",
            lineWidth: (line.width ?? 2) as 1 | 2 | 3 | 4,
            lineStyle: getLineStyle(line.style),
            lastValueVisible: false,
            priceLineVisible: false,
            crosshairMarkerVisible: false,
          });
          currentIds.set(id, series);
        } catch { continue; } // chart disposed mid-loop
      }
      try { series.setData(data); } catch { /* disposed */ }
    }
  }, [chartApi, results]);

  // ─── Manage Markers ───
  useEffect(() => {
    if (!seriesApi) return;

    if (markersPluginRef.current) {
      markersPluginRef.current.detach();
      markersPluginRef.current = null;
    }

    const allMarkers = results.flatMap((r) =>
      r.markers.map((m) => ({
        time: m.time as UTCTimestamp,
        position: (m.position ?? "aboveBar") as "aboveBar" | "belowBar" | "inBar",
        shape: (m.shape ?? "circle") as "arrowUp" | "arrowDown" | "circle" | "square",
        color: m.color ?? "#3b82f6",
        text: m.text ?? "",
      })),
    );

    if (allMarkers.length > 0) {
      allMarkers.sort((a, b) => (a.time as number) - (b.time as number));
      markersPluginRef.current = createSeriesMarkers(seriesApi, allMarkers);
    }
  }, [seriesApi, results]);

  // Cleanup on unmount
  useEffect(() => {
    const lineMap = lineSeriesRef.current;
    const markersPlugin = markersPluginRef.current;
    return () => {
      if (chartApi) {
        for (const [, series] of lineMap) {
          try { chartApi.removeSeries(series); } catch { /* */ }
        }
        lineMap.clear();
      }
      if (markersPlugin) {
        markersPlugin.detach();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!chartApi || !seriesApi) return null;

  const isLight = theme === "light";

  // ─── Compute SVG coordinates ───
  // Deduplicate by id (last write wins) to prevent React duplicate-key warnings
  const dedup = <T extends { id: string }>(items: T[]): T[] =>
    [...new Map(items.map((i) => [i.id, i])).values()];

  const allHLines = dedup(results.flatMap((r) => r.hlines));
  const allVLines = dedup(results.flatMap((r) => r.vlines));
  const allBoxes = dedup(results.flatMap((r) => r.boxes));
  const allLabels = dedup(results.flatMap((r) => r.labels));
  const allShades = dedup(results.flatMap((r) => r.shades));


  // Get chart element dimensions — bail if chart is disposed
  let chartWidth = 0;
  let chartHeight = 0;
  let plotAreaHeight = 0;
  try {
    const el = chartApi.chartElement();
    chartWidth = el.clientWidth;
    chartHeight = el.clientHeight;
    // lightweight-charts: the first canvas represents the plot area (excludes time axis)
    const canvas = el.querySelector("canvas");
    plotAreaHeight = canvas ? canvas.clientHeight : chartHeight;
  } catch {
    // Chart is disposed — render nothing
    return null;
  }

  if (chartWidth === 0 || chartHeight === 0) return null;

  return (
    <>
      {/* SVG overlay for hlines, vlines, labels */}
      <svg
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: chartWidth,
          height: plotAreaHeight,
          pointerEvents: "none",
          zIndex: 30,
        }}
      >
        {/* Horizontal lines */}
        {allHLines.map((hl) => {
          try {
          const y = seriesApi.priceToCoordinate(hl.price);
          if (y === null) return null;
          const color = hl.color ?? (isLight ? "#666" : "#888");
          const labelWidth = hl.label ? hl.label.length * 6.5 + 8 : 0;
          const labelX = chartWidth - labelWidth - 6;
          return (
            <g key={hl.id}>
              <line
                x1={0}
                y1={y}
                x2={chartWidth}
                y2={y}
                stroke={color}
                strokeWidth={hl.width ?? 1}
                strokeDasharray={getSvgDashArray(hl.style)}
              />
              {hl.label && (
                <>
                  <rect
                    x={labelX}
                    y={y - 8}
                    width={labelWidth}
                    height={16}
                    rx={3}
                    fill={isLight ? "rgba(255,255,255,0.9)" : "rgba(30,30,34,0.9)"}
                    stroke={color}
                    strokeWidth={0.5}
                  />
                  <text
                    x={labelX + 4}
                    y={y + 4}
                    fontSize={10}
                    fontFamily="var(--font-mono)"
                    fontWeight={600}
                    fill={color}
                  >
                    {hl.label}
                  </text>
                </>
              )}
            </g>
          );
          } catch { return null; }
        })}

        {/* Vertical lines */}
        {allVLines.map((vl) => {
          let x: number | null = null;
          try {
            x = chartApi.timeScale().timeToCoordinate(vl.time as UTCTimestamp);
          } catch { /* */ }
          if (x === null) return null;
          const color = vl.color ?? (isLight ? "#666" : "#888");
          return (
            <g key={vl.id}>
              <line
                x1={x}
                y1={0}
                x2={x}
                y2={plotAreaHeight}
                stroke={color}
                strokeWidth={vl.width ?? 1}
                strokeDasharray={getSvgDashArray(vl.style)}
              />
              {vl.label && (
                <>
                  <rect
                    x={x + 4}
                    y={plotAreaHeight - 20}
                    width={vl.label.length * 6 + 8}
                    height={16}
                    rx={3}
                    fill={isLight ? "rgba(255,255,255,0.9)" : "rgba(30,30,34,0.9)"}
                    stroke={color}
                    strokeWidth={0.5}
                  />
                  <text
                    x={x + 8}
                    y={plotAreaHeight - 8}
                    fontSize={9}
                    fontFamily="var(--font-mono)"
                    fontWeight={600}
                    fill={color}
                  >
                    {vl.label}
                  </text>
                </>
              )}
            </g>
          );
        })}

        {/* Labels */}
        {allLabels.map((lb) => {
          let x: number | null = null;
          try {
            x = chartApi.timeScale().timeToCoordinate(lb.time as UTCTimestamp);
          } catch { /* */ }
          const y = seriesApi.priceToCoordinate(lb.price);
          if (x === null || y === null) return null;
          const color = lb.color ?? (isLight ? "#333" : "#ddd");
          const bg = lb.background ?? (isLight ? "rgba(255,255,255,0.9)" : "rgba(30,30,34,0.9)");
          const fontSize = lb.fontSize ?? 10;
          const textWidth = lb.text.length * fontSize * 0.6 + 12;
          return (
            <g key={lb.id}>
              <rect
                x={x - 2}
                y={y - fontSize / 2 - 4}
                width={textWidth}
                height={fontSize + 8}
                rx={3}
                fill={bg}
                stroke={color}
                strokeWidth={0.5}
              />
              <text
                x={x + 4}
                y={y + fontSize / 2 - 1}
                fontSize={fontSize}
                fontFamily="var(--font-mono)"
                fontWeight={500}
                fill={color}
              >
                {lb.text}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Boxes (positioned divs) */}
      {allBoxes.map((box) => {
        try {
        let x1: number | null = null;
        let x2: number | null = null;
        try {
          x1 = chartApi.timeScale().timeToCoordinate(box.timeStart as UTCTimestamp);
          x2 = chartApi.timeScale().timeToCoordinate(box.timeEnd as UTCTimestamp);
        } catch { /* */ }
        const y1 = seriesApi.priceToCoordinate(box.priceHigh);
        const y2 = seriesApi.priceToCoordinate(box.priceLow);
        if (x1 === null || x2 === null || y1 === null || y2 === null) return null;

        const left = Math.min(x1, x2);
        const top = Math.min(y1, y2);
        const width = Math.abs(x2 - x1);
        const height = Math.abs(y2 - y1);
        const color = box.color ?? "#3b82f6";
        const opacity = box.opacity ?? 0.15;

        return (
          <div
            key={box.id}
            style={{
              position: "absolute",
              left,
              top,
              width,
              height,
              background: color,
              opacity,
              border: `1px solid ${color}`,
              borderRadius: 2,
              pointerEvents: "none",
              zIndex: 30,
            }}
          >
            {box.label && (
              <span
                style={{
                  position: "absolute",
                  top: 2,
                  left: 4,
                  fontSize: 9,
                  fontFamily: "var(--font-mono)",
                  fontWeight: 600,
                  color,
                  opacity: 1 / opacity, // counteract parent opacity
                }}
              >
                {box.label}
              </span>
            )}
          </div>
        );
        } catch { return null; }
      })}

      {/* Shades (full-height time regions) */}
      {allShades.map((shade) => {
        try {
        let x1: number | null = null;
        let x2: number | null = null;
        try {
          x1 = chartApi.timeScale().timeToCoordinate(shade.timeStart as UTCTimestamp);
          x2 = chartApi.timeScale().timeToCoordinate(shade.timeEnd as UTCTimestamp);
        } catch { /* */ }
        if (x1 === null || x2 === null) return null;

        const left = Math.min(x1, x2);
        const width = Math.abs(x2 - x1);
        const color = shade.color ?? "#3b82f6";
        const opacity = shade.opacity ?? 0.08;

        return (
          <div
            key={shade.id}
            style={{
              position: "absolute",
              left,
              top: 0,
              width,
              height: plotAreaHeight,
              background: color,
              opacity,
              pointerEvents: "none",
              zIndex: 8,
            }}
          >
            {shade.label && (
              <span
                style={{
                  position: "absolute",
                  top: 4,
                  left: 4,
                  fontSize: 9,
                  fontFamily: "var(--font-mono)",
                  fontWeight: 600,
                  color,
                  opacity: 1 / opacity,
                }}
              >
                {shade.label}
              </span>
            )}
          </div>
        );
        } catch { return null; }
      })}
    </>
  );
}
