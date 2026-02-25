/**
 * NSE Kenya data fetcher — scrapes daily close prices from afx.kwayisi.org
 * and synthesizes OHLC candles for charting.
 *
 * Usage: prefix tickers with "NSE:" e.g. "NSE:SCOM" for Safaricom
 */

// Known NSE symbols → AFX slug
const NSE_SYMBOLS: Record<string, string> = {
  SCOM: "scom",   // Safaricom
  SMER: "smer",   // Sameer Africa
  EQTY: "eqty",   // Equity Group
  KCB: "kcb",     // KCB Group
  COOP: "coop",   // Co-op Bank
  ABSA: "absa",   // Absa Bank Kenya
  EABL: "eabl",   // East African Breweries
  BAT: "bat",     // BAT Kenya
  KPLC: "kplc",   // Kenya Power
  KQ: "kq",       // Kenya Airways
  BAMB: "bamb",   // Bamburi Cement
  NCBA: "ncba",   // NCBA Group
  BRIT: "brit",    // Britam
  JUB: "jub",     // Jubilee Holdings
  NMG: "nmg",     // Nation Media
  SCBK: "scbk",   // Standard Chartered
  DTK: "dtk",     // Diamond Trust
  HAFR: "hafr",   // HF Group
  NSE: "nse",     // NSE PLC
  KAPC: "kapc",   // KenolKobil (now part of Rubis)
  SASN: "sasn",   // Sasini
  ARM: "arm",     // ARM Cement
  CIC: "cic",     // CIC Group
  KEGN: "kegn",   // KenGen
  KNRE: "knre",   // Kenya Re
  TOTL: "totl",   // TotalEnergies
  SCAN: "scan",   // Scangroup
  SBIC: "sbic",   // Stanbic
  BOC: "boc",     // BOC Kenya
  CTUM: "ctum",   // Centum
  LBTY: "lbty",   // Liberty Kenya
  GLD: "gld",     // Gold (NewGold ETF)
};

// Full company names for display
const NSE_NAMES: Record<string, string> = {
  SCOM: "Safaricom PLC",
  SMER: "Sameer Africa PLC",
  EQTY: "Equity Group Holdings",
  KCB: "KCB Group PLC",
  COOP: "Co-operative Bank",
  ABSA: "Absa Bank Kenya",
  EABL: "East African Breweries",
  BAT: "BAT Kenya",
  KPLC: "Kenya Power",
  KQ: "Kenya Airways",
};

export function isNSETicker(ticker: string): boolean {
  const clean = ticker.replace(/^NSE:/i, "").toUpperCase();
  return clean in NSE_SYMBOLS;
}

export function parseNSETicker(ticker: string): string {
  return ticker.replace(/^NSE:/i, "").toUpperCase();
}

export function getNSEName(symbol: string): string {
  return NSE_NAMES[symbol] || `${symbol} (NSE)`;
}

interface DailyClose {
  date: string; // YYYY-MM-DD
  close: number;
}

// In-memory cache (survives for the lifetime of the serverless function)
const cache: Record<string, { data: DailyClose[]; fetchedAt: number }> = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function fetchDailyCloses(symbol: string): Promise<DailyClose[]> {
  const slug = NSE_SYMBOLS[symbol];
  if (!slug) throw new Error(`Unknown NSE symbol: ${symbol}`);

  // Check cache
  const cached = cache[slug];
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.data;
  }

  const url = `https://afx.kwayisi.org/chart/nse/${slug}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" },
    next: { revalidate: 300 }, // cache for 5min at CDN level
  });

  if (!res.ok) {
    throw new Error(`AFX fetch failed: ${res.status}`);
  }

  const text = await res.text();

  // Parse: d("2016-02-25"),16.5
  const pattern = /d\("(\d{4}-\d{2}-\d{2})"\),(\d+\.?\d*)/g;
  const data: DailyClose[] = [];
  let match;
  while ((match = pattern.exec(text)) !== null) {
    data.push({ date: match[1], close: parseFloat(match[2]) });
  }

  if (data.length === 0) {
    throw new Error(`No price data found for NSE:${symbol}`);
  }

  cache[slug] = { data, fetchedAt: Date.now() };
  return data;
}

export interface NSECandle {
  time: number;       // Unix timestamp (seconds)
  timestamp: number;  // Same, for portfolio chart compat
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Fetch NSE OHLC candles for a symbol.
 * Synthesizes open/high/low from sequential daily closes.
 */
export async function fetchNSECandles(
  symbol: string,
  period?: string,
): Promise<NSECandle[]> {
  const closes = await fetchDailyCloses(symbol);

  // Trim by period
  const now = new Date();
  let cutoff = new Date("2010-01-01");
  switch (period) {
    case "1D":
    case "1d":
      cutoff = new Date(now.getTime() - 1 * 86400000);
      break;
    case "1W":
    case "5d":
      cutoff = new Date(now.getTime() - 7 * 86400000);
      break;
    case "1M":
    case "1mo":
      cutoff = new Date(now.getTime() - 30 * 86400000);
      break;
    case "3M":
    case "3mo":
      cutoff = new Date(now.getTime() - 90 * 86400000);
      break;
    case "6mo":
      cutoff = new Date(now.getTime() - 180 * 86400000);
      break;
    case "YTD":
      cutoff = new Date(now.getFullYear(), 0, 1);
      break;
    case "1Y":
    case "1y":
      cutoff = new Date(now.getTime() - 365 * 86400000);
      break;
    case "2y":
      cutoff = new Date(now.getTime() - 730 * 86400000);
      break;
    case "5Y":
    case "5y":
      cutoff = new Date(now.getTime() - 1825 * 86400000);
      break;
    case "MAX":
    case "max":
    default:
      cutoff = new Date("2010-01-01");
      break;
  }

  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const filtered = closes.filter((c) => c.date >= cutoffStr);

  // Synthesize OHLC from sequential closes
  const candles: NSECandle[] = [];
  for (let i = 0; i < filtered.length; i++) {
    const c = filtered[i];
    const prevClose = i > 0 ? filtered[i - 1].close : c.close;
    const open = prevClose;
    const close = c.close;
    const high = Math.max(open, close) * 1.003; // tiny wick
    const low = Math.min(open, close) * 0.997;

    // Use noon UTC so the date displays correctly in any timezone (UTC-12 to UTC+14)
    const ts = Math.floor(new Date(c.date + "T12:00:00Z").getTime() / 1000);

    candles.push({
      time: ts,
      timestamp: ts,
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
      volume: 0,
    });
  }

  return candles;
}

/**
 * Get all available NSE symbols (for autocomplete/search)
 */
export function getAllNSESymbols(): { symbol: string; name: string; slug: string }[] {
  return Object.entries(NSE_SYMBOLS).map(([symbol, slug]) => ({
    symbol,
    name: NSE_NAMES[symbol] || symbol,
    slug,
  }));
}
