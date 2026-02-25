import type { Candle } from "./types";

// ─── Indicator Config Types ───

export type IndicatorType =
  | "sma" | "ema" | "wma" | "dema" | "tema"
  | "rsi" | "macd" | "bb" | "vwap" | "atr"
  | "stoch" | "cci" | "willr" | "adx" | "obv" | "mfi"
  | "psar" | "donchian" | "keltner" | "roc" | "trix"
  | "chaikin" | "force" | "aroon" | "cmo" | "supertrend";

export interface IndicatorConfig {
  id: string;
  type: IndicatorType;
  params: Record<string, number>;
  color: string;
  visible: boolean;
  source?: "manual" | "alphy";
}

export interface IndicatorLineData {
  time: number;
  value: number;
}

export interface IndicatorResult {
  id: string;
  type: IndicatorType;
  overlay: boolean; // true = render on price scale; false = render in separate pane
  lines: { key: string; label: string; color: string; data: IndicatorLineData[] }[];
  bands?: { upper: IndicatorLineData[]; lower: IndicatorLineData[]; color: string; fillOpacity: number }[];
}

// ─── Default Indicator Definitions ───

export interface IndicatorDef {
  type: IndicatorType;
  name: string;
  shortName: string;
  overlay: boolean;
  defaultParams: Record<string, number>;
  paramLabels: Record<string, string>;
  defaultColor: string;
  description: string;
}

export const INDICATOR_DEFS: IndicatorDef[] = [
  {
    type: "sma",
    name: "Simple Moving Average",
    shortName: "SMA",
    overlay: true,
    defaultParams: { period: 20 },
    paramLabels: { period: "Period" },
    defaultColor: "#2962FF",
    description: "Average of closing prices over N periods",
  },
  {
    type: "ema",
    name: "Exponential Moving Average",
    shortName: "EMA",
    overlay: true,
    defaultParams: { period: 20 },
    paramLabels: { period: "Period" },
    defaultColor: "#FF6D00",
    description: "Weighted average giving more weight to recent prices",
  },
  {
    type: "rsi",
    name: "Relative Strength Index",
    shortName: "RSI",
    overlay: false,
    defaultParams: { period: 14 },
    paramLabels: { period: "Period" },
    defaultColor: "#7B1FA2",
    description: "Momentum oscillator measuring speed of price changes (0-100)",
  },
  {
    type: "macd",
    name: "MACD",
    shortName: "MACD",
    overlay: false,
    defaultParams: { fast: 12, slow: 26, signal: 9 },
    paramLabels: { fast: "Fast", slow: "Slow", signal: "Signal" },
    defaultColor: "#2962FF",
    description: "Trend-following momentum indicator showing relationship between two EMAs",
  },
  {
    type: "bb",
    name: "Bollinger Bands",
    shortName: "BB",
    overlay: true,
    defaultParams: { period: 20, stdDev: 2 },
    paramLabels: { period: "Period", stdDev: "Std Dev" },
    defaultColor: "#26A69A",
    description: "Volatility bands plotted above and below a moving average",
  },
  {
    type: "vwap",
    name: "Volume Weighted Average Price",
    shortName: "VWAP",
    overlay: true,
    defaultParams: {},
    paramLabels: {},
    defaultColor: "#AB47BC",
    description: "Average price weighted by volume, resets each session",
  },
  {
    type: "atr",
    name: "Average True Range",
    shortName: "ATR",
    overlay: false,
    defaultParams: { period: 14 },
    paramLabels: { period: "Period" },
    defaultColor: "#FF7043",
    description: "Measures market volatility by decomposing the entire range of a bar",
  },
  { type: "wma", name: "Weighted Moving Average", shortName: "WMA", overlay: true, defaultParams: { period: 20 }, paramLabels: { period: "Period" }, defaultColor: "#5C6BC0", description: "Moving average with linearly decreasing weights" },
  { type: "dema", name: "Double EMA", shortName: "DEMA", overlay: true, defaultParams: { period: 20 }, paramLabels: { period: "Period" }, defaultColor: "#66BB6A", description: "Double-smoothed exponential moving average" },
  { type: "tema", name: "Triple EMA", shortName: "TEMA", overlay: true, defaultParams: { period: 20 }, paramLabels: { period: "Period" }, defaultColor: "#42A5F5", description: "Triple-smoothed exponential moving average" },
  { type: "stoch", name: "Stochastic", shortName: "Stoch", overlay: false, defaultParams: { k: 14, d: 3 }, paramLabels: { k: "K Period", d: "D Period" }, defaultColor: "#8D6E63", description: "Momentum oscillator comparing closing price to price range" },
  { type: "cci", name: "Commodity Channel Index", shortName: "CCI", overlay: false, defaultParams: { period: 20 }, paramLabels: { period: "Period" }, defaultColor: "#EF5350", description: "Measures deviation from statistical mean" },
  { type: "willr", name: "Williams %R", shortName: "Williams %R", overlay: false, defaultParams: { period: 14 }, paramLabels: { period: "Period" }, defaultColor: "#EC407A", description: "Momentum indicator similar to stochastic (-100 to 0)" },
  { type: "adx", name: "Average Directional Index", shortName: "ADX", overlay: false, defaultParams: { period: 14 }, paramLabels: { period: "Period" }, defaultColor: "#7E57C2", description: "Trend strength indicator" },
  { type: "obv", name: "On Balance Volume", shortName: "OBV", overlay: false, defaultParams: {}, paramLabels: {}, defaultColor: "#26A69A", description: "Cumulative volume flow indicator" },
  { type: "mfi", name: "Money Flow Index", shortName: "MFI", overlay: false, defaultParams: { period: 14 }, paramLabels: { period: "Period" }, defaultColor: "#FFA726", description: "Volume-weighted RSI (0-100)" },
  { type: "psar", name: "Parabolic SAR", shortName: "PSAR", overlay: true, defaultParams: { step: 0.02, max: 0.2 }, paramLabels: { step: "Step", max: "Max" }, defaultColor: "#00BCD4", description: "Trend-following stop and reverse points" },
  { type: "donchian", name: "Donchian Channel", shortName: "Donchian", overlay: true, defaultParams: { period: 20 }, paramLabels: { period: "Period" }, defaultColor: "#009688", description: "Upper/lower bands from highest high and lowest low" },
  { type: "keltner", name: "Keltner Channel", shortName: "Keltner", overlay: true, defaultParams: { period: 20, mult: 2 }, paramLabels: { period: "Period", mult: "Multiplier" }, defaultColor: "#4DB6AC", description: "Volatility bands based on ATR" },
  { type: "roc", name: "Rate of Change", shortName: "ROC", overlay: false, defaultParams: { period: 12 }, paramLabels: { period: "Period" }, defaultColor: "#7986CB", description: "Momentum oscillator showing price change rate" },
  { type: "trix", name: "TRIX", shortName: "TRIX", overlay: false, defaultParams: { period: 15 }, paramLabels: { period: "Period" }, defaultColor: "#BA68C8", description: "Triple-smoothed ROC" },
  { type: "chaikin", name: "Chaikin Oscillator", shortName: "Chaikin", overlay: false, defaultParams: { fast: 3, slow: 10 }, paramLabels: { fast: "Fast", slow: "Slow" }, defaultColor: "#4DD0E1", description: "Accumulation/distribution momentum" },
  { type: "force", name: "Force Index", shortName: "Force", overlay: false, defaultParams: { period: 2 }, paramLabels: { period: "Period" }, defaultColor: "#F06292", description: "Volume-weighted price change" },
  { type: "aroon", name: "Aroon", shortName: "Aroon", overlay: false, defaultParams: { period: 25 }, paramLabels: { period: "Period" }, defaultColor: "#FF8A65", description: "Identifies trend strength and direction" },
  { type: "cmo", name: "Chande Momentum Oscillator", shortName: "CMO", overlay: false, defaultParams: { period: 14 }, paramLabels: { period: "Period" }, defaultColor: "#9575CD", description: "Momentum oscillator (-100 to 100)" },
  { type: "supertrend", name: "SuperTrend", shortName: "SuperTrend", overlay: true, defaultParams: { period: 10, mult: 3 }, paramLabels: { period: "Period", mult: "Multiplier" }, defaultColor: "#E57373", description: "Trend-following indicator based on ATR" },
];

// ─── Calculation Functions ───

function calcSMA(closes: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) sum += closes[j];
      result.push(sum / period);
    }
  }
  return result;
}

function calcEMA(closes: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  const k = 2 / (period + 1);
  let ema: number | null = null;
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else if (ema === null) {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) sum += closes[j];
      ema = sum / period;
      result.push(ema);
    } else {
      ema = closes[i] * k + ema * (1 - k);
      result.push(ema);
    }
  }
  return result;
}

function calcRSI(closes: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  if (closes.length < period + 1) return closes.map(() => null);

  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) avgGain += diff;
    else avgLoss += Math.abs(diff);
  }
  avgGain /= period;
  avgLoss /= period;

  for (let i = 0; i < period; i++) result.push(null);

  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  result.push(100 - 100 / (1 + rs));

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff >= 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    result.push(rsi);
  }
  return result;
}

function calcMACD(
  closes: number[],
  fast: number,
  slow: number,
  signalPeriod: number,
): { macd: (number | null)[]; signal: (number | null)[]; histogram: (number | null)[] } {
  const emaFast = calcEMA(closes, fast);
  const emaSlow = calcEMA(closes, slow);

  const macdLine: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (emaFast[i] !== null && emaSlow[i] !== null) {
      macdLine.push(emaFast[i]! - emaSlow[i]!);
    } else {
      macdLine.push(null);
    }
  }

  const validMacd = macdLine.filter((v): v is number => v !== null);
  const signalEma = calcEMA(validMacd, signalPeriod);

  let signalIdx = 0;
  const signalLine: (number | null)[] = [];
  const histogram: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (macdLine[i] !== null) {
      const sig = signalEma[signalIdx] ?? null;
      signalLine.push(sig);
      histogram.push(sig !== null ? macdLine[i]! - sig : null);
      signalIdx++;
    } else {
      signalLine.push(null);
      histogram.push(null);
    }
  }

  return { macd: macdLine, signal: signalLine, histogram };
}

function calcBB(
  closes: number[],
  period: number,
  stdDevMult: number,
): { middle: (number | null)[]; upper: (number | null)[]; lower: (number | null)[] } {
  const middle = calcSMA(closes, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (middle[i] === null) {
      upper.push(null);
      lower.push(null);
    } else {
      let sumSqDiff = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sumSqDiff += (closes[j] - middle[i]!) ** 2;
      }
      const stdDev = Math.sqrt(sumSqDiff / period);
      upper.push(middle[i]! + stdDevMult * stdDev);
      lower.push(middle[i]! - stdDevMult * stdDev);
    }
  }

  return { middle, upper, lower };
}

function calcVWAP(candles: Candle[]): (number | null)[] {
  const result: (number | null)[] = [];
  let cumTPV = 0;
  let cumVol = 0;
  let lastDate = "";

  for (const c of candles) {
    const d = new Date(c.time * 1000);
    const dateStr = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

    if (dateStr !== lastDate) {
      cumTPV = 0;
      cumVol = 0;
      lastDate = dateStr;
    }

    const tp = (c.high + c.low + c.close) / 3;
    cumTPV += tp * c.volume;
    cumVol += c.volume;
    result.push(cumVol > 0 ? cumTPV / cumVol : null);
  }
  return result;
}

function calcATR(candles: Candle[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  const trueRanges: number[] = [];

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (i === 0) {
      trueRanges.push(c.high - c.low);
    } else {
      const prev = candles[i - 1];
      trueRanges.push(Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close)));
    }
  }

  let atr: number | null = null;
  for (let i = 0; i < trueRanges.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else if (atr === null) {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) sum += trueRanges[j];
      atr = sum / period;
      result.push(atr);
    } else {
      atr = (atr * (period - 1) + trueRanges[i]) / period;
      result.push(atr);
    }
  }
  return result;
}

function calcWMA(closes: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  const denom = (period * (period + 1)) / 2;
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) result.push(null);
    else {
      let sum = 0;
      for (let j = 0; j < period; j++) sum += closes[i - period + 1 + j] * (j + 1);
      result.push(sum / denom);
    }
  }
  return result;
}

function calcDEMA(closes: number[], period: number): (number | null)[] {
  const ema1 = calcEMA(closes, period);
  const ema1Vals = ema1.filter((v): v is number => v !== null);
  const ema2Vals = calcEMA(ema1Vals, period);
  const result: (number | null)[] = [];
  let idx = 0;
  for (let i = 0; i < closes.length; i++) {
    if (ema1[i] === null) result.push(null);
    else {
      const e1 = ema1[i]!;
      const e2 = ema2Vals[idx] ?? null;
      result.push(e2 !== null ? 2 * e1 - e2 : e1);
      idx++;
    }
  }
  return result;
}

function calcTEMA(closes: number[], period: number): (number | null)[] {
  const ema1 = calcEMA(closes, period);
  const ema1Vals = ema1.filter((v): v is number => v !== null);
  const ema2 = calcEMA(ema1Vals, period);
  const ema2Vals = ema2.filter((v): v is number => v !== null);
  const ema3 = calcEMA(ema2Vals, period);
  const result: (number | null)[] = [];
  let idx = 0;
  for (let i = 0; i < closes.length; i++) {
    if (ema1[i] === null) result.push(null);
    else {
      const e1 = ema1[i]!;
      const e2 = ema2[idx] ?? null;
      const e3 = ema3[idx] ?? null;
      result.push(e2 !== null && e3 !== null ? 3 * e1 - 3 * e2 + e3 : e1);
      idx++;
    }
  }
  return result;
}

function calcStoch(candles: Candle[], kPeriod: number, dPeriod: number): { k: (number | null)[]; d: (number | null)[] } {
  const k: (number | null)[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i < kPeriod - 1) k.push(null);
    else {
      let lowest = candles[i].low, highest = candles[i].high;
      for (let j = i - kPeriod + 1; j <= i; j++) {
        lowest = Math.min(lowest, candles[j].low);
        highest = Math.max(highest, candles[j].high);
      }
      const range = highest - lowest;
      k.push(range === 0 ? 50 : 100 * (candles[i].close - lowest) / range);
    }
  }
  const d = calcSMA(k.filter((v): v is number => v !== null), dPeriod);
  let dIdx = 0;
  const dOut: (number | null)[] = [];
  for (let i = 0; i < k.length; i++) {
    dOut.push(k[i] !== null ? d[dIdx] ?? null : null);
    if (k[i] !== null) dIdx++;
  }
  return { k, d: dOut };
}

function calcCCI(candles: Candle[], period: number): (number | null)[] {
  const tp = candles.map((c) => (c.high + c.low + c.close) / 3);
  const result: (number | null)[] = [];
  for (let i = 0; i < tp.length; i++) {
    if (i < period - 1) result.push(null);
    else {
      const slice = tp.slice(i - period + 1, i + 1);
      const sma = slice.reduce((a, b) => a + b, 0) / period;
      const meanDev = slice.reduce((a, b) => a + Math.abs(b - sma), 0) / period;
      result.push(meanDev === 0 ? 0 : (tp[i] - sma) / (0.015 * meanDev));
    }
  }
  return result;
}

function calcWilliamsR(candles: Candle[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) result.push(null);
    else {
      let highest = candles[i].high, lowest = candles[i].low;
      for (let j = i - period + 1; j <= i; j++) {
        highest = Math.max(highest, candles[j].high);
        lowest = Math.min(lowest, candles[j].low);
      }
      const range = highest - lowest;
      result.push(range === 0 ? -50 : -100 * (highest - candles[i].close) / range);
    }
  }
  return result;
}

function calcADX(candles: Candle[], period: number): (number | null)[] {
  const tr: number[] = [];
  const plusDM: number[] = [];
  const minusDM: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      tr.push(candles[i].high - candles[i].low);
      plusDM.push(0);
      minusDM.push(0);
    } else {
      tr.push(Math.max(
        candles[i].high - candles[i].low,
        Math.abs(candles[i].high - candles[i - 1].close),
        Math.abs(candles[i].low - candles[i - 1].close)
      ));
      const up = candles[i].high - candles[i - 1].high;
      const down = candles[i - 1].low - candles[i].low;
      plusDM.push(up > down && up > 0 ? up : 0);
      minusDM.push(down > up && down > 0 ? down : 0);
    }
  }
  const result: (number | null)[] = [];
  let atr = 0, plusDMSum = 0, minusDMSum = 0;
  for (let i = 0; i < candles.length; i++) {
    if (i < period) {
      result.push(null);
      if (i >= 1) {
        atr += tr[i];
        plusDMSum += plusDM[i];
        minusDMSum += minusDM[i];
      }
    } else {
      atr = (atr * (period - 1) + tr[i]) / period;
      plusDMSum = (plusDMSum * (period - 1) + plusDM[i]) / period;
      minusDMSum = (minusDMSum * (period - 1) + minusDM[i]) / period;
      const plusDI = atr === 0 ? 0 : 100 * plusDMSum / atr;
      const minusDI = atr === 0 ? 0 : 100 * minusDMSum / atr;
      const diSum = plusDI + minusDI;
      const dx = diSum === 0 ? 0 : 100 * Math.abs(plusDI - minusDI) / diSum;
      const prev = result[i - 1];
      result.push(prev === null ? dx : (prev * (period - 1) + dx) / period);
    }
  }
  return result;
}

function calcOBV(candles: Candle[]): (number | null)[] {
  const result: (number | null)[] = [];
  let obv = 0;
  for (let i = 0; i < candles.length; i++) {
    if (i === 0) obv = candles[i].volume;
    else {
      if (candles[i].close > candles[i - 1].close) obv += candles[i].volume;
      else if (candles[i].close < candles[i - 1].close) obv -= candles[i].volume;
    }
    result.push(obv);
  }
  return result;
}

function calcMFI(candles: Candle[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  const tp = candles.map((c) => (c.high + c.low + c.close) / 3);
  for (let i = 0; i < candles.length; i++) {
    if (i < period) result.push(null);
    else {
      let posFlow = 0, negFlow = 0;
      for (let j = i - period + 1; j <= i; j++) {
        const raw = tp[j] * candles[j].volume;
        if (tp[j] > tp[j - 1]) posFlow += raw;
        else if (tp[j] < tp[j - 1]) negFlow += raw;
      }
      const mf = negFlow === 0 ? 100 : 100 - 100 / (1 + posFlow / negFlow);
      result.push(mf);
    }
  }
  return result;
}

function calcPSAR(candles: Candle[], step: number, max: number): (number | null)[] {
  const result: (number | null)[] = [];
  let ep = candles[0].high, sar = candles[0].low, af = step, trend = 1;
  for (let i = 0; i < candles.length; i++) {
    if (i < 2) { result.push(null); continue; }
    if (trend === 1) {
      sar = sar + af * (ep - sar);
      if (candles[i].low < sar) { trend = -1; sar = ep; ep = candles[i].low; af = step; }
      else { ep = Math.max(ep, candles[i].high); af = Math.min(af + step, max); }
    } else {
      sar = sar + af * (ep - sar);
      if (candles[i].high > sar) { trend = 1; sar = ep; ep = candles[i].high; af = step; }
      else { ep = Math.min(ep, candles[i].low); af = Math.min(af + step, max); }
    }
    result.push(sar);
  }
  return result;
}

function calcDonchian(candles: Candle[], period: number): { upper: (number | null)[]; lower: (number | null)[]; middle: (number | null)[] } {
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];
  const middle: (number | null)[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      upper.push(null); lower.push(null); middle.push(null);
    } else {
      let hi = candles[i].high, lo = candles[i].low;
      for (let j = i - period + 1; j <= i; j++) {
        hi = Math.max(hi, candles[j].high);
        lo = Math.min(lo, candles[j].low);
      }
      upper.push(hi);
      lower.push(lo);
      middle.push((hi + lo) / 2);
    }
  }
  return { upper, lower, middle };
}

function calcKeltner(candles: Candle[], period: number, mult: number): { middle: (number | null)[]; upper: (number | null)[]; lower: (number | null)[] } {
  const middle = calcEMA(candles.map((c) => c.close), period);
  const atrVals = calcATR(candles, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (middle[i] === null || atrVals[i] === null) {
      upper.push(null); lower.push(null);
    } else {
      upper.push(middle[i]! + mult * atrVals[i]!);
      lower.push(middle[i]! - mult * atrVals[i]!);
    }
  }
  return { middle, upper, lower };
}

function calcROC(closes: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period) result.push(null);
    else {
      const prev = closes[i - period];
      result.push(prev === 0 ? 0 : 100 * (closes[i] - prev) / prev);
    }
  }
  return result;
}

function calcTRIX(closes: number[], period: number): (number | null)[] {
  const ema1 = calcEMA(closes, period);
  const ema1Vals = ema1.filter((v): v is number => v !== null);
  const ema2 = calcEMA(ema1Vals, period);
  const ema2Vals = ema2.filter((v): v is number => v !== null);
  const ema3 = calcEMA(ema2Vals, period);
  const result: (number | null)[] = [];
  let idx = 0;
  for (let i = 0; i < closes.length; i++) {
    if (ema1[i] === null) result.push(null);
    else {
      const v = ema3[idx];
      const prev = idx > 0 ? ema3[idx - 1] : null;
      result.push(v !== null && prev !== null && prev !== 0 ? 100 * (v - prev) / prev : null);
      idx++;
    }
  }
  return result;
}

function calcChaikin(candles: Candle[], fast: number, slow: number): (number | null)[] {
  const ad: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    const mfm = candles[i].high === candles[i].low ? 0 : ((candles[i].close - candles[i].low) - (candles[i].high - candles[i].close)) / (candles[i].high - candles[i].low);
    ad.push(i === 0 ? mfm * candles[i].volume : ad[i - 1] + mfm * candles[i].volume);
  }
  const emaFast = calcEMA(ad, fast);
  const emaSlow = calcEMA(ad, slow);
  const result: (number | null)[] = [];
  for (let i = 0; i < candles.length; i++) {
    result.push(emaFast[i] !== null && emaSlow[i] !== null ? emaFast[i]! - emaSlow[i]! : null);
  }
  return result;
}

function calcForce(candles: Candle[], period: number): (number | null)[] {
  const raw: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    raw.push(i === 0 ? 0 : (candles[i].close - candles[i - 1].close) * candles[i].volume);
  }
  return calcEMA(raw, period);
}

function calcAroon(candles: Candle[], period: number): { aroonUp: (number | null)[]; aroonDown: (number | null)[] } {
  const aroonUp: (number | null)[] = [];
  const aroonDown: (number | null)[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i < period) {
      aroonUp.push(null); aroonDown.push(null);
    } else {
      let hiIdx = i, loIdx = i;
      for (let j = i - period; j <= i; j++) {
        if (candles[j].high >= candles[hiIdx].high) hiIdx = j;
        if (candles[j].low <= candles[loIdx].low) loIdx = j;
      }
      aroonUp.push(100 * (period - (i - hiIdx)) / period);
      aroonDown.push(100 * (period - (i - loIdx)) / period);
    }
  }
  return { aroonUp, aroonDown };
}

function calcCMO(closes: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < period; i++) result.push(null);
  for (let i = period; i < closes.length; i++) {
    let sumUp = 0, sumDown = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const d = closes[j] - closes[j - 1];
      if (d > 0) sumUp += d;
      else sumDown += Math.abs(d);
    }
    const total = sumUp + sumDown;
    result.push(total === 0 ? 0 : 100 * (sumUp - sumDown) / total);
  }
  return result;
}

function calcSuperTrend(candles: Candle[], period: number, mult: number): (number | null)[] {
  const atr = calcATR(candles, period);
  const result: (number | null)[] = [];
  let trend = 1;
  let upper = 0, lower = 0, st = 0;
  for (let i = 0; i < candles.length; i++) {
    if (atr[i] === null) { result.push(null); continue; }
    const hl2 = (candles[i].high + candles[i].low) / 2;
    if (i === 0) {
      upper = hl2 + mult * atr[i]!;
      lower = hl2 - mult * atr[i]!;
      st = lower;
    } else {
      upper = Math.min(hl2 + mult * atr[i]!, candles[i].close > upper ? hl2 + mult * atr[i]! : upper);
      lower = Math.max(hl2 - mult * atr[i]!, candles[i].close < lower ? hl2 - mult * atr[i]! : lower);
      if (trend === 1) {
        if (candles[i].close <= lower) { trend = -1; st = upper; }
        else st = lower;
      } else {
        if (candles[i].close >= upper) { trend = 1; st = lower; }
        else st = upper;
      }
    }
    result.push(st);
  }
  return result;
}

// ─── Main Compute Function ───

export function computeIndicator(config: IndicatorConfig, candles: Candle[]): IndicatorResult | null {
  if (candles.length === 0) return null;

  const closes = candles.map((c) => c.close);
  const times = candles.map((c) => c.time);
  const def = INDICATOR_DEFS.find((d) => d.type === config.type);
  if (!def) return null;

  const toLineData = (values: (number | null)[]): IndicatorLineData[] =>
    values
      .map((v, i) => (v !== null ? { time: times[i], value: v } : null))
      .filter((d): d is IndicatorLineData => d !== null);

  switch (config.type) {
    case "sma": {
      const period = config.params.period ?? 20;
      const values = calcSMA(closes, period);
      return {
        id: config.id, type: "sma", overlay: true,
        lines: [{ key: "sma", label: `SMA(${period})`, color: config.color, data: toLineData(values) }],
      };
    }
    case "ema": {
      const period = config.params.period ?? 20;
      const values = calcEMA(closes, period);
      return {
        id: config.id, type: "ema", overlay: true,
        lines: [{ key: "ema", label: `EMA(${period})`, color: config.color, data: toLineData(values) }],
      };
    }
    case "rsi": {
      const period = config.params.period ?? 14;
      const values = calcRSI(closes, period);
      return {
        id: config.id, type: "rsi", overlay: false,
        lines: [{ key: "rsi", label: `RSI(${period})`, color: config.color, data: toLineData(values) }],
      };
    }
    case "macd": {
      const { fast = 12, slow = 26, signal = 9 } = config.params;
      const { macd, signal: sig, histogram } = calcMACD(closes, fast, slow, signal);
      return {
        id: config.id, type: "macd", overlay: false,
        lines: [
          { key: "macd", label: "MACD", color: "#2962FF", data: toLineData(macd) },
          { key: "signal", label: "Signal", color: "#FF6D00", data: toLineData(sig) },
          { key: "histogram", label: "Histogram", color: "#26A69A", data: toLineData(histogram) },
        ],
      };
    }
    case "bb": {
      const period = config.params.period ?? 20;
      const stdDev = config.params.stdDev ?? 2;
      const { middle, upper, lower } = calcBB(closes, period, stdDev);
      return {
        id: config.id, type: "bb", overlay: true,
        lines: [
          { key: "middle", label: `BB(${period})`, color: config.color, data: toLineData(middle) },
          { key: "upper", label: "Upper", color: config.color, data: toLineData(upper) },
          { key: "lower", label: "Lower", color: config.color, data: toLineData(lower) },
        ],
        bands: [{ upper: toLineData(upper), lower: toLineData(lower), color: config.color, fillOpacity: 0.06 }],
      };
    }
    case "vwap": {
      const values = calcVWAP(candles);
      return {
        id: config.id, type: "vwap", overlay: true,
        lines: [{ key: "vwap", label: "VWAP", color: config.color, data: toLineData(values) }],
      };
    }
    case "atr": {
      const period = config.params.period ?? 14;
      const values = calcATR(candles, period);
      return {
        id: config.id, type: "atr", overlay: false,
        lines: [{ key: "atr", label: `ATR(${period})`, color: config.color, data: toLineData(values) }],
      };
    }
    case "wma": {
      const period = config.params.period ?? 20;
      const values = calcWMA(closes, period);
      return {
        id: config.id, type: "wma", overlay: true,
        lines: [{ key: "wma", label: `WMA(${period})`, color: config.color, data: toLineData(values) }],
      };
    }
    case "dema": {
      const period = config.params.period ?? 20;
      const values = calcDEMA(closes, period);
      return {
        id: config.id, type: "dema", overlay: true,
        lines: [{ key: "dema", label: `DEMA(${period})`, color: config.color, data: toLineData(values) }],
      };
    }
    case "tema": {
      const period = config.params.period ?? 20;
      const values = calcTEMA(closes, period);
      return {
        id: config.id, type: "tema", overlay: true,
        lines: [{ key: "tema", label: `TEMA(${period})`, color: config.color, data: toLineData(values) }],
      };
    }
    case "stoch": {
      const { k = 14, d = 3 } = config.params;
      const { k: kVal, d: dVal } = calcStoch(candles, k, d);
      return {
        id: config.id, type: "stoch", overlay: false,
        lines: [
          { key: "k", label: `%K(${k})`, color: config.color, data: toLineData(kVal) },
          { key: "d", label: `%D(${d})`, color: "#FF6D00", data: toLineData(dVal) },
        ],
      };
    }
    case "cci": {
      const period = config.params.period ?? 20;
      const values = calcCCI(candles, period);
      return {
        id: config.id, type: "cci", overlay: false,
        lines: [{ key: "cci", label: `CCI(${period})`, color: config.color, data: toLineData(values) }],
      };
    }
    case "willr": {
      const period = config.params.period ?? 14;
      const values = calcWilliamsR(candles, period);
      return {
        id: config.id, type: "willr", overlay: false,
        lines: [{ key: "willr", label: `Williams %R(${period})`, color: config.color, data: toLineData(values) }],
      };
    }
    case "adx": {
      const period = config.params.period ?? 14;
      const values = calcADX(candles, period);
      return {
        id: config.id, type: "adx", overlay: false,
        lines: [{ key: "adx", label: `ADX(${period})`, color: config.color, data: toLineData(values) }],
      };
    }
    case "obv": {
      const values = calcOBV(candles);
      return {
        id: config.id, type: "obv", overlay: false,
        lines: [{ key: "obv", label: "OBV", color: config.color, data: toLineData(values) }],
      };
    }
    case "mfi": {
      const period = config.params.period ?? 14;
      const values = calcMFI(candles, period);
      return {
        id: config.id, type: "mfi", overlay: false,
        lines: [{ key: "mfi", label: `MFI(${period})`, color: config.color, data: toLineData(values) }],
      };
    }
    case "psar": {
      const step = config.params.step ?? 0.02;
      const max = config.params.max ?? 0.2;
      const values = calcPSAR(candles, step, max);
      return {
        id: config.id, type: "psar", overlay: true,
        lines: [{ key: "psar", label: "PSAR", color: config.color, data: toLineData(values) }],
      };
    }
    case "donchian": {
      const period = config.params.period ?? 20;
      const { upper, lower, middle } = calcDonchian(candles, period);
      return {
        id: config.id, type: "donchian", overlay: true,
        lines: [
          { key: "upper", label: "Upper", color: config.color, data: toLineData(upper) },
          { key: "middle", label: "Middle", color: config.color, data: toLineData(middle) },
          { key: "lower", label: "Lower", color: config.color, data: toLineData(lower) },
        ],
        bands: [{ upper: toLineData(upper), lower: toLineData(lower), color: config.color, fillOpacity: 0.06 }],
      };
    }
    case "keltner": {
      const period = config.params.period ?? 20;
      const mult = config.params.mult ?? 2;
      const { middle, upper, lower } = calcKeltner(candles, period, mult);
      return {
        id: config.id, type: "keltner", overlay: true,
        lines: [
          { key: "middle", label: `KC(${period})`, color: config.color, data: toLineData(middle) },
          { key: "upper", label: "Upper", color: config.color, data: toLineData(upper) },
          { key: "lower", label: "Lower", color: config.color, data: toLineData(lower) },
        ],
        bands: [{ upper: toLineData(upper), lower: toLineData(lower), color: config.color, fillOpacity: 0.06 }],
      };
    }
    case "roc": {
      const period = config.params.period ?? 12;
      const values = calcROC(closes, period);
      return {
        id: config.id, type: "roc", overlay: false,
        lines: [{ key: "roc", label: `ROC(${period})`, color: config.color, data: toLineData(values) }],
      };
    }
    case "trix": {
      const period = config.params.period ?? 15;
      const values = calcTRIX(closes, period);
      return {
        id: config.id, type: "trix", overlay: false,
        lines: [{ key: "trix", label: `TRIX(${period})`, color: config.color, data: toLineData(values) }],
      };
    }
    case "chaikin": {
      const { fast = 3, slow = 10 } = config.params;
      const values = calcChaikin(candles, fast, slow);
      return {
        id: config.id, type: "chaikin", overlay: false,
        lines: [{ key: "chaikin", label: "Chaikin", color: config.color, data: toLineData(values) }],
      };
    }
    case "force": {
      const period = config.params.period ?? 2;
      const values = calcForce(candles, period);
      return {
        id: config.id, type: "force", overlay: false,
        lines: [{ key: "force", label: `Force(${period})`, color: config.color, data: toLineData(values) }],
      };
    }
    case "aroon": {
      const period = config.params.period ?? 25;
      const { aroonUp, aroonDown } = calcAroon(candles, period);
      return {
        id: config.id, type: "aroon", overlay: false,
        lines: [
          { key: "up", label: "Aroon Up", color: "#26A69A", data: toLineData(aroonUp) },
          { key: "down", label: "Aroon Down", color: "#EF5350", data: toLineData(aroonDown) },
        ],
      };
    }
    case "cmo": {
      const period = config.params.period ?? 14;
      const values = calcCMO(closes, period);
      return {
        id: config.id, type: "cmo", overlay: false,
        lines: [{ key: "cmo", label: `CMO(${period})`, color: config.color, data: toLineData(values) }],
      };
    }
    case "supertrend": {
      const period = config.params.period ?? 10;
      const mult = config.params.mult ?? 3;
      const values = calcSuperTrend(candles, period, mult);
      return {
        id: config.id, type: "supertrend", overlay: true,
        lines: [{ key: "supertrend", label: "SuperTrend", color: config.color, data: toLineData(values) }],
      };
    }
    default:
      return null;
  }
}

// Helper to create a new indicator config
let nextId = 0;
const DEFAULT_INDICATOR_COLOR = "#b4aa9b";

export function createIndicatorConfig(type: IndicatorType, overrides?: Partial<IndicatorConfig>): IndicatorConfig {
  const def = INDICATOR_DEFS.find((d) => d.type === type)!;
  return {
    id: `ind-${type}-${Date.now()}-${nextId++}`,
    type,
    params: { ...def.defaultParams },
    color: DEFAULT_INDICATOR_COLOR,
    visible: true,
    source: "manual",
    ...overrides,
  };
}
