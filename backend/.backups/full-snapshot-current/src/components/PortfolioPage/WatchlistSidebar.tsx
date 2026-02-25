"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useConvexUserId } from "@/components/ConvexClientProvider";
import type { PortfolioQuote } from "@/lib/api";
import { fetchPortfolioQuotes } from "@/lib/api";
import { SYMBOL_LIBRARY } from "@/lib/symbols";
import SparklineSVG from "./shared/SparklineSVG";
import { formatCurrency, formatPercent } from "@/lib/portfolio-utils";

interface WatchlistSidebarProps {
  onSelectTicker: (ticker: string) => void;
}

export default function WatchlistSidebar({ onSelectTicker }: WatchlistSidebarProps) {
  const DEFAULT_WATCHLIST = ["AAPL", "MSFT", "NVDA", "GOOGL", "TSLA", "META", "AMZN", "V", "JPM"];
  const [watchlist, setWatchlist] = useState<string[]>(DEFAULT_WATCHLIST);
  const [wlHydrated, setWlHydrated] = useState(false);

  // ─── Convex sync ───
  const { userId } = useConvexUserId();
  const convexWatchlist = useQuery(api.watchlists.get, userId ? { userId } : "skip");
  const setConvexWatchlist = useMutation(api.watchlists.set);

  useEffect(() => {
    const saved = localStorage.getItem("afindr_watchlist");
    if (saved) {
      try { const parsed = JSON.parse(saved) as string[]; setWatchlist([...new Set(parsed)]); } catch { /* ignore */ }
    }
    setWlHydrated(true);
  }, []);

  useEffect(() => {
    if (wlHydrated) localStorage.setItem("afindr_watchlist", JSON.stringify(watchlist));
  }, [watchlist, wlHydrated]);

  // Convex reconciliation: Convex wins if it has data, else seed from localStorage
  const convexReconciledRef = useRef(false);
  useEffect(() => {
    if (!wlHydrated || !userId || convexWatchlist === undefined || convexReconciledRef.current) return;
    convexReconciledRef.current = true;
    if (convexWatchlist && convexWatchlist.symbols.length > 0) {
      // Convex has data → use it (deduplicate in case of stale data)
      setWatchlist([...new Set(convexWatchlist.symbols)]);
      localStorage.setItem("afindr_watchlist", JSON.stringify(convexWatchlist.symbols));
    } else {
      // Convex empty → seed from localStorage
      setConvexWatchlist({ userId, symbols: watchlist });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wlHydrated, userId, convexWatchlist]);

  // ─── Collapsible Sections ───
  const [watchlistOpen, setWatchlistOpen] = useState(true);

  // ─── Search ───
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showSearch) setTimeout(() => searchInputRef.current?.focus(), 50);
    else setSearchQuery("");
  }, [showSearch]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSearch(false);
      }
    };
    if (showSearch) {
      window.addEventListener("click", handleClick);
      return () => window.removeEventListener("click", handleClick);
    }
  }, [showSearch]);

  const searchResults = useMemo(() => {
    if (!searchQuery) return [];
    const q = searchQuery.toLowerCase();
    return SYMBOL_LIBRARY
      .filter((s) => !watchlist.includes(s.symbol))
      .filter((s) => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [searchQuery, watchlist]);

  const addToWatchlist = useCallback((symbol: string) => {
    setWatchlist((prev) => {
      if (prev.includes(symbol)) return prev;
      const next = [...prev, symbol];
      if (userId) setConvexWatchlist({ userId, symbols: next });
      return next;
    });
    setShowSearch(false);
  }, [userId, setConvexWatchlist]);

  const removeFromWatchlist = useCallback((symbol: string) => {
    setWatchlist((prev) => {
      const next = prev.filter((s) => s !== symbol);
      if (userId) setConvexWatchlist({ userId, symbols: next });
      return next;
    });
  }, [userId, setConvexWatchlist]);

  // ─── Live Quotes ───
  const [quotes, setQuotes] = useState<Record<string, PortfolioQuote>>({});

  const allSymbols = useMemo(() => {
    return [...new Set(watchlist)];
  }, [watchlist]);

  useEffect(() => {
    if (allSymbols.length === 0) return;
    let cancelled = false;

    const fetchQuotes = () => {
      fetchPortfolioQuotes(allSymbols)
        .then((data) => {
          if (!cancelled) setQuotes(data);
        })
        .catch(() => {});
    };

    fetchQuotes();
    const interval = globalThis.setInterval(fetchQuotes, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [allSymbols]);

  // ─── Thesis sentiments (Convex with localStorage fallback) ───
  const convexTheses = useQuery(api.theses.listByUser, userId ? { userId } : "skip");

  const thesisSentiments = useMemo(() => {
    const sentiments: Record<string, "bullish" | "bearish" | "neutral"> = {};
    // If Convex data available, use it
    if (convexTheses && convexTheses.length > 0) {
      for (const t of convexTheses) {
        sentiments[t.ticker] = t.sentiment;
      }
      return sentiments;
    }
    // Fallback to localStorage while Convex is loading
    for (const sym of watchlist) {
      const raw = localStorage.getItem(`afindr_thesis_${sym}`);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed?.sentiment) sentiments[sym] = parsed.sentiment;
        } catch { /* ignore */ }
      }
    }
    return sentiments;
  }, [convexTheses, watchlist]);

  // ─── Watchlist Entries with metadata ───
  const watchlistEntries = useMemo(() => {
    return watchlist.map((sym) => {
      const entry = SYMBOL_LIBRARY.find((s) => s.symbol === sym);
      const quote = quotes[sym];
      return {
        symbol: sym,
        name: quote?.name || entry?.name || sym,
        price: quote?.price ?? 0,
        change: quote?.change ?? 0,
        changePct: quote?.changePct ?? 0,
        sparkline: quote?.sparkline ?? [],
      };
    });
  }, [watchlist, quotes]);

  return (
    <div
      style={{
        width: 280,
        borderRadius: 16,
        background: "rgba(24,22,18,0.92)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(236,227,213,0.12)",
        boxShadow: "0 16px 48px rgba(0,0,0,0.4), 0 0 0 1px rgba(236,227,213,0.06)",
        overflowY: "auto",
        alignSelf: "flex-start",
        position: "sticky",
        top: 16,
        maxHeight: "calc(100vh - 100px)",
        scrollbarWidth: "none",
      }}
    >
      {/* ─── Watchlist Section ─── */}
      <div>
        <div
          className="flex items-center justify-between"
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <button
            onClick={() => setWatchlistOpen(!watchlistOpen)}
            className="flex items-center gap-2"
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 0 }}
          >
            <span style={{ fontSize: 11, fontWeight: 600, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Watchlist
            </span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
              style={{ transform: watchlistOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 150ms ease" }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {/* Add button + search */}
          <div ref={searchContainerRef} style={{ position: "relative" }}>
            <button
              onClick={(e) => { e.stopPropagation(); setShowSearch(!showSearch); }}
              style={{
                display: "flex", alignItems: "center", gap: 4,
                padding: "3px 8px", borderRadius: 6,
                background: showSearch ? "rgba(236,227,213,0.08)" : "rgba(236,227,213,0.04)",
                border: "1px solid rgba(236,227,213,0.08)",
                color: "var(--text-secondary)", fontSize: 10, fontWeight: 500, cursor: "pointer",
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add
            </button>

            {showSearch && (
              <div
                style={{
                  position: "absolute", top: "100%", right: 0, marginTop: 6,
                  width: 260, background: "rgba(24,22,18,0.98)",
                  border: "1px solid rgba(236,227,213,0.12)", borderRadius: 12,
                  boxShadow: "0 12px 40px rgba(15,12,8,0.6)",
                  backdropFilter: "blur(20px)", zIndex: 50, overflow: "hidden",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderBottom: "1px solid rgba(236,227,213,0.08)" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    ref={searchInputRef}
                    type="text" value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search symbols..."
                    style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 12, color: "white" }}
                  />
                </div>
                <div style={{ maxHeight: 240, overflowY: "auto" }}>
                  {searchResults.length === 0 && searchQuery && (
                    <div style={{ padding: "16px 12px", textAlign: "center", color: "var(--text-muted)", fontSize: 11 }}>
                      No matches found
                    </div>
                  )}
                  {!searchQuery && (
                    <div style={{ padding: "16px 12px", textAlign: "center", color: "var(--text-muted)", fontSize: 11 }}>
                      Type to search
                    </div>
                  )}
                  {searchResults.map((entry) => (
                    <button
                      key={entry.symbol}
                      onClick={() => addToWatchlist(entry.symbol)}
                      style={{
                        display: "flex", alignItems: "center", gap: 8, width: "100%",
                        padding: "8px 12px", border: "none", cursor: "pointer",
                        background: "transparent", color: "var(--text-primary)", textAlign: "left",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(236,227,213,0.04)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <span style={{ fontWeight: 600, fontSize: 12, fontFamily: "var(--font-mono)", minWidth: 56 }}>{entry.symbol}</span>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {watchlistOpen && (
          <div>
            {watchlistEntries.length === 0 ? (
              <div style={{ padding: "20px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: 11, fontFamily: "var(--font-mono)" }}>
                No symbols in watchlist
              </div>
            ) : (
              watchlistEntries.map((entry, idx) => {
                const isPositive = entry.changePct >= 0;
                return (
                  <div
                    key={`${entry.symbol}-${idx}`}
                    className="flex items-center"
                    style={{
                      padding: "10px 16px",
                      borderBottom: "1px solid var(--border-subtle)",
                      cursor: "pointer", transition: "background 80ms ease",
                      position: "relative",
                    }}
                    onClick={() => onSelectTicker(entry.symbol)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(236,227,213,0.03)";
                      const btn = e.currentTarget.querySelector("[data-remove]") as HTMLElement;
                      if (btn) btn.style.opacity = "1";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                      const btn = e.currentTarget.querySelector("[data-remove]") as HTMLElement;
                      if (btn) btn.style.opacity = "0";
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="flex items-center" style={{ gap: 5, fontSize: 13, fontWeight: 600, color: "var(--accent-bright)", fontFamily: "var(--font-mono)" }}>
                        {entry.symbol}
                        {thesisSentiments[entry.symbol] && (
                          <span
                            title={`Thesis: ${thesisSentiments[entry.symbol]}`}
                            style={{
                              width: 6, height: 6, borderRadius: "50%", display: "inline-block", flexShrink: 0,
                              background: thesisSentiments[entry.symbol] === "bullish" ? "var(--buy)" : thesisSentiments[entry.symbol] === "bearish" ? "var(--sell)" : "var(--warning)",
                            }}
                          />
                        )}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 100 }}>
                        {entry.name}
                      </div>
                    </div>
                    <div style={{ marginRight: 8 }}>
                      <SparklineSVG data={entry.sparkline} positive={isPositive} />
                    </div>
                    <div style={{ textAlign: "right", minWidth: 56 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", color: "var(--text-primary)" }}>
                        {entry.price > 0 ? formatCurrency(entry.price) : "-"}
                      </div>
                      <div
                        style={{
                          fontSize: 10, fontWeight: 600, fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums",
                          color: isPositive ? "var(--buy)" : "var(--sell)", marginTop: 2,
                        }}
                      >
                        {formatPercent(entry.changePct)}
                      </div>
                    </div>
                    <button
                      data-remove
                      onClick={(e) => { e.stopPropagation(); removeFromWatchlist(entry.symbol); }}
                      style={{
                        position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)",
                        background: "transparent", border: "none", cursor: "pointer",
                        color: "var(--text-muted)", padding: 4, borderRadius: 4,
                        opacity: 0, transition: "opacity 100ms ease, color 100ms ease",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "var(--sell)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
                      title="Remove from watchlist"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
