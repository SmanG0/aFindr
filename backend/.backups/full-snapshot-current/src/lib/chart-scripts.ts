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

export interface KillzoneShadeGenerator {
  type: "killzone_shades";
  sessions: Array<{
    name: string;
    utcStartHour: number;
    utcStartMinute: number;
    utcEndHour: number;
    utcEndMinute: number;
    color: string;
    opacity: number;
  }>;
}

export type ChartScriptGenerator =
  | SessionVLinesGenerator
  | PrevDayLevelsGenerator
  | KillzoneShadeGenerator;

// ─── Top-level ChartScript ───

export interface ChartScript {
  id: string;
  name: string;
  symbol?: string; // Symbol this script was created for (undefined = universal)
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
): { lines: ScriptLine[]; labels: ScriptLabel[] } {
  if (candles.length === 0) return { lines: [], labels: [] };

  // Group candles by UTC date
  const dayMap = new Map<string, Candle[]>();
  for (const c of candles) {
    const d = new Date(c.time * 1000);
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
    const arr = dayMap.get(key);
    if (arr) arr.push(c);
    else dayMap.set(key, [c]);
  }

  const days = Array.from(dayMap.values());
  if (days.length < 2) return { lines: [], labels: [] };

  // Previous day = second-to-last day group
  const prevDay = days[days.length - 2];
  let pdh = -Infinity, pdl = Infinity;
  const pdo = prevDay[0].open, pdc = prevDay[prevDay.length - 1].close;
  for (const c of prevDay) {
    if (c.high > pdh) pdh = c.high;
    if (c.low < pdl) pdl = c.low;
  }

  // Current day = last day group
  const currentDay = days[days.length - 1];
  // Ray starts from beginning of current day
  const rayStart = currentDay[0].time;
  // Ray extends 50 candles past the last candle (well past right edge)
  const lastCandle = candles[candles.length - 1];
  const avgInterval = candles.length >= 2
    ? (candles[candles.length - 1].time - candles[candles.length - 2].time)
    : 60;
  const rayEnd = lastCandle.time + avgInterval * 200;

  const pdColor = gen.color ?? "#f59e0b";
  const width = gen.width ?? 1;
  const style = gen.style ?? "dashed";

  // Helper to create a horizontal ray (line with two points at the same price)
  const makeRay = (id: string, price: number, label: string, rayColor?: string, rayStartTime?: number): ScriptLine => ({
    type: "line",
    id,
    data: [
      { time: rayStartTime ?? rayStart, value: price },
      { time: rayEnd, value: price },
    ],
    color: rayColor ?? pdColor,
    width,
    style,
    label,
  });

  const lines: ScriptLine[] = [
    makeRay(`${scriptId}_pdh`, pdh, "PDH"),
    makeRay(`${scriptId}_pdl`, pdl, "PDL"),
    makeRay(`${scriptId}_pdc`, pdc, "PDC"),
    makeRay(`${scriptId}_pdo`, pdo, "PDO"),
  ];

  const labels: ScriptLabel[] = [
    { type: "label", id: `${scriptId}_pdh_lbl`, time: rayEnd, price: pdh, text: "PDH", color: pdColor, fontSize: 9 },
    { type: "label", id: `${scriptId}_pdl_lbl`, time: rayEnd, price: pdl, text: "PDL", color: pdColor, fontSize: 9 },
    { type: "label", id: `${scriptId}_pdc_lbl`, time: rayEnd, price: pdc, text: "PDC", color: pdColor, fontSize: 9 },
    { type: "label", id: `${scriptId}_pdo_lbl`, time: rayEnd, price: pdo, text: "PDO", color: pdColor, fontSize: 9 },
  ];

  // ─── Session opening price rays ───
  // Find midnight ET (05:00 UTC) and 9:30 AM ET (14:30 UTC) opening prices
  const sessionColor = "#00bcd4"; // cyan for session opens

  // Find candle nearest to midnight ET (05:00 UTC) in current day
  const midnightTarget = 5 * 3600; // 05:00 UTC in seconds-of-day
  const sessionOpenTarget = 14 * 3600 + 30 * 60; // 14:30 UTC in seconds-of-day

  let midnightCandle: Candle | null = null;
  let sessionOpenCandle: Candle | null = null;

  for (const c of currentDay) {
    const d = new Date(c.time * 1000);
    const secOfDay = d.getUTCHours() * 3600 + d.getUTCMinutes() * 60;
    // Midnight ET open: first candle at or after 05:00 UTC
    if (!midnightCandle && secOfDay >= midnightTarget) {
      midnightCandle = c;
    }
    // 9:30 AM ET open: first candle at or after 14:30 UTC
    if (!sessionOpenCandle && secOfDay >= sessionOpenTarget) {
      sessionOpenCandle = c;
    }
  }

  if (midnightCandle) {
    lines.push(makeRay(`${scriptId}_mop`, midnightCandle.open, "MOP", sessionColor, midnightCandle.time));
    labels.push({ type: "label", id: `${scriptId}_mop_lbl`, time: rayEnd, price: midnightCandle.open, text: "Midnight Open", color: sessionColor, fontSize: 9 });
  }

  if (sessionOpenCandle) {
    lines.push(makeRay(`${scriptId}_930`, sessionOpenCandle.open, "930", sessionColor, sessionOpenCandle.time));
    labels.push({ type: "label", id: `${scriptId}_930_lbl`, time: rayEnd, price: sessionOpenCandle.open, text: "9:30 Open", color: sessionColor, fontSize: 9 });
  }

  return { lines, labels };
}

function generateKillzoneShades(
  gen: KillzoneShadeGenerator,
  candles: Candle[],
  scriptId: string,
): ScriptShade[] {
  if (candles.length === 0) return [];

  // Group candles by UTC date
  const dayMap = new Map<string, Candle[]>();
  for (const c of candles) {
    const d = new Date(c.time * 1000);
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
    const arr = dayMap.get(key);
    if (arr) arr.push(c);
    else dayMap.set(key, [c]);
  }

  const results: ScriptShade[] = [];
  const days = Array.from(dayMap.entries());

  for (const [dayKey, dayCandles] of days) {
    for (const sess of gen.sessions) {
      const startMin = sess.utcStartHour * 60 + sess.utcStartMinute;
      const endMin = sess.utcEndHour * 60 + sess.utcEndMinute;

      // Find candles within this killzone window
      const kzCandles = dayCandles.filter((c) => {
        const d = new Date(c.time * 1000);
        const barMin = d.getUTCHours() * 60 + d.getUTCMinutes();
        return barMin >= startMin && barMin < endMin;
      });

      if (kzCandles.length < 1) continue;

      const timeStart = kzCandles[0].time;
      const timeEnd = kzCandles[kzCandles.length - 1].time;

      results.push({
        type: "shade",
        id: `${scriptId}_kz_${sess.name.replace(/\s/g, "_")}_${dayKey}`,
        timeStart,
        timeEnd,
        color: sess.color,
        opacity: sess.opacity,
        label: sess.name,
      });
    }
  }

  return results;
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
        const { lines, labels } = generatePrevDayLevels(gen, candles, script.id);
        result.lines.push(...lines);
        result.labels.push(...labels);
        break;
      }
      case "killzone_shades": {
        const shades = generateKillzoneShades(gen, candles, script.id);
        result.shades.push(...shades);
        break;
      }
    }
  }

  return result;
}
