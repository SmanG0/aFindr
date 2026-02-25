"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { AccountState } from "@/lib/types";
import type { PortfolioQuote, NewsArticle } from "@/lib/api";
import { fetchPortfolioQuotes, fetchNewsFeed } from "@/lib/api";
import type { AppPage } from "@/components/PageNav/PageNav";
import StockDetailView from "@/components/PortfolioPage/StockDetailView";
import { TickerBanner } from "./TickerBanner";
import { JournalSection } from "./JournalSection";
import { ThesisSection, getThesisTickers } from "./ThesisSection";
import {
  getDailyBooks,
  getQuoteAtOffset,
  getMarketSession,
  getTimeOfDayGreeting,
  getFormattedDate,
  getBookCoverUrl,
  authorAccentColor,
  getAuthorHeadshotUrl,
} from "@/lib/dashboard-content";

// ─── Types ───

interface DashboardPageProps {
  accountState: AccountState;
  onNavigateToChart?: (ticker: string) => void;
  onNavigateToPage?: (page: AppPage) => void;
  onOpenCopilot?: () => void;
  onSelectTicker?: (ticker: string) => void;
}

interface UserProfile {
  name: string;
  experience: string;
  markets: string[];
  instruments: string[];
}

// ─── Animation Constants ───

const EASE_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];
const PAGE_EASE: [number, number, number, number] = [0.25, 1, 0.5, 1];

// ─── Parallax Hook ───

function useMouseParallax(strength: number = 0.02) {
  const ref = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handleMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      setOffset({
        x: (e.clientX - cx) * strength,
        y: (e.clientY - cy) * strength,
      });
    };
    const handleLeave = () => setOffset({ x: 0, y: 0 });

    el.addEventListener("mousemove", handleMove);
    el.addEventListener("mouseleave", handleLeave);
    return () => {
      el.removeEventListener("mousemove", handleMove);
      el.removeEventListener("mouseleave", handleLeave);
    };
  }, [strength]);

  return { ref, offset };
}

// ─── Helpers ───

function formatPnl(value: number): string {
  const prefix = value >= 0 ? "+$" : "-$";
  return `${prefix}${Math.abs(value).toFixed(2)}`;
}

function parseOnboardingProfile(): UserProfile {
  try {
    const raw = localStorage.getItem("afindr_onboarding");
    if (!raw) return { name: "", experience: "all", markets: [], instruments: [] };
    const data = JSON.parse(raw);
    return {
      name: data.name || data.firstName || "",
      experience: data.experience || "all",
      markets: data.markets || [],
      instruments: data.instruments || data.watchlist || [],
    };
  } catch {
    return { name: "", experience: "all", markets: [], instruments: [] };
  }
}

// ─── Main Component ───

export default function DashboardPage({
  accountState,
  onNavigateToChart,
  onNavigateToPage,
  onOpenCopilot: _onOpenCopilot,
  onSelectTicker: onSelectTickerProp,
}: DashboardPageProps) {
  void _onOpenCopilot;
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile>({ name: "", experience: "all", markets: [], instruments: [] });
  const [quotes, setQuotes] = useState<Record<string, PortfolioQuote>>({});
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [quoteOffset, setQuoteOffset] = useState(0);
  const [showFullAnalytics, setShowFullAnalytics] = useState(false);
  const [headlines, setHeadlines] = useState<NewsArticle[]>([]);
  const [headlinesLoading, setHeadlinesLoading] = useState(true);

  const greetingParallax = useMouseParallax(0.02);
  const bookParallax = useMouseParallax(0.015);
  const quoteParallax = useMouseParallax(0.01);

  useEffect(() => {
    setUserProfile(parseOnboardingProfile());
  }, []);

  // Prioritize thesis tickers at the front of the watchlist
  const orderedInstruments = useMemo(() => {
    const thesisTickers = getThesisTickers();
    if (thesisTickers.length === 0) return userProfile.instruments;
    const thesisSet = new Set(thesisTickers);
    const fromThesis = thesisTickers.filter((t) => userProfile.instruments.includes(t));
    const rest = userProfile.instruments.filter((t) => !thesisSet.has(t));
    // Also include thesis tickers not already in the watchlist
    const extra = thesisTickers.filter((t) => !userProfile.instruments.includes(t));
    return [...fromThesis, ...extra, ...rest];
  }, [userProfile.instruments]);

  // ─── Fetch quotes (fires independently — shows as soon as ready) ───
  useEffect(() => {
    if (orderedInstruments.length === 0) return;
    let cancelled = false;
    setQuotesLoading(true);
    fetchPortfolioQuotes(orderedInstruments)
      .then((data) => { if (!cancelled) { setQuotes(data); setQuotesLoading(false); } })
      .catch(() => { if (!cancelled) setQuotesLoading(false); });
    return () => { cancelled = true; };
  }, [orderedInstruments]);

  // ─── Fetch news (fires independently — doesn't block watchlist) ───
  useEffect(() => {
    let cancelled = false;
    setHeadlinesLoading(true);
    fetchNewsFeed({ limit: 2 })
      .then((data) => { if (!cancelled) { setHeadlines(data.articles.slice(0, 2)); setHeadlinesLoading(false); } })
      .catch(() => { if (!cancelled) setHeadlinesLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setQuoteOffset((prev) => prev + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  const handleSelectTicker = useCallback((ticker: string) => {
    if (onSelectTickerProp) {
      onSelectTickerProp(ticker);
    } else {
      setSelectedTicker(ticker);
    }
  }, [onSelectTickerProp]);
  const handleBack = useCallback(() => setSelectedTicker(null), []);

  const dailyBooks = useMemo(() => getDailyBooks(userProfile.experience), [userProfile.experience]);
  const currentQuote = useMemo(() => getQuoteAtOffset(quoteOffset), [quoteOffset]);
  const session = useMemo(() => getMarketSession(), []);

  const stats = useMemo(() => {
    const history = accountState.tradeHistory;
    const totalTrades = history.length;
    const wins = history.filter((t) => t.pnl > 0);
    const losses = history.filter((t) => t.pnl < 0);
    const winRate = totalTrades > 0 ? (wins.length / totalTrades) * 100 : 0;
    const totalPnl = history.reduce((sum, t) => sum + t.pnl, 0);
    const totalCommission = history.reduce((sum, t) => sum + t.commission, 0);
    const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((s, t) => s + t.pnl, 0) / losses.length : 0;
    const profitFactor = avgLoss !== 0 ? Math.abs(avgWin * wins.length) / Math.abs(avgLoss * losses.length) : 0;
    const maxWin = wins.length > 0 ? Math.max(...wins.map((t) => t.pnl)) : 0;
    const maxLoss = losses.length > 0 ? Math.min(...losses.map((t) => t.pnl)) : 0;

    const startingBalance = accountState.balance - totalPnl;
    let peak = startingBalance, maxDrawdown = 0, running = startingBalance;
    for (const t of history) {
      running += t.pnl;
      if (running > peak) peak = running;
      const dd = peak - running;
      if (dd > maxDrawdown) maxDrawdown = dd;
    }

    let maxConsecWins = 0, maxConsecLosses = 0, curWins = 0, curLosses = 0;
    for (const t of history) {
      if (t.pnl > 0) { curWins++; curLosses = 0; maxConsecWins = Math.max(maxConsecWins, curWins); }
      else if (t.pnl < 0) { curLosses++; curWins = 0; maxConsecLosses = Math.max(maxConsecLosses, curLosses); }
    }

    let bal = startingBalance;
    const equityPoints = history.map((t) => { bal += t.pnl; return { time: t.exitTime, value: bal }; });

    const symbolBreakdown: Record<string, { trades: number; pnl: number; wins: number }> = {};
    for (const t of history) {
      if (!symbolBreakdown[t.symbol]) symbolBreakdown[t.symbol] = { trades: 0, pnl: 0, wins: 0 };
      symbolBreakdown[t.symbol].trades++;
      symbolBreakdown[t.symbol].pnl += t.pnl;
      if (t.pnl > 0) symbolBreakdown[t.symbol].wins++;
    }

    const dailyPnl: Record<string, number> = {};
    for (const t of history) {
      const day = new Date(t.exitTime > 1e12 ? t.exitTime : t.exitTime * 1000).toISOString().split("T")[0];
      dailyPnl[day] = (dailyPnl[day] || 0) + t.pnl;
    }

    return {
      totalTrades, wins: wins.length, losses: losses.length, winRate, totalPnl,
      totalCommission, avgWin, avgLoss, profitFactor, maxWin, maxLoss,
      maxDrawdown, maxConsecWins, maxConsecLosses, equityPoints, symbolBreakdown, dailyPnl,
    };
  }, [accountState.tradeHistory, accountState.balance]);

  // ─── Render ───

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background: "var(--bg)" }}>
      {/* CNBC-Style Ticker Banner */}
      {selectedTicker === null && <TickerBanner />}

      <div className="flex-1 flex overflow-hidden">
      <AnimatePresence mode="wait">
        {selectedTicker !== null ? (
          <motion.div
            key={`detail-${selectedTicker}`}
            className="flex-1 overflow-hidden"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2, ease: PAGE_EASE }}
          >
            <StockDetailView
              ticker={selectedTicker}
              onBack={handleBack}
              onSelectTicker={handleSelectTicker}
              onNavigateToChart={onNavigateToChart}
            />
          </motion.div>
        ) : (
          <motion.div
            key="dashboard-main"
            className="flex-1 overflow-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: PAGE_EASE }}
            style={{ padding: "16px 24px 32px", position: "relative" }}
          >
            {/* ─── Animated flow lines background ─── */}
            <DashboardFlowLines />
            <div style={{ maxWidth: 1080, margin: "0 auto", display: "flex", flexDirection: "column", gap: 28 }}>

              {/* ════════════════════════════════════════════
                  Section 1: Compact Personalized Greeting
                  ════════════════════════════════════════════ */}
              <motion.div
                ref={greetingParallax.ref}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, ease: EASE_EXPO, delay: 0.05 }}
                style={{ position: "relative", overflow: "hidden", padding: "8px 0" }}
              >
                <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <h1 style={{
                      fontSize: 21,
                      fontWeight: 700,
                      marginBottom: 4,
                      background: "linear-gradient(135deg, var(--accent-bright), var(--accent))",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                      lineHeight: 1.2,
                    }}>
                      {getTimeOfDayGreeting()}{userProfile.name ? `, ${userProfile.name}` : ""}
                    </h1>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                        {getFormattedDate()}
                      </span>
                      <span style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        fontSize: 10,
                        fontFamily: "var(--font-mono)",
                        color: session.isOpen ? "var(--buy)" : "var(--text-muted)",
                        background: session.isOpen ? "var(--buy-muted)" : "rgba(236,227,213,0.04)",
                        padding: "2px 8px",
                        borderRadius: 16,
                      }}>
                        {session.isOpen && (
                          <span style={{
                            width: 5,
                            height: 5,
                            borderRadius: "50%",
                            background: "var(--buy)",
                            animation: "pulse-dot 2s ease-in-out infinite",
                          }} />
                        )}
                        {session.label}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Headlines */}
                {!headlinesLoading && headlines.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: EASE_EXPO, delay: 0.15 }}
                    style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap" }}
                  >
                    {headlines.map((article) => (
                      <a
                        key={article.id}
                        href={article.url || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "4px 10px",
                          background: "rgba(236,227,213,0.03)",
                          border: "1px solid rgba(236,227,213,0.05)",
                          borderRadius: 8,
                          textDecoration: "none",
                          maxWidth: 480,
                          transition: "border-color 150ms ease",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(236,227,213,0.12)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(236,227,213,0.05)"; }}
                      >
                        <span style={{
                          fontSize: 8,
                          fontFamily: "var(--font-mono)",
                          fontWeight: 700,
                          color: article.sourceColor || "var(--accent)",
                          background: `${article.sourceColor || "var(--accent)"}18`,
                          padding: "1px 5px",
                          borderRadius: 4,
                          flexShrink: 0,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}>
                          {article.source}
                        </span>
                        <span style={{
                          fontSize: 11,
                          fontFamily: "var(--font-mono)",
                          color: "var(--text-secondary)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}>
                          {article.title}
                        </span>
                      </a>
                    ))}
                  </motion.div>
                )}
              </motion.div>

              {/* ════════════════════════════════════════════
                  Section 2: Market Pulse Strip
                  ════════════════════════════════════════════ */}
              {orderedInstruments.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, ease: EASE_EXPO, delay: 0.12 }}
                >
                  <SectionLabel>YOUR WATCHLIST</SectionLabel>
                  <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
                    {quotesLoading
                      ? orderedInstruments.slice(0, 6).map((_, i) => (
                          <motion.div
                            key={`skel-${i}`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.3, ease: EASE_EXPO, delay: i * 0.03 }}
                            className="dashboard-card-skeleton"
                            style={{ minWidth: 140, height: 70, borderRadius: 12, background: "var(--glass)", border: "1px solid var(--glass-border)", overflow: "hidden" }}
                          >
                            <div style={{ height: "100%", background: "linear-gradient(90deg, transparent, rgba(236,227,213,0.03), transparent)", backgroundSize: "200% 100%", animation: "shimmer 1.5s ease-in-out infinite" }} />
                          </motion.div>
                        ))
                      : orderedInstruments.map((sym, i) => {
                          const q = quotes[sym];
                          if (!q) return null;
                          const isUp = q.changePct >= 0;
                          return (
                            <motion.div
                              key={sym}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ duration: 0.35, ease: EASE_EXPO, delay: i * 0.03 }}
                              onClick={() => handleSelectTicker(sym)}
                              className="dashboard-glass-card"
                              style={{
                                minWidth: 148,
                                padding: "12px 14px",
                                borderRadius: 12,
                                background: "var(--glass)",
                                border: "1px solid var(--glass-border)",
                                cursor: "pointer",
                                flexShrink: 0,
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                                <div>
                                  <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "0.02em" }}>{sym}</div>
                                  <div style={{ fontSize: 15, fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--text-primary)", marginTop: 1, fontVariantNumeric: "tabular-nums" }}>
                                    ${q.price.toFixed(2)}
                                  </div>
                                </div>
                                <div style={{
                                  fontSize: 10,
                                  fontFamily: "var(--font-mono)",
                                  fontWeight: 600,
                                  color: isUp ? "var(--buy)" : "var(--sell)",
                                  padding: "2px 6px",
                                  borderRadius: 6,
                                  background: isUp ? "var(--buy-muted)" : "var(--sell-muted)",
                                }}>
                                  {isUp ? "+" : ""}{q.changePct.toFixed(2)}%
                                </div>
                              </div>
                              {q.sparkline && q.sparkline.length > 1 && (
                                <svg width="100%" height="16" viewBox={`0 0 ${q.sparkline.length - 1} 16`} preserveAspectRatio="none" style={{ display: "block", marginTop: 2 }}>
                                  {(() => {
                                    const min = Math.min(...q.sparkline);
                                    const max = Math.max(...q.sparkline);
                                    const range = max - min || 1;
                                    const pts = q.sparkline.map((v, j) => `${j},${14 - ((v - min) / range) * 12}`).join(" ");
                                    return <polyline points={pts} fill="none" stroke={isUp ? "var(--buy)" : "var(--sell)"} strokeWidth="1.5" vectorEffect="non-scaling-stroke" opacity="0.7" />;
                                  })()}
                                </svg>
                              )}
                            </motion.div>
                          );
                        })}
                  </div>
                </motion.div>
              )}

              {/* ════════════════════════════════════════════
                  Section 3: Trading Wisdom (Books)
                  ════════════════════════════════════════════ */}
              <div>
                {/* Featured Book */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <SectionLabel style={{ marginBottom: 0 }}>TODAY&apos;S READ</SectionLabel>
                  <button
                    onClick={() => onNavigateToPage?.("library")}
                    className="dashboard-pill-btn"
                    style={{
                      fontSize: 10,
                      fontFamily: "var(--font-mono)",
                      color: "var(--accent)",
                      background: "var(--accent-muted)",
                      border: "none",
                      padding: "3px 12px",
                      borderRadius: 16,
                      cursor: "pointer",
                    }}
                  >
                    Explore Library
                  </button>
                </div>
                <motion.div
                  ref={bookParallax.ref}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, ease: EASE_EXPO, delay: 0.18 }}
                  className="dashboard-glass-card"
                  style={{
                    position: "relative",
                    borderRadius: 12,
                    padding: "16px 20px",
                    background: `linear-gradient(135deg, ${dailyBooks.featured.coverAccent}14, var(--bg-raised))`,
                    border: "1px solid rgba(236,227,213,0.06)",
                    overflow: "hidden",
                    marginBottom: 10,
                  }}
                >
                  {/* Parallax accent blob */}
                  <div style={{
                    position: "absolute",
                    top: -20,
                    right: -10,
                    width: 120,
                    height: 120,
                    borderRadius: "50%",
                    background: `radial-gradient(circle, ${dailyBooks.featured.coverAccent}20, transparent 70%)`,
                    pointerEvents: "none",
                    transition: "transform 150ms ease-out",
                    transform: `translate(${bookParallax.offset.x}px, ${bookParallax.offset.y}px)`,
                  }} />
                  <div style={{ position: "relative", display: "flex", gap: 16, alignItems: "center" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 2, lineHeight: 1.3 }}>
                        {dailyBooks.featured.title}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 2 }}>
                        {dailyBooks.featured.author}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--accent-bright)", marginBottom: 8 }}>
                        {dailyBooks.featured.tagline}
                      </div>
                      <div style={{
                        borderLeft: `2px solid ${dailyBooks.featured.coverAccent}50`,
                        paddingLeft: 12,
                        fontSize: 11,
                        lineHeight: 1.5,
                        color: "var(--text-secondary)",
                        fontStyle: "italic",
                        maxWidth: 480,
                      }}>
                        &ldquo;{dailyBooks.featured.pullQuote}&rdquo;
                      </div>
                    </div>
                    {/* 3D Book */}
                    <Book3D
                      src={getBookCoverUrl(dailyBooks.featured.isbn, "M")}
                      fallback={dailyBooks.featured.title}
                      accentColor={dailyBooks.featured.coverAccent}
                    />
                  </div>
                </motion.div>

              </div>

              {/* ════════════════════════════════════════════
                  Section 4: Compact Analytics
                  ════════════════════════════════════════════ */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, ease: EASE_EXPO, delay: 0.3 }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <SectionLabel style={{ marginBottom: 0 }}>ANALYTICS</SectionLabel>
                  <button
                    onClick={() => setShowFullAnalytics((prev) => !prev)}
                    className="dashboard-pill-btn"
                    style={{
                      fontSize: 10,
                      fontFamily: "var(--font-mono)",
                      color: "var(--accent)",
                      background: "var(--accent-muted)",
                      border: "none",
                      padding: "3px 12px",
                      borderRadius: 16,
                      cursor: "pointer",
                    }}
                  >
                    {showFullAnalytics ? "Collapse" : "View Full Analytics"}
                  </button>
                </div>

                {/* Compact preview */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {/* Left: Equity + metrics */}
                  <div style={{ background: "var(--bg-raised)", borderRadius: 12, padding: 14, border: "1px solid rgba(236,227,213,0.06)" }}>
                    <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 6, fontWeight: 600, letterSpacing: "0.04em" }}>EQUITY CURVE</div>
                    {stats.equityPoints.length > 1 ? (
                      <div style={{ height: 60, position: "relative", overflow: "hidden", marginBottom: 10 }}>
                        <svg width="100%" height="100%" viewBox={`0 0 ${stats.equityPoints.length} 100`} preserveAspectRatio="none">
                          {(() => {
                            const min = Math.min(...stats.equityPoints.map((p) => p.value));
                            const max = Math.max(...stats.equityPoints.map((p) => p.value));
                            const range = max - min || 1;
                            const points = stats.equityPoints.map((p, idx) => `${idx},${100 - ((p.value - min) / range) * 100}`).join(" ");
                            const fillPoints = `0,100 ${points} ${stats.equityPoints.length - 1},100`;
                            return (
                              <>
                                <polygon points={fillPoints} fill="rgba(196,123,58,0.08)" />
                                <polyline points={points} fill="none" stroke="var(--accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                              </>
                            );
                          })()}
                        </svg>
                      </div>
                    ) : (
                      <div style={{ height: 60, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 10, marginBottom: 10 }}>
                        No trade data yet
                      </div>
                    )}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                      <MiniMetric label="Balance" value={`$${accountState.balance.toFixed(2)}`} />
                      <MiniMetric label="Net P&L" value={formatPnl(stats.totalPnl)} color={stats.totalPnl >= 0 ? "var(--buy)" : "var(--sell)"} />
                      <MiniMetric label="Win Rate" value={stats.totalTrades > 0 ? `${stats.winRate.toFixed(1)}%` : "--"} color={stats.winRate >= 50 ? "var(--buy)" : "var(--sell)"} />
                      <MiniMetric label="Profit Factor" value={stats.profitFactor > 0 ? stats.profitFactor.toFixed(2) : "--"} />
                    </div>
                  </div>

                  {/* Right: Recent Trades */}
                  <div style={{ background: "var(--bg-raised)", borderRadius: 12, padding: 14, border: "1px solid rgba(236,227,213,0.06)" }}>
                    <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 6, fontWeight: 600, letterSpacing: "0.04em" }}>RECENT TRADES</div>
                    {accountState.tradeHistory.length === 0 ? (
                      <div style={{ padding: 16, textAlign: "center", color: "var(--text-muted)", fontSize: 10 }}>
                        No completed trades yet
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        {[...accountState.tradeHistory].reverse().slice(0, 5).map((trade) => (
                          <div key={trade.id} style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "5px 0",
                            borderBottom: "1px solid rgba(236,227,213,0.03)",
                          }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <TickerLink symbol={trade.symbol} onClick={handleSelectTicker} />
                              <span style={{
                                fontSize: 8,
                                fontFamily: "var(--font-mono)",
                                fontWeight: 700,
                                padding: "1px 5px",
                                borderRadius: 3,
                                color: trade.side === "long" ? "var(--buy)" : "var(--sell)",
                                background: trade.side === "long" ? "var(--buy-muted)" : "var(--sell-muted)",
                              }}>
                                {trade.side.toUpperCase()}
                              </span>
                            </div>
                            <span style={{
                              fontSize: 11,
                              fontFamily: "var(--font-mono)",
                              fontWeight: 600,
                              color: trade.pnl >= 0 ? "var(--buy)" : "var(--sell)",
                              fontVariantNumeric: "tabular-nums",
                            }}>
                              {formatPnl(trade.pnl)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Expanded Full Analytics */}
                <AnimatePresence>
                  {showFullAnalytics && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.4, ease: EASE_EXPO }}
                      style={{ overflow: "hidden" }}
                    >
                      <div style={{ paddingTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
                        {/* Summary Cards */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
                          <SummaryCard label="Balance" value={`$${accountState.balance.toFixed(2)}`} />
                          <SummaryCard label="Equity" value={`$${accountState.equity.toFixed(2)}`} />
                          <SummaryCard label="Net P&L" value={formatPnl(stats.totalPnl)} color={stats.totalPnl >= 0 ? "var(--buy)" : "var(--sell)"} />
                          <SummaryCard label="Win Rate" value={stats.totalTrades > 0 ? `${stats.winRate.toFixed(1)}%` : "--"} color={stats.winRate >= 50 ? "var(--buy)" : "var(--sell)"} />
                          <SummaryCard label="Total Trades" value={String(stats.totalTrades)} />
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
                          <div style={{ background: "var(--bg-raised)", borderRadius: 12, padding: 18, border: "1px solid rgba(236,227,213,0.06)" }}>
                            <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 10, fontWeight: 600 }}>PERFORMANCE</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              <MetricRow label="Profit Factor" value={stats.profitFactor > 0 ? stats.profitFactor.toFixed(2) : "--"} />
                              <MetricRow label="Avg Win" value={stats.avgWin > 0 ? formatPnl(stats.avgWin) : "--"} color="var(--buy)" />
                              <MetricRow label="Avg Loss" value={stats.avgLoss < 0 ? formatPnl(stats.avgLoss) : "--"} color="var(--sell)" />
                              <MetricRow label="Best Trade" value={stats.maxWin > 0 ? formatPnl(stats.maxWin) : "--"} color="var(--buy)" />
                              <MetricRow label="Worst Trade" value={stats.maxLoss < 0 ? formatPnl(stats.maxLoss) : "--"} color="var(--sell)" />
                              <MetricRow label="Max Drawdown" value={stats.maxDrawdown > 0 ? `-$${stats.maxDrawdown.toFixed(2)}` : "--"} color="var(--sell)" />
                              <MetricRow label="Max Consec. Wins" value={String(stats.maxConsecWins)} />
                              <MetricRow label="Max Consec. Losses" value={String(stats.maxConsecLosses)} />
                              <MetricRow label="Commission" value={`$${stats.totalCommission.toFixed(2)}`} />
                            </div>
                          </div>
                        </div>

                        {Object.keys(stats.dailyPnl).length > 0 && (
                          <div style={{ background: "var(--bg-raised)", borderRadius: 12, padding: 18, border: "1px solid rgba(236,227,213,0.06)" }}>
                            <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 10, fontWeight: 600 }}>DAILY P&L</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                              {Object.entries(stats.dailyPnl).sort(([a], [b]) => a.localeCompare(b)).map(([day, pnl]) => (
                                <div
                                  key={day}
                                  title={`${day}: ${formatPnl(pnl)}`}
                                  style={{
                                    width: 26,
                                    height: 26,
                                    borderRadius: 4,
                                    background: pnl >= 0
                                      ? `rgba(34,171,148,${Math.min(0.8, Math.abs(pnl) / 500)})`
                                      : `rgba(229,77,77,${Math.min(0.8, Math.abs(pnl) / 500)})`,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: 7,
                                    color: "var(--text-primary)",
                                    fontFamily: "var(--font-mono)",
                                  }}
                                >
                                  {new Date(day).getDate()}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {Object.keys(stats.symbolBreakdown).length > 0 && (
                          <div style={{ background: "var(--bg-raised)", borderRadius: 12, padding: 18, border: "1px solid rgba(236,227,213,0.06)" }}>
                            <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 10, fontWeight: 600 }}>BY SYMBOL</div>
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                              <thead>
                                <tr style={{ borderBottom: "1px solid rgba(236,227,213,0.06)" }}>
                                  {["Symbol", "Trades", "Win Rate", "P&L"].map((h) => (
                                    <th key={h} style={{ textAlign: h === "Symbol" ? "left" : "right", fontSize: 9, color: "var(--text-muted)", fontFamily: "var(--font-mono)", padding: "5px 6px", fontWeight: 500 }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {Object.entries(stats.symbolBreakdown).map(([sym, data]) => (
                                  <tr key={sym} style={{ borderBottom: "1px solid rgba(236,227,213,0.03)" }}>
                                    <td style={{ fontSize: 11, fontFamily: "var(--font-mono)", padding: "6px", fontWeight: 600 }}>
                                      <TickerLink symbol={sym} onClick={handleSelectTicker} />
                                    </td>
                                    <td style={{ textAlign: "right", fontSize: 11, color: "var(--text-secondary)", fontFamily: "var(--font-mono)", padding: "6px" }}>{data.trades}</td>
                                    <td style={{ textAlign: "right", fontSize: 11, color: "var(--text-secondary)", fontFamily: "var(--font-mono)", padding: "6px" }}>
                                      {((data.wins / data.trades) * 100).toFixed(0)}%
                                    </td>
                                    <td style={{ textAlign: "right", fontSize: 11, fontWeight: 600, fontFamily: "var(--font-mono)", padding: "6px", color: data.pnl >= 0 ? "var(--buy)" : "var(--sell)" }}>
                                      {formatPnl(data.pnl)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        <div style={{ background: "var(--bg-raised)", borderRadius: 12, padding: 18, border: "1px solid rgba(236,227,213,0.06)" }}>
                          <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 10, fontWeight: 600 }}>TRADE HISTORY</div>
                          {accountState.tradeHistory.length === 0 ? (
                            <div style={{ padding: 30, textAlign: "center", color: "var(--text-muted)", fontSize: 11 }}>
                              No completed trades yet
                            </div>
                          ) : (
                            <div style={{ overflowX: "auto" }}>
                              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                  <tr style={{ borderBottom: "1px solid rgba(236,227,213,0.06)" }}>
                                    {["Symbol", "Side", "Size", "Entry", "Exit", "P&L", "Commission", "Time"].map((h) => (
                                      <th key={h} style={{ textAlign: h === "Symbol" || h === "Side" ? "left" : "right", fontSize: 9, color: "var(--text-muted)", fontFamily: "var(--font-mono)", padding: "5px 6px", fontWeight: 500 }}>{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {[...accountState.tradeHistory].reverse().slice(0, 50).map((trade) => (
                                    <tr key={trade.id} style={{ borderBottom: "1px solid rgba(236,227,213,0.03)" }}>
                                      <td style={{ fontSize: 10, fontFamily: "var(--font-mono)", padding: "5px 6px", fontWeight: 600 }}>
                                        <TickerLink symbol={trade.symbol} onClick={handleSelectTicker} />
                                      </td>
                                      <td style={{ fontSize: 10, fontFamily: "var(--font-mono)", padding: "5px 6px", color: trade.side === "long" ? "var(--buy)" : "var(--sell)", fontWeight: 600 }}>
                                        {trade.side.toUpperCase()}
                                      </td>
                                      <td style={{ textAlign: "right", fontSize: 10, color: "var(--text-secondary)", fontFamily: "var(--font-mono)", padding: "5px 6px" }}>{trade.size}</td>
                                      <td style={{ textAlign: "right", fontSize: 10, color: "var(--text-secondary)", fontFamily: "var(--font-mono)", padding: "5px 6px" }}>${trade.entryPrice.toFixed(2)}</td>
                                      <td style={{ textAlign: "right", fontSize: 10, color: "var(--text-secondary)", fontFamily: "var(--font-mono)", padding: "5px 6px" }}>${trade.exitPrice.toFixed(2)}</td>
                                      <td style={{ textAlign: "right", fontSize: 10, fontWeight: 600, fontFamily: "var(--font-mono)", padding: "5px 6px", color: trade.pnl >= 0 ? "var(--buy)" : "var(--sell)" }}>
                                        {formatPnl(trade.pnl)}
                                      </td>
                                      <td style={{ textAlign: "right", fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", padding: "5px 6px" }}>${trade.commission.toFixed(2)}</td>
                                      <td style={{ textAlign: "right", fontSize: 9, color: "var(--text-muted)", fontFamily: "var(--font-mono)", padding: "5px 6px" }}>
                                        {new Date(trade.exitTime > 1e12 ? trade.exitTime : trade.exitTime * 1000).toLocaleDateString()}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* ════════════════════════════════════════════
                  Section 5: Trading Journal (Notes)
                  ════════════════════════════════════════════ */}
              <JournalSection onNavigateToPage={onNavigateToPage} />

              {/* ════════════════════════════════════════════
                  Section 6: Investment Thesis
                  ════════════════════════════════════════════ */}
              <ThesisSection
                onSelectTicker={handleSelectTicker}
                onNavigateToChart={onNavigateToChart}
              />

              {/* ════════════════════════════════════════════
                  Section 7: Trader Quote (compact)
                  ════════════════════════════════════════════ */}
              <motion.div
                ref={quoteParallax.ref}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, ease: EASE_EXPO, delay: 0.36 }}
                style={{ position: "relative" }}
              >
                <div style={{ height: 1, background: "linear-gradient(90deg, transparent, var(--accent-glow), transparent)", marginBottom: 28 }} />
                <div style={{
                  maxWidth: 640,
                  margin: "0 auto",
                  textAlign: "center",
                  transition: "transform 150ms ease-out",
                  transform: `translate(${quoteParallax.offset.x}px, ${quoteParallax.offset.y}px)`,
                }}>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={quoteOffset}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.6, ease: EASE_EXPO }}
                      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}
                    >
                      <ImageBubble
                        src={getAuthorHeadshotUrl(currentQuote.author)}
                        fallback={currentQuote.author}
                        size={44}
                        accentColor={authorAccentColor(currentQuote.author)}
                      />
                      <div style={{
                        fontSize: 18,
                        lineHeight: 1.6,
                        fontWeight: 400,
                        background: "linear-gradient(180deg, var(--text-primary), var(--text-secondary))",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        backgroundClip: "text",
                      }}>
                        &ldquo;{currentQuote.text}&rdquo;
                      </div>
                      <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                        {currentQuote.author}
                        {currentQuote.source && (
                          <span style={{ fontStyle: "italic" }}> -- {currentQuote.source}</span>
                        )}
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>
                <div style={{ height: 1, background: "linear-gradient(90deg, transparent, var(--accent-glow), transparent)", marginTop: 28 }} />
              </motion.div>



              {/* ═══ Footer — bottom of scroll ═══ */}
              <footer style={{
                marginTop: 40,
                borderTop: "1px solid rgba(236,227,213,0.06)",
                padding: "14px 0 8px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>aFindr</span>
                    <span style={{ fontSize: 8, color: "var(--text-disabled)", fontFamily: "var(--font-mono)" }}>
                      &copy; {new Date().getFullYear()} All rights reserved. Not financial advice.
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
                    <FooterLink label="Help" onClick={() => onNavigateToPage?.("help-center")} />
                    <FooterLink label="Changelog" onClick={() => onNavigateToPage?.("changelog")} />
                    <FooterLink label="Terms" onClick={() => onNavigateToPage?.("terms")} />
                    <FooterLink label="Privacy" onClick={() => onNavigateToPage?.("privacy")} />
                    <FooterLink label="Risk" onClick={() => onNavigateToPage?.("risk-disclosure")} />
                  </div>
                </div>
              </footer>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Keyframe animations + hover styles */}
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .dashboard-glass-card {
          transition: transform 180ms cubic-bezier(0.16, 1, 0.3, 1),
                      border-color 180ms ease,
                      box-shadow 180ms ease;
        }
        .dashboard-glass-card:hover {
          transform: translateY(-1px) scale(1.01);
          border-color: rgba(236,227,213,0.14) !important;
          box-shadow: 0 4px 20px rgba(15,12,8,0.35), 0 0 0 1px rgba(196,123,58,0.06);
        }
        .dashboard-pill-btn {
          transition: opacity 150ms ease, transform 150ms ease;
        }
        .dashboard-pill-btn:hover {
          opacity: 0.8;
          transform: scale(1.02);
        }
        .book-3d:hover .book-3d-inner {
          transform: rotateY(-8deg) !important;
        }
      `}</style>
      </div>

    </div>
  );
}

// ─── Flow Lines Background ───

const FLOW_PATHS = [
  "M-50,120 C150,80 300,200 500,140 S750,180 950,100 S1200,160 1400,120",
  "M-80,200 C100,250 280,150 480,220 S700,160 900,230 S1150,180 1450,200",
  "M-30,300 C200,260 350,340 550,280 S780,320 980,260 S1180,300 1420,280",
  "M-60,380 C120,420 300,360 500,400 S720,350 920,410 S1160,370 1450,390",
  "M-40,460 C180,430 340,490 540,440 S760,480 960,430 S1200,470 1440,450",
  "M-70,160 C160,130 320,190 520,150 S740,200 940,150 S1180,190 1430,160",
  "M-50,260 C140,300 290,230 490,270 S710,240 910,290 S1150,250 1440,270",
  "M-80,340 C110,370 280,310 480,350 S700,300 900,360 S1170,330 1450,340",
  "M-30,420 C190,390 350,440 550,400 S770,440 970,390 S1190,430 1430,410",
  "M-60,500 C130,470 300,520 500,480 S730,520 930,470 S1160,510 1440,490",
  "M-40,180 C170,210 330,160 530,200 S750,170 950,220 S1180,180 1420,200",
  "M-70,280 C150,310 310,260 510,300 S740,270 940,320 S1160,280 1440,300",
  "M-50,360 C120,340 290,380 490,350 S720,380 920,340 S1170,370 1430,350",
  "M-80,440 C140,460 310,420 510,450 S740,410 940,460 S1180,430 1450,440",
  "M-30,520 C180,500 350,540 550,510 S770,540 970,500 S1190,530 1440,510",
];

function DashboardFlowLines() {
  return (
    <div className="dash-flow-lines">
      <svg viewBox="0 0 1400 600" preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}>
        {FLOW_PATHS.map((d, i) => (
          <path
            key={i}
            d={d}
            className="dash-flow-line"
            style={{
              opacity: 0.03 + (i % 5) * 0.006,
              animationDuration: `${12 + i * 1.5}s`,
              animationDelay: `${i * -0.8}s`,
            }}
          />
        ))}
      </svg>
    </div>
  );
}

// ─── Sub-components ───

function FooterLink({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        fontSize: 9,
        color: "var(--text-muted)",
        cursor: "pointer",
        padding: 0,
        fontFamily: "var(--font-mono)",
        transition: "color 100ms ease",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-primary)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
    >
      {label}
    </div>
  );
}

function SectionLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      fontSize: 10,
      color: "var(--text-muted)",
      fontFamily: "var(--font-mono)",
      fontWeight: 600,
      letterSpacing: "0.06em",
      marginBottom: 8,
      ...style,
    }}>
      {children}
    </div>
  );
}

function Book3D({
  src,
  fallback,
  accentColor,
  width = 72,
  height = 100,
}: {
  src?: string;
  fallback: string;
  accentColor?: string;
  width?: number;
  height?: number;
}) {
  const [failed, setFailed] = useState(false);
  const spineW = 14;
  const accent = accentColor || "var(--accent)";

  return (
    <div
      className="book-3d"
      style={{
        width,
        height,
        perspective: 600,
        flexShrink: 0,
      }}
    >
      <div
        className="book-3d-inner"
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          transformStyle: "preserve-3d",
          transform: "rotateY(-18deg)",
          transition: "transform 300ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* Front cover */}
        <div style={{
          position: "absolute",
          inset: 0,
          borderRadius: "2px 6px 6px 2px",
          overflow: "hidden",
          backfaceVisibility: "hidden",
          boxShadow: `4px 4px 12px rgba(0,0,0,0.4), 0 0 1px rgba(0,0,0,0.3)`,
          transform: `translateZ(${spineW / 2}px)`,
          background: `${accent}30`,
        }}>
          {src && !failed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={fallback}
              onError={() => setFailed(true)}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <div style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 700,
              color: accent,
              padding: 6,
              textAlign: "center",
              lineHeight: 1.2,
              fontFamily: "var(--font-mono)",
            }}>
              {fallback}
            </div>
          )}
        </div>

        {/* Spine */}
        <div style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: spineW,
          height: "100%",
          background: `linear-gradient(180deg, ${accent}60, ${accent}35)`,
          transform: `rotateY(90deg) translateZ(0px)`,
          transformOrigin: "left center",
          borderRadius: "2px 0 0 2px",
        }} />

        {/* Back cover */}
        <div style={{
          position: "absolute",
          inset: 0,
          background: `${accent}20`,
          borderRadius: "2px 6px 6px 2px",
          transform: `translateZ(-${spineW / 2}px)`,
          boxShadow: "inset 0 0 8px rgba(0,0,0,0.2)",
        }} />

        {/* Page edges (right side) */}
        <div style={{
          position: "absolute",
          top: 2,
          right: -1,
          width: spineW,
          height: height - 4,
          background: "linear-gradient(90deg, #e8e0d4, #d4ccc0, #e8e0d4)",
          transform: `rotateY(90deg) translateZ(${width - spineW}px)`,
          transformOrigin: "left center",
          borderRadius: "0 1px 1px 0",
        }} />
      </div>
    </div>
  );
}

function ImageBubble({
  src,
  fallback,
  size = 44,
  accentColor,
}: {
  src?: string;
  fallback: string;
  size?: number;
  accentColor?: string;
}) {
  const [failed, setFailed] = useState(false);
  const initials = fallback
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: "50%",
      overflow: "hidden",
      background: accentColor ? `${accentColor}25` : "var(--bg-surface)",
      border: "1px solid rgba(236,227,213,0.08)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    }}>
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={fallback}
          onError={() => setFailed(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <span style={{
          fontSize: size * 0.32,
          fontFamily: "var(--font-mono)",
          fontWeight: 600,
          color: accentColor || "var(--text-muted)",
          letterSpacing: "-0.02em",
        }}>
          {initials}
        </span>
      )}
    </div>
  );
}

function TickerLink({ symbol, onClick }: { symbol: string; onClick: (s: string) => void }) {
  return (
    <span
      onClick={() => onClick(symbol)}
      style={{
        color: "var(--accent)",
        cursor: "pointer",
        fontSize: 11,
        fontFamily: "var(--font-mono)",
        fontWeight: 600,
        transition: "opacity 120ms ease",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.7"; }}
      onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
    >
      {symbol}
    </span>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: "var(--bg-raised)", borderRadius: 10, padding: "12px 14px", border: "1px solid rgba(236,227,213,0.06)" }}>
      <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 4, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: color || "var(--text-primary)", fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}

function MetricRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between" style={{ padding: "4px 0", borderBottom: "1px solid rgba(236,227,213,0.03)" }}>
      <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: color || "var(--text-primary)", fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
}

function MiniMetric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ padding: "6px 8px", borderRadius: 6, background: "rgba(236,227,213,0.02)" }}>
      <div style={{ fontSize: 8, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 2, fontWeight: 500, letterSpacing: "0.04em" }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: color || "var(--text-primary)", fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}
