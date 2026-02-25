import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { symbols } = (await request.json()) as { symbols?: string[] };
    if (!symbols || symbols.length === 0) {
      return NextResponse.json({ error: "Missing symbols array" }, { status: 400 });
    }

    const results: Record<string, unknown> = {};

    // Fetch quotes in parallel (max 20 symbols to avoid rate limits)
    const batch = symbols.slice(0, 20);
    const quotePromises = batch.map(async (sym) => {
      try {
        // Fetch current quote + 1-month sparkline (~20 points for smooth curve)
        const quoteUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1mo`;
        const res = await fetch(quoteUrl, {
          headers: { "User-Agent": "Mozilla/5.0" },
          next: { revalidate: 0 },
        });
        if (!res.ok) return null;
        const json = await res.json();
        const result = json.chart?.result?.[0];
        if (!result) return null;

        const meta = result.meta;
        const quote = result.indicators?.quote?.[0];

        // Build sparkline from close prices
        const sparkline: number[] = [];
        if (quote?.close) {
          for (const c of quote.close) {
            if (c != null) sparkline.push(c);
          }
        }

        const currentPrice = meta.regularMarketPrice ?? sparkline[sparkline.length - 1] ?? 0;
        const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? currentPrice;
        const change = currentPrice - prevClose;
        const changePct = prevClose ? (change / prevClose) * 100 : 0;

        return {
          symbol: sym,
          name: meta.shortName || meta.longName || sym,
          price: Math.round(currentPrice * 100) / 100,
          change: Math.round(change * 100) / 100,
          changePct: Math.round(changePct * 100) / 100,
          sparkline,
        };
      } catch {
        return null;
      }
    });

    const resolved = await Promise.all(quotePromises);
    for (const item of resolved) {
      if (item) results[item.symbol] = item;
    }

    return NextResponse.json(results);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch portfolio quotes", detail: String(err) },
      { status: 500 }
    );
  }
}
