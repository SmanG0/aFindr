import { NextRequest, NextResponse } from "next/server";

// ─── In-memory cache (3 min TTL) — avoids re-fetching 6 RSS feeds ───
const newsCache = new Map<string, { data: unknown; expires: number }>();
const NEWS_CACHE_TTL = 180_000; // 3 minutes

// ─── Multi-source RSS: Top 5 reputable free financial news sources ───
// 1. Yahoo Finance  2. CNBC  3. MarketWatch  4. Seeking Alpha  5. Reuters (agency)
type FeedConfig = { url: string; source: string };
const FEEDS_BY_CATEGORY: Record<string, FeedConfig[]> = {
  All: [
    { url: "https://finance.yahoo.com/news/rssindex", source: "Yahoo Finance" },
    { url: "https://www.cnbc.com/id/100727362/device/rss/rss.html", source: "CNBC" },
    { url: "https://feeds.content.dowjones.io/public/rss/mw_topstories", source: "MarketWatch" },
    { url: "https://seekingalpha.com/feed.xml", source: "Seeking Alpha" },
    { url: "https://seekingalpha.com/market_currents.xml", source: "Seeking Alpha" },
    { url: "https://www.reutersagency.com/feed/?best-topics=business-finance&post_type=best", source: "Reuters" },
  ],
  Markets: [
    { url: "https://finance.yahoo.com/rss/topfinstories", source: "Yahoo Finance" },
    { url: "https://www.cnbc.com/id/10000664/device/rss/rss.html", source: "CNBC" },
    { url: "https://feeds.content.dowjones.io/public/rss/mw_realtimeheadlines", source: "MarketWatch" },
    { url: "https://seekingalpha.com/market_currents.xml", source: "Seeking Alpha" },
  ],
  Earnings: [
    { url: "https://finance.yahoo.com/rss/industry?s=earnings", source: "Yahoo Finance" },
    { url: "https://www.cnbc.com/id/15839135/device/rss/rss.html", source: "CNBC" },
    { url: "https://feeds.content.dowjones.io/public/rss/mw_topstories", source: "MarketWatch" },
    { url: "https://seekingalpha.com/feed.xml", source: "Seeking Alpha" },
  ],
  Commodities: [
    { url: "https://finance.yahoo.com/rss/industry?s=commodities", source: "Yahoo Finance" },
    { url: "https://www.cnbc.com/id/19836768/device/rss/rss.html", source: "CNBC" },
    { url: "https://feeds.content.dowjones.io/public/rss/mw_marketpulse", source: "MarketWatch" },
  ],
  Futures: [
    { url: "https://finance.yahoo.com/rss/topfinstories", source: "Yahoo Finance" },
    { url: "https://www.cnbc.com/id/20409666/device/rss/rss.html", source: "CNBC" },
    { url: "https://feeds.content.dowjones.io/public/rss/mw_marketpulse", source: "MarketWatch" },
  ],
  Macro: [
    { url: "https://finance.yahoo.com/rss/topfinstories", source: "Yahoo Finance" },
    { url: "https://www.cnbc.com/id/20910258/device/rss/rss.html", source: "CNBC" },
    { url: "https://feeds.content.dowjones.io/public/rss/mw_topstories", source: "MarketWatch" },
    { url: "https://www.reutersagency.com/feed/?best-topics=business-finance&post_type=best", source: "Reuters" },
  ],
  Bonds: [
    { url: "https://finance.yahoo.com/rss/topfinstories", source: "Yahoo Finance" },
    { url: "https://www.cnbc.com/id/20910258/device/rss/rss.html", source: "CNBC" },
    { url: "https://feeds.content.dowjones.io/public/rss/mw_marketpulse", source: "MarketWatch" },
  ],
  Global: [
    { url: "https://finance.yahoo.com/rss/topfinstories", source: "Yahoo Finance" },
    { url: "https://www.cnbc.com/id/100727362/device/rss/rss.html", source: "CNBC" },
    { url: "https://www.cnbc.com/id/19794221/device/rss/rss.html", source: "CNBC" },
    { url: "https://feeds.content.dowjones.io/public/rss/mw_topstories", source: "MarketWatch" },
  ],
  Technology: [
    { url: "https://finance.yahoo.com/rss/industry?s=technology", source: "Yahoo Finance" },
    { url: "https://www.cnbc.com/id/19854910/device/rss/rss.html", source: "CNBC" },
    { url: "https://seekingalpha.com/feed.xml", source: "Seeking Alpha" },
  ],
  Africa: [
    { url: "https://allafrica.com/tools/headlines/rdf/business/headlines.rdf", source: "AllAfrica" },
    { url: "https://allafrica.com/tools/headlines/rdf/stockmarkets/headlines.rdf", source: "AllAfrica" },
    { url: "https://allafrica.com/tools/headlines/rdf/investment/headlines.rdf", source: "AllAfrica" },
    { url: "https://allafrica.com/tools/headlines/rdf/banking/headlines.rdf", source: "AllAfrica" },
    { url: "https://allafrica.com/tools/headlines/rdf/mining/headlines.rdf", source: "AllAfrica" },
    { url: "https://allafrica.com/tools/headlines/rdf/energy/headlines.rdf", source: "AllAfrica" },
    { url: "https://allafrica.com/tools/headlines/rdf/southafrica/headlines.rdf", source: "AllAfrica" },
    { url: "https://allafrica.com/tools/headlines/rdf/nigeria/headlines.rdf", source: "AllAfrica" },
    { url: "https://allafrica.com/tools/headlines/rdf/kenya/headlines.rdf", source: "AllAfrica" },
  ],
};

// Fallback: generate quality mock data with real-looking URLs
function generateMockNews(category: string, limit: number) {
  const sources = [
    { name: "Reuters", color: "#ff6900" },
    { name: "Bloomberg", color: "#472bff" },
    { name: "CNBC", color: "#005594" },
    { name: "MarketWatch", color: "#00a651" },
    { name: "Financial Times", color: "#fff1e5" },
    { name: "WSJ", color: "#0080c3" },
    { name: "Yahoo Finance", color: "#6001d2" },
    { name: "Benzinga", color: "#00d1a0" },
  ];

  const headlines: { title: string; ticker?: string; category: string; sentiment: "bullish" | "bearish" | "neutral"; url: string; summary: string }[] = [
    { title: "S&P 500 Hits Record High as Tech Rally Extends", ticker: "SPY", category: "Markets", sentiment: "bullish", url: "https://finance.yahoo.com/quote/SPY/", summary: "The S&P 500 reached new all-time highs driven by strong earnings from major technology companies." },
    { title: "Fed Signals Rate Cuts May Come Sooner Than Expected", category: "Macro", sentiment: "bullish", url: "https://finance.yahoo.com/topic/federal-reserve/", summary: "Federal Reserve officials indicated a more dovish stance, suggesting rate reductions could begin earlier than previously anticipated." },
    { title: "NVIDIA Surges on AI Chip Demand Forecast", ticker: "NVDA", category: "Earnings", sentiment: "bullish", url: "https://finance.yahoo.com/quote/NVDA/", summary: "NVIDIA raised guidance citing unprecedented demand for AI training and inference chips." },
    { title: "Oil Prices Slide as OPEC+ Output Increases", ticker: "CL=F", category: "Commodities", sentiment: "bearish", url: "https://finance.yahoo.com/quote/CL=F/", summary: "Crude oil dropped 3% after OPEC+ announced plans to increase production quotas starting next month." },
    { title: "Treasury Yields Fall on Weak Jobs Data", category: "Bonds", sentiment: "neutral", url: "https://finance.yahoo.com/quote/%5ETNX/", summary: "The 10-year Treasury yield declined after non-farm payrolls came in below consensus expectations." },
    { title: "Bitcoin Breaks Above $100K on ETF Inflows", ticker: "BTC-USD", category: "Markets", sentiment: "bullish", url: "https://finance.yahoo.com/quote/BTC-USD/", summary: "Bitcoin surged past the $100,000 milestone as institutional inflows into spot Bitcoin ETFs accelerated." },
    { title: "Apple Reports Record Services Revenue", ticker: "AAPL", category: "Earnings", sentiment: "bullish", url: "https://finance.yahoo.com/quote/AAPL/", summary: "Apple's services segment posted record quarterly revenue, offsetting softer iPhone sales in key markets." },
    { title: "Gold Hits New High Amid Geopolitical Tensions", ticker: "GC=F", category: "Commodities", sentiment: "bullish", url: "https://finance.yahoo.com/quote/GC=F/", summary: "Gold prices surged to fresh all-time highs as investors sought safe-haven assets." },
    { title: "Tesla Deliveries Miss Estimates, Stock Falls 5%", ticker: "TSLA", category: "Earnings", sentiment: "bearish", url: "https://finance.yahoo.com/quote/TSLA/", summary: "Tesla reported quarterly deliveries below analyst expectations, citing production challenges and softer demand." },
    { title: "European Markets Rise on ECB Rate Decision", category: "Global", sentiment: "bullish", url: "https://finance.yahoo.com/quote/%5ESTOXX50E/", summary: "European indices rallied after the ECB signaled an end to its tightening cycle." },
    { title: "Amazon Web Services Revenue Beats Estimates", ticker: "AMZN", category: "Earnings", sentiment: "bullish", url: "https://finance.yahoo.com/quote/AMZN/", summary: "AWS posted 30% year-over-year growth, driven by AI workload demand from enterprise customers." },
    { title: "Natural Gas Futures Spike on Winter Forecast", ticker: "NG=F", category: "Futures", sentiment: "bullish", url: "https://finance.yahoo.com/quote/NG=F/", summary: "Natural gas futures surged as weather models indicated a colder-than-expected winter outlook." },
    { title: "Microsoft's AI Integration Drives Cloud Growth", ticker: "MSFT", category: "Earnings", sentiment: "bullish", url: "https://finance.yahoo.com/quote/MSFT/", summary: "Microsoft Azure revenue jumped 29% with Copilot AI integration driving enterprise adoption." },
    { title: "Nasdaq 100 Futures Signal Strong Open", ticker: "NQ=F", category: "Futures", sentiment: "bullish", url: "https://finance.yahoo.com/quote/NQ=F/", summary: "Nasdaq 100 futures pointed to a higher open following positive earnings surprises from tech giants." },
    { title: "Dollar Weakens Against Major Currencies", category: "Macro", sentiment: "bearish", url: "https://finance.yahoo.com/quote/DX-Y.NYB/", summary: "The US dollar index fell to multi-month lows as traders priced in earlier rate cuts." },
    { title: "Meta Platforms Announces $50B Buyback", ticker: "META", category: "Markets", sentiment: "bullish", url: "https://finance.yahoo.com/quote/META/", summary: "Meta authorized a new $50 billion share repurchase program, boosting investor confidence." },
    { title: "Copper Prices Rise on China Stimulus Hopes", category: "Commodities", sentiment: "bullish", url: "https://finance.yahoo.com/quote/HG=F/", summary: "Copper futures gained as China announced new infrastructure spending plans to support economic growth." },
    { title: "JPMorgan Raises S&P 500 Year-End Target", category: "Markets", sentiment: "bullish", url: "https://finance.yahoo.com/quote/%5EGSPC/", summary: "JPMorgan's chief strategist raised the year-end S&P 500 target citing stronger-than-expected earnings growth." },
    { title: "Ethereum Surges Past $4,000 on Network Upgrade", ticker: "ETH-USD", category: "Markets", sentiment: "bullish", url: "https://finance.yahoo.com/quote/ETH-USD/", summary: "Ethereum rallied following the successful implementation of a major network scaling upgrade." },
    { title: "Semiconductor Stocks Rally on AI Spending Surge", category: "Markets", sentiment: "bullish", url: "https://finance.yahoo.com/quote/SMH/", summary: "The VanEck Semiconductor ETF hit new highs as companies across industries ramped up AI infrastructure spending." },
  ];

  const timeOffsets = headlines.map((_, i) => i * 7 + Math.floor(Math.random() * 5));
  
  const filtered = category === "All" ? headlines : headlines.filter(h => h.category === category);
  
  return filtered.slice(0, limit).map((h, i) => ({
    id: `news-${i}-${Date.now()}`,
    title: h.title,
    source: sources[i % sources.length].name,
    sourceColor: sources[i % sources.length].color,
    time: `${timeOffsets[i]}m ago`,
    category: h.category,
    sentiment: h.sentiment,
    ticker: h.ticker,
    summary: h.summary,
    url: h.url,
  }));
}

const FETCH_OPTIONS = {
  headers: {
    "User-Agent": "Mozilla/5.0 (compatible; aFindr/1.0; +https://afindr.app)",
    Accept: "application/rss+xml, application/xml, text/xml",
  },
  next: { revalidate: 300 },
} as const;

async function fetchFeed(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { ...FETCH_OPTIONS, signal: AbortSignal.timeout(8000) });
    return res.ok ? res.text() : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") || "All";
    const ticker = searchParams.get("ticker");
    const limit = parseInt(searchParams.get("limit") || "50");

    // Check cache first
    const cacheKey = `${category}|${ticker || ""}|${limit}`;
    const cached = newsCache.get(cacheKey);
    if (cached && Date.now() < cached.expires) {
      return NextResponse.json(cached.data);
    }

    // Stock-specific: Yahoo Finance headline feed (other sources lack ticker feeds)
    if (ticker) {
      const feedUrl = `https://finance.yahoo.com/rss/headline?s=${encodeURIComponent(ticker)}`;
      const xml = await fetchFeed(feedUrl);
      if (xml) {
        const articles = parseRSS(xml, "Markets", limit, "Yahoo Finance");
        if (articles.length > 0) {
          const payload = { articles, count: articles.length, source: "rss", feedUrl };
          newsCache.set(cacheKey, { data: payload, expires: Date.now() + NEWS_CACHE_TTL });
          return NextResponse.json(payload);
        }
      }
      const articles = generateMockNews("Markets", limit);
      const payload = { articles, count: articles.length, source: "fallback" };
      newsCache.set(cacheKey, { data: payload, expires: Date.now() + NEWS_CACHE_TTL });
      return NextResponse.json(payload);
    }

    // Multi-source: fetch all feeds for category in parallel
    const feeds = FEEDS_BY_CATEGORY[category] || FEEDS_BY_CATEGORY.All;
    const results = await Promise.all(
      feeds.map(async (f) => ({ xml: await fetchFeed(f.url), config: f }))
    );

    const allArticles: Array<{
      id: string; title: string; source: string; sourceColor: string;
      time: string; category: string; sentiment?: "bullish" | "bearish" | "neutral";
      ticker?: string; summary?: string; url?: string;
    }> = [];
    for (const { xml, config } of results) {
      if (!xml) continue;
      const items = parseRSS(xml, category === "All" ? "Markets" : category, 999, config.source);
      allArticles.push(...items);
    }

    if (allArticles.length === 0) {
      const articles = generateMockNews(category, limit);
      const fallbackPayload = { articles, count: articles.length, source: "fallback" };
      newsCache.set(cacheKey, { data: fallbackPayload, expires: Date.now() + NEWS_CACHE_TTL });
      return NextResponse.json(fallbackPayload);
    }

    // Deduplicate by normalized title, sort by time (newest first), take limit
    const seen = new Set<string>();
    const deduped = allArticles
      .filter((a) => {
        const key = a.title.toLowerCase().replace(/\s+/g, " ").slice(0, 80);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => {
        const ta = parseTimeAgoToMs(a.time);
        const tb = parseTimeAgoToMs(b.time);
        return ta - tb; // ascending = newest first (smaller = more recent)
      })
      .slice(0, limit);

    const resultPayload = {
      articles: deduped,
      count: deduped.length,
      source: "rss",
      feeds: feeds.map((f) => f.url),
    };
    newsCache.set(cacheKey, { data: resultPayload, expires: Date.now() + NEWS_CACHE_TTL });
    return NextResponse.json(resultPayload);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch news", detail: String(err) },
      { status: 500 }
    );
  }
}

function parseTimeAgoToMs(time: string): number {
  const m = time.match(/(\d+)([mhd])/);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  if (m[2] === "m") return n * 60 * 1000;
  if (m[2] === "h") return n * 60 * 60 * 1000;
  if (m[2] === "d") return n * 24 * 60 * 60 * 1000;
  return 0;
}

const SOURCE_COLORS: Record<string, string> = {
  "Yahoo Finance": "#6001d2",
  Reuters: "#ff6900",
  Bloomberg: "#472bff",
  CNBC: "#005594",
  "MarketWatch": "#00a651",
  "Financial Times": "#fff1e5",
  WSJ: "#0080c3",
  Benzinga: "#00d1a0",
  "Seeking Alpha": "#e8834a",
  AllAfrica: "#e85d04",
  default: "#6001d2",
};

function inferSource(link: string | null): string | null {
  if (!link) return null;
  const domain = link.match(/https?:\/\/(?:www\.)?([^/]+)/)?.[1]?.toLowerCase() || "";
  if (domain.includes("reuters") || domain.includes("reutersagency")) return "Reuters";
  if (domain.includes("bloomberg")) return "Bloomberg";
  if (domain.includes("cnbc")) return "CNBC";
  if (domain.includes("marketwatch") || domain.includes("dowjones")) return "MarketWatch";
  if (domain.includes("ft.com") || domain.includes("financialtimes")) return "Financial Times";
  if (domain.includes("wsj.com") || domain.includes("wallstreetjournal")) return "WSJ";
  if (domain.includes("benzinga")) return "Benzinga";
  if (domain.includes("seekingalpha")) return "Seeking Alpha";
  if (domain.includes("allafrica")) return "AllAfrica";
  return null;
}

function parseRSS(xml: string, category: string, limit: number, defaultSource?: string) {
  const items: Array<{
    id: string; title: string; source: string; sourceColor: string;
    time: string; category: string; sentiment?: "bullish" | "bearish" | "neutral";
    ticker?: string; summary?: string; url?: string;
  }> = [];

  const pushItem = (
    title: string,
    link: string | null,
    pubDate: string | null,
    description: string | null,
    creator: string | null,
    i: number
  ) => {
    if (!title) return;
    const source = inferSource(link) || defaultSource || creator || "Yahoo Finance";
    const sourceColor = SOURCE_COLORS[source] || SOURCE_COLORS.default;
    const timeAgo = pubDate ? getTimeAgo(new Date(pubDate)) : `${i * 5}m ago`;
    items.push({
      id: `rss-${i}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: decodeHTML(title),
      source,
      sourceColor,
      time: timeAgo,
      category: category === "All" ? "Markets" : category,
      sentiment: "neutral",
      summary: description ? decodeHTML(description).slice(0, 300) : undefined,
      url: link || undefined,
    });
  };

  // RSS 2.0 / Atom / RDF 1.0
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/g;
  let match;
  let i = 0;
  while ((match = itemRegex.exec(xml)) !== null && i < limit) {
    const itemXml = match[1];
    const title = extractTag(itemXml, "title");
    const link = extractTag(itemXml, "link");
    const pubDate = extractTag(itemXml, "pubDate") || extractTag(itemXml, "dc:date");
    const description = extractTag(itemXml, "description");
    const creator = extractTag(itemXml, "dc:creator") || extractTag(itemXml, "creator");
    pushItem(title ?? "", link, pubDate, description, creator, i++);
  }

  // Atom (if no RSS items found)
  if (items.length === 0) {
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let entryMatch;
    i = 0;
    while ((entryMatch = entryRegex.exec(xml)) !== null && i < limit) {
      const entryXml = entryMatch[1];
      const title = extractTag(entryXml, "title");
      const link = extractTag(entryXml, "link", "href") || extractTag(entryXml, "link");
      const pubDate = extractTag(entryXml, "published") || extractTag(entryXml, "updated");
      const description = extractTag(entryXml, "summary") || extractTag(entryXml, "content");
      const creator = extractTag(entryXml, "author");
      pushItem(title ?? "", link, pubDate, description, creator, i++);
    }
  }

  return items;
}

function extractTag(xml: string, tag: string, attr?: string): string | null {
  if (attr) {
    const attrRegex = new RegExp(`<${tag}[^>]*\\s${attr}=["']([^"']+)["']`, "i");
    const am = attrRegex.exec(xml);
    if (am) return am[1].trim();
  }
  const regex = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?</${tag}>`, "s");
  const match = regex.exec(xml);
  return match ? match[1].trim() : null;
}

function decodeHTML(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]*>/g, "");
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
