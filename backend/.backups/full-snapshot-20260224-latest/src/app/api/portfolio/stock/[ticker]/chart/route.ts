import { NextRequest, NextResponse } from "next/server";
import { isNSETicker, parseNSETicker, fetchNSECandles } from "@/lib/nse-data";

const PERIOD_MAP: Record<string, { interval: string; range: string }> = {
  "1D": { interval: "5m", range: "1d" },
  "1W": { interval: "15m", range: "5d" },
  "1M": { interval: "1h", range: "1mo" },
  "3M": { interval: "1d", range: "3mo" },
  "YTD": { interval: "1d", range: "ytd" },
  "1Y": { interval: "1d", range: "1y" },
  "5Y": { interval: "1wk", range: "5y" },
  "MAX": { interval: "1mo", range: "max" },
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const { ticker } = await params;
    const { period } = (await request.json()) as { period?: string };

    // NSE Kenya tickers: "NSE:SCOM", "SCOM" (if known NSE symbol)
    if (isNSETicker(ticker)) {
      const symbol = parseNSETicker(ticker);
      const candles = await fetchNSECandles(symbol, period || "1Y");
      const points = candles.map((c) => ({
        timestamp: c.timestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
      }));
      return NextResponse.json({ points });
    }

    const mapping = PERIOD_MAP[period || "1D"] || PERIOD_MAP["1D"];

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker.toUpperCase())}?interval=${mapping.interval}&range=${mapping.range}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Yahoo error: ${res.status}` }, { status: res.status });
    }

    const json = await res.json();
    const result = json.chart?.result?.[0];
    if (!result || !result.timestamp) {
      return NextResponse.json({ error: "No chart data" }, { status: 404 });
    }

    const timestamps = result.timestamp;
    const quote = result.indicators.quote[0];
    const points: { timestamp: number; open: number; high: number; low: number; close: number; volume: number }[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      const c = quote.close[i];
      if (c == null) continue;
      points.push({
        timestamp: timestamps[i],
        open: quote.open?.[i] ?? c,
        high: quote.high?.[i] ?? c,
        low: quote.low?.[i] ?? c,
        close: c,
        volume: quote.volume?.[i] ?? 0,
      });
    }

    return NextResponse.json({ points });
  } catch (err) {
    return NextResponse.json(
      { error: "Chart fetch failed", detail: String(err) },
      { status: 500 }
    );
  }
}
