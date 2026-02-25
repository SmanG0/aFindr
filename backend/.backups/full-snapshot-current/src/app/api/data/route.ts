import { NextRequest, NextResponse } from "next/server";
import { CONTRACTS } from "@/lib/types";
import { isNSETicker, parseNSETicker, fetchNSECandles } from "@/lib/nse-data";

// ─── Interval & Range Mapping ───

const YAHOO_INTERVAL_MAP: Record<string, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "30m": "30m",
  "1h": "60m",
  "4h": "60m",
  "1d": "1d",
  "1wk": "1wk",
};

const DEFAULT_RANGE: Record<string, string> = {
  "1m": "1d",
  "5m": "5d",
  "15m": "5d",
  "30m": "1mo",
  "1h": "6mo",
  "4h": "2y",
  "1d": "2y",
  "1wk": "5y",
};

function aggregateToHigherTimeframe(
  candles: { time: number; open: number; high: number; low: number; close: number; volume: number }[],
  periodSeconds: number,
): { time: number; open: number; high: number; low: number; close: number; volume: number }[] {
  if (candles.length === 0) return [];

  const result: typeof candles = [];
  let bucket: typeof candles[0] | null = null;
  let bucketStart = 0;

  for (const c of candles) {
    const slot = Math.floor(c.time / periodSeconds) * periodSeconds;
    if (bucket === null || slot !== bucketStart) {
      if (bucket) result.push(bucket);
      bucketStart = slot;
      bucket = { time: slot, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume };
    } else {
      bucket.high = Math.max(bucket.high, c.high);
      bucket.low = Math.min(bucket.low, c.low);
      bucket.close = c.close;
      bucket.volume += c.volume;
    }
  }
  if (bucket) result.push(bucket);
  return result;
}

// ─── Yahoo Finance Response Types ───

interface YahooChartResult {
  meta: { symbol: string; regularMarketPrice: number };
  timestamp: number[];
  indicators: {
    quote: Array<{
      open: (number | null)[];
      high: (number | null)[];
      low: (number | null)[];
      close: (number | null)[];
      volume: (number | null)[];
    }>;
  };
}

interface YahooChartResponse {
  chart: {
    result: YahooChartResult[] | null;
    error: { code: string; description: string } | null;
  };
}

// ─── POST  →  Fetch OHLCV candles from Yahoo Finance ───

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { symbol, interval, range, period } = body as {
      symbol?: string;
      interval?: string;
      range?: string;
      period?: string;
    };

    if (!symbol || !interval) {
      return NextResponse.json(
        { error: "Missing required fields: symbol, interval" },
        { status: 400 }
      );
    }

    // NSE Kenya tickers
    if (isNSETicker(symbol)) {
      const nseSymbol = parseNSETicker(symbol);
      const yahooRange = range ?? period ?? DEFAULT_RANGE[interval] ?? "1y";
      const candles = await fetchNSECandles(nseSymbol, yahooRange);
      return NextResponse.json({
        symbol,
        candles: candles.map((c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume })),
        count: candles.length,
      });
    }

    // Resolve Yahoo-compatible interval
    const yahooInterval = YAHOO_INTERVAL_MAP[interval] ?? interval;

    // Resolve range: explicit range > period > default for interval
    const yahooRange = range ?? period ?? DEFAULT_RANGE[interval] ?? "1mo";

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${yahooInterval}&range=${yahooRange}`;

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
      next: { revalidate: 0 }, // no caching
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Yahoo Finance error: ${res.status}`, detail: text },
        { status: res.status }
      );
    }

    const json: YahooChartResponse = await res.json();

    if (json.chart.error) {
      return NextResponse.json(
        { error: json.chart.error.description },
        { status: 400 }
      );
    }

    const result = json.chart.result?.[0];
    if (!result || !result.timestamp) {
      return NextResponse.json(
        { error: "No data returned from Yahoo Finance" },
        { status: 404 }
      );
    }

    const timestamps = result.timestamp;
    const quote = result.indicators.quote[0];

    // Build candles, filtering out nulls (holidays / missing bars)
    const candles: {
      time: number;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      const o = quote.open[i];
      const h = quote.high[i];
      const l = quote.low[i];
      const c = quote.close[i];
      const v = quote.volume[i];

      if (o == null || h == null || l == null || c == null) continue;

      candles.push({
        time: timestamps[i],
        open: o,
        high: h,
        low: l,
        close: c,
        volume: v ?? 0,
      });
    }

    const finalCandles = interval === "4h"
      ? aggregateToHigherTimeframe(candles, 4 * 3600)
      : candles;

    return NextResponse.json({
      symbol,
      candles: finalCandles,
      count: finalCandles.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch market data", detail: String(err) },
      { status: 500 }
    );
  }
}

// ─── GET  →  Return available contracts ───

export async function GET() {
  return NextResponse.json(CONTRACTS);
}
