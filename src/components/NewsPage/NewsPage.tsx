"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fetchNewsFeed, fetchStockDetail, fetchArticleContent } from "@/lib/api";
import type { StockDetailData, ArticleContent } from "@/lib/api";
import { SYMBOL_LIBRARY } from "@/lib/symbols";

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
  url?: string;
}


// ─── Content Tabs ───
const CONTENT_TABS = ["All", "Analysis", "News", "Press Releases"];
const DETAIL_TABS = ["Summary", "Ratings", "Financials", "Earnings"];

// ─── Filter categories for news feed ───
const NEWS_CATEGORIES = ["All", "Markets", "Earnings", "Macro", "Africa"];

// ─── Ticker regex: match known symbols (longest first to avoid partial matches) ───
function getTickerPattern(): RegExp {
  const symbols = [...new Set(SYMBOL_LIBRARY.map((s) => s.symbol))].sort((a, b) => b.length - a.length);
  return new RegExp(`\\b(${symbols.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "gi");
}

// ─── Normalize article HTML: break wall-of-text into paragraphs for premium layout ───
function normalizeArticleHTML(html: string): string {
  const trimmed = html.trim();
  if (!trimmed) return trimmed;
  const hasStructure = /<(p|h[1-6]|blockquote|ul|ol|li)[\s>]/i.test(trimmed);
  if (hasStructure) return trimmed;
  let paragraphs = trimmed
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paragraphs.length <= 1 && paragraphs[0]?.length > 300) {
    paragraphs = paragraphs[0]!
      .split(/(?<=[.!?])\s+/)
      .reduce<string[]>((acc, s) => {
        const last = acc[acc.length - 1];
        if (last && last.length < 200) acc[acc.length - 1] = last + " " + s;
        else acc.push(s);
        return acc;
      }, []);
  }
  if (paragraphs.length <= 1) return trimmed;
  return paragraphs.map((p) => `<p>${p}</p>`).join("\n");
}

// ─── Inject ticker hyperlinks into HTML (Robinhood-style: detect symbols in article body) ───
function injectTickerLinksIntoHTML(html: string): string {
  const normalized = normalizeArticleHTML(html);
  const symbols = [...new Set(SYMBOL_LIBRARY.map((s) => s.symbol))].sort((a, b) => b.length - a.length);
  const pattern = new RegExp(`\\b(${symbols.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "gi");
  const parts = normalized.split(/(<[^>]+>)/g);
  return parts
    .map((part) => {
      if (part.startsWith("<")) return part;
      return part.replace(pattern, (_, ticker) => {
        const canonical = SYMBOL_LIBRARY.find((s) => s.symbol.toUpperCase() === ticker.toUpperCase())?.symbol ?? ticker.toUpperCase();
        return `<span class="ticker-link" data-ticker="${canonical}">${canonical}</span>`;
      });
    })
    .join("");
}

// ─── Component ───

interface NewsPageProps {
  onClose: () => void;
  onNavigateToChart?: (ticker: string) => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function NewsPage({ onClose, onNavigateToChart }: NewsPageProps) {
  const [selectedArticle, setSelectedArticle] = useState<NewsItem | null>(null);
  const [viewingArticle, setViewingArticle] = useState<NewsItem | null>(null);
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

  const handleTickerClick = useCallback((ticker: string) => {
    handleArticleClick({
      id: `ticker-${ticker}`,
      title: "",
      source: "",
      sourceColor: "#6001d2",
      time: "",
      category: "Markets",
      ticker,
    });
  }, [handleArticleClick]);

  return (
    <div style={{ display: "flex", width: "100%", height: "100%", overflow: "hidden", background: "var(--bg-news)" }}>

      {/* ═══ MAIN CONTENT ═══ */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--bg-news)" }}>

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
            onNavigateToChart={onNavigateToChart}
          />
          ) : null
        ) : (
          /* ─── NEWS FEED + ARTICLE VIEW (Seeking Alpha-style) ─── */
          <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
            <div style={{
              flex: viewingArticle ? "0 0 320px" : 1,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              borderRight: viewingArticle ? "1px solid var(--divider)" : "none",
              transition: "flex 200ms ease",
            }}>
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
                onTickerClick={handleTickerClick}
                onOpenArticle={setViewingArticle}
                viewingArticleId={viewingArticle?.id ?? null}
                isLoadingNews={isLoadingNews}
              />
            </div>
            {viewingArticle && (
              <ArticleFullView
                item={viewingArticle}
                onBack={() => setViewingArticle(null)}
                onTickerClick={handleTickerClick}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}



// ═══════════════════════════════════════════════
// NEWS FEED VIEW (main list)
// ═══════════════════════════════════════════════

function renderTextWithTickerLinks(text: string, onTickerClick: (ticker: string) => void): React.ReactNode[] {
  const pattern = getTickerPattern();
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let keyIdx = 0;
  pattern.lastIndex = 0;
  while ((match = pattern.exec(text)) !== null) {
    parts.push(text.slice(lastIndex, match.index));
    const ticker = match[1];
    const canonical = SYMBOL_LIBRARY.find((s) => s.symbol.toUpperCase() === ticker.toUpperCase())?.symbol ?? ticker.toUpperCase();
    parts.push(
      <button
        key={`tk-${keyIdx++}-${canonical}`}
        onClick={(e) => { e.stopPropagation(); onTickerClick(canonical); }}
        style={{
          background: "none", border: "none", padding: 0, cursor: "pointer",
          color: "#5a9bd4", fontSize: "inherit", fontFamily: "var(--font-mono)", fontWeight: 600,
          textDecoration: "underline",
        }}
      >
        {canonical}
      </button>
    );
    lastIndex = pattern.lastIndex;
  }
  parts.push(text.slice(lastIndex));
  return parts;
}

// ─── Full Article View (Seeking Alpha-style: article on clean page, user stays in app) ───
function ArticleFullView({ item, onBack, onTickerClick }: {
  item: NewsItem;
  onBack: () => void;
  onTickerClick: (ticker: string) => void;
}) {
  const [content, setContent] = useState<ArticleContent | null>(null);
  const [loading, setLoading] = useState(true);
  const articleUrl = item.url || "https://finance.yahoo.com/news/rssindex";

  useEffect(() => {
    if (!item.url) {
      setContent(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchArticleContent(item.url)
      .then((c) => setContent(c ?? null))
      .catch(() => setContent(null))
      .finally(() => setLoading(false));
  }, [item.url]);

  const hasContent = content && (content.content?.trim() || content.description?.trim());
  const contentText = [item.title, item.summary].filter(Boolean).join(" ");

  const handleContentClick = (e: React.MouseEvent) => {
    const target = (e.target as HTMLElement).closest(".ticker-link");
    if (target?.getAttribute("data-ticker")) {
      e.preventDefault();
      onTickerClick(target.getAttribute("data-ticker")!);
    }
  };

  return (
    <div style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      background: "var(--bg-news-raised)",
      minWidth: 0,
    }}>
      {/* Header bar - brown aesthetic */}
      <div style={{
        padding: "12px 20px",
        borderBottom: "1px solid var(--divider)",
        background: "var(--bg-news)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexShrink: 0,
      }}>
        <button
          onClick={onBack}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 12px", borderRadius: 6,
            background: "rgba(236,227,213,0.08)", border: "1px solid rgba(236,227,213,0.12)",
            cursor: "pointer", fontSize: 12, fontFamily: "var(--font-mono)",
            color: "var(--text-secondary)",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to feed
        </button>
        <span style={{
          fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 600,
          color: item.sourceColor, textTransform: "uppercase", letterSpacing: "0.04em",
        }}>
          {item.source}
        </span>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{item.time}</span>
        {item.ticker && (
          <button
            onClick={() => onTickerClick(item.ticker!)}
            style={{
              fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 600,
              color: "var(--accent-bright)", background: "var(--accent-muted)",
              padding: "2px 8px", borderRadius: 100, cursor: "pointer", border: "none",
            }}
          >
            {item.ticker}
          </button>
        )}
      </div>

      {/* Article content - brown aesthetic, ticker hyperlinks */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        padding: "32px 48px 48px",
        maxWidth: 720,
        margin: "0 auto",
        width: "100%",
      }}>
        <h1 style={{
          fontSize: 24, fontWeight: 700, lineHeight: 1.3, color: "var(--text-primary)",
          margin: "0 0 16px", fontFamily: "var(--font-inter), system-ui, sans-serif",
        }}>
          {item.title}
        </h1>

        {loading ? (
          <div style={{ padding: "48px 0", color: "var(--text-muted)", fontSize: 14 }}>
            Loading article…
          </div>
        ) : hasContent ? (
          <div
            className="news-article-content news-article-brown news-article-premium"
            style={{ color: "var(--text-secondary)", fontSize: 17, lineHeight: 1.8 }}
            onClick={handleContentClick}
          >
            {content!.image && (
              <img
                src={content!.image}
                alt=""
                style={{ width: "100%", maxHeight: 360, objectFit: "cover", borderRadius: 8, marginBottom: 24 }}
              />
            )}
            {content!.content ? (
              <div dangerouslySetInnerHTML={{ __html: injectTickerLinksIntoHTML(content!.content) }} />
            ) : content!.description ? (
              <p style={{ margin: 0 }}>{renderTextWithTickerLinks(content!.description, onTickerClick)}</p>
            ) : null}
          </div>
        ) : contentText ? (
          <div style={{ color: "var(--text-secondary)", fontSize: 16, lineHeight: 1.75 }}>
            {renderTextWithTickerLinks(contentText, onTickerClick)}
          </div>
        ) : (
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
            Article preview not available.
          </p>
        )}

        <a
          href={articleUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex", alignItems: "center", gap: 8, marginTop: 32,
            fontSize: 13, fontWeight: 600, color: "var(--accent-bright)",
            textDecoration: "none",
          }}
        >
          Open on {item.source}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </a>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function ArticleContentDisplay({ content, articleUrl }: { content: ArticleContent; articleUrl: string }) {
  return (
    <div className="news-article-content">
      {content.image && (
        <img
          src={content.image}
          alt=""
          style={{
            width: "100%", maxHeight: 280, objectFit: "cover", borderRadius: 8, marginBottom: 16,
          }}
        />
      )}
      {content.content ? (
        <div
          dangerouslySetInnerHTML={{ __html: content.content }}
          style={{
            fontSize: 13, lineHeight: 1.7, color: "var(--text-secondary)",
          }}
        />
      ) : content.description ? (
        <p style={{ margin: 0 }}>{content.description}</p>
      ) : null}
      <a
        href={articleUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6, marginTop: 16,
          fontSize: 11, fontWeight: 600, color: "var(--accent-bright)",
          textDecoration: "none",
        }}
      >
        Open full article
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      </a>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function NewsFeedView({ news, activeCategory, onCategoryChange, isLive, onToggleLive, searchQuery, onSearchChange, sentimentIcon, onArticleClick, onTickerClick, onOpenArticle, viewingArticleId, isLoadingNews }: {
  news: NewsItem[];
  activeCategory: string;
  onCategoryChange: (cat: string) => void;
  isLive: boolean;
  onToggleLive: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  sentimentIcon: (s?: "bullish" | "bearish" | "neutral") => React.JSX.Element;
  onArticleClick: (article: NewsItem) => void;
  onTickerClick: (ticker: string) => void;
  onOpenArticle: (item: NewsItem) => void;
  viewingArticleId: string | null;
  isLoadingNews: boolean;
}) {

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: "var(--bg-news)" }}>
      {/* Search Bar */}
      <div style={{
        padding: "10px 16px", borderBottom: "1px solid var(--divider)",
        display: "flex", alignItems: "center", gap: 10,
        background: "var(--bg-news-raised)",
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
        background: "var(--bg-news-raised)",
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
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 0", background: "var(--bg-news)" }}>
        <AnimatePresence mode="popLayout">
          {news.map((item, i) => {
            const isViewing = viewingArticleId === item.id;
            return (
              <motion.div
                key={item.id}
                initial={i === 0 ? { opacity: 0, y: -8 } : { opacity: 1 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => item.url && onOpenArticle(item)}
                style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid var(--border-subtle)",
                  cursor: item.url ? "pointer" : "default",
                  transition: "background 100ms ease",
                  background: isViewing ? "rgba(236,227,213,0.08)" : "transparent",
                }}
                onMouseEnter={(e) => { if (!isViewing && item.url) e.currentTarget.style.background = "rgba(236,227,213,0.04)"; }}
                onMouseLeave={(e) => { if (!isViewing) e.currentTarget.style.background = "transparent"; }}
              >
                {/* Source + Sentiment + Time */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  {sentimentIcon(item.sentiment)}
                  <span style={{
                    fontSize: 12, fontWeight: 400, fontFamily: "var(--font-mono)",
                    color: item.sourceColor, textTransform: "uppercase", letterSpacing: "0.04em",
                  }}>
                    {item.source}
                  </span>
                  <span style={{ fontSize: 10, color: "var(--text-disabled)", fontFamily: "var(--font-mono)" }}>
                    {item.time}
                  </span>
                  <div style={{ flex: 1 }} />
                {item.ticker && (
                  <span
                    onClick={(e) => { e.stopPropagation(); onArticleClick(item); }}
                    style={{
                      fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 600,
                      color: "var(--accent-bright)", background: "var(--accent-muted)",
                      padding: "2px 8px", borderRadius: 100, cursor: "pointer",
                    }}
                  >
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
                  marginBottom: 4, fontSize: 13, lineHeight: 1.45, color: "var(--text-primary)",
                  fontWeight: 500, display: "flex", alignItems: "flex-start", gap: 8,
                }}>
                  <span style={{ flex: 1, minWidth: 0 }}>{item.title}</span>
                  {item.url && (
                    <svg width="14" height="14" style={{ flexShrink: 0, opacity: 0.5, marginTop: 2 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  )}
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
            );
          })}
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

function StockDetailView({ article, detail, activeDetailTab, activeContentTab, onDetailTabChange, onContentTabChange, onBack, onNavigateToChart }: {
  article: NewsItem;
  detail: StockDetailData;
  activeDetailTab: string;
  activeContentTab: string;
  onDetailTabChange: (tab: string) => void;
  onContentTabChange: (tab: string) => void;
  onBack: () => void;
  onNavigateToChart?: (ticker: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: "var(--bg-news)" }}>
      {/* Header: Back + Ticker info */}
      <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--divider)", flexShrink: 0, background: "var(--bg-news-raised)" }}>
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

          {onNavigateToChart && (
            <button
              onClick={() => onNavigateToChart(detail.ticker)}
              style={{
                padding: "5px 12px", borderRadius: 6,
                background: "rgba(236,227,213,0.08)", color: "var(--accent-bright)",
                border: "1px solid rgba(196,123,58,0.3)", fontSize: 11, fontWeight: 600,
                cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
              Chart
            </button>
          )}
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
      <div style={{ flex: 1, overflowY: "auto", display: "flex", background: "var(--bg-news)" }}>
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
                  {detail.ratings.map((r: { firm: string; rating: string; date: string }, i: number) => {
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

          {(detail.relatedStocks || []).map((stock: { ticker: string; name: string; price: number; change: number; changePct: number }) => (
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
