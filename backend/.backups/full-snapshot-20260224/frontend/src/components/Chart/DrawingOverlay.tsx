"use client";

import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import type {
  Drawing,
  DrawingPoint,
  HLineDrawing,
  VLineDrawing,
  TrendLineDrawing,
  RayDrawing,
  ArrowDrawing,
  ExtendedLineDrawing,
  ChannelDrawing,
  RectangleDrawing,
  FibDrawing,
  MeasureDrawing,
  TextDrawing,
  RulerDrawing,
  BrushDrawing,
} from "@/hooks/useDrawings";
import type { IChartApi, ISeriesApi, UTCTimestamp } from "lightweight-charts";

// ─── Constants ───
const HIT_THRESHOLD = 8; // pixels
const HANDLE_SIZE = 4; // handle radius
const SELECTION_COLOR = "#2962FF";

// ─── Props ───
interface DrawingOverlayProps {
  drawings: Drawing[];
  chartApi: IChartApi | null;
  seriesApi: ISeriesApi<"Candlestick"> | null;
  pendingPoint: DrawingPoint | null;
  mousePoint: DrawingPoint | null;
  brushPoints?: DrawingPoint[];
  selectedId: string | null;
  activeTool?: string;
  onRemove?: (id: string) => void;
  onSelect?: (id: string | null) => void;
  onUpdate?: (id: string, updates: Partial<Drawing>) => void;
  onDoubleClick?: (drawing: Drawing, position: { x: number; y: number }) => void;
  theme?: "dark" | "light";
}

// ─── Coordinate Helpers ───

function pointToPixel(
  point: DrawingPoint,
  chart: IChartApi,
  series: ISeriesApi<"Candlestick">
): { x: number; y: number } | null {
  try {
    const x = chart.timeScale().timeToCoordinate(point.time as UTCTimestamp);
    const y = series.priceToCoordinate(point.price);
    if (x === null || y === null) return null;
    return { x, y };
  } catch {
    return null;
  }
}

function priceToY(price: number, series: ISeriesApi<"Candlestick">): number | null {
  try {
    return series.priceToCoordinate(price);
  } catch {
    return null;
  }
}

function pixelToPoint(
  px: number,
  py: number,
  chart: IChartApi,
  series: ISeriesApi<"Candlestick">
): DrawingPoint | null {
  try {
    const time = chart.timeScale().coordinateToTime(px);
    const price = series.coordinateToPrice(py);
    if (time === null || price === null) return null;
    return { time: time as number, price };
  } catch {
    return null;
  }
}

// ─── Hit Testing ───

function pointToLineDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function pointInRect(px: number, py: number, x1: number, y1: number, x2: number, y2: number): boolean {
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  return px >= minX && px <= maxX && py >= minY && py <= maxY;
}

// ─── SVG Style Helpers ───

function lineStyleToDash(style: string): string | undefined {
  switch (style) {
    case "dashed": return "8,4";
    case "dotted": return "2,4";
    default: return undefined;
  }
}

/** Extend a line from p1→p2 beyond the chart boundaries */
function extendLine(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  width: number,
  height: number,
  extendLeft: boolean,
  extendRight: boolean
): { x1: number; y1: number; x2: number; y2: number } {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  let x1 = p1.x, y1 = p1.y, x2 = p2.x, y2 = p2.y;

  if (dx === 0) {
    // Vertical line
    if (extendLeft) y1 = 0;
    if (extendRight) y2 = height;
    return { x1, y1, x2, y2 };
  }

  if (extendLeft) {
    const t = -p1.x / dx;
    x1 = 0;
    y1 = p1.y + t * dy;
  }
  if (extendRight) {
    const t = (width - p1.x) / dx;
    x2 = width;
    y2 = p1.y + t * dy;
  }

  return { x1, y1, x2, y2 };
}

// ─── Selection Handles ───

function SelectionHandles({
  points,
  selected,
  onHandleMouseDown,
}: {
  points: { x: number; y: number }[];
  selected: boolean;
  onHandleMouseDown?: (index: number, e: React.MouseEvent) => void;
}) {
  if (!selected) return null;
  return (
    <>
      {points.map((p, i) => (
        <rect
          key={i}
          x={p.x - HANDLE_SIZE}
          y={p.y - HANDLE_SIZE}
          width={HANDLE_SIZE * 2}
          height={HANDLE_SIZE * 2}
          fill="white"
          stroke={SELECTION_COLOR}
          strokeWidth={1.5}
          style={{ cursor: "crosshair" }}
          onMouseDown={(e) => {
            e.stopPropagation();
            onHandleMouseDown?.(i, e);
          }}
        />
      ))}
    </>
  );
}

// ─── Individual Drawing Renderers ───

function HLineRenderer({
  drawing, series, width, selected, onHandleMouseDown,
}: {
  drawing: HLineDrawing;
  series: ISeriesApi<"Candlestick">;
  width: number;
  selected: boolean;
  onHandleMouseDown?: (index: number, e: React.MouseEvent) => void;
}) {
  const y = priceToY(drawing.price, series);
  if (y === null) return null;

  return (
    <g>
      <line x1={0} y1={y} x2={width} y2={y}
        stroke={drawing.color} strokeWidth={drawing.lineWidth || 1.5}
        strokeDasharray={lineStyleToDash(drawing.lineStyle) || "6 3"}
        opacity={0.8} />
      {/* Price label */}
      <rect x={width - 70} y={y - 9} width={62} height={18} rx={3}
        fill={drawing.color} opacity={0.9} />
      <text x={width - 39} y={y + 4} textAnchor="middle" fill="white"
        fontSize={9} fontFamily="'JetBrains Mono', monospace" fontWeight={600}>
        {drawing.price.toFixed(2)}
      </text>
      {selected && (
        <line x1={0} y1={y} x2={width} y2={y}
          stroke={SELECTION_COLOR} strokeWidth={1} strokeDasharray="4,4" opacity={0.5} />
      )}
      <SelectionHandles
        points={[{ x: width / 4, y }, { x: width * 3 / 4, y }]}
        selected={selected}
        onHandleMouseDown={onHandleMouseDown}
      />
    </g>
  );
}

function VLineRenderer({
  drawing, chart, height, selected, onHandleMouseDown,
}: {
  drawing: VLineDrawing;
  chart: IChartApi;
  height: number;
  selected: boolean;
  onHandleMouseDown?: (index: number, e: React.MouseEvent) => void;
}) {
  let x: number | null = null;
  try {
    x = chart.timeScale().timeToCoordinate(drawing.time as UTCTimestamp);
  } catch { /* */ }
  if (x === null) return null;

  return (
    <g>
      <line x1={x} y1={0} x2={x} y2={height}
        stroke={drawing.color} strokeWidth={drawing.lineWidth || 1.5}
        strokeDasharray={lineStyleToDash(drawing.lineStyle) || "6 3"}
        opacity={0.8} />
      {selected && (
        <line x1={x} y1={0} x2={x} y2={height}
          stroke={SELECTION_COLOR} strokeWidth={1} strokeDasharray="4,4" opacity={0.5} />
      )}
      <SelectionHandles
        points={[{ x, y: height / 4 }, { x, y: height * 3 / 4 }]}
        selected={selected}
        onHandleMouseDown={onHandleMouseDown}
      />
    </g>
  );
}

function TwoPointLineRenderer({
  drawing, chart, series, width, height, selected, onHandleMouseDown, arrowHead,
}: {
  drawing: TrendLineDrawing | RayDrawing | ArrowDrawing | ExtendedLineDrawing;
  chart: IChartApi;
  series: ISeriesApi<"Candlestick">;
  width: number;
  height: number;
  selected: boolean;
  onHandleMouseDown?: (index: number, e: React.MouseEvent) => void;
  arrowHead?: boolean;
}) {
  const p1 = pointToPixel(drawing.start, chart, series);
  const p2 = pointToPixel(drawing.end, chart, series);
  if (!p1 || !p2) return null;

  const ext = extendLine(p1, p2, width, height, drawing.extendLeft, drawing.extendRight);

  // Arrow marker ID
  const markerId = arrowHead ? `arrow-${drawing.id}` : undefined;

  return (
    <g>
      {arrowHead && (
        <defs>
          <marker id={markerId} markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill={drawing.color} />
          </marker>
        </defs>
      )}
      <line x1={ext.x1} y1={ext.y1} x2={ext.x2} y2={ext.y2}
        stroke={drawing.color} strokeWidth={drawing.lineWidth || 1.5}
        strokeDasharray={lineStyleToDash(drawing.lineStyle)}
        opacity={0.85}
        markerEnd={arrowHead ? `url(#${markerId})` : undefined}
      />
      {/* End points */}
      <circle cx={p1.x} cy={p1.y} r={3} fill={drawing.color} />
      <circle cx={p2.x} cy={p2.y} r={3} fill={drawing.color} />
      {selected && (
        <line x1={ext.x1} y1={ext.y1} x2={ext.x2} y2={ext.y2}
          stroke={SELECTION_COLOR} strokeWidth={1} strokeDasharray="4,4" opacity={0.4} />
      )}
      <SelectionHandles
        points={[p1, p2]}
        selected={selected}
        onHandleMouseDown={onHandleMouseDown}
      />
    </g>
  );
}

function ChannelRenderer({
  drawing, chart, series, selected, onHandleMouseDown,
}: {
  drawing: ChannelDrawing;
  chart: IChartApi;
  series: ISeriesApi<"Candlestick">;
  selected: boolean;
  onHandleMouseDown?: (index: number, e: React.MouseEvent) => void;
}) {
  const p1 = pointToPixel(drawing.start, chart, series);
  const p2 = pointToPixel(drawing.end, chart, series);
  const p1b = pointToPixel({ time: drawing.start.time, price: drawing.start.price + drawing.offset }, chart, series);
  const p2b = pointToPixel({ time: drawing.end.time, price: drawing.end.price + drawing.offset }, chart, series);
  if (!p1 || !p2 || !p1b || !p2b) return null;

  const fillOpacity = drawing.fillOpacity ?? 0.06;

  return (
    <g>
      <polygon
        points={`${p1.x},${p1.y} ${p2.x},${p2.y} ${p2b.x},${p2b.y} ${p1b.x},${p1b.y}`}
        fill={drawing.fillColor || drawing.color}
        opacity={fillOpacity}
      />
      <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
        stroke={drawing.color} strokeWidth={drawing.lineWidth || 1.5} opacity={0.8} />
      <line x1={p1b.x} y1={p1b.y} x2={p2b.x} y2={p2b.y}
        stroke={drawing.color} strokeWidth={drawing.lineWidth || 1.5} opacity={0.8}
        strokeDasharray={lineStyleToDash(drawing.lineStyle) || "4 2"} />
      <circle cx={p1.x} cy={p1.y} r={3} fill={drawing.color} />
      <circle cx={p2.x} cy={p2.y} r={3} fill={drawing.color} />
      <SelectionHandles
        points={[p1, p2, p1b, p2b]}
        selected={selected}
        onHandleMouseDown={onHandleMouseDown}
      />
    </g>
  );
}

function RectangleRenderer({
  drawing, chart, series, selected, onHandleMouseDown,
}: {
  drawing: RectangleDrawing;
  chart: IChartApi;
  series: ISeriesApi<"Candlestick">;
  selected: boolean;
  onHandleMouseDown?: (index: number, e: React.MouseEvent) => void;
}) {
  const p1 = pointToPixel(drawing.start, chart, series);
  const p2 = pointToPixel(drawing.end, chart, series);
  if (!p1 || !p2) return null;

  const x = Math.min(p1.x, p2.x);
  const y = Math.min(p1.y, p2.y);
  const w = Math.abs(p2.x - p1.x);
  const h = Math.abs(p2.y - p1.y);

  return (
    <g>
      <rect x={x} y={y} width={w} height={h}
        fill={drawing.fillColor || drawing.color}
        fillOpacity={drawing.fillOpacity ?? 0.15}
        stroke={drawing.color}
        strokeWidth={drawing.lineWidth || 1}
        strokeDasharray={lineStyleToDash(drawing.lineStyle)}
      />
      <SelectionHandles
        points={[
          { x: Math.min(p1.x, p2.x), y: Math.min(p1.y, p2.y) },
          { x: Math.max(p1.x, p2.x), y: Math.min(p1.y, p2.y) },
          { x: Math.max(p1.x, p2.x), y: Math.max(p1.y, p2.y) },
          { x: Math.min(p1.x, p2.x), y: Math.max(p1.y, p2.y) },
        ]}
        selected={selected}
        onHandleMouseDown={onHandleMouseDown}
      />
    </g>
  );
}

function FibRenderer({
  drawing, chart, series, width, isLight, selected, onHandleMouseDown,
}: {
  drawing: FibDrawing;
  chart: IChartApi;
  series: ISeriesApi<"Candlestick">;
  width: number;
  isLight: boolean;
  selected: boolean;
  onHandleMouseDown?: (index: number, e: React.MouseEvent) => void;
}) {
  const p1 = pointToPixel(drawing.start, chart, series);
  const p2 = pointToPixel(drawing.end, chart, series);
  if (!p1 || !p2) return null;

  const priceRange = drawing.end.price - drawing.start.price;
  const fibColors = ["#ef4444", "#f59e0b", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ef4444"];

  return (
    <g>
      {drawing.levels.map((level, i) => {
        const price = drawing.start.price + priceRange * level;
        const y = priceToY(price, series);
        if (y === null) return null;
        const color = fibColors[i % fibColors.length];
        return (
          <g key={level}>
            {/* Fill between levels */}
            {i < drawing.levels.length - 1 && (() => {
              const nextPrice = drawing.start.price + priceRange * drawing.levels[i + 1];
              const nextY = priceToY(nextPrice, series);
              if (nextY === null) return null;
              return (
                <rect x={0} y={Math.min(y, nextY)} width={width} height={Math.abs(nextY - y)}
                  fill={color} opacity={drawing.fillOpacity ?? 0.04} />
              );
            })()}
            <line x1={0} y1={y} x2={width} y2={y}
              stroke={color} strokeWidth={drawing.lineWidth || 1}
              strokeDasharray={level === 0 || level === 1 ? "none" : "4 2"} opacity={0.6} />
            <rect x={4} y={y - 8} width={80} height={16} rx={2}
              fill={isLight ? "rgba(255,255,255,0.9)" : "rgba(24,24,28,0.9)"} />
            <text x={8} y={y + 4} fill={color} fontSize={9}
              fontFamily="'JetBrains Mono', monospace" fontWeight={600}>
              {(level * 100).toFixed(1)}% — {price.toFixed(2)}
            </text>
          </g>
        );
      })}
      <line x1={p1.x} y1={p1.y} x2={p1.x} y2={p2.y}
        stroke={drawing.color} strokeWidth={1} strokeDasharray="2 2" opacity={0.4} />
      <circle cx={p1.x} cy={p1.y} r={3} fill={drawing.color} />
      <circle cx={p2.x} cy={p2.y} r={3} fill={drawing.color} />
      <SelectionHandles points={[p1, p2]} selected={selected} onHandleMouseDown={onHandleMouseDown} />
    </g>
  );
}

function MeasureRenderer({
  drawing, chart, series, isLight, selected, onHandleMouseDown,
}: {
  drawing: MeasureDrawing;
  chart: IChartApi;
  series: ISeriesApi<"Candlestick">;
  isLight: boolean;
  selected: boolean;
  onHandleMouseDown?: (index: number, e: React.MouseEvent) => void;
}) {
  const p1 = pointToPixel(drawing.start, chart, series);
  const p2 = pointToPixel(drawing.end, chart, series);
  if (!p1 || !p2) return null;

  const priceDiff = drawing.end.price - drawing.start.price;
  const pricePct = ((priceDiff / drawing.start.price) * 100).toFixed(2);
  const timeDiffSec = Math.abs(drawing.end.time - drawing.start.time);
  const bars = Math.round(timeDiffSec / 86400);
  const isPositive = priceDiff >= 0;
  const bgColor = isPositive ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)";
  const textColor = isPositive ? "#22c55e" : "#ef4444";

  return (
    <g>
      <rect
        x={Math.min(p1.x, p2.x)} y={Math.min(p1.y, p2.y)}
        width={Math.abs(p2.x - p1.x)} height={Math.abs(p2.y - p1.y)}
        fill={bgColor} stroke={textColor} strokeWidth={1} strokeDasharray="4 2" opacity={0.8}
      />
      <rect x={(p1.x + p2.x) / 2 - 55} y={(p1.y + p2.y) / 2 - 14} width={110} height={28} rx={4}
        fill={isLight ? "rgba(255,255,255,0.95)" : "rgba(24,24,28,0.95)"}
        stroke={isLight ? "rgba(0,0,0,0.1)" : "rgba(236,227,213,0.1)"} strokeWidth={1} />
      <text x={(p1.x + p2.x) / 2} y={(p1.y + p2.y) / 2 - 2} textAnchor="middle"
        fill={textColor} fontSize={10} fontFamily="'JetBrains Mono', monospace" fontWeight={700}>
        {isPositive ? "+" : ""}{priceDiff.toFixed(2)} ({pricePct}%)
      </text>
      <text x={(p1.x + p2.x) / 2} y={(p1.y + p2.y) / 2 + 10} textAnchor="middle"
        fill={isLight ? "rgba(0,0,0,0.5)" : "rgba(236,227,213,0.5)"}
        fontSize={8} fontFamily="'JetBrains Mono', monospace">
        {bars} bars
      </text>
      <circle cx={p1.x} cy={p1.y} r={3} fill={textColor} />
      <circle cx={p2.x} cy={p2.y} r={3} fill={textColor} />
      <SelectionHandles
        points={[
          { x: Math.min(p1.x, p2.x), y: Math.min(p1.y, p2.y) },
          { x: Math.max(p1.x, p2.x), y: Math.min(p1.y, p2.y) },
          { x: Math.max(p1.x, p2.x), y: Math.max(p1.y, p2.y) },
          { x: Math.min(p1.x, p2.x), y: Math.max(p1.y, p2.y) },
        ]}
        selected={selected}
        onHandleMouseDown={onHandleMouseDown}
      />
    </g>
  );
}

function TextRenderer({
  drawing, chart, series, isLight, selected, onHandleMouseDown,
}: {
  drawing: TextDrawing;
  chart: IChartApi;
  series: ISeriesApi<"Candlestick">;
  isLight: boolean;
  selected: boolean;
  onHandleMouseDown?: (index: number, e: React.MouseEvent) => void;
}) {
  const p = pointToPixel(drawing.point, chart, series);
  if (!p) return null;

  const fontSize = drawing.fontSize || 11;
  const textWidth = drawing.label.length * (fontSize * 0.6) + 16;

  return (
    <g>
      <rect x={p.x - 4} y={p.y - fontSize} width={textWidth} height={fontSize + 8} rx={3}
        fill={isLight ? "rgba(255,255,255,0.9)" : "rgba(24,24,28,0.9)"}
        stroke={selected ? SELECTION_COLOR : drawing.color} strokeWidth={selected ? 1.5 : 1} opacity={0.9} />
      <text x={p.x + 4} y={p.y + 2} fill={drawing.color}
        fontSize={fontSize} fontFamily="'Inter', system-ui, sans-serif" fontWeight={500}>
        {drawing.label}
      </text>
      <SelectionHandles points={[p]} selected={selected} onHandleMouseDown={onHandleMouseDown} />
    </g>
  );
}

function RulerRenderer({
  drawing, chart, series, isLight, selected, onHandleMouseDown,
}: {
  drawing: RulerDrawing;
  chart: IChartApi;
  series: ISeriesApi<"Candlestick">;
  isLight: boolean;
  selected: boolean;
  onHandleMouseDown?: (index: number, e: React.MouseEvent) => void;
}) {
  const p1 = pointToPixel(drawing.start, chart, series);
  const p2 = pointToPixel(drawing.end, chart, series);
  if (!p1 || !p2) return null;

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const pixelDist = Math.sqrt(dx * dx + dy * dy);
  const priceDiff = Math.abs(drawing.end.price - drawing.start.price);

  return (
    <g>
      <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
        stroke={drawing.color} strokeWidth={drawing.lineWidth || 1.5} opacity={0.8} />
      <line x1={p1.x - 4} y1={p1.y - 4} x2={p1.x + 4} y2={p1.y + 4}
        stroke={drawing.color} strokeWidth={1.5} opacity={0.8} />
      <line x1={p2.x - 4} y1={p2.y - 4} x2={p2.x + 4} y2={p2.y + 4}
        stroke={drawing.color} strokeWidth={1.5} opacity={0.8} />
      <rect x={(p1.x + p2.x) / 2 - 35} y={(p1.y + p2.y) / 2 - 20} width={70} height={18} rx={3}
        fill={isLight ? "rgba(255,255,255,0.95)" : "rgba(24,24,28,0.95)"}
        stroke={drawing.color} strokeWidth={1} />
      <text x={(p1.x + p2.x) / 2} y={(p1.y + p2.y) / 2 - 8} textAnchor="middle"
        fill={drawing.color} fontSize={9} fontFamily="'JetBrains Mono', monospace" fontWeight={600}>
        {priceDiff.toFixed(2)} pts
      </text>
      <text x={(p1.x + p2.x) / 2} y={(p1.y + p2.y) / 2 + 4} textAnchor="middle"
        fill={isLight ? "rgba(0,0,0,0.35)" : "rgba(236,227,213,0.35)"}
        fontSize={8} fontFamily="'JetBrains Mono', monospace">
        {pixelDist.toFixed(0)}px
      </text>
      <SelectionHandles points={[p1, p2]} selected={selected} onHandleMouseDown={onHandleMouseDown} />
    </g>
  );
}

function BrushRenderer({
  points, chart, series, drawing, selected,
}: {
  points: DrawingPoint[];
  chart: IChartApi;
  series: ISeriesApi<"Candlestick">;
  drawing?: BrushDrawing;
  selected: boolean;
}) {
  const pixelPoints = points
    .map((p) => pointToPixel(p, chart, series))
    .filter((p): p is { x: number; y: number } => p !== null);

  if (pixelPoints.length < 2) return null;

  const pointsStr = pixelPoints.map((p) => `${p.x},${p.y}`).join(" ");
  const color = drawing?.color || "#c47b3a";
  const strokeWidth = drawing?.lineWidth || 2;

  return (
    <g>
      <polyline
        points={pointsStr}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.8}
      />
      {selected && (
        <polyline
          points={pointsStr}
          fill="none"
          stroke={SELECTION_COLOR}
          strokeWidth={1}
          strokeDasharray="4,4"
          opacity={0.4}
        />
      )}
    </g>
  );
}

// ─── Preview Line (pending first point → mouse) ───

function PreviewLine({
  pendingPoint, mousePoint, chart, series,
}: {
  pendingPoint: DrawingPoint;
  mousePoint: DrawingPoint;
  chart: IChartApi;
  series: ISeriesApi<"Candlestick">;
}) {
  const p1 = pointToPixel(pendingPoint, chart, series);
  const p2 = pointToPixel(mousePoint, chart, series);
  if (!p1 || !p2) return null;

  return (
    <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
      stroke="rgba(196,123,58,0.5)" strokeWidth={1} strokeDasharray="6 3" />
  );
}

// ─── Get Drawing Pixel Points (for hit testing & drag) ───

function getDrawingPixels(
  drawing: Drawing,
  chart: IChartApi,
  series: ISeriesApi<"Candlestick">
): { x: number; y: number }[] {
  switch (drawing.type) {
    case "hline": {
      const y = priceToY(drawing.price, series);
      if (y === null) return [];
      const w = chart.chartElement().clientWidth;
      return [{ x: 0, y }, { x: w, y }];
    }
    case "vline": {
      try {
        const x = chart.timeScale().timeToCoordinate(drawing.time as UTCTimestamp);
        if (x === null) return [];
        const h = chart.chartElement().clientHeight;
        return [{ x, y: 0 }, { x, y: h }];
      } catch { return []; }
    }
    case "text": {
      const p = pointToPixel(drawing.point, chart, series);
      return p ? [p] : [];
    }
    case "brush": {
      return drawing.points
        .map((p) => pointToPixel(p, chart, series))
        .filter((p): p is { x: number; y: number } => p !== null);
    }
    default: {
      const d = drawing as { start?: DrawingPoint; end?: DrawingPoint };
      if (d.start && d.end) {
        const p1 = pointToPixel(d.start, chart, series);
        const p2 = pointToPixel(d.end, chart, series);
        if (p1 && p2) return [p1, p2];
      }
      return [];
    }
  }
}

function hitTestDrawing(
  drawing: Drawing,
  mx: number,
  my: number,
  chart: IChartApi,
  series: ISeriesApi<"Candlestick">
): boolean {
  const pts = getDrawingPixels(drawing, chart, series);
  if (pts.length === 0) return false;

  switch (drawing.type) {
    case "hline":
      return Math.abs(my - pts[0].y) < HIT_THRESHOLD;
    case "vline":
      return Math.abs(mx - pts[0].x) < HIT_THRESHOLD;
    case "text": {
      const p = pts[0];
      const fontSize = (drawing as TextDrawing).fontSize || 11;
      const tw = (drawing as TextDrawing).label.length * (fontSize * 0.6) + 16;
      return pointInRect(mx, my, p.x - 4, p.y - fontSize, p.x + tw, p.y + 8);
    }
    case "rectangle":
    case "measure": {
      if (pts.length < 2) return false;
      // Hit test on border or inside
      if (pointInRect(mx, my, pts[0].x, pts[0].y, pts[1].x, pts[1].y)) return true;
      return false;
    }
    case "brush": {
      for (let i = 0; i < pts.length - 1; i++) {
        if (pointToLineDist(mx, my, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y) < HIT_THRESHOLD) {
          return true;
        }
      }
      return false;
    }
    case "channel": {
      // Hit test both lines of channel
      const cd = drawing as ChannelDrawing;
      const p1b = pointToPixel({ time: cd.start.time, price: cd.start.price + cd.offset }, chart, series);
      const p2b = pointToPixel({ time: cd.end.time, price: cd.end.price + cd.offset }, chart, series);
      if (pts.length >= 2) {
        if (pointToLineDist(mx, my, pts[0].x, pts[0].y, pts[1].x, pts[1].y) < HIT_THRESHOLD) return true;
      }
      if (p1b && p2b) {
        if (pointToLineDist(mx, my, p1b.x, p1b.y, p2b.x, p2b.y) < HIT_THRESHOLD) return true;
      }
      // Also inside the fill area
      if (pts.length >= 2 && p1b && p2b) {
        if (pointInRect(mx, my,
          Math.min(pts[0].x, pts[1].x, p1b.x, p2b.x),
          Math.min(pts[0].y, pts[1].y, p1b.y, p2b.y),
          Math.max(pts[0].x, pts[1].x, p1b.x, p2b.x),
          Math.max(pts[0].y, pts[1].y, p1b.y, p2b.y)
        )) return true;
      }
      return false;
    }
    case "fib": {
      // Hit test on the vertical range line or any fib level
      if (pts.length >= 2) {
        if (pointToLineDist(mx, my, pts[0].x, pts[0].y, pts[0].x, pts[1].y) < HIT_THRESHOLD) return true;
      }
      const fd = drawing as FibDrawing;
      const priceRange = fd.end.price - fd.start.price;
      for (const level of fd.levels) {
        const price = fd.start.price + priceRange * level;
        const y = priceToY(price, series);
        if (y !== null && Math.abs(my - y) < HIT_THRESHOLD) return true;
      }
      return false;
    }
    default: {
      // Line-based drawings
      if (pts.length >= 2) {
        return pointToLineDist(mx, my, pts[0].x, pts[0].y, pts[1].x, pts[1].y) < HIT_THRESHOLD;
      }
      return false;
    }
  }
}

// ─── Main Overlay Component ───

export default function DrawingOverlay({
  drawings,
  chartApi,
  seriesApi,
  pendingPoint,
  mousePoint,
  brushPoints,
  selectedId,
  activeTool,
  onRemove,
  onSelect,
  onUpdate,
  onDoubleClick,
  theme = "dark",
}: DrawingOverlayProps) {
  const isLight = theme === "light";
  const svgRef = useRef<SVGSVGElement>(null);

  // Force re-render when chart scrolls/zooms
  const [, setRenderTick] = useState(0);
  useEffect(() => {
    if (!chartApi) return;
    const handler = () => setRenderTick((t) => t + 1);
    chartApi.timeScale().subscribeVisibleLogicalRangeChange(handler);
    chartApi.timeScale().subscribeVisibleTimeRangeChange(handler);
    return () => {
      try {
        chartApi.timeScale().unsubscribeVisibleLogicalRangeChange(handler);
        chartApi.timeScale().unsubscribeVisibleTimeRangeChange(handler);
      } catch { /* chart disposed */ }
    };
  }, [chartApi]);

  // ─── Drag/Resize State ───
  const [dragState, setDragState] = useState<{
    type: "move" | "resize";
    drawingId: string;
    handleIndex?: number;
    startMouse: { x: number; y: number };
    startPoints: Record<string, unknown>;
  } | null>(null);

  const dragStateRef = useRef(dragState);
  dragStateRef.current = dragState;

  // ─── Mouse Handlers for Drag/Resize ───
  useEffect(() => {
    if (!chartApi || !seriesApi) return;

    const handleMouseMove = (e: MouseEvent) => {
      const ds = dragStateRef.current;
      if (!ds) return;

      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const drawing = drawings.find((d) => d.id === ds.drawingId);
      if (!drawing || drawing.locked) return;

      const dx = mx - ds.startMouse.x;
      const dy = my - ds.startMouse.y;

      if (ds.type === "move") {
        // Move entire drawing
        const sp = ds.startPoints as Record<string, unknown>;

        if (drawing.type === "hline") {
          const origY = sp.origY as number;
          const newPrice = seriesApi.coordinateToPrice(origY + dy);
          if (newPrice !== null) onUpdate?.(drawing.id, { price: newPrice } as Partial<Drawing>);
        } else if (drawing.type === "vline") {
          const origX = sp.origX as number;
          const newTime = chartApi.timeScale().coordinateToTime(origX + dx);
          if (newTime !== null) onUpdate?.(drawing.id, { time: newTime as number } as Partial<Drawing>);
        } else if (drawing.type === "text") {
          const origP = sp.origPoint as { x: number; y: number };
          const newPt = pixelToPoint(origP.x + dx, origP.y + dy, chartApi, seriesApi);
          if (newPt) onUpdate?.(drawing.id, { point: newPt } as Partial<Drawing>);
        } else if ("start" in drawing && "end" in drawing) {
          const origStart = sp.origStart as { x: number; y: number };
          const origEnd = sp.origEnd as { x: number; y: number };
          const newStart = pixelToPoint(origStart.x + dx, origStart.y + dy, chartApi, seriesApi);
          const newEnd = pixelToPoint(origEnd.x + dx, origEnd.y + dy, chartApi, seriesApi);
          if (newStart && newEnd) onUpdate?.(drawing.id, { start: newStart, end: newEnd } as Partial<Drawing>);
        }
      } else if (ds.type === "resize" && ds.handleIndex !== undefined) {
        // Resize specific handle
        const newPt = pixelToPoint(mx, my, chartApi, seriesApi);
        if (!newPt) return;

        if (drawing.type === "hline") {
          onUpdate?.(drawing.id, { price: newPt.price } as Partial<Drawing>);
        } else if (drawing.type === "vline") {
          onUpdate?.(drawing.id, { time: newPt.time } as Partial<Drawing>);
        } else if (drawing.type === "text") {
          onUpdate?.(drawing.id, { point: newPt } as Partial<Drawing>);
        } else if (drawing.type === "rectangle" || drawing.type === "measure") {
          // 4-corner handle: adjust the appropriate corner
          const d = drawing as RectangleDrawing | MeasureDrawing;
          // Handle index: 0=TL, 1=TR, 2=BR, 3=BL
          const hi = ds.handleIndex;
          const newStart = { ...d.start };
          const newEnd = { ...d.end };
          if (hi === 0) { newStart.time = newPt.time; newStart.price = newPt.price; }
          else if (hi === 1) { newEnd.time = newPt.time; newStart.price = newPt.price; }
          else if (hi === 2) { newEnd.time = newPt.time; newEnd.price = newPt.price; }
          else if (hi === 3) { newStart.time = newPt.time; newEnd.price = newPt.price; }
          onUpdate?.(drawing.id, { start: newStart, end: newEnd } as Partial<Drawing>);
        } else if ("start" in drawing && "end" in drawing) {
          // 2-point handle
          if (ds.handleIndex === 0) {
            onUpdate?.(drawing.id, { start: newPt } as Partial<Drawing>);
          } else {
            onUpdate?.(drawing.id, { end: newPt } as Partial<Drawing>);
          }
        }
      }
    };

    const handleMouseUp = () => {
      setDragState(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [chartApi, seriesApi, drawings, onUpdate]);

  // ─── Delete key handler ───
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId && onRemove) {
        // Don't trigger if user is typing in an input
        if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "TEXTAREA") return;
        e.preventDefault();
        onRemove(selectedId);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedId, onRemove]);

  // ─── SVG Click Handler (selection, eraser) ───
  const handleSvgClick = useCallback(
    (e: React.MouseEvent) => {
      if (!chartApi || !seriesApi) return;

      // Use svgRef for coordinates (not e.currentTarget which may be <g>)
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      // Find topmost drawing hit
      for (let i = drawings.length - 1; i >= 0; i--) {
        const d = drawings[i];
        if (!d.visible) continue;
        if (hitTestDrawing(d, mx, my, chartApi, seriesApi)) {
          if (activeTool === "eraser") {
            onRemove?.(d.id);
          } else {
            onSelect?.(d.id);
          }
          e.stopPropagation();
          return;
        }
      }

      // Clicked empty space — deselect
      onSelect?.(null);
    },
    [drawings, chartApi, seriesApi, activeTool, onRemove, onSelect]
  );

  // ─── SVG Double-Click Handler ───
  const handleSvgDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!chartApi || !seriesApi || !onDoubleClick) return;

      // Use svgRef for coordinates (not e.currentTarget which may be <g>)
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      for (let i = drawings.length - 1; i >= 0; i--) {
        const d = drawings[i];
        if (!d.visible) continue;
        if (hitTestDrawing(d, mx, my, chartApi, seriesApi)) {
          onDoubleClick(d, { x: e.clientX, y: e.clientY });
          e.stopPropagation();
          return;
        }
      }
    },
    [drawings, chartApi, seriesApi, onDoubleClick]
  );

  // ─── SVG MouseDown Handler (start drag) ───
  const handleSvgMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!chartApi || !seriesApi || !selectedId) return;
      if (e.button !== 0) return; // left click only

      // Use svgRef for coordinates (not e.currentTarget which may be <g>)
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const drawing = drawings.find((d) => d.id === selectedId);
      if (!drawing || drawing.locked) return;

      // Check if we're clicking on the selected drawing
      if (!hitTestDrawing(drawing, mx, my, chartApi, seriesApi)) return;

      // Start move drag
      const startPoints: Record<string, unknown> = {};

      if (drawing.type === "hline") {
        const y = priceToY(drawing.price, seriesApi);
        if (y !== null) startPoints.origY = y;
      } else if (drawing.type === "vline") {
        try {
          const x = chartApi.timeScale().timeToCoordinate(drawing.time as UTCTimestamp);
          if (x !== null) startPoints.origX = x;
        } catch { /* */ }
      } else if (drawing.type === "text") {
        const p = pointToPixel(drawing.point, chartApi, seriesApi);
        if (p) startPoints.origPoint = p;
      } else if ("start" in drawing && "end" in drawing) {
        const p1 = pointToPixel(drawing.start, chartApi, seriesApi);
        const p2 = pointToPixel(drawing.end, chartApi, seriesApi);
        if (p1) startPoints.origStart = p1;
        if (p2) startPoints.origEnd = p2;
      }

      setDragState({
        type: "move",
        drawingId: drawing.id,
        startMouse: { x: mx, y: my },
        startPoints,
      });

      e.preventDefault();
    },
    [chartApi, seriesApi, selectedId, drawings]
  );

  // ─── Handle Resize Start ───
  const handleResizeStart = useCallback(
    (drawingId: string, handleIndex: number, e: React.MouseEvent) => {
      if (!svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      setDragState({
        type: "resize",
        drawingId,
        handleIndex,
        startMouse: { x: mx, y: my },
        startPoints: {},
      });
    },
    []
  );

  // ─── Render Drawing ───
  const renderDrawing = useCallback(
    (drawing: Drawing) => {
      if (!drawing.visible || !chartApi || !seriesApi) return null;

      const selected = drawing.id === selectedId;
      const width = chartApi.chartElement().clientWidth;
      const height = chartApi.chartElement().clientHeight;
      const makeHandleCb = (index: number, e: React.MouseEvent) => {
        handleResizeStart(drawing.id, index, e);
      };

      switch (drawing.type) {
        case "hline":
          return <HLineRenderer key={drawing.id} drawing={drawing} series={seriesApi}
            width={width} selected={selected} onHandleMouseDown={makeHandleCb} />;
        case "vline":
          return <VLineRenderer key={drawing.id} drawing={drawing} chart={chartApi}
            height={height} selected={selected} onHandleMouseDown={makeHandleCb} />;
        case "trendline":
        case "ray":
        case "extendedline":
          return <TwoPointLineRenderer key={drawing.id} drawing={drawing} chart={chartApi} series={seriesApi}
            width={width} height={height} selected={selected} onHandleMouseDown={makeHandleCb} />;
        case "arrow":
          return <TwoPointLineRenderer key={drawing.id} drawing={drawing} chart={chartApi} series={seriesApi}
            width={width} height={height} selected={selected} onHandleMouseDown={makeHandleCb} arrowHead />;
        case "channel":
          return <ChannelRenderer key={drawing.id} drawing={drawing} chart={chartApi} series={seriesApi}
            selected={selected} onHandleMouseDown={makeHandleCb} />;
        case "rectangle":
          return <RectangleRenderer key={drawing.id} drawing={drawing} chart={chartApi} series={seriesApi}
            selected={selected} onHandleMouseDown={makeHandleCb} />;
        case "fib":
          return <FibRenderer key={drawing.id} drawing={drawing} chart={chartApi} series={seriesApi}
            width={width} isLight={isLight} selected={selected} onHandleMouseDown={makeHandleCb} />;
        case "measure":
          return <MeasureRenderer key={drawing.id} drawing={drawing} chart={chartApi} series={seriesApi}
            isLight={isLight} selected={selected} onHandleMouseDown={makeHandleCb} />;
        case "text":
          return <TextRenderer key={drawing.id} drawing={drawing} chart={chartApi} series={seriesApi}
            isLight={isLight} selected={selected} onHandleMouseDown={makeHandleCb} />;
        case "ruler":
          return <RulerRenderer key={drawing.id} drawing={drawing} chart={chartApi} series={seriesApi}
            isLight={isLight} selected={selected} onHandleMouseDown={makeHandleCb} />;
        case "brush":
          return <BrushRenderer key={drawing.id} points={drawing.points} chart={chartApi} series={seriesApi}
            drawing={drawing} selected={selected} />;
        default:
          return null;
      }
    },
    [chartApi, seriesApi, selectedId, isLight, handleResizeStart]
  );

  const visibleDrawings = useMemo(
    () => drawings.filter((d) => d.visible),
    [drawings]
  );

  if (!chartApi || !seriesApi) return null;

  // The SVG overlay should never block scroll/zoom on the chart.
  // We use pointerEvents: "none" by default and only set "auto" when actively
  // dragging a selected drawing. For clicks/double-clicks on drawings, we use
  // a transparent click-catcher that doesn't block scroll.
  const isDragging = !!dragState;

  const cursorStyle = activeTool === "eraser" ? "not-allowed"
    : dragState ? (dragState.type === "resize" ? "crosshair" : "grabbing")
    : selectedId ? "grab"
    : "default";

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 z-10"
      style={{
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        cursor: cursorStyle,
        overflow: "visible",
      }}
    >
      {/* Drawings group — each drawing element has pointerEvents:auto for click/drag */}
      <g
        style={{ pointerEvents: isDragging ? "auto" : "visiblePainted" }}
        onClick={handleSvgClick}
        onDoubleClick={handleSvgDoubleClick}
        onMouseDown={handleSvgMouseDown}
      >
        {visibleDrawings.map(renderDrawing)}
        {/* Preview line while placing a 2-click drawing */}
        {pendingPoint && mousePoint && (
          <PreviewLine pendingPoint={pendingPoint} mousePoint={mousePoint}
            chart={chartApi} series={seriesApi} />
        )}
        {/* Live brush preview */}
        {brushPoints && brushPoints.length > 1 && (
          <BrushRenderer points={brushPoints} chart={chartApi} series={seriesApi} selected={false} />
        )}
      </g>
    </svg>
  );
}
