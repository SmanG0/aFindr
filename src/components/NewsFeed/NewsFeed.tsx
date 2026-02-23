"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface NewsItem {
  id: string;
  title: string;
  source: string;
  sourceColor: string;
  time: string;
  category: string;
  sentiment?: "bullish" | "bearish" | "neutral";
  url?: string;
}

// Simulated news feed data — in production, these would come from RSS/API
const MOCK_NEWS: NewsItem[] = [
  { id: "1", title: "Fed signals potential rate pause amid cooling inflation data", source: "Reuters", sourceColor: "#e8834a", time: "2m ago", category: "Macro", sentiment: "bullish" },
  { id: "2", title: "S&P 500 futures edge higher ahead of jobs report", source: "Yahoo Finance", sourceColor: "#7b61ff", time: "5m ago", category: "Markets", sentiment: "bullish" },
  { id: "3", title: "Oil prices slip as OPEC+ members signal potential output increase", source: "Seeking Alpha", sourceColor: "#e8834a", time: "8m ago", category: "Commodities", sentiment: "bearish" },
  { id: "4", title: "Treasury yields retreat from session highs on dovish Fed commentary", source: "Reuters", sourceColor: "#e8834a", time: "12m ago", category: "Bonds", sentiment: "bullish" },
  { id: "5", title: "NQ futures test resistance at 20,400 level for third consecutive session", source: "Bloomberg", sourceColor: "#ff6b35", time: "15m ago", category: "Futures", sentiment: "neutral" },
  { id: "6", title: "Gold extends gains as dollar weakness persists, hits $2,380", source: "Seeking Alpha", sourceColor: "#e8834a", time: "18m ago", category: "Commodities", sentiment: "bullish" },
  { id: "7", title: "Tech earnings season kicks off with mixed signals from semiconductor sector", source: "Yahoo Finance", sourceColor: "#7b61ff", time: "22m ago", category: "Earnings", sentiment: "neutral" },
  { id: "8", title: "China manufacturing PMI contracts for third straight month", source: "Reuters", sourceColor: "#e8834a", time: "28m ago", category: "Global", sentiment: "bearish" },
  { id: "9", title: "Crude oil inventories draw down more than expected: EIA", source: "Bloomberg", sourceColor: "#ff6b35", time: "32m ago", category: "Commodities", sentiment: "bullish" },
  { id: "10", title: "ES mini futures volume surges 40% ahead of FOMC minutes release", source: "Seeking Alpha", sourceColor: "#e8834a", time: "35m ago", category: "Futures", sentiment: "neutral" },
  { id: "11", title: "European markets close mixed as ECB holds rates steady", source: "Reuters", sourceColor: "#e8834a", time: "41m ago", category: "Global", sentiment: "neutral" },
  { id: "12", title: "VIX drops below 14 as market complacency reaches multi-month highs", source: "Yahoo Finance", sourceColor: "#7b61ff", time: "45m ago", category: "Volatility", sentiment: "bearish" },
];

const CATEGORIES = ["All", "Markets", "Futures", "Commodities", "Macro", "Earnings", "Global"];

interface NewsFeedProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NewsFeed({ isOpen, onClose }: NewsFeedProps) {
  const [activeCategory, setActiveCategory] = useState("All");
  const [news, setNews] = useState<NewsItem[]>(MOCK_NEWS);
  const [isLive, setIsLive] = useState(true);

  // Simulate live feed with occasional new items
  const addRandomNews = useCallback(() => {
    const headlines = [
      "Breaking: Fed Chair signals no immediate need for policy adjustment",
      "Nasdaq futures gap up 0.3% in pre-market trading",
      "Crude oil breaks above $82 resistance on supply concerns",
      "Dollar index falls to 2-week low amid rate cut expectations",
      "Bitcoin surges past $68K as ETF inflows accelerate",
      "Japanese yen weakens further as BOJ maintains ultra-loose policy",
      "Copper prices rise on China stimulus hopes",
    ];
    const sources = [
      { name: "Reuters", color: "#e8834a" },
      { name: "Seeking Alpha", color: "#e8834a" },
      { name: "Yahoo Finance", color: "#7b61ff" },
      { name: "Bloomberg", color: "#ff6b35" },
    ];
    const cats = ["Markets", "Futures", "Commodities", "Macro", "Global"];
    const sentiments: ("bullish" | "bearish" | "neutral")[] = ["bullish", "bearish", "neutral"];

    const src = sources[Math.floor(Math.random() * sources.length)];
    const newItem: NewsItem = {
      id: `live-${Date.now()}`,
      title: headlines[Math.floor(Math.random() * headlines.length)],
      source: src.name,
      sourceColor: src.color,
      time: "Just now",
      category: cats[Math.floor(Math.random() * cats.length)],
      sentiment: sentiments[Math.floor(Math.random() * sentiments.length)],
    };

    setNews((prev) => [newItem, ...prev].slice(0, 30));
  }, []);

  useEffect(() => {
    if (!isLive || !isOpen) return;
    const interval = setInterval(addRandomNews, 15000 + Math.random() * 20000);
    return () => clearInterval(interval);
  }, [isLive, isOpen, addRandomNews]);

  const filtered = activeCategory === "All"
    ? news
    : news.filter((n) => n.category === activeCategory);

  const sentimentIcon = (s?: "bullish" | "bearish" | "neutral") => {
    if (s === "bullish") return <span style={{ color: "var(--buy)", fontSize: 10 }}>▲</span>;
    if (s === "bearish") return <span style={{ color: "var(--sell)", fontSize: 10 }}>▼</span>;
    return <span style={{ color: "var(--text-muted)", fontSize: 10 }}>●</span>;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 320, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          style={{
            height: "100%",
            background: "var(--bg-raised)",
            borderLeft: "0.667px solid rgba(236,227,213,0.15)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 12px",
              borderBottom: "1px solid var(--divider)",
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5">
                <rect x="2" y="3" width="20" height="18" rx="2" />
                <line x1="8" y1="7" x2="16" y2="7" />
                <line x1="8" y1="11" x2="16" y2="11" />
                <line x1="8" y1="15" x2="12" y2="15" />
              </svg>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
                NEWS FEED
              </span>
              {isLive && (
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div
                    className="live-indicator"
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "var(--buy)",
                    }}
                  />
                  <span style={{ fontSize: 9, color: "var(--buy)", fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                    LIVE
                  </span>
                </div>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {/* Pause/Play toggle */}
              <button
                onClick={() => setIsLive(!isLive)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  padding: 4,
                  display: "flex",
                  alignItems: "center",
                }}
                title={isLive ? "Pause feed" : "Resume feed"}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {isLive ? (
                    <>
                      <rect x="6" y="4" width="4" height="16" />
                      <rect x="14" y="4" width="4" height="16" />
                    </>
                  ) : (
                    <polygon points="5,3 19,12 5,21" fill="currentColor" />
                  )}
                </svg>
              </button>
              {/* Close */}
              <button
                onClick={onClose}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  padding: 4,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          {/* Category Filter Tabs */}
          <div
            style={{
              display: "flex",
              gap: 2,
              padding: "6px 8px",
              borderBottom: "1px solid var(--divider)",
              overflowX: "auto",
              flexShrink: 0,
            }}
          >
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  padding: "3px 8px",
                  borderRadius: 100,
                  fontSize: 10,
                  fontFamily: "var(--font-mono)",
                  fontWeight: 500,
                  border: "none",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  background: activeCategory === cat ? "var(--accent-muted)" : "transparent",
                  color: activeCategory === cat ? "var(--accent-bright)" : "var(--text-muted)",
                  transition: "all 100ms ease",
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* News Items */}
          <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
            <AnimatePresence mode="popLayout">
              {filtered.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={i === 0 ? { opacity: 0, y: -10, backgroundColor: "rgba(196,123,58,0.08)" } : { opacity: 1 }}
                  animate={{ opacity: 1, y: 0, backgroundColor: "transparent" }}
                  transition={{ duration: 0.3 }}
                  style={{
                    padding: "8px 12px",
                    borderBottom: "1px solid var(--border-subtle)",
                    cursor: "pointer",
                    transition: "background 100ms ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(236,227,213,0.04)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  {/* Source + Time row */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                    {sentimentIcon(item.sentiment)}
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 400,
                        fontFamily: "var(--font-mono)",
                        color: item.sourceColor,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {item.source}
                    </span>
                    <span style={{ fontSize: 9, color: "var(--text-disabled)", fontFamily: "var(--font-mono)" }}>
                      {item.time}
                    </span>
                    <div style={{ flex: 1 }} />
                    <span
                      style={{
                        fontSize: 8,
                        padding: "1px 5px",
                        borderRadius: 100,
                        background: "rgba(236,227,213,0.06)",
                        color: "var(--text-muted)",
                        fontFamily: "var(--font-mono)",
                        fontWeight: 500,
                      }}
                    >
                      {item.category}
                    </span>
                  </div>

                  {/* Headline */}
                  <div
                    style={{
                      fontSize: 11,
                      lineHeight: 1.4,
                      color: "var(--text-secondary)",
                      fontWeight: 400,
                    }}
                  >
                    {item.title}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {filtered.length === 0 && (
              <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 11 }}>
                No news in this category
              </div>
            )}
          </div>

          {/* Footer - Sources */}
          <div
            style={{
              padding: "6px 12px",
              borderTop: "1px solid var(--divider)",
              fontSize: 11,
              fontWeight: 400,
              color: "var(--text-disabled)",
              fontFamily: "var(--font-mono)",
              textAlign: "center",
              flexShrink: 0,
            }}
          >
            Reuters · Seeking Alpha · Yahoo Finance · Bloomberg
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
