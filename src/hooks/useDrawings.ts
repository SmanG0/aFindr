"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { DrawingTool } from "@/components/LeftSidebar/LeftSidebar";

// ─── Drawing Object Types ───

export interface DrawingPoint {
  time: number; // chart time coordinate
  price: number;
}

export interface BaseDrawing {
  id: string;
  type: DrawingTool;
  color: string;
  visible: boolean;
  locked: boolean;
  lineWidth: number;
  lineStyle: "solid" | "dashed" | "dotted";
  extendLeft: boolean;
  extendRight: boolean;
}

export interface HLineDrawing extends BaseDrawing {
  type: "hline";
  price: number;
}

export interface VLineDrawing extends BaseDrawing {
  type: "vline";
  time: number;
}

export interface TrendLineDrawing extends BaseDrawing {
  type: "trendline";
  start: DrawingPoint;
  end: DrawingPoint;
}

export interface RayDrawing extends BaseDrawing {
  type: "ray";
  start: DrawingPoint;
  end: DrawingPoint;
}

export interface ArrowDrawing extends BaseDrawing {
  type: "arrow";
  start: DrawingPoint;
  end: DrawingPoint;
}

export interface ExtendedLineDrawing extends BaseDrawing {
  type: "extendedline";
  start: DrawingPoint;
  end: DrawingPoint;
}

export interface ChannelDrawing extends BaseDrawing {
  type: "channel";
  start: DrawingPoint;
  end: DrawingPoint;
  offset: number;
  fillColor: string;
  fillOpacity: number;
}

export interface RectangleDrawing extends BaseDrawing {
  type: "rectangle";
  start: DrawingPoint;
  end: DrawingPoint;
  fillColor: string;
  fillOpacity: number;
}

export interface FibDrawing extends BaseDrawing {
  type: "fib";
  start: DrawingPoint;
  end: DrawingPoint;
  levels: number[];
  fillColor: string;
  fillOpacity: number;
}

export interface MeasureDrawing extends BaseDrawing {
  type: "measure";
  start: DrawingPoint;
  end: DrawingPoint;
  fillColor: string;
  fillOpacity: number;
}

export interface TextDrawing extends BaseDrawing {
  type: "text";
  point: DrawingPoint;
  label: string;
  fontSize: number;
}

export interface RulerDrawing extends BaseDrawing {
  type: "ruler";
  start: DrawingPoint;
  end: DrawingPoint;
}

export interface BrushDrawing extends BaseDrawing {
  type: "brush";
  points: DrawingPoint[];
}

export type Drawing =
  | HLineDrawing
  | VLineDrawing
  | TrendLineDrawing
  | RayDrawing
  | ArrowDrawing
  | ExtendedLineDrawing
  | ChannelDrawing
  | RectangleDrawing
  | FibDrawing
  | MeasureDrawing
  | TextDrawing
  | RulerDrawing
  | BrushDrawing;

// ─── Drawing State ───

export type DrawingPhase = "idle" | "placing" | "dragging" | "brushing";

const STORAGE_KEY = "afindr_drawings";
const DEFAULT_COLOR = "#c47b3a";
const DEFAULT_FILL = "rgba(196,123,58,0.15)";
const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0];

function generateId(): string {
  return `drw-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Base defaults for all new drawings */
function baseDefaults(): Pick<BaseDrawing, "color" | "visible" | "locked" | "lineWidth" | "lineStyle" | "extendLeft" | "extendRight"> {
  return {
    color: DEFAULT_COLOR,
    visible: true,
    locked: false,
    lineWidth: 1,
    lineStyle: "solid",
    extendLeft: false,
    extendRight: false,
  };
}

/** Migrate old drawings missing new properties */
function migrateDrawing(d: Record<string, unknown>): Drawing {
  return {
    locked: false,
    lineWidth: 1,
    lineStyle: "solid",
    extendLeft: false,
    extendRight: false,
    ...d,
  } as Drawing;
}

function loadDrawings(): Drawing[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>[];
      return parsed.map(migrateDrawing);
    }
  } catch { /* corrupted data */ }
  return [];
}

function saveDrawings(drawings: Drawing[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drawings));
  } catch { /* quota exceeded */ }
}

export function useDrawings() {
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [phase, setPhase] = useState<DrawingPhase>("idle");
  const [pendingPoint, setPendingPoint] = useState<DrawingPoint | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [brushPoints, setBrushPoints] = useState<DrawingPoint[]>([]);
  const hydrated = useRef(false);

  // Restore from localStorage after mount
  useEffect(() => {
    const saved = loadDrawings();
    if (saved.length > 0) setDrawings(saved);
    hydrated.current = true;
  }, []);

  // Persist whenever drawings change (skip initial hydration)
  useEffect(() => {
    if (hydrated.current) {
      saveDrawings(drawings);
    }
  }, [drawings]);

  // ─── Selection ───
  const selectDrawing = useCallback((id: string | null) => {
    setSelectedId(id);
  }, []);

  // ─── Update drawing properties (for edit modal, drag, resize) ───
  const updateDrawing = useCallback((id: string, updates: Partial<Drawing>) => {
    setDrawings((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...updates } as Drawing : d))
    );
  }, []);

  // ─── Brush tool handlers ───
  const startBrush = useCallback((point: DrawingPoint) => {
    setBrushPoints([point]);
    setPhase("brushing");
  }, []);

  const moveBrush = useCallback((point: DrawingPoint) => {
    setBrushPoints((prev) => [...prev, point]);
  }, []);

  const endBrush = useCallback(() => {
    if (brushPoints.length > 1) {
      const drawing: BrushDrawing = {
        id: generateId(),
        type: "brush",
        points: brushPoints,
        ...baseDefaults(),
      };
      setDrawings((prev) => [...prev, drawing]);
    }
    setBrushPoints([]);
    setPhase("idle");
    return brushPoints.length > 1 ? "completed" as const : false as const;
  }, [brushPoints]);

  /**
   * Handle a chart click when a drawing tool is active.
   * Returns "completed" when a drawing was placed, "pending" for first click
   * of a two-click tool, or false if the click was not consumed.
   */
  const handleDrawingClick = useCallback(
    (tool: DrawingTool, point: DrawingPoint): "completed" | "pending" | false => {
      if (tool === "crosshair" || tool === "eraser" || tool === "brush") return false;

      // ─── Single-click tools ───
      if (tool === "hline") {
        const drawing: HLineDrawing = {
          id: generateId(),
          type: "hline",
          price: point.price,
          ...baseDefaults(),
        };
        setDrawings((prev) => [...prev, drawing]);
        return "completed";
      }

      if (tool === "vline") {
        const drawing: VLineDrawing = {
          id: generateId(),
          type: "vline",
          time: point.time,
          ...baseDefaults(),
        };
        setDrawings((prev) => [...prev, drawing]);
        return "completed";
      }

      if (tool === "text") {
        const label = prompt("Enter text:") ?? "";
        if (!label) return false;
        const drawing: TextDrawing = {
          id: generateId(),
          type: "text",
          point,
          label,
          fontSize: 14,
          ...baseDefaults(),
        };
        setDrawings((prev) => [...prev, drawing]);
        return "completed";
      }

      // ─── Two-click tools ───
      const twoClickTools: DrawingTool[] = [
        "trendline", "ray", "arrow", "extendedline",
        "channel", "rectangle", "fib", "measure", "ruler",
      ];

      if (twoClickTools.includes(tool)) {
        if (!pendingPoint) {
          setPendingPoint(point);
          setPhase("placing");
          return "pending";
        }

        // Second click — finalize
        const start = pendingPoint;
        const end = point;
        const base = baseDefaults();

        const fillDefaults = { fillColor: DEFAULT_FILL, fillOpacity: 0.15 };

        let drawing: Drawing;

        switch (tool) {
          case "trendline":
            drawing = { id: generateId(), type: "trendline", start, end, ...base };
            break;
          case "ray":
            drawing = { id: generateId(), type: "ray", start, end, ...base, extendRight: true };
            break;
          case "arrow":
            drawing = { id: generateId(), type: "arrow", start, end, ...base };
            break;
          case "extendedline":
            drawing = { id: generateId(), type: "extendedline", start, end, ...base, extendLeft: true, extendRight: true };
            break;
          case "channel": {
            const priceRange = Math.abs(end.price - start.price) * 0.3;
            drawing = { id: generateId(), type: "channel", start, end, offset: priceRange, ...base, ...fillDefaults };
            break;
          }
          case "rectangle":
            drawing = { id: generateId(), type: "rectangle", start, end, ...base, ...fillDefaults };
            break;
          case "fib":
            drawing = { id: generateId(), type: "fib", start, end, levels: FIB_LEVELS, ...base, ...fillDefaults };
            break;
          case "measure":
            drawing = { id: generateId(), type: "measure", start, end, ...base, ...fillDefaults };
            break;
          case "ruler":
            drawing = { id: generateId(), type: "ruler", start, end, ...base };
            break;
          default:
            return false;
        }

        setDrawings((prev) => [...prev, drawing]);
        setPendingPoint(null);
        setPhase("idle");
        return "completed";
      }

      return false;
    },
    [pendingPoint]
  );

  const removeDrawing = useCallback((id: string) => {
    setDrawings((prev) => prev.filter((d) => d.id !== id));
    if (selectedId === id) setSelectedId(null);
  }, [selectedId]);

  const clearAllDrawings = useCallback(() => {
    setDrawings([]);
    setPendingPoint(null);
    setPhase("idle");
    setSelectedId(null);
  }, []);

  const cancelPending = useCallback(() => {
    setPendingPoint(null);
    setPhase("idle");
    setBrushPoints([]);
  }, []);

  const setDrawingsVisible = useCallback((visible: boolean) => {
    setDrawings((prev) => prev.map((d) => ({ ...d, visible })));
  }, []);

  return {
    drawings,
    phase,
    pendingPoint,
    selectedId,
    brushPoints,
    handleDrawingClick,
    removeDrawing,
    clearAllDrawings,
    cancelPending,
    setDrawingsVisible,
    selectDrawing,
    updateDrawing,
    startBrush,
    moveBrush,
    endBrush,
  };
}
