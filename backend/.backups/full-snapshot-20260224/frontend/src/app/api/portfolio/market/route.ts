import { NextResponse } from "next/server";

async function fetchYahooQuote(symbol: string): Promise<{
  name: string;
  symbol: string;
  value: number;
  change: number;
  changePct: number;
} | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 0 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const meta = json.chart?.result?.[0]?.meta;
    if (!meta) return null;

    const price = meta.regularMarketPrice ?? 0;
    const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
    const change = price - prevClose;
    const changePct = prevClose ? (change / prevClose) * 100 : 0;

    const nameMap: Record<string, string> = {
      "^GSPC": "S&P 500",
      "^IXIC": "Nasdaq",
      "^DJI": "Dow Jones",
    };

    return {
      name: nameMap[symbol] || symbol,
      symbol,
      value: Math.round(price * 100) / 100,
      change: Math.round(change * 100) / 100,
      changePct: Math.round(changePct * 100) / 100,
    };
  } catch {
    return null;
  }
}

async function fetchBitcoinPrice(): Promise<{
  name: string;
  symbol: string;
  value: number;
  change: number;
  changePct: number;
} | null> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true",
      { next: { revalidate: 0 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const btc = data.bitcoin;
    if (!btc) return null;
    const price = btc.usd;
    const changePct = btc.usd_24h_change ?? 0;
    const change = price * (changePct / 100);
    return {
      name: "Bitcoin",
      symbol: "BTC",
      value: Math.round(price * 100) / 100,
      change: Math.round(change * 100) / 100,
      changePct: Math.round(changePct * 100) / 100,
    };
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const [sp500, nasdaq, btc] = await Promise.all([
      fetchYahooQuote("^GSPC"),
      fetchYahooQuote("^IXIC"),
      fetchBitcoinPrice(),
    ]);

    const indicators = [sp500, nasdaq, btc].filter(Boolean);
    return NextResponse.json({ indicators });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch market data", detail: String(err) },
      { status: 500 }
    );
  }
}
