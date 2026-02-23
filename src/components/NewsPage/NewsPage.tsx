"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fetchNewsFeed, fetchStockDetail } from "@/lib/api";
import type { StockDetailData } from "@/lib/api";

// ─── Types ───

interface NewsItem {
  id: string;
  title: string;
  source: string;
  sourceColor: string;
  time: string;
  category: string;
  sentiment?: "bullish" | "bearish" | "neutral";
  ticker?: string;
  tickerPrice?: number;
  tickerChange?: number;
  tickerChangePct?: number;
  summary?: string;
}

interface StockDetail {
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
  relatedStocks: RelatedStock[];
  news: NewsItem[];
  ratings: RatingItem[];
}

interface RelatedStock {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  postPrice?: number;
  postChange?: number;
}

interface RatingItem {
  analyst: string;
  firm: string;
  rating: "Buy" | "Strong Buy" | "Hold" | "Sell" | "Strong Sell";
  priceTarget: number;
  date: string;
}

// ─── Source types for left sidebar ───

interface SourceCategory {
  id: string;
  label: string;
  icon: string;
  count?: number;
}

// ─── Mock Data ───

const SOURCES: SourceCategory[] = [
  { id: "home", label: "Home", icon: "home" },
  { id: "analysis", label: "Analysis", icon: "analysis" },
  { id: "news", label: "News", icon: "news", count: 24 },
  { id: "market-data", label: "Market Data", icon: "data" },
];

const FEED_CATEGORIES: SourceCategory[] = [
  { id: "top-stocks", label: "Top Stocks", icon: "trending" },
  { id: "top-etfs", label: "Top ETFs", icon: "etf" },
  { id: "stock-screener", label: "Stock Screener", icon: "screener" },
  { id: "etf-screener", label: "ETF Screener", icon: "screener" },
];

const WATCHLIST_ITEMS: SourceCategory[] = [
  { id: "alpha-picks", label: "Alpha Picks", icon: "star", count: 1 },
  { id: "portfolio", label: "My Portfolio", icon: "portfolio" },
  { id: "watchlist", label: "Watchlist", icon: "eye" },
];

// ─── Content Tabs ───
const CONTENT_TABS = ["All", "Analysis", "Comments", "News", "Transcripts & Insights", "SEC Filings", "Press Releases"];
const DETAIL_TABS = ["Summary", "Ratings", "Financials", "Earnings", "Dividends", "Valuation", "Growth", "Profitability", "Momentum", "Peers", "Options", "Charting"];

// ─── Filter categories for news feed ───
const NEWS_CATEGORIES = ["All", "Markets", "Futures", "Commodities", "Macro", "Earnings", "Bonds", "Global"];

// ─── Component ───

interface NewsPageProps {
  onClose: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function NewsPage({ onClose }: NewsPageProps) {
  const [activeSource, setActiveSource] = useState("news");
  const [selectedArticle, setSelectedArticle] = useState<NewsItem | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState("Summary");
  const [activeContentTab, setActiveContentTab] = useState("All");
  const [activeNewsCategory, setActiveNewsCategory] = useState("All");
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isLive, setIsLive] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoadingNews, setIsLoadingNews] = useState(true);
  const [stockDetail, setStockDetail] = useState<StockDetailData | null>(null);
  const [isLoadingStock, setIsLoadingStock] = useState(false);
  const fetchInFlight = useRef(false);

  // Fetch news from real API
  const loadNews = useCallback(async (category?: string) => {
    if (fetchInFlight.current) return;
    fetchInFlight.current = true;
    try {
      const result = await fetchNewsFeed({
        category: category || activeNewsCategory,
        limit: 50,
      });
      setNews(result.articles || []);
    } catch (err) {
      console.error("Failed to fetch news:", err);
      // Keep existing news on error
    } finally {
      setIsLoadingNews(false);
      fetchInFlight.current = false;
    }
  }, [activeNewsCategory]);

  // Initial load
  useEffect(() => {
    loadNews();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh when category changes
  useEffect(() => {
    setIsLoadingNews(true);
    loadNews(activeNewsCategory);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNewsCategory]);

  // Auto-refresh every 60s when live (not blasting — once per minute)
  useEffect(() => {
    if (!isLive) return;
    const interval = globalThis.setInterval(() => loadNews(), 60000);
    return () => clearInterval(interval);
  }, [isLive, loadNews]);

  const filteredNews = activeNewsCategory === "All"
    ? news
    : news.filter(n => n.category === activeNewsCategory);

  const searchFilteredNews = searchQuery
    ? filteredNews.filter(n =>
        n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.ticker?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.source.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : filteredNews;

  const sentimentIcon = (s?: "bullish" | "bearish" | "neutral") => {
    if (s === "bullish") return <span style={{ color: "var(--buy)", fontSize: 11 }}>▲</span>;
    if (s === "bearish") return <span style={{ color: "var(--sell)", fontSize: 11 }}>▼</span>;
    return <span style={{ color: "var(--text-muted)", fontSize: 11 }}>●</span>;
  };

  const handleArticleClick = useCallback(async (article: NewsItem) => {
    setSelectedArticle(article);
    setActiveDetailTab("Summary");
    setActiveContentTab("All");

    if (article.ticker) {
      setIsLoadingStock(true);
      setStockDetail(null);
      try {
        const data = await fetchStockDetail(article.ticker);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!(data as any).error) {
          setStockDetail(data);
        }
      } catch (err) {
        console.error("Failed to fetch stock detail:", err);
      } finally {
        setIsLoadingStock(false);
      }
    } else {
      setStockDetail(null);
    }
  }, []);

  return (
    <div style={{ display: "flex", width: "100%", height: "100%", overflow: "hidden" }}>

      {/* ═══ LEFT SIDEBAR ═══ */}
      <div
        style={{
          width: 190,
          flexShrink: 0,
          background: "var(--bg-raised)",
          borderRight: "0.667px solid rgba(236,227,213,0.1)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Logo / Brand */}
        <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid var(--divider)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 24, height: 24, borderRadius: 6,
              background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 700, color: "#fff",
            }}>
              α
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              Research
            </span>
          </div>
        </div>

        {/* Main Nav */}
        <div style={{ padding: "8px 8px 4px", flex: 1, overflowY: "auto" }}>
          {SOURCES.map(src => (
            <SidebarItem
              key={src.id}
              label={src.label}
              icon={src.icon}
              count={src.count}
              active={activeSource === src.id}
              onClick={() => setActiveSource(src.id)}
            />
          ))}

          <div style={{ height: 1, background: "var(--divider)", margin: "8px 4px" }} />

          <div style={{
            fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase",
            letterSpacing: "0.06em", padding: "6px 10px 4px", fontFamily: "var(--font-mono)",
          }}>
            Find & Compare
          </div>
          {FEED_CATEGORIES.map(cat => (
            <SidebarItem
              key={cat.id}
              label={cat.label}
              icon={cat.icon}
              active={activeSource === cat.id}
              onClick={() => setActiveSource(cat.id)}
            />
          ))}

          <div style={{ height: 1, background: "var(--divider)", margin: "8px 4px" }} />

          <div style={{
            fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase",
            letterSpacing: "0.06em", padding: "6px 10px 4px", fontFamily: "var(--font-mono)",
          }}>
            Watchlists
          </div>
          {WATCHLIST_ITEMS.map(item => (
            <SidebarItem
              key={item.id}
              label={item.label}
              icon={item.icon}
              count={item.count}
              active={activeSource === item.id}
              onClick={() => setActiveSource(item.id)}
            />
          ))}
        </div>

        {/* Footer Sources */}
        <div style={{
          padding: "8px 12px", borderTop: "1px solid var(--divider)",
          fontSize: 9, color: "var(--text-disabled)", fontFamily: "var(--font-mono)", lineHeight: 1.6,
        }}>
          Reuters · Bloomberg<br />
          Seeking Alpha · Yahoo
        </div>
      </div>

      {/* ═══ MAIN CONTENT ═══ */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {selectedArticle && selectedArticle.ticker && (stockDetail || isLoadingStock) ? (
          /* ─── STOCK DETAIL VIEW ─── */
          isLoadingStock ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                  Loading {selectedArticle.ticker}...
                </div>
              </div>
            </div>
          ) : stockDetail ? (
          <StockDetailView
            article={selectedArticle}
            detail={stockDetail}
            activeDetailTab={activeDetailTab}
            activeContentTab={activeContentTab}
            onDetailTabChange={setActiveDetailTab}
            onContentTabChange={setActiveContentTab}
            onBack={() => { setSelectedArticle(null); setStockDetail(null); }}
          />
          ) : null
        ) : (
          /* ─── NEWS FEED VIEW ─── */
          <NewsFeedView
            news={searchFilteredNews}
            activeCategory={activeNewsCategory}
            onCategoryChange={setActiveNewsCategory}
            isLive={isLive}
            onToggleLive={() => setIsLive(!isLive)}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            sentimentIcon={sentimentIcon}
            onArticleClick={handleArticleClick}
            isLoadingNews={isLoadingNews}
          />
        )}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════
// SIDEBAR ITEM
// ═══════════════════════════════════════════════

function SidebarItem({ label, icon, count, active, onClick }: {
  label: string; icon: string; count?: number; active: boolean; onClick: () => void;
}) {
  const iconMap: Record<string, React.JSX.Element> = {
    home: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>,
    analysis: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15V19a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="7 10 12 15 17 10" /></svg>,
    news: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="20" height="18" rx="2" /><line x1="8" y1="7" x2="16" y2="7" /><line x1="8" y1="11" x2="16" y2="11" /><line x1="8" y1="15" x2="12" y2="15" /></svg>,
    data: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" /></svg>,
    trending: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>,
    etf: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" /></svg>,
    screener: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>,
    star: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>,
    portfolio: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 4H3a2 2 0 00-2 2v12a2 2 0 002 2h18a2 2 0 002-2V6a2 2 0 00-2-2z" /><line x1="1" y1="10" x2="23" y2="10" /></svg>,
    eye: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>,
  };

  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 8, width: "100%",
        padding: "7px 10px", borderRadius: 6,
        background: active ? "var(--accent-muted)" : "transparent",
        color: active ? "var(--accent-bright)" : "var(--text-secondary)",
        border: "none", cursor: "pointer", fontSize: 12, fontWeight: 400,
        transition: "all 100ms ease", textAlign: "left",
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(236,227,213,0.04)"; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
    >
      <span style={{ opacity: active ? 1 : 0.6, flexShrink: 0 }}>{iconMap[icon] || iconMap.news}</span>
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      {count !== undefined && (
        <span style={{
          fontSize: 9, fontFamily: "var(--font-mono)", fontWeight: 600,
          background: active ? "var(--accent)" : "rgba(236,227,213,0.1)",
          color: active ? "#fff" : "var(--text-muted)",
          padding: "1px 6px", borderRadius: 100, minWidth: 18, textAlign: "center",
        }}>
          {count}
        </span>
      )}
    </button>
  );
}


// ═══════════════════════════════════════════════
// NEWS FEED VIEW (main list)
// ═══════════════════════════════════════════════

function NewsFeedView({ news, activeCategory, onCategoryChange, isLive, onToggleLive, searchQuery, onSearchChange, sentimentIcon, onArticleClick, isLoadingNews }: {
  news: NewsItem[];
  activeCategory: string;
  onCategoryChange: (cat: string) => void;
  isLive: boolean;
  onToggleLive: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  sentimentIcon: (s?: "bullish" | "bearish" | "neutral") => React.JSX.Element;
  onArticleClick: (article: NewsItem) => void;
  isLoadingNews: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Search Bar */}
      <div style={{
        padding: "10px 16px", borderBottom: "1px solid var(--divider)",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <div style={{
          flex: 1, display: "flex", alignItems: "center", gap: 8,
          background: "rgba(236,227,213,0.04)", borderRadius: 8,
          border: "1px solid rgba(236,227,213,0.08)", padding: "0 12px",
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Search symbols, keywords, analysts..."
            style={{
              flex: 1, background: "none", border: "none", outline: "none",
              color: "var(--text-primary)", fontSize: 12, padding: "8px 0",
              fontFamily: "inherit",
            }}
          />
        </div>

        {/* Live toggle */}
        <button
          onClick={onToggleLive}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 12px", borderRadius: 6,
            background: isLive ? "rgba(34,171,148,0.1)" : "rgba(236,227,213,0.04)",
            border: `1px solid ${isLive ? "rgba(34,171,148,0.25)" : "rgba(236,227,213,0.08)"}`,
            color: isLive ? "var(--buy)" : "var(--text-muted)",
            cursor: "pointer", fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 600,
          }}
        >
          {isLive && <div className="live-indicator" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--buy)" }} />}
          {isLive ? "LIVE" : "PAUSED"}
        </button>
      </div>

      {/* Category Filter */}
      <div style={{
        display: "flex", gap: 2, padding: "6px 16px",
        borderBottom: "1px solid var(--divider)", overflowX: "auto", flexShrink: 0,
      }}>
        {NEWS_CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => onCategoryChange(cat)}
            style={{
              padding: "4px 12px", borderRadius: 100,
              fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 500,
              border: "none", cursor: "pointer", whiteSpace: "nowrap",
              background: activeCategory === cat ? "var(--accent-muted)" : "transparent",
              color: activeCategory === cat ? "var(--accent-bright)" : "var(--text-muted)",
              transition: "all 100ms ease",
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* News List */}
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
        <AnimatePresence mode="popLayout">
          {news.map((item, i) => (
            <motion.div
              key={item.id}
              initial={i === 0 ? { opacity: 0, y: -8 } : { opacity: 1 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => onArticleClick(item)}
              style={{
                padding: "12px 16px",
                borderBottom: "1px solid var(--border-subtle)",
                cursor: "pointer", transition: "background 100ms ease",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(236,227,213,0.04)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
            >
              {/* Source + Sentiment + Time */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                {sentimentIcon(item.sentiment)}
                <span style={{
                  fontSize: 10, fontWeight: 600, fontFamily: "var(--font-mono)",
                  color: item.sourceColor, textTransform: "uppercase", letterSpacing: "0.04em",
                }}>
                  {item.source}
                </span>
                <span style={{ fontSize: 10, color: "var(--text-disabled)", fontFamily: "var(--font-mono)" }}>
                  {item.time}
                </span>
                <div style={{ flex: 1 }} />
                {item.ticker && (
                  <span style={{
                    fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 600,
                    color: "var(--accent-bright)", background: "var(--accent-muted)",
                    padding: "2px 8px", borderRadius: 100,
                  }}>
                    {item.ticker}
                  </span>
                )}
                <span style={{
                  fontSize: 9, padding: "2px 6px", borderRadius: 100,
                  background: "rgba(236,227,213,0.06)", color: "var(--text-muted)",
                  fontFamily: "var(--font-mono)", fontWeight: 500,
                }}>
                  {item.category}
                </span>
              </div>

              {/* Headline */}
              <div style={{
                fontSize: 13, lineHeight: 1.45, color: "var(--text-primary)",
                fontWeight: 500, marginBottom: 4,
              }}>
                {item.title}
              </div>

              {/* Summary */}
              {item.summary && (
                <div style={{
                  fontSize: 11, lineHeight: 1.5, color: "var(--text-muted)",
                  display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}>
                  {item.summary}
                </div>
              )}

              {/* Ticker price row */}
              {item.ticker && item.tickerPrice && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                  <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--text-primary)" }}>
                    ${item.tickerPrice.toFixed(2)}
                  </span>
                  <span style={{
                    fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 500,
                    color: (item.tickerChange ?? 0) >= 0 ? "var(--buy)" : "var(--sell)",
                  }}>
                    {(item.tickerChange ?? 0) >= 0 ? "+" : ""}{item.tickerChange?.toFixed(2)} ({(item.tickerChangePct ?? 0) >= 0 ? "+" : ""}{item.tickerChangePct?.toFixed(2)}%)
                  </span>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoadingNews && news.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 12, fontFamily: "var(--font-mono)" }}>
            Loading news feeds...
          </div>
        )}
        {!isLoadingNews && news.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
            No news matching your criteria
          </div>
        )}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════
// STOCK DETAIL VIEW
// ═══════════════════════════════════════════════

function StockDetailView({ article, detail, activeDetailTab, activeContentTab, onDetailTabChange, onContentTabChange, onBack }: {
  article: NewsItem;
  detail: StockDetailData | StockDetail;
  activeDetailTab: string;
  activeContentTab: string;
  onDetailTabChange: (tab: string) => void;
  onContentTabChange: (tab: string) => void;
  onBack: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header: Back + Ticker info */}
      <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--divider)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <button
            onClick={onBack}
            style={{
              background: "rgba(236,227,213,0.06)", border: "1px solid rgba(236,227,213,0.08)",
              borderRadius: 6, padding: "4px 8px", cursor: "pointer", color: "var(--text-secondary)",
              display: "flex", alignItems: "center", gap: 4, fontSize: 11,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back
          </button>

          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>
                {detail.ticker}
              </span>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                - {detail.name}
              </span>
              <span style={{
                fontSize: 10, padding: "2px 8px", borderRadius: 4,
                background: "var(--accent-muted)", color: "var(--accent-bright)",
                fontFamily: "var(--font-mono)", fontWeight: 600,
              }}>
                Summary
              </span>
            </div>
          </div>

          <button style={{
            padding: "5px 14px", borderRadius: 6,
            background: "var(--accent)", color: "#fff", border: "none",
            fontSize: 12, fontWeight: 600, cursor: "pointer",
          }}>
            Follow
          </button>
        </div>

        {/* Price row */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 26, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
            ${detail.price.toFixed(2)}
          </span>
          <span style={{
            fontSize: 14, fontWeight: 600, fontFamily: "var(--font-mono)",
            color: detail.change >= 0 ? "var(--buy)" : "var(--sell)",
          }}>
            {detail.change >= 0 ? "+" : ""}{detail.change.toFixed(2)} ({detail.changePct >= 0 ? "+" : ""}{detail.changePct.toFixed(2)}%)
          </span>
          <span style={{ fontSize: 11, color: "var(--text-disabled)", fontFamily: "var(--font-mono)" }}>
            {detail.exchange} | $USD
          </span>
        </div>
      </div>

      {/* Detail Tabs */}
      <div style={{
        display: "flex", gap: 0, padding: "0 20px",
        borderBottom: "1px solid var(--divider)", overflowX: "auto", flexShrink: 0,
      }}>
        {DETAIL_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => onDetailTabChange(tab)}
            style={{
              padding: "10px 14px", fontSize: 12, fontWeight: 500,
              border: "none", cursor: "pointer", whiteSpace: "nowrap",
              background: "transparent",
              color: activeDetailTab === tab ? "var(--text-primary)" : "var(--text-muted)",
              borderBottom: activeDetailTab === tab ? "2px solid var(--accent)" : "2px solid transparent",
              transition: "all 100ms ease",
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content Tabs */}
      <div style={{
        display: "flex", gap: 0, padding: "0 20px",
        borderBottom: "1px solid var(--divider)", overflowX: "auto", flexShrink: 0,
      }}>
        {CONTENT_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => onContentTabChange(tab)}
            style={{
              padding: "8px 12px", fontSize: 11, fontWeight: 500,
              border: "none", cursor: "pointer", whiteSpace: "nowrap",
              background: "transparent",
              color: activeContentTab === tab ? "var(--text-primary)" : "var(--text-muted)",
              borderBottom: activeContentTab === tab ? "2px solid var(--accent-bright)" : "2px solid transparent",
              transition: "all 100ms ease",
            }}
          >
            {tab}
            {tab === "News" && (
              <span style={{
                marginLeft: 4, fontSize: 9, padding: "1px 5px", borderRadius: 100,
                background: "var(--buy-muted)", color: "var(--buy)", fontWeight: 600,
              }}>
                Free
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Main content area */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex" }}>
        {/* Left: Chart + Stats */}
        <div style={{ flex: 1, padding: 20, minWidth: 0 }}>

          {/* Mini Chart Placeholder */}
          <div style={{
            background: "rgba(236,227,213,0.03)", borderRadius: 10,
            border: "1px solid rgba(236,227,213,0.06)",
            padding: 16, marginBottom: 16, position: "relative",
          }}>
            {/* Chart toolbar */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <button style={{
                padding: "4px 10px", borderRadius: 4, fontSize: 10,
                background: "rgba(236,227,213,0.06)", color: "var(--text-muted)",
                border: "1px solid rgba(236,227,213,0.08)", cursor: "pointer",
                fontFamily: "var(--font-mono)", display: "flex", alignItems: "center", gap: 4,
              }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
                Advanced Chart
              </button>
              {["1D", "5D", "1M", "6M", "YTD", "1Y", "5Y", "10Y", "MAX"].map(p => (
                <button
                  key={p}
                  style={{
                    padding: "4px 8px", borderRadius: 4, fontSize: 10,
                    background: p === "1Y" ? "rgba(236,227,213,0.12)" : "transparent",
                    color: p === "1Y" ? "var(--text-primary)" : "var(--text-muted)",
                    border: p === "1Y" ? "1px solid rgba(236,227,213,0.15)" : "1px solid transparent",
                    cursor: "pointer", fontFamily: "var(--font-mono)",
                  }}
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Fake chart SVG */}
            <div style={{ height: 200, position: "relative" }}>
              <div style={{
                position: "absolute", top: 8, right: 8,
                fontSize: 12, fontFamily: "var(--font-mono)", fontWeight: 600,
                color: "var(--sell)", background: "var(--sell-muted)",
                padding: "2px 8px", borderRadius: 4,
              }}>
                {detail.changePct.toFixed(2)}%
              </div>
              <svg width="100%" height="100%" viewBox="0 0 400 200" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--sell)" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="var(--sell)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M0,60 Q25,55 50,50 Q75,40 100,35 Q125,45 150,55 Q175,70 200,80 Q225,90 250,100 Q275,105 300,110 Q325,120 350,130 Q375,140 400,145"
                  fill="url(#chartGrad)" stroke="none"
                />
                <path
                  d="M0,60 Q25,55 50,50 Q75,40 100,35 Q125,45 150,55 Q175,70 200,80 Q225,90 250,100 Q275,105 300,110 Q325,120 350,130 Q375,140 400,145"
                  fill="none" stroke="var(--sell)" strokeWidth="1.5" vectorEffect="non-scaling-stroke"
                />
              </svg>
            </div>

            {/* Stats below chart */}
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
              gap: 12, marginTop: 16, paddingTop: 12,
              borderTop: "1px solid var(--divider)",
            }}>
              <StatItem label="52 Week Range" value={`${detail.weekLow52.toFixed(2)} — ${detail.weekHigh52.toFixed(2)}`} />
              <StatItem label="Day Range" value={`${detail.dayLow.toFixed(2)} — ${detail.dayHigh.toFixed(2)}`} />
              <StatItem label="EPS (FWD)" value={detail.eps} />
              <StatItem label="PE" value={detail.pe} />
              <StatItem label="Div Rate" value={detail.divYield} />
              <StatItem label="Yield" value={detail.divYield} />
              <StatItem label="Short Interest" value={detail.shortInterest} />
              <StatItem label="Market Cap" value={detail.marketCap} />
              <StatItem label="Volume" value={detail.volume} />
              <StatItem label="Prev. Close" value={`$${detail.prevClose.toFixed(2)}`} />
              <StatItem label="Sector" value={detail.sector} />
              <StatItem label="Exchange" value={detail.exchange} />
            </div>
          </div>

          {/* Article that led here */}
          <div style={{
            background: "rgba(236,227,213,0.03)", borderRadius: 10,
            border: "1px solid rgba(236,227,213,0.06)", padding: 16,
          }}>
            <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-muted)", marginBottom: 8, fontWeight: 600 }}>
              RELATED ARTICLE
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.4, marginBottom: 6 }}>
              {article.title}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              {article.summary}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 600, fontFamily: "var(--font-mono)", color: article.sourceColor }}>
                {article.source}
              </span>
              <span style={{ fontSize: 10, color: "var(--text-disabled)", fontFamily: "var(--font-mono)" }}>
                {article.time}
              </span>
            </div>
          </div>

          {/* Analyst Ratings */}
          {detail.ratings.length > 0 && (
            <div style={{
              background: "rgba(236,227,213,0.03)", borderRadius: 10,
              border: "1px solid rgba(236,227,213,0.06)", padding: 16, marginTop: 16,
            }}>
              <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-muted)", marginBottom: 12, fontWeight: 600 }}>
                ANALYST RATINGS
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Firm", "Rating", "Date"].map(h => (
                      <th key={h} style={{
                        padding: "6px 8px", textAlign: "left", fontSize: 10,
                        color: "var(--text-muted)", fontFamily: "var(--font-mono)",
                        fontWeight: 500, borderBottom: "1px solid var(--divider)",
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detail.ratings.map((r: RatingItem | { firm: string; rating: string; date: string }, i: number) => {
                    const rating = typeof r.rating === "string" ? r.rating : "";
                    return (
                    <tr key={i}>
                      <td style={{ padding: "8px 8px", fontSize: 11, color: "var(--text-secondary)", borderBottom: "1px solid var(--border-subtle)" }}>
                        {r.firm}
                      </td>
                      <td style={{ padding: "8px 8px", fontSize: 11, borderBottom: "1px solid var(--border-subtle)" }}>
                        <span style={{
                          padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600,
                          background: rating.includes("Buy") || rating.includes("Upgrade") || rating.includes("Outperform") ? "var(--buy-muted)" : rating === "Hold" || rating.includes("Neutral") ? "rgba(236,227,213,0.08)" : "var(--sell-muted)",
                          color: rating.includes("Buy") || rating.includes("Upgrade") || rating.includes("Outperform") ? "var(--buy)" : rating === "Hold" || rating.includes("Neutral") ? "var(--text-secondary)" : "var(--sell)",
                        }}>
                          {rating}
                        </span>
                      </td>
                      <td style={{ padding: "8px 8px", fontSize: 10, color: "var(--text-disabled)", fontFamily: "var(--font-mono)", borderBottom: "1px solid var(--border-subtle)" }}>
                        {r.date}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right: Related Stocks ("People Also Follow") */}
        <div style={{
          width: 280, flexShrink: 0, padding: "16px 16px 16px 0",
          borderLeft: "1px solid var(--divider)",
          overflowY: "auto",
        }}>
          <div style={{
            fontSize: 13, fontWeight: 600, color: "var(--text-primary)",
            marginBottom: 12, paddingLeft: 16,
          }}>
            People Also Follow
          </div>

          {/* Header row */}
          <div style={{
            display: "flex", alignItems: "center", padding: "4px 16px 8px",
            fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontWeight: 500,
          }}>
            <span style={{ flex: 1 }}>Symbol</span>
            <span style={{ width: 65, textAlign: "right" }}>Last Price</span>
            <span style={{ width: 65, textAlign: "right" }}>Change</span>
          </div>

          {(detail.relatedStocks || []).map((stock: RelatedStock | { ticker: string; name: string; price: number; change: number; changePct: number }) => (
            <div
              key={stock.ticker}
              style={{
                padding: "8px 16px", cursor: "pointer",
                transition: "background 100ms ease",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(236,227,213,0.04)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
            >
              <div style={{ display: "flex", alignItems: "center" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--accent-bright)", fontFamily: "var(--font-mono)" }}>
                    {stock.ticker}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>
                    {stock.name}
                  </div>
                </div>
                <div style={{ width: 65, textAlign: "right" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>
                    {stock.price.toFixed(2)}
                  </div>
                </div>
                <div style={{ width: 65, textAlign: "right" }}>
                  <div style={{
                    fontSize: 11, fontWeight: 600, fontFamily: "var(--font-mono)",
                    color: stock.changePct >= 0 ? "var(--buy)" : "var(--sell)",
                  }}>
                    {stock.changePct >= 0 ? "+" : ""}{stock.changePct.toFixed(2)}%
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Compare button */}
          <div style={{ padding: "12px 16px" }}>
            <button style={{
              width: "100%", padding: "8px 0", borderRadius: 6,
              background: "rgba(236,227,213,0.06)", color: "var(--text-secondary)",
              border: "1px solid rgba(236,227,213,0.1)", cursor: "pointer",
              fontSize: 12, fontWeight: 500,
            }}>
              Compare
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════
// SMALL HELPERS
// ═══════════════════════════════════════════════

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontWeight: 500 }}>
        {value}
      </div>
    </div>
  );
}
