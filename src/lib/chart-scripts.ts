/**
 * Chart Script Engine — type system + evaluation for custom chart visuals.
 *
 * Alphy can create chart scripts via the create_chart_script tool.
 * Each script contains static elements and/or dynamic generators
 * that produce visual overlays on the chart.
 */

import type { Candle } from "./types";

// ─── Element Types (discriminated union) ───

export interface ScriptLine {
  type: "line";
  id: string;
  data: { time: number; value: number }[];
  color?: string;
  width?: number;
  style?: "solid" | "dashed" | "dotted";
  label?: string;
}

export interface ScriptHLine {
  type: "hline";
  id: string;
  price: number;
  color?: string;
  width?: number;
  style?: "solid" | "dashed" | "dotted";
  label?: string;
}

export interface ScriptVLine {
  type: "vline";
  id: string;
  time: number;
  color?: string;
  width?: number;
  style?: "solid" | "dashed" | "dotted";
  label?: string;
}

export interface ScriptBox {
  type: "box";
  id: string;
  timeStart: number;
  timeEnd: number;
  priceHigh: number;
  priceLow: number;
  color?: string;
  opacity?: number;
  label?: string;
}

export interface ScriptMarker {
  type: "marker";
  id: string;
  time: number;
  position?: "aboveBar" | "belowBar" | "inBar";
  shape?: "arrowUp" | "arrowDown" | "circle" | "square";
  color?: string;
  text?: string;
}

export interface ScriptLabel {
  type: "label";
  id: string;
  time: number;
  price: number;
  text: string;
  color?: string;
  fontSize?: number;
  background?: string;
}

export interface ScriptShade {
  type: "shade";
  id: string;
  timeStart: number;
  timeEnd: number;
  color?: string;
  opacity?: number;
  label?: string;
}

export type ChartScriptElement =
  | ScriptLine
  | ScriptHLine
  | ScriptVLine
  | ScriptBox
  | ScriptMarker
  | ScriptLabel
  | ScriptShade;

// ─── Generator Configs ───

export interface SessionVLinesGenerator {
  type: "session_vlines";
  hour?: number;
  minute?: number;
  label?: string;
  color?: string;
  width?: number;
  style?: "solid" | "dashed" | "dotted";
}

export interface PrevDayLevelsGenerator {
  type: "prev_day_levels";
  color?: string;
  width?: number;
  style?: "solid" | "dashed" | "dotted";
}

export type ChartScriptGenerator = SessionVLinesGenerator | PrevDayLevelsGenerator;

// ─── Top-level ChartScript ───

export interface ChartScript {
  id: string;
  name: string;
  visible: boolean;
  elements: ChartScriptElement[];
  generators: ChartScriptGenerator[];
}

// ─── Evaluation Result (typed buckets) ───

export interface ChartScriptResult {
  scriptId: string;
  scriptName: string;
  lines: ScriptLine[];
  hlines: ScriptHLine[];
  vlines: ScriptVLine[];
  boxes: ScriptBox[];
  markers: ScriptMarker[];
  labels: ScriptLabel[];
  shades: ScriptShade[];
}

// ─── Generator Implementations ───

function generateSessionVLines(
  gen: SessionVLinesGenerator,
  candles: Candle[],
  scriptId: string,
): ScriptVLine[] {
  const hour = gen.hour ?? 14; // Default 14:30 UTC = 9:30 AM ET
  const minute = gen.minute ?? 30;
  const results: ScriptVLine[] = [];
  const seen = new Set<number>();

  for (const candle of candles) {
    const d = new Date(candle.time * 1000);
    if (d.getUTCHours() === hour && d.getUTCMinutes() === minute && !seen.has(candle.time)) {
      seen.add(candle.time);
      results.push({
        type: "vline",
        id: `${scriptId}_svl_${candle.time}`,
        time: candle.time,
        color: gen.color ?? "#3b82f6",
        width: gen.width ?? 1,
        style: gen.style ?? "dashed",
        label: gen.label ?? `${hour}:${String(minute).padStart(2, "0")} UTC`,
      });
    }
  }
  return results;
}

function generatePrevDayLevels(
  gen: PrevDayLevelsGenerator,
  candles: Candle[],
  scriptId: string,
): ScriptHLine[] {
  if (candles.length === 0) return [];

  // Group candles by UTC date
  const dayMap = new Map<string, Candle[]>();
  for (const c of candles) {
    const d = new Date(c.time * 1000);
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
    const arr = dayMap.get(key);
    if (arr) arr.push(c);
    else dayMap.set(key, [c]);
  }

  const days = Array.from(dayMap.values());
  if (days.length < 2) return [];

  // Previous day = second-to-last day group
  const prevDay = days[days.length - 2];
  let pdh = -Infinity, pdl = Infinity;
  const pdo = prevDay[0].open, pdc = prevDay[prevDay.length - 1].close;
  for (const c of prevDay) {
    if (c.high > pdh) pdh = c.high;
    if (c.low < pdl) pdl = c.low;
  }

  const color = gen.color ?? "#f59e0b";
  const width = gen.width ?? 1;
  const style = gen.style ?? "dashed";

  return [
    { type: "hline", id: `${scriptId}_pdh`, price: pdh, color, width, style, label: "PDH" },
    { type: "hline", id: `${scriptId}_pdl`, price: pdl, color, width, style, label: "PDL" },
    { type: "hline", id: `${scriptId}_pdc`, price: pdc, color: color, width, style, label: "PDC" },
    { type: "hline", id: `${scriptId}_pdo`, price: pdo, color: color, width, style, label: "PDO" },
  ];
}

// ─── Main Evaluation Function ───

export function evaluateChartScript(
  script: ChartScript,
  candles: Candle[],
): ChartScriptResult {
  const result: ChartScriptResult = {
    scriptId: script.id,
    scriptName: script.name,
    lines: [],
    hlines: [],
    vlines: [],
    boxes: [],
    markers: [],
    labels: [],
    shades: [],
  };

  // Process static elements
  for (const el of script.elements) {
    switch (el.type) {
      case "line": result.lines.push(el); break;
      case "hline": result.hlines.push(el); break;
      case "vline": result.vlines.push(el); break;
      case "box": result.boxes.push(el); break;
      case "marker": result.markers.push(el); break;
      case "label": result.labels.push(el); break;
      case "shade": result.shades.push(el); break;
    }
  }

  // Run generators
  for (const gen of script.generators) {
    switch (gen.type) {
      case "session_vlines": {
        const vlines = generateSessionVLines(gen, candles, script.id);
        result.vlines.push(...vlines);
        break;
      }
      case "prev_day_levels": {
        const hlines = generatePrevDayLevels(gen, candles, script.id);
        result.hlines.push(...hlines);
        break;
      }
    }
  }

  return result;
}
