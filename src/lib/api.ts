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

export interface ArticleContent {
  title?: string;
  description?: string;
  content?: string;
  image?: string;
  author?: string;
  published?: string;
  source?: string;
  url?: string;
}

export async function fetchArticleContent(url: string): Promise<ArticleContent | null> {
  const res = await fetch(`${API_BASE}/news/article?url=${encodeURIComponent(url)}`);
  if (!res.ok) return null;
  return res.json();
}

// ─── Portfolio API Types ───

export interface PortfolioQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  sparkline: number[]; // close prices for mini chart
}

export interface MarketIndicator {
  name: string;
  symbol: string;
  value: number;
  change: number;
  changePct: number;
}

export interface StockDetailFull {
  // Quote
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  prevClose: number;
  // About
  description: string;
  ceo: string;
  employees: number;
  headquarters: string;
  founded: string;
  industry: string;
  website: string;
  // Key Stats
  marketCap: string;
  peRatio: string;
  dividendYield: string;
  avgVolume: string;
  volume: string;
  dayHigh: number;
  dayLow: number;
  open: number;
  week52High: number;
  week52Low: number;
  shortFloat: string;
  // Valuation
  forwardPE: string;
  pegRatio: string;
  priceToBook: string;
  priceToSales: string;
  enterpriseValue: string;
  evToRevenue: string;
  evToEBITDA: string;
  bookValue: string;
  // Profitability & Financials
  profitMargin: string;
  operatingMargin: string;
  grossMargin: string;
  returnOnEquity: string;
  returnOnAssets: string;
  revenuePerShare: string;
  totalRevenue: string;
  netIncome: string;
  freeCashFlow: string;
  operatingCashFlow: string;
  totalCash: string;
  totalDebt: string;
  // Balance Sheet Ratios
  debtToEquity: string;
  currentRatio: string;
  quickRatio: string;
  // Technical / Risk
  beta: string;
  fiftyDayMA: string;
  twoHundredDayMA: string;
  // EPS
  trailingEPS: string;
  forwardEPS: string;
  // Share Statistics
  sharesOutstanding: string;
  floatShares: string;
  shortRatio: string;
  sharesShort: string;
  // Ownership
  insiderPercent: string;
  institutionalPercent: string;
  // Price Targets
  targetMeanPrice: number | null;
  targetMedianPrice: number | null;
  targetHighPrice: number | null;
  targetLowPrice: number | null;
  numberOfAnalysts: number;
  recommendationKey: string;
  // Dividends
  exDividendDate: string;
  dividendDate: string;
  // Earnings
  nextEarningsDate: string;
  earningsHistory: { quarter: string; actual: number | null; estimate: number | null }[];
  currentQuarterEstimate: number | null;
  currentQuarterDate: string;
  yearlyFinancials: { year: string; revenue: number | null; earnings: number | null }[];
  quarterlyFinancials: { quarter: string; revenue: number | null; earnings: number | null }[];
  // Analyst Ratings
  analystRatings: {
    buy: number;
    hold: number;
    sell: number;
    total: number;
    buyPercent: number;
    holdPercent: number;
    sellPercent: number;
  };
  recentRatings: { firm: string; toGrade: string; fromGrade: string; action: string; date: string }[];
  // Peers
  peers: { ticker: string; name: string; price: number; change: number; changePct: number }[];
  // Meta
  exchange: string;
  sector: string;
}

export interface ChartDataPoint {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ─── Portfolio API Fetchers ───

export async function fetchPortfolioQuotes(
  symbols: string[]
): Promise<Record<string, PortfolioQuote>> {
  const res = await fetch(`${API_BASE}/portfolio/quotes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symbols }),
  });
  if (!res.ok) throw new Error(`Portfolio quotes failed: ${res.statusText}`);
  return res.json();
}

export async function fetchMarketIndicators(): Promise<{
  indicators: MarketIndicator[];
}> {
  const res = await fetch(`${API_BASE}/portfolio/market`);
  if (!res.ok) throw new Error(`Market indicators failed: ${res.statusText}`);
  return res.json();
}

export async function fetchStockDetailFull(
  ticker: string
): Promise<StockDetailFull> {
  const res = await fetch(`${API_BASE}/portfolio/stock/${ticker}`);
  if (!res.ok) throw new Error(`Stock detail failed: ${res.statusText}`);
  return res.json();
}

export async function fetchStockChart(
  ticker: string,
  period: string
): Promise<{ points: ChartDataPoint[] }> {
  const res = await fetch(`${API_BASE}/portfolio/stock/${ticker}/chart`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ period }),
  });
  if (!res.ok) throw new Error(`Stock chart failed: ${res.statusText}`);
  return res.json();
}

// ─── Strategies API ───

export interface StrategySummary {
  filename: string;
  name: string;
  description: string;
  symbol: string;
  interval: string;
  date: string;
  hasBacktest: boolean;
  hasMonteCarlo: boolean;
  hasWalkForward: boolean;
}

export async function fetchStrategies(): Promise<{ strategies: StrategySummary[] }> {
  const res = await fetch(`${API_BASE}/strategies`);
  if (!res.ok) return { strategies: [] };
  return res.json();
}

export async function fetchStrategy(filename: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_BASE}/strategies/${encodeURIComponent(filename)}`);
  if (!res.ok) throw new Error(`Strategy fetch failed: ${res.statusText}`);
  return res.json();
}
