# Portfolio Page Robinhood-Style Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the existing single-column PortfolioPage with a Robinhood-inspired two-column dashboard (portfolio hero + watchlist sidebar) and stock detail drill-down (stats, analyst ratings, chart, peers + order panel sidebar), all in the existing dark warm-brown theme.

**Architecture:** State-driven view switching within the existing PortfolioPage component. `selectedTicker: string | null` controls dashboard vs stock detail. New API routes under `/api/portfolio/` fetch live data from Yahoo Finance (via direct URL fetch from Next.js API routes) and CoinGecko. No routing changes — stays within the `currentPage === "portfolio"` branch.

**Tech Stack:** Next.js 15 App Router API routes, React 19, Framer Motion, raw SVG charts, Yahoo Finance v8 API (direct HTTP), CoinGecko REST API, existing CSS variables + Tailwind + inline styles.

---

## Task 1: API Types & Shared Utilities

**Files:**
- Modify: `src/lib/api.ts` (add new fetch functions + types at end)
- Create: `src/lib/portfolio-utils.ts` (formatting utilities)

**Step 1: Add portfolio types and fetch functions to `src/lib/api.ts`**

Append these types and functions after the existing code:

```typescript
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
  recentRatings: { firm: string; rating: string; date: string }[];
  // Peers
  peers: { ticker: string; name: string; price: number; change: number; changePct: number }[];
  // Meta
  exchange: string;
  sector: string;
}

export interface ChartDataPoint {
  timestamp: number;
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
```

**Step 2: Create `src/lib/portfolio-utils.ts`**

```typescript
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatLargeNumber(value: number | null | undefined): string {
  if (value == null) return "-";
  if (value >= 1e12) return (value / 1e12).toFixed(2) + "T";
  if (value >= 1e9) return (value / 1e9).toFixed(2) + "B";
  if (value >= 1e6) return (value / 1e6).toFixed(2) + "M";
  if (value >= 1e3) return (value / 1e3).toFixed(2) + "K";
  return value.toString();
}

export function formatPercent(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return sign + value.toFixed(2) + "%";
}

export function formatPnl(value: number): string {
  const prefix = value >= 0 ? "+$" : "-$";
  return `${prefix}${Math.abs(value).toFixed(2)}`;
}

export function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const ts = timestamp > 1e12 ? timestamp : timestamp * 1000;
  const diff = now - ts;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return minutes + "m";
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + "h";
  const days = Math.floor(hours / 24);
  return days + "d";
}
```

**Step 3: Verify no type errors**

Run: `cd /Users/saahilmanji/Desktop/afindr && npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors (existing project may have some)

**Step 4: Commit**

```bash
git add src/lib/api.ts src/lib/portfolio-utils.ts
git commit -m "feat(portfolio): add portfolio API types, fetch functions, and formatting utils"
```

---

## Task 2: Portfolio Quotes API Route

**Files:**
- Create: `src/app/api/portfolio/quotes/route.ts`

**Step 1: Create the multi-symbol quotes route**

This route fetches quotes + 5-day sparkline data for all watchlist symbols using Yahoo Finance v8 HTTP API (same pattern as existing `src/app/api/data/route.ts`).

```typescript
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
        // Fetch current quote
        const quoteUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=5d`;
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
        const timestamps = result.timestamp || [];

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
```

**Step 2: Test the route manually**

Run: `curl -s -X POST http://localhost:3000/api/portfolio/quotes -H "Content-Type: application/json" -d '{"symbols":["AAPL","MSFT","NVDA"]}' | head -c 500`
Expected: JSON with quote data for each symbol

**Step 3: Commit**

```bash
git add src/app/api/portfolio/quotes/route.ts
git commit -m "feat(portfolio): add multi-symbol quotes API route"
```

---

## Task 3: Market Indicators API Route

**Files:**
- Create: `src/app/api/portfolio/market/route.ts`

**Step 1: Create market indicators route**

Fetches S&P 500, Nasdaq, and Bitcoin prices.

```typescript
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
```

**Step 2: Test**

Run: `curl -s http://localhost:3000/api/portfolio/market | head -c 500`
Expected: JSON with S&P 500, Nasdaq, Bitcoin indicators

**Step 3: Commit**

```bash
git add src/app/api/portfolio/market/route.ts
git commit -m "feat(portfolio): add market indicators API route (S&P 500, Nasdaq, BTC)"
```

---

## Task 4: Stock Detail Full API Route

**Files:**
- Create: `src/app/api/portfolio/stock/[ticker]/route.ts`

**Step 1: Create comprehensive stock detail route**

This fetches everything needed for the stock detail page from Yahoo Finance v8 API in a single call.

```typescript
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const { ticker } = await params;
    const sym = ticker.toUpperCase();

    // Fetch quote data from Yahoo Finance
    const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=5d`;
    const chartRes = await fetch(chartUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 0 },
    });

    // Fetch detailed info from Yahoo quoteSummary
    const summaryUrl = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym)}?modules=assetProfile,defaultKeyStatistics,financialData,recommendationTrend,earnings`;
    const summaryRes = await fetch(summaryUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 0 },
    });

    if (!chartRes.ok) {
      return NextResponse.json({ error: `Yahoo chart error: ${chartRes.status}` }, { status: chartRes.status });
    }

    const chartJson = await chartRes.json();
    const meta = chartJson.chart?.result?.[0]?.meta;
    if (!meta) {
      return NextResponse.json({ error: "No chart data" }, { status: 404 });
    }

    const price = meta.regularMarketPrice ?? 0;
    const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
    const change = Math.round((price - prevClose) * 100) / 100;
    const changePct = prevClose ? Math.round(((price - prevClose) / prevClose) * 10000) / 100 : 0;

    // Parse quoteSummary if available
    let profile: Record<string, unknown> = {};
    let keyStats: Record<string, unknown> = {};
    let financialData: Record<string, unknown> = {};
    let recTrend: Record<string, unknown>[] = [];

    if (summaryRes.ok) {
      try {
        const summaryJson = await summaryRes.json();
        const result = summaryJson.quoteSummary?.result?.[0];
        if (result) {
          profile = result.assetProfile || {};
          keyStats = result.defaultKeyStatistics || {};
          financialData = result.financialData || {};
          recTrend = result.recommendationTrend?.trend || [];
        }
      } catch { /* ignore parse errors */ }
    }

    // Extract analyst ratings from recommendationTrend
    const latestRec = recTrend.find((t: Record<string, unknown>) => t.period === "0m") || recTrend[0] || {};
    const buy = ((latestRec.strongBuy as number) || 0) + ((latestRec.buy as number) || 0);
    const hold = (latestRec.hold as number) || 0;
    const sell = ((latestRec.sell as number) || 0) + ((latestRec.strongSell as number) || 0);
    const total = buy + hold + sell;

    // Extract values with fallback
    const rawVal = (obj: Record<string, unknown>, key: string): number | null => {
      const v = obj[key];
      if (v && typeof v === "object" && "raw" in (v as Record<string, unknown>)) {
        return (v as { raw: number }).raw;
      }
      return typeof v === "number" ? v : null;
    };

    const fmtLarge = (n: number | null): string => {
      if (n == null) return "-";
      if (n >= 1e12) return (n / 1e12).toFixed(2) + "T";
      if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
      if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
      if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
      return n.toFixed(2);
    };

    // Get officers for CEO
    const officers = (profile.companyOfficers || []) as { name?: string; title?: string }[];
    const ceo = officers.find((o) => o.title?.toLowerCase().includes("ceo"))?.name || officers[0]?.name || "-";

    const data = {
      ticker: sym,
      name: meta.shortName || meta.longName || sym,
      price: Math.round(price * 100) / 100,
      change,
      changePct,
      prevClose: Math.round(prevClose * 100) / 100,
      // About
      description: (profile.longBusinessSummary as string) || "",
      ceo,
      employees: rawVal(profile as Record<string, unknown>, "fullTimeEmployees") || 0,
      headquarters: [profile.city, profile.state].filter(Boolean).join(", ") || "-",
      founded: (profile.startDate as string) || "-",
      // Key Stats
      marketCap: fmtLarge(rawVal(keyStats, "enterpriseValue") || rawVal(financialData, "marketCap")),
      peRatio: rawVal(keyStats, "trailingPE")?.toFixed(2) || "-",
      dividendYield: rawVal(keyStats, "dividendYield") != null
        ? ((rawVal(keyStats, "dividendYield") as number) * 100).toFixed(2) + "%"
        : "-",
      avgVolume: fmtLarge(rawVal(financialData, "averageDailyVolume10Day")),
      volume: fmtLarge(rawVal(financialData, "volume")),
      dayHigh: rawVal(financialData, "dayHigh") || 0,
      dayLow: rawVal(financialData, "dayLow") || 0,
      open: rawVal(financialData, "open") || 0,
      week52High: rawVal(keyStats, "fiftyTwoWeekHigh") || 0,
      week52Low: rawVal(keyStats, "fiftyTwoWeekLow") || 0,
      shortFloat: rawVal(keyStats, "shortPercentOfFloat") != null
        ? ((rawVal(keyStats, "shortPercentOfFloat") as number) * 100).toFixed(2) + "%"
        : "-",
      // Analyst Ratings
      analystRatings: {
        buy,
        hold,
        sell,
        total,
        buyPercent: total > 0 ? Math.round((buy / total) * 1000) / 10 : 0,
        holdPercent: total > 0 ? Math.round((hold / total) * 1000) / 10 : 0,
        sellPercent: total > 0 ? Math.round((sell / total) * 1000) / 10 : 0,
      },
      recentRatings: [] as { firm: string; rating: string; date: string }[],
      // Peers (simple sector-based)
      peers: [] as { ticker: string; name: string; price: number; change: number; changePct: number }[],
      exchange: meta.exchangeName || "-",
      sector: (profile.sector as string) || "-",
    };

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch stock detail", detail: String(err) },
      { status: 500 }
    );
  }
}
```

**Step 2: Test**

Run: `curl -s http://localhost:3000/api/portfolio/stock/META | python3 -m json.tool | head -30`
Expected: Full stock detail JSON

**Step 3: Commit**

```bash
git add src/app/api/portfolio/stock/\[ticker\]/route.ts
git commit -m "feat(portfolio): add comprehensive stock detail API route"
```

---

## Task 5: Stock Chart API Route

**Files:**
- Create: `src/app/api/portfolio/stock/[ticker]/chart/route.ts`

**Step 1: Create chart data route with period mapping**

```typescript
import { NextRequest, NextResponse } from "next/server";

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
    const points: { timestamp: number; close: number; volume: number }[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      const c = quote.close[i];
      if (c == null) continue;
      points.push({
        timestamp: timestamps[i],
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
```

**Step 2: Test**

Run: `curl -s -X POST http://localhost:3000/api/portfolio/stock/AAPL/chart -H "Content-Type: application/json" -d '{"period":"1M"}' | python3 -c "import json,sys;d=json.load(sys.stdin);print(len(d.get('points',[])), 'data points')"`
Expected: Some number of data points (e.g. "150 data points")

**Step 3: Commit**

```bash
git add src/app/api/portfolio/stock/\[ticker\]/chart/route.ts
git commit -m "feat(portfolio): add stock chart API route with period mapping"
```

---

## Task 6: Shared Components (SectionWrapper + SparklineSVG)

**Files:**
- Create: `src/components/PortfolioPage/shared/SectionWrapper.tsx`
- Create: `src/components/PortfolioPage/shared/SparklineSVG.tsx`

**Step 1: Create SectionWrapper**

Every data section on the stock detail page follows the same pattern: h2 heading with a border-bottom separator, then content below. This component standardizes that.

```typescript
"use client";

import React from "react";

interface SectionWrapperProps {
  title: string;
  children: React.ReactNode;
  rightAction?: React.ReactNode;
}

export default function SectionWrapper({ title, children, rightAction }: SectionWrapperProps) {
  return (
    <section style={{ marginBottom: 48 }}>
      <div
        className="flex items-center justify-between"
        style={{
          padding: "16px 0",
          borderBottom: "1px solid var(--glass-border)",
          marginBottom: 24,
        }}
      >
        <h2
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: "var(--text-primary)",
            margin: 0,
          }}
        >
          {title}
        </h2>
        {rightAction}
      </div>
      {children}
    </section>
  );
}
```

**Step 2: Create SparklineSVG**

Reusable sparkline for the watchlist sidebar rows.

```typescript
"use client";

interface SparklineSVGProps {
  data: number[];
  width?: number;
  height?: number;
  positive?: boolean; // true = buy color, false = sell color
}

export default function SparklineSVG({
  data,
  width = 60,
  height = 24,
  positive = true,
}: SparklineSVGProps) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 2;

  const points = data
    .map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = padding + ((max - val) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  const color = positive ? "var(--buy)" : "var(--sell)";

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
```

**Step 3: Commit**

```bash
git add src/components/PortfolioPage/shared/
git commit -m "feat(portfolio): add SectionWrapper and SparklineSVG shared components"
```

---

## Task 7: WatchlistSidebar Component

**Files:**
- Create: `src/components/PortfolioPage/WatchlistSidebar.tsx`

**Step 1: Build the watchlist sidebar**

Sticky sidebar with collapsible sections (Holdings, Watchlist), sparkline mini-charts, and click-to-navigate-to-stock-detail.

```typescript
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import SparklineSVG from "./shared/SparklineSVG";
import type { Position } from "@/lib/types";
import type { PortfolioQuote } from "@/lib/api";
import { SYMBOL_LIBRARY } from "@/lib/symbols";
import { fetchPortfolioQuotes } from "@/lib/api";

interface WatchlistSidebarProps {
  positions: Position[];
  watchlist: string[];
  onWatchlistChange: (list: string[]) => void;
  onSelectTicker: (ticker: string) => void;
  quotes: Record<string, PortfolioQuote>;
}

export default function WatchlistSidebar({
  positions,
  watchlist,
  onWatchlistChange,
  onSelectTicker,
  quotes,
}: WatchlistSidebarProps) {
  const [holdingsExpanded, setHoldingsExpanded] = useState(true);
  const [watchlistExpanded, setWatchlistExpanded] = useState(true);
  const [showAddSearch, setShowAddSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showAddSearch) setTimeout(() => searchInputRef.current?.focus(), 50);
    else setSearchQuery("");
  }, [showAddSearch]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowAddSearch(false);
      }
    };
    if (showAddSearch) {
      window.addEventListener("click", handleClick);
      return () => window.removeEventListener("click", handleClick);
    }
  }, [showAddSearch]);

  const searchResults = useMemo(() => {
    if (!searchQuery) return [];
    const q = searchQuery.toLowerCase();
    return SYMBOL_LIBRARY
      .filter((s) => !watchlist.includes(s.symbol))
      .filter((s) => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [searchQuery, watchlist]);

  const holdingSymbols = [...new Set(positions.map((p) => p.symbol))];

  return (
    <aside
      style={{
        width: 340,
        flexShrink: 0,
        borderLeft: "1px solid var(--glass-border)",
        height: "calc(100vh - 52px)",
        position: "sticky",
        top: 52,
        overflowY: "auto",
        background: "var(--bg)",
      }}
    >
      {/* Holdings Section */}
      {holdingSymbols.length > 0 && (
        <div>
          <button
            onClick={() => setHoldingsExpanded(!holdingsExpanded)}
            className="flex items-center justify-between"
            style={{
              width: "100%",
              padding: "14px 16px",
              background: "none",
              border: "none",
              borderBottom: "1px solid var(--glass-border)",
              cursor: "pointer",
              color: "var(--text-primary)",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <span>Holdings</span>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{
                transform: holdingsExpanded ? "rotate(0deg)" : "rotate(-90deg)",
                transition: "transform 200ms ease",
              }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          <AnimatePresence>
            {holdingsExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{ overflow: "hidden" }}
              >
                {holdingSymbols.map((sym) => {
                  const q = quotes[sym];
                  const pos = positions.find((p) => p.symbol === sym);
                  return (
                    <SidebarRow
                      key={sym}
                      symbol={sym}
                      subtitle={pos ? `${pos.size} shares` : ""}
                      price={q?.price}
                      changePct={q?.changePct}
                      sparkline={q?.sparkline}
                      onClick={() => onSelectTicker(sym)}
                    />
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Watchlist Section */}
      <div>
        <div
          className="flex items-center justify-between"
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid var(--glass-border)",
          }}
        >
          <button
            onClick={() => setWatchlistExpanded(!watchlistExpanded)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-primary)",
              fontSize: 13,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: 0,
            }}
          >
            Watchlist
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{
                transform: watchlistExpanded ? "rotate(0deg)" : "rotate(-90deg)",
                transition: "transform 200ms ease",
              }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          <div ref={searchContainerRef} style={{ position: "relative" }}>
            <button
              onClick={() => setShowAddSearch(!showAddSearch)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "4px 10px",
                borderRadius: 6,
                background: showAddSearch ? "rgba(236,227,213,0.08)" : "transparent",
                border: "1px solid rgba(236,227,213,0.08)",
                color: "var(--text-muted)",
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add
            </button>
            {showAddSearch && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  right: 0,
                  marginTop: 6,
                  width: 280,
                  background: "rgba(24,22,18,0.98)",
                  border: "1px solid rgba(236,227,213,0.12)",
                  borderRadius: 12,
                  boxShadow: "0 12px 40px rgba(15,12,8,0.6)",
                  backdropFilter: "blur(20px)",
                  zIndex: 50,
                  overflow: "hidden",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderBottom: "1px solid rgba(236,227,213,0.08)" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search symbols..."
                    style={{
                      flex: 1,
                      background: "transparent",
                      border: "none",
                      outline: "none",
                      fontSize: 12,
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
                <div style={{ maxHeight: 280, overflowY: "auto" }}>
                  {searchResults.length === 0 && searchQuery && (
                    <div style={{ padding: "20px 12px", textAlign: "center", color: "var(--text-muted)", fontSize: 11 }}>
                      No matches
                    </div>
                  )}
                  {!searchQuery && (
                    <div style={{ padding: "20px 12px", textAlign: "center", color: "var(--text-muted)", fontSize: 11 }}>
                      Type to search
                    </div>
                  )}
                  {searchResults.map((entry) => (
                    <button
                      key={entry.symbol}
                      onClick={() => {
                        onWatchlistChange([...watchlist, entry.symbol]);
                        setShowAddSearch(false);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        width: "100%",
                        padding: "8px 12px",
                        border: "none",
                        cursor: "pointer",
                        background: "transparent",
                        color: "var(--text-primary)",
                        textAlign: "left",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(236,227,213,0.04)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <span style={{ fontWeight: 600, fontSize: 12, fontFamily: "var(--font-mono)", minWidth: 60 }}>{entry.symbol}</span>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        <AnimatePresence>
          {watchlistExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ overflow: "hidden" }}
            >
              {watchlist.map((sym) => {
                const q = quotes[sym];
                return (
                  <SidebarRow
                    key={sym}
                    symbol={sym}
                    price={q?.price}
                    changePct={q?.changePct}
                    sparkline={q?.sparkline}
                    onClick={() => onSelectTicker(sym)}
                    onRemove={() => onWatchlistChange(watchlist.filter((s) => s !== sym))}
                  />
                );
              })}
              {watchlist.length === 0 && (
                <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
                  No symbols in watchlist
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </aside>
  );
}

// ─── Sidebar Row ───

function SidebarRow({
  symbol,
  subtitle,
  price,
  changePct,
  sparkline,
  onClick,
  onRemove,
}: {
  symbol: string;
  subtitle?: string;
  price?: number;
  changePct?: number;
  sparkline?: number[];
  onClick: () => void;
  onRemove?: () => void;
}) {
  const isPositive = (changePct ?? 0) >= 0;

  return (
    <div
      className="flex items-center"
      onClick={onClick}
      style={{
        padding: "10px 16px",
        borderBottom: "1px solid rgba(236,227,213,0.04)",
        cursor: "pointer",
        transition: "background 80ms ease",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(236,227,213,0.03)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      <div style={{ flex: "1 1 0", minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
          {symbol}
        </div>
        {subtitle && (
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            {subtitle}
          </div>
        )}
      </div>
      <div style={{ flex: "0 0 60px", margin: "0 12px" }}>
        {sparkline && sparkline.length > 1 && (
          <SparklineSVG data={sparkline} positive={isPositive} />
        )}
      </div>
      <div style={{ textAlign: "right", minWidth: 80 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>
          {price != null ? `$${price.toFixed(2)}` : "..."}
        </div>
        <div
          style={{
            fontSize: 11,
            fontFamily: "var(--font-mono)",
            fontVariantNumeric: "tabular-nums",
            color: isPositive ? "var(--buy)" : "var(--sell)",
          }}
        >
          {changePct != null ? `${isPositive ? "+" : ""}${changePct.toFixed(2)}%` : ""}
        </div>
      </div>
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          style={{
            marginLeft: 8,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--text-muted)",
            padding: 4,
            borderRadius: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--sell)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/PortfolioPage/WatchlistSidebar.tsx
git commit -m "feat(portfolio): add WatchlistSidebar with sparklines, collapsible sections, search"
```

---

## Task 8: PortfolioDashboard Component (Main Content)

**Files:**
- Create: `src/components/PortfolioPage/PortfolioDashboard.tsx`

**Step 1: Build the dashboard main column**

Portfolio hero (balance + change + equity sparkline), time period selector, buying power bar, market indicators bar, and news feed — all in a single scrollable main column.

```typescript
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import type { AccountState } from "@/lib/types";
import type { MarketIndicator } from "@/lib/api";
import { fetchMarketIndicators, fetchNewsFeed } from "@/lib/api";
import type { NewsArticle } from "@/lib/api";
import { formatPnl, formatPercent, formatTimeAgo } from "@/lib/portfolio-utils";

interface PortfolioDashboardProps {
  accountState: AccountState;
  currentPrice: number;
  onSelectTicker: (ticker: string) => void;
}

const TIME_PERIODS = ["1D", "1W", "1M", "3M", "YTD", "1Y", "ALL"];

export default function PortfolioDashboard({
  accountState,
  currentPrice,
  onSelectTicker,
}: PortfolioDashboardProps) {
  const [activePeriod, setActivePeriod] = useState("1D");
  const [showBuyingPower, setShowBuyingPower] = useState(false);
  const [marketIndicators, setMarketIndicators] = useState<MarketIndicator[]>([]);
  const [news, setNews] = useState<NewsArticle[]>([]);

  // Fetch market indicators
  useEffect(() => {
    fetchMarketIndicators()
      .then((data) => setMarketIndicators(data.indicators))
      .catch(() => {});
  }, []);

  // Fetch news
  useEffect(() => {
    fetchNewsFeed({ limit: 10 })
      .then((data) => setNews(data.articles || []))
      .catch(() => {});
  }, []);

  const stats = useMemo(() => {
    const initialBalance = 25000;
    const totalChange = accountState.equity - initialBalance;
    const totalChangePct = (totalChange / initialBalance) * 100;
    const dayPnl = accountState.unrealizedPnl + accountState.tradeHistory.reduce((sum, t) => {
      const today = new Date().toDateString();
      const tradeDate = new Date(t.exitTime > 1e12 ? t.exitTime : t.exitTime * 1000).toDateString();
      return tradeDate === today ? sum + t.pnl : sum;
    }, 0);
    const dayPnlPct = initialBalance > 0 ? (dayPnl / initialBalance) * 100 : 0;

    // Build equity curve
    let bal = initialBalance;
    const equityPoints = [{ time: 0, value: bal }];
    for (const t of accountState.tradeHistory) {
      bal += t.pnl;
      equityPoints.push({ time: t.exitTime, value: bal });
    }
    equityPoints.push({ time: Date.now(), value: accountState.equity });

    return { totalChange, totalChangePct, dayPnl, dayPnlPct, equityPoints };
  }, [accountState]);

  const isUp = stats.totalChange >= 0;

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "0 32px 64px" }}>
      <div style={{ maxWidth: 900 }}>
        {/* ─── Portfolio Hero ─── */}
        <div style={{ paddingTop: 32 }}>
          <div style={{ fontSize: 28, fontWeight: 500, color: "var(--text-primary)", marginBottom: 8 }}>
            Individual
          </div>
          <div
            style={{
              fontSize: 44,
              fontWeight: 800,
              color: "var(--text-primary)",
              fontFamily: "var(--font-mono)",
              fontVariantNumeric: "tabular-nums",
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
            }}
          >
            ${accountState.equity.toFixed(2)}
          </div>
          <div className="flex items-center gap-2" style={{ marginTop: 8 }}>
            <span
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: isUp ? "var(--buy)" : "var(--sell)",
                fontFamily: "var(--font-mono)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatPnl(stats.totalChange)} ({formatPercent(stats.totalChangePct)})
            </span>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>All time</span>
          </div>
          <div style={{ marginTop: 4 }}>
            <span
              style={{
                fontSize: 13,
                color: stats.dayPnl >= 0 ? "var(--buy)" : "var(--sell)",
                fontFamily: "var(--font-mono)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatPnl(stats.dayPnl)} ({formatPercent(stats.dayPnlPct)})
            </span>
            <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 8 }}>Today</span>
          </div>
        </div>

        {/* ─── Equity Chart ─── */}
        {stats.equityPoints.length > 2 && (
          <div style={{ height: 200, marginTop: 24, position: "relative" }}>
            <EquityChart points={stats.equityPoints} isUp={isUp} />
          </div>
        )}

        {/* ─── Time Period Selector ─── */}
        <nav className="flex items-center" style={{ gap: 24, padding: "16px 0", marginTop: 8 }}>
          {TIME_PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setActivePeriod(p)}
              style={{
                background: "none",
                border: "none",
                borderBottom: activePeriod === p ? `2px solid ${isUp ? "var(--buy)" : "var(--sell)"}` : "2px solid transparent",
                padding: "0 0 10px",
                fontSize: 13,
                fontFamily: "var(--font-mono)",
                fontWeight: activePeriod === p ? 600 : 400,
                color: activePeriod === p ? (isUp ? "var(--buy)" : "var(--sell)") : "var(--text-muted)",
                cursor: "pointer",
                transition: "color 200ms ease",
              }}
            >
              {p}
            </button>
          ))}
        </nav>

        {/* ─── Buying Power ─── */}
        <button
          onClick={() => setShowBuyingPower(!showBuyingPower)}
          className="flex items-center justify-between"
          style={{
            width: "100%",
            padding: "16px 0",
            background: "none",
            border: "none",
            borderTop: "1px solid var(--glass-border)",
            cursor: "pointer",
            color: "var(--text-primary)",
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 600 }}>Buying power</span>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 15, fontWeight: 600, fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>
              ${accountState.balance.toFixed(2)}
            </span>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ transform: showBuyingPower ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 200ms ease" }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </button>
        {showBuyingPower && (
          <div style={{ padding: "0 0 16px", borderBottom: "1px solid var(--glass-border)" }}>
            <div className="flex items-center justify-between" style={{ padding: "8px 0", fontSize: 13, color: "var(--text-secondary)" }}>
              <span>Cash available</span>
              <span style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>${accountState.balance.toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* ─── Market Indicators Bar ─── */}
        {marketIndicators.length > 0 && (
          <div
            className="flex justify-around"
            style={{
              background: "var(--bg-surface)",
              padding: "14px 20px",
              borderRadius: 10,
              margin: "20px 0",
            }}
          >
            {marketIndicators.map((ind) => {
              const up = ind.changePct >= 0;
              return (
                <div key={ind.symbol} className="flex items-center gap-2" style={{ fontSize: 13 }}>
                  <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{ind.name}</span>
                  <span style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>
                    {ind.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={up ? "var(--buy)" : "var(--sell)"} strokeWidth="3">
                    {up ? <polyline points="18 15 12 9 6 15" /> : <polyline points="6 9 12 15 18 9" />}
                  </svg>
                  <span style={{ color: up ? "var(--buy)" : "var(--sell)", fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>
                    {Math.abs(ind.changePct).toFixed(2)}%
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* ─── News Feed ─── */}
        {news.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>News</h2>
            {news.map((article) => (
              <a
                key={article.id}
                href={article.url || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="flex"
                style={{
                  gap: 16,
                  padding: "20px 0",
                  borderBottom: "1px solid var(--glass-border)",
                  textDecoration: "none",
                  color: "inherit",
                  transition: "background 80ms ease",
                }}
              >
                <div style={{ flex: 1 }}>
                  <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{article.source}</span>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{article.time}</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.4, marginBottom: 6 }}>
                    {article.title}
                  </div>
                  {article.summary && (
                    <div style={{ fontSize: 12, color: "var(--text-muted)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {article.summary}
                    </div>
                  )}
                  {article.ticker && (
                    <div style={{ marginTop: 8 }}>
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSelectTicker(article.ticker!); }}
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          fontFamily: "var(--font-mono)",
                          color: article.sentiment === "bullish" ? "var(--buy)" : article.sentiment === "bearish" ? "var(--sell)" : "var(--text-secondary)",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: 0,
                        }}
                      >
                        {article.ticker}
                      </button>
                    </div>
                  )}
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Equity Chart (SVG) ───

function EquityChart({ points, isUp }: { points: { time: number; value: number }[]; isUp: boolean }) {
  const svgWidth = 900;
  const svgHeight = 200;
  const padding = 4;

  const min = Math.min(...points.map((p) => p.value));
  const max = Math.max(...points.map((p) => p.value));
  const range = max - min || 1;

  const pathPoints = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * svgWidth;
      const y = padding + ((max - p.value) / range) * (svgHeight - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  const fillPoints = `0,${svgHeight} ${pathPoints} ${svgWidth},${svgHeight}`;
  const color = isUp ? "var(--buy)" : "var(--sell)";
  const fillColor = isUp ? "rgba(34,171,148,0.08)" : "rgba(229,77,77,0.08)";

  // Reference line at starting value
  const refY = padding + ((max - points[0].value) / range) * (svgHeight - padding * 2);

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${svgWidth} ${svgHeight}`} preserveAspectRatio="none">
      <line
        x1="0"
        y1={refY}
        x2={svgWidth}
        y2={refY}
        stroke="var(--glass-border)"
        strokeWidth="1"
        strokeDasharray="4 4"
        vectorEffect="non-scaling-stroke"
      />
      <polygon points={fillPoints} fill={fillColor} />
      <polyline
        points={pathPoints}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/PortfolioPage/PortfolioDashboard.tsx
git commit -m "feat(portfolio): add PortfolioDashboard with hero, chart, market bar, and news"
```

---

## Task 9: StockDetailView Component

**Files:**
- Create: `src/components/PortfolioPage/StockDetailView.tsx`

**Step 1: Build the stock detail main content**

This is the most complex component. When a user clicks a ticker, it shows: stock header, SVG line chart with time period selector, about section, key statistics grid, analyst ratings with bar breakdown, and people also own horizontal cards.

```typescript
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import SectionWrapper from "./shared/SectionWrapper";
import type { StockDetailFull, ChartDataPoint } from "@/lib/api";
import { fetchStockDetailFull, fetchStockChart } from "@/lib/api";
import { formatCurrency } from "@/lib/portfolio-utils";

interface StockDetailViewProps {
  ticker: string;
  onBack: () => void;
  onSelectTicker: (ticker: string) => void;
}

const CHART_PERIODS = ["1D", "1W", "1M", "3M", "YTD", "1Y", "5Y", "MAX"];

export default function StockDetailView({ ticker, onBack, onSelectTicker }: StockDetailViewProps) {
  const [detail, setDetail] = useState<StockDetailFull | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [activePeriod, setActivePeriod] = useState("1M");
  const [loading, setLoading] = useState(true);
  const [showFullDescription, setShowFullDescription] = useState(false);

  // Fetch stock detail
  useEffect(() => {
    setLoading(true);
    fetchStockDetailFull(ticker)
      .then((data) => setDetail(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [ticker]);

  // Fetch chart data
  useEffect(() => {
    fetchStockChart(ticker, activePeriod)
      .then((data) => setChartData(data.points || []))
      .catch(() => setChartData([]));
  }, [ticker, activePeriod]);

  if (loading || !detail) {
    return (
      <div style={{ flex: 1, padding: "32px 32px 64px", overflowY: "auto" }}>
        <BackButton onClick={onBack} />
        <div style={{ maxWidth: 900 }}>
          {/* Skeleton loading */}
          <div className="skeleton" style={{ height: 32, width: 200, marginBottom: 12 }} />
          <div className="skeleton" style={{ height: 40, width: 160, marginBottom: 8 }} />
          <div className="skeleton" style={{ height: 20, width: 120, marginBottom: 32 }} />
          <div className="skeleton" style={{ height: 250, width: "100%", marginBottom: 24 }} />
        </div>
      </div>
    );
  }

  const isUp = detail.change >= 0;

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "0 32px 64px" }}>
      <div style={{ maxWidth: 900 }}>
        {/* Back Button */}
        <div style={{ paddingTop: 16, marginBottom: 8 }}>
          <BackButton onClick={onBack} />
        </div>

        {/* ─── Stock Header ─── */}
        <div style={{ marginBottom: 8 }}>
          <h1 style={{ fontSize: 28, fontWeight: 500, color: "var(--text-primary)", margin: 0, lineHeight: 1.3 }}>
            {detail.name}
          </h1>
        </div>
        <div>
          <span
            style={{
              fontSize: 36,
              fontWeight: 800,
              color: "var(--text-primary)",
              fontFamily: "var(--font-mono)",
              fontVariantNumeric: "tabular-nums",
              letterSpacing: "-0.02em",
            }}
          >
            {formatCurrency(detail.price)}
          </span>
        </div>
        <div className="flex items-center gap-2" style={{ marginTop: 4 }}>
          <span
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: isUp ? "var(--buy)" : "var(--sell)",
              fontFamily: "var(--font-mono)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {isUp ? "+" : ""}${detail.change.toFixed(2)} ({isUp ? "+" : ""}{detail.changePct.toFixed(2)}%)
          </span>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Today</span>
        </div>

        {/* ─── Chart ─── */}
        <div style={{ height: 250, marginTop: 24, position: "relative" }}>
          <StockChartSVG data={chartData} isUp={isUp} prevClose={detail.prevClose} />
        </div>

        {/* ─── Time Period Selector ─── */}
        <nav className="flex items-center" style={{ gap: 20, padding: "16px 0", marginTop: 4 }}>
          {CHART_PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setActivePeriod(p)}
              style={{
                background: "none",
                border: "none",
                borderBottom: activePeriod === p ? `2px solid ${isUp ? "var(--buy)" : "var(--sell)"}` : "2px solid transparent",
                padding: "0 0 10px",
                fontSize: 13,
                fontFamily: "var(--font-mono)",
                fontWeight: activePeriod === p ? 600 : 400,
                color: activePeriod === p ? (isUp ? "var(--buy)" : "var(--sell)") : "var(--text-muted)",
                cursor: "pointer",
              }}
            >
              {p}
            </button>
          ))}
        </nav>

        {/* ─── About ─── */}
        {detail.description && (
          <SectionWrapper title="About">
            <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.7, margin: 0 }}>
              {showFullDescription ? detail.description : detail.description.slice(0, 300)}
              {detail.description.length > 300 && (
                <button
                  onClick={() => setShowFullDescription(!showFullDescription)}
                  style={{ background: "none", border: "none", color: "var(--accent-bright)", fontSize: 14, fontWeight: 600, cursor: "pointer", marginLeft: 4 }}
                >
                  {showFullDescription ? "Show less" : "Show more"}
                </button>
              )}
            </p>
            <div className="flex gap-12 flex-wrap" style={{ marginTop: 24 }}>
              {detail.ceo && detail.ceo !== "-" && <MetaItem label="CEO" value={detail.ceo} />}
              {detail.employees > 0 && <MetaItem label="Employees" value={detail.employees.toLocaleString()} />}
              {detail.headquarters !== "-" && <MetaItem label="Headquarters" value={detail.headquarters} />}
              {detail.sector !== "-" && <MetaItem label="Sector" value={detail.sector} />}
            </div>
          </SectionWrapper>
        )}

        {/* ─── Key Statistics ─── */}
        <SectionWrapper title="Key statistics">
          <div style={{ display: "flex", flexWrap: "wrap" }}>
            <StatItem label="Market cap" value={detail.marketCap} />
            <StatItem label="Price-Earnings ratio" value={detail.peRatio} />
            <StatItem label="Dividend yield" value={detail.dividendYield} />
            <StatItem label="Average volume" value={detail.avgVolume} />
            <StatItem label="High today" value={detail.dayHigh ? formatCurrency(detail.dayHigh) : "-"} />
            <StatItem label="Low today" value={detail.dayLow ? formatCurrency(detail.dayLow) : "-"} />
            <StatItem label="Open price" value={detail.open ? formatCurrency(detail.open) : "-"} />
            <StatItem label="Volume" value={detail.volume} />
            <StatItem label="52 Week high" value={detail.week52High ? formatCurrency(detail.week52High) : "-"} />
            <StatItem label="52 Week low" value={detail.week52Low ? formatCurrency(detail.week52Low) : "-"} />
            <StatItem label="Short float" value={detail.shortFloat} />
            <StatItem label="Exchange" value={detail.exchange} />
          </div>
        </SectionWrapper>

        {/* ─── Analyst Ratings ─── */}
        {detail.analystRatings.total > 0 && (
          <SectionWrapper title="Analyst ratings">
            <div className="flex items-center gap-12" style={{ padding: "16px 0" }}>
              {/* Circle percentage */}
              <div style={{ textAlign: "center", minWidth: 100 }}>
                <div
                  style={{
                    fontSize: 44,
                    fontWeight: 800,
                    fontFamily: "var(--font-mono)",
                    color: detail.analystRatings.buyPercent > 50 ? "var(--buy)" : "var(--sell)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {detail.analystRatings.buyPercent.toFixed(0)}%
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                  of {detail.analystRatings.total} ratings
                </div>
              </div>

              {/* Bar breakdown */}
              <div style={{ flex: 1 }}>
                <RatingBar label="Buy" percent={detail.analystRatings.buyPercent} color="var(--buy)" />
                <RatingBar label="Hold" percent={detail.analystRatings.holdPercent} color="var(--text-primary)" />
                <RatingBar label="Sell" percent={detail.analystRatings.sellPercent} color="var(--sell)" />
              </div>
            </div>
          </SectionWrapper>
        )}

        {/* ─── People Also Own ─── */}
        {detail.peers.length > 0 && (
          <SectionWrapper title="People also own">
            <div className="flex gap-4" style={{ overflowX: "auto", padding: "8px 0" }}>
              {detail.peers.map((peer) => {
                const peerUp = peer.changePct >= 0;
                return (
                  <motion.button
                    key={peer.ticker}
                    onClick={() => onSelectTicker(peer.ticker)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                      flex: "0 0 140px",
                      padding: 16,
                      border: "1px solid var(--glass-border)",
                      borderRadius: 10,
                      background: "var(--bg-raised)",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                      textAlign: "left",
                      color: "inherit",
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
                      {peer.ticker}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {peer.name}
                    </span>
                    <span
                      style={{
                        fontSize: 18,
                        fontWeight: 700,
                        fontFamily: "var(--font-mono)",
                        fontVariantNumeric: "tabular-nums",
                        color: peerUp ? "var(--buy)" : "var(--sell)",
                      }}
                    >
                      {formatCurrency(peer.price)}
                    </span>
                    <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: peerUp ? "var(--buy)" : "var(--sell)" }}>
                      {peerUp ? "+" : ""}{peer.changePct.toFixed(2)}%
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </SectionWrapper>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1"
      style={{
        background: "none",
        border: "none",
        color: "var(--text-muted)",
        cursor: "pointer",
        fontSize: 13,
        padding: 0,
        transition: "color 100ms ease",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-primary)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="15 18 9 12 15 6" />
      </svg>
      Back
    </button>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{value}</div>
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: "0 0 25%", padding: "14px 0", borderBottom: "1px solid var(--glass-border)" }}>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
    </div>
  );
}

function RatingBar({ label, percent, color }: { label: string; percent: number; color: string }) {
  return (
    <div className="flex items-center gap-3" style={{ marginBottom: 8 }}>
      <span style={{ width: 36, fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{label}</span>
      <div style={{ flex: 1, height: 6, background: "var(--glass-border)", borderRadius: 3, overflow: "hidden" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          style={{ height: "100%", borderRadius: 3, background: color }}
        />
      </div>
      <span style={{ width: 40, textAlign: "right", fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
        {percent.toFixed(1)}%
      </span>
    </div>
  );
}

// ─── Stock Chart SVG with hover crosshair ───

function StockChartSVG({ data, isUp, prevClose }: { data: ChartDataPoint[]; isUp: boolean; prevClose: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const svgWidth = 900;
  const svgHeight = 250;
  const padding = 4;

  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center" style={{ height: "100%", color: "var(--text-muted)", fontSize: 13 }}>
        No chart data available
      </div>
    );
  }

  const closes = data.map((d) => d.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;

  const toY = (val: number) => padding + ((max - val) / range) * (svgHeight - padding * 2);
  const toX = (i: number) => (i / (data.length - 1)) * svgWidth;

  const pathD = data.map((d, i) => `${i === 0 ? "M" : "L"}${toX(i)},${toY(d.close)}`).join(" ");
  const fillD = `M0,${svgHeight} ${data.map((d, i) => `L${toX(i)},${toY(d.close)}`).join(" ")} L${svgWidth},${svgHeight} Z`;

  const color = isUp ? "var(--buy)" : "var(--sell)";
  const fillColor = isUp ? "rgba(34,171,148,0.06)" : "rgba(229,77,77,0.06)";

  // Reference line (previous close)
  const refY = toY(prevClose);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const ratio = x / rect.width;
      const idx = Math.min(Math.max(Math.round(ratio * (data.length - 1)), 0), data.length - 1);
      setHoverIndex(idx);
    },
    [data.length]
  );

  const hoverPoint = hoverIndex != null ? data[hoverIndex] : null;

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", position: "relative", cursor: "crosshair" }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoverIndex(null)}
    >
      <svg width="100%" height="100%" viewBox={`0 0 ${svgWidth} ${svgHeight}`} preserveAspectRatio="none">
        {/* Reference line */}
        <line x1="0" y1={refY} x2={svgWidth} y2={refY} stroke="var(--glass-border)" strokeWidth="1" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
        {/* Fill */}
        <path d={fillD} fill={fillColor} />
        {/* Line */}
        <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {/* Hover crosshair */}
        {hoverIndex != null && (
          <>
            <line x1={toX(hoverIndex)} y1={0} x2={toX(hoverIndex)} y2={svgHeight} stroke="var(--text-muted)" strokeWidth="1" vectorEffect="non-scaling-stroke" opacity={0.4} />
            <circle cx={toX(hoverIndex)} cy={toY(data[hoverIndex].close)} r="4" fill={color} stroke="var(--bg)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </>
        )}
      </svg>
      {/* Hover tooltip */}
      {hoverPoint && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            fontSize: 12,
            fontFamily: "var(--font-mono)",
            color: "var(--text-secondary)",
            pointerEvents: "none",
          }}
        >
          ${hoverPoint.close.toFixed(2)} · {new Date(hoverPoint.timestamp * 1000).toLocaleString()}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/PortfolioPage/StockDetailView.tsx
git commit -m "feat(portfolio): add StockDetailView with chart, about, stats, ratings, peers"
```

---

## Task 10: OrderPanel Sidebar

**Files:**
- Create: `src/components/PortfolioPage/OrderPanel.tsx`

**Step 1: Build the trade order panel**

Sticky sidebar with buy/sell form (visual only, wired to display only).

```typescript
"use client";

import { useState } from "react";

interface OrderPanelProps {
  ticker: string;
  price: number;
  buyingPower: number;
}

export default function OrderPanel({ ticker, price, buyingPower }: OrderPanelProps) {
  const [orderType, setOrderType] = useState("market");
  const [buyIn, setBuyIn] = useState<"shares" | "dollars">("dollars");
  const [amount, setAmount] = useState("");

  const estimatedQty = buyIn === "dollars" && amount && price > 0
    ? (parseFloat(amount) / price).toFixed(4)
    : amount || "0";

  return (
    <aside
      style={{
        width: 300,
        flexShrink: 0,
        position: "sticky",
        top: 52,
        height: "fit-content",
        padding: "24px 20px",
      }}
    >
      <div
        style={{
          background: "var(--bg-raised)",
          border: "1px solid var(--glass-border)",
          borderRadius: 10,
          padding: 24,
          boxShadow: "var(--shadow-md)",
        }}
      >
        {/* Header */}
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 20 }}>
          Buy {ticker}
        </div>

        {/* Order Type */}
        <div className="flex items-center justify-between" style={{ padding: "12px 0", borderBottom: "1px solid var(--glass-border)" }}>
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Order type</span>
          <select
            value={orderType}
            onChange={(e) => setOrderType(e.target.value)}
            style={{
              background: "var(--bg)",
              border: "1px solid var(--glass-border)",
              borderRadius: 6,
              padding: "6px 10px",
              fontSize: 12,
              color: "var(--text-primary)",
              cursor: "pointer",
              minWidth: 120,
              textAlign: "right",
            }}
          >
            <option value="market">Market</option>
            <option value="limit">Limit</option>
            <option value="stop">Stop loss</option>
            <option value="stop_limit">Stop limit</option>
          </select>
        </div>

        {/* Buy In */}
        <div className="flex items-center justify-between" style={{ padding: "12px 0", borderBottom: "1px solid var(--glass-border)" }}>
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Buy in</span>
          <select
            value={buyIn}
            onChange={(e) => setBuyIn(e.target.value as "shares" | "dollars")}
            style={{
              background: "var(--bg)",
              border: "1px solid var(--glass-border)",
              borderRadius: 6,
              padding: "6px 10px",
              fontSize: 12,
              color: "var(--text-primary)",
              cursor: "pointer",
              minWidth: 120,
              textAlign: "right",
            }}
          >
            <option value="dollars">Dollars</option>
            <option value="shares">Shares</option>
          </select>
        </div>

        {/* Amount */}
        <div className="flex items-center justify-between" style={{ padding: "12px 0", borderBottom: "1px solid var(--glass-border)" }}>
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Amount</span>
          <input
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder={buyIn === "dollars" ? "$0.00" : "0"}
            style={{
              background: "var(--bg)",
              border: "1px solid var(--glass-border)",
              borderRadius: 6,
              padding: "6px 10px",
              fontSize: 12,
              color: "var(--text-primary)",
              textAlign: "right",
              width: 120,
              outline: "none",
              fontFamily: "var(--font-mono)",
            }}
          />
        </div>

        {/* Estimate */}
        <div className="flex items-center justify-between" style={{ padding: "14px 0" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
            {buyIn === "dollars" ? "Est. quantity" : "Est. cost"}
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
            {buyIn === "dollars" ? estimatedQty : amount ? `$${(parseFloat(amount) * price).toFixed(2)}` : "$0.00"}
          </span>
        </div>

        {/* Submit Button */}
        <button
          style={{
            width: "100%",
            height: 44,
            borderRadius: 22,
            background: "var(--accent)",
            color: "#fff",
            border: "none",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            transition: "opacity 150ms ease",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.85"; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
        >
          Review Order
        </button>

        {/* Buying Power */}
        <div style={{ textAlign: "center", marginTop: 14, fontSize: 12, color: "var(--text-muted)" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>
            ${buyingPower.toFixed(2)}
          </span>{" "}
          buying power available
        </div>
      </div>

      {/* Secondary buttons */}
      <button
        style={{
          width: "100%",
          height: 44,
          borderRadius: 22,
          background: "transparent",
          color: "var(--accent-bright)",
          border: "1px solid var(--accent)",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          marginTop: 12,
        }}
      >
        Trade {ticker} Options
      </button>
    </aside>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/PortfolioPage/OrderPanel.tsx
git commit -m "feat(portfolio): add OrderPanel sidebar with buy form"
```

---

## Task 11: Rewrite PortfolioPage Orchestrator

**Files:**
- Modify: `src/components/PortfolioPage/PortfolioPage.tsx` (full rewrite)

**Step 1: Rewrite the orchestrator component**

This component manages `selectedTicker` state, fetches quotes for the sidebar, and renders either the Dashboard or StockDetail view.

```typescript
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { AccountState } from "@/lib/types";
import type { PortfolioQuote } from "@/lib/api";
import { fetchPortfolioQuotes } from "@/lib/api";
import PortfolioDashboard from "./PortfolioDashboard";
import StockDetailView from "./StockDetailView";
import WatchlistSidebar from "./WatchlistSidebar";
import OrderPanel from "./OrderPanel";

interface PortfolioPageProps {
  accountState: AccountState;
  currentPrice: number;
}

export default function PortfolioPage({ accountState, currentPrice }: PortfolioPageProps) {
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<Record<string, PortfolioQuote>>({});
  const [watchlist, setWatchlist] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("afindr_watchlist");
      return saved ? JSON.parse(saved) : ["AAPL", "MSFT", "NVDA", "META", "GOOGL"];
    }
    return ["AAPL", "MSFT", "NVDA", "META", "GOOGL"];
  });

  const quoteFetchRef = useRef(false);

  // Persist watchlist
  useEffect(() => {
    localStorage.setItem("afindr_watchlist", JSON.stringify(watchlist));
  }, [watchlist]);

  // Fetch quotes for all sidebar symbols
  const loadQuotes = useCallback(async () => {
    if (quoteFetchRef.current) return;
    quoteFetchRef.current = true;

    const holdingSymbols = [...new Set(accountState.positions.map((p) => p.symbol))];
    const allSymbols = [...new Set([...holdingSymbols, ...watchlist])];

    if (allSymbols.length === 0) {
      quoteFetchRef.current = false;
      return;
    }

    try {
      const data = await fetchPortfolioQuotes(allSymbols);
      setQuotes(data);
    } catch (err) {
      console.error("Failed to load quotes:", err);
    } finally {
      quoteFetchRef.current = false;
    }
  }, [accountState.positions, watchlist]);

  useEffect(() => {
    loadQuotes();
    // Refresh quotes every 30 seconds
    const interval = setInterval(loadQuotes, 30000);
    return () => clearInterval(interval);
  }, [loadQuotes]);

  const handleSelectTicker = useCallback((ticker: string) => {
    setSelectedTicker(ticker);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedTicker(null);
  }, []);

  // Get selected stock quote for order panel
  const selectedQuote = selectedTicker ? quotes[selectedTicker] : null;

  return (
    <div className="flex-1 flex" style={{ background: "var(--bg)", height: "calc(100vh - 52px)", overflow: "hidden" }}>
      {/* Main Content */}
      <AnimatePresence mode="wait">
        {selectedTicker ? (
          <motion.div
            key="detail"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            style={{ flex: 1, display: "flex", overflow: "hidden" }}
          >
            <StockDetailView
              ticker={selectedTicker}
              onBack={handleBack}
              onSelectTicker={handleSelectTicker}
            />
            <OrderPanel
              ticker={selectedTicker}
              price={selectedQuote?.price ?? 0}
              buyingPower={accountState.balance}
            />
          </motion.div>
        ) : (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            style={{ flex: 1, display: "flex", overflow: "hidden" }}
          >
            <PortfolioDashboard
              accountState={accountState}
              currentPrice={currentPrice}
              onSelectTicker={handleSelectTicker}
            />
            <WatchlistSidebar
              positions={accountState.positions}
              watchlist={watchlist}
              onWatchlistChange={setWatchlist}
              onSelectTicker={handleSelectTicker}
              quotes={quotes}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

**Step 2: Verify build**

Run: `cd /Users/saahilmanji/Desktop/afindr && npx next build 2>&1 | tail -20`
Expected: Build succeeds (or only pre-existing errors)

**Step 3: Commit**

```bash
git add src/components/PortfolioPage/PortfolioPage.tsx
git commit -m "feat(portfolio): rewrite PortfolioPage orchestrator with dashboard/detail view switching"
```

---

## Task 12: Integration Test & Polish

**Files:**
- Possibly modify: `src/app/page.tsx` (if PortfolioPage props changed — they haven't, same interface)
- Verify: all new files compile and render

**Step 1: Verify the dev server runs**

Run: `cd /Users/saahilmanji/Desktop/afindr && npm run dev`
Navigate to `http://localhost:3000`, click Portfolio tab.

Expected behavior:
- Dashboard view shows: portfolio balance, equity chart, time period buttons, buying power bar, market indicators (S&P 500, Nasdaq, BTC), news feed
- Right sidebar shows watchlist with sparklines and live prices
- Clicking a ticker switches to stock detail view with back button, chart, about, stats, analyst ratings, peers
- Order panel appears on right when viewing stock detail

**Step 2: Fix any TypeScript or runtime errors discovered during testing**

Common issues to watch for:
- Missing `"use client"` directive on any component
- CSS variable names not matching `globals.css`
- API routes returning unexpected shapes

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat(portfolio): complete Robinhood-style portfolio redesign with live API data"
```

---

## Summary

| Task | Component | What It Does |
|---|---|---|
| 1 | Types & Utils | API types, fetch functions, formatting utils |
| 2 | `/api/portfolio/quotes` | Multi-symbol quotes with sparklines |
| 3 | `/api/portfolio/market` | S&P 500, Nasdaq, Bitcoin indicators |
| 4 | `/api/portfolio/stock/[ticker]` | Full stock detail (about, stats, ratings) |
| 5 | `/api/portfolio/stock/[ticker]/chart` | Chart data with period mapping |
| 6 | SectionWrapper + SparklineSVG | Reusable shared components |
| 7 | WatchlistSidebar | Sticky sidebar with search, sparklines |
| 8 | PortfolioDashboard | Hero, equity chart, market bar, news |
| 9 | StockDetailView | Chart, about, stats, ratings, peers |
| 10 | OrderPanel | Buy/sell form sidebar |
| 11 | PortfolioPage rewrite | Orchestrator with view switching |
| 12 | Integration test | Verify everything works end-to-end |
