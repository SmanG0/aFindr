import { NextRequest, NextResponse } from "next/server";

// ─── In-memory cache (60s TTL) — avoids hammering Yahoo on repeat loads ───
const cache = new Map<string, { data: Record<string, unknown>; expires: number }>();
const CACHE_TTL = 60_000; // 60 seconds

function getCacheKey(symbols: string[]): string {
  return symbols.slice().sort().join(",");
}

export async function POST(request: NextRequest) {
  try {
    const { symbols } = (await request.json()) as { symbols?: string[] };
    if (!symbols || symbols.length === 0) {
      return NextResponse.json({ error: "Missing symbols array" }, { status: 400 });
    }

    // Check cache first
    const cacheKey = getCacheKey(symbols);
    const cached = cache.get(cacheKey);
    if (cached && Date.now() < cached.expires) {
      return NextResponse.json(cached.data);
    }

    const results: Record<string, unknown> = {};

    // Fetch quotes in parallel (max 20 symbols to avoid rate limits)
    const batch = symbols.slice(0, 20);
    const quotePromises = batch.map(async (sym) => {
      try {
        // Fetch 1-day chart (5-min intervals ≈ 78 points) — fast & enough for sparkline
        const encSym = encodeURIComponent(sym);
        const quoteUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encSym}?interval=5m&range=1d`;
        const res = await fetch(quoteUrl, {
          headers: { "User-Agent": "Mozilla/5.0" },
          next: { revalidate: 120 },
        });
        if (!res.ok) return null;
        const json = await res.json();
        const result = json.chart?.result?.[0];
        if (!result) return null;

        const meta = result.meta;
        const quote = result.indicators?.quote?.[0];

        // Build sparkline from close prices (skip nulls)
        const sparkline: number[] = [];
        if (quote?.close) {
          for (const c of quote.close) {
            if (c != null) sparkline.push(c);
          }
        }

        const currentPrice = meta.regularMarketPrice ?? sparkline[sparkline.length - 1] ?? 0;
        // Use previousClose (yesterday's close) for daily change
        const prevClose = meta.previousClose ?? meta.chartPreviousClose ?? currentPrice;
        const change = currentPrice - prevClose;
        const changePct = prevClose ? (change / prevClose) * 100 : 0;

        // Downsample sparkline to ~30 points for efficient rendering
        const target = 30;
        let sampled = sparkline;
        if (sparkline.length > target) {
          sampled = [];
          for (let i = 0; i < target; i++) {
            const idx = Math.round((i / (target - 1)) * (sparkline.length - 1));
            sampled.push(sparkline[idx]);
          }
        }

        return {
          symbol: sym,
          name: meta.shortName || meta.longName || sym,
          price: Math.round(currentPrice * 100) / 100,
          change: Math.round(change * 100) / 100,
          changePct: Math.round(changePct * 100) / 100,
          sparkline: sampled,
        };
      } catch {
        return null;
      }
    });

    const resolved = await Promise.all(quotePromises);
    for (const item of resolved) {
      if (item) results[item.symbol] = item;
    }

    // Store in cache
    cache.set(cacheKey, { data: results, expires: Date.now() + CACHE_TTL });

    return NextResponse.json(results);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch portfolio quotes", detail: String(err) },
      { status: 500 }
    );
  }
}
