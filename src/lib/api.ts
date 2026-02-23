import type {
  ChatRequest,
  ChatResponse,
  DataRequest,
  Candle,
  Tick,
  ContractConfig,
} from "./types";

const API_BASE = "/api";

export async function sendChatMessage(req: ChatRequest): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`Chat failed: ${res.statusText}`);
  return res.json();
}

export async function fetchOHLCV(
  req: DataRequest
): Promise<{ symbol: string; candles: Candle[]; count: number }> {
  const res = await fetch(`${API_BASE}/data`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`Data fetch failed: ${res.statusText}`);
  return res.json();
}

export async function fetchTicks(
  symbol: string,
  date?: string,
  limit: number = 50000
): Promise<{ symbol: string; ticks: Tick[]; count: number }> {
  const res = await fetch(`${API_BASE}/ticks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symbol, date, limit }),
  });
  if (!res.ok) throw new Error(`Tick fetch failed: ${res.statusText}`);
  return res.json();
}

export async function fetchContracts(): Promise<Record<string, ContractConfig>> {
  const res = await fetch(`${API_BASE}/data`);
  if (!res.ok) throw new Error(`Contracts fetch failed: ${res.statusText}`);
  return res.json();
}

// ─── News API ───

export interface NewsArticle {
  id: string;
  title: string;
  source: string;
  sourceColor: string;
  time: string;
  category: string;
  sentiment?: "bullish" | "bearish" | "neutral";
  ticker?: string;
  summary?: string;
  url?: string;
}

export interface StockDetailData {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  prevClose: number;
  marketCap: string;
  volume: string;
  pe: string;
  eps: string;
  divYield: string;
  shortInterest: string;
  weekHigh52: number;
  weekLow52: number;
  dayHigh: number;
  dayLow: number;
  exchange: string;
  sector: string;
  ratings: { firm: string; rating: string; date: string }[];
  relatedStocks: {
    ticker: string;
    name: string;
    price: number;
    change: number;
    changePct: number;
  }[];
}

export async function fetchNewsFeed(params?: {
  category?: string;
  ticker?: string;
  source?: string;
  limit?: number;
}): Promise<{ articles: NewsArticle[]; count: number }> {
  const searchParams = new URLSearchParams();
  if (params?.category && params.category !== "All")
    searchParams.set("category", params.category);
  if (params?.ticker) searchParams.set("ticker", params.ticker);
  if (params?.source) searchParams.set("source", params.source);
  if (params?.limit) searchParams.set("limit", String(params.limit));

  const qs = searchParams.toString();
  const res = await fetch(`${API_BASE}/news/feed${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error(`News fetch failed: ${res.statusText}`);
  return res.json();
}

export async function fetchStockDetail(
  ticker: string
): Promise<StockDetailData> {
  const res = await fetch(`${API_BASE}/news/stock/${ticker}`);
  if (!res.ok) throw new Error(`Stock detail failed: ${res.statusText}`);
  return res.json();
}
