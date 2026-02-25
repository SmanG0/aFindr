"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { fetchPortfolioQuotes } from "@/lib/api";
import type { PortfolioQuote } from "@/lib/api";

// ─── Constants ───

const DEFAULT_SYMBOLS = [
  "SPY", "QQQ", "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA",
  "GC=F", "CL=F", "BTC-USD",
];
const EASE_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];
const REFRESH_INTERVAL = 60_000;

// ─── Helpers ───

function getWatchlistSymbols(): string[] {
  try {
    const raw = localStorage.getItem("afindr_watchlist");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch { /* ignore */ }
  return [];
}

function getOnboardingInstruments(): string[] {
  try {
    const raw = localStorage.getItem("afindr_onboarding");
    if (raw) {
      const data = JSON.parse(raw);
      return data.instruments || data.watchlist || [];
    }
  } catch { /* ignore */ }
  return [];
}

function deduplicateSymbols(symbols: string[]): string[] {
  const seen = new Set<string>();
  return symbols.filter((s) => {
    const upper = s.toUpperCase();
    if (seen.has(upper)) return false;
    seen.add(upper);
    return true;
  });
}

// ─── Component ───

export function TickerBanner() {
  const [quotes, setQuotes] = useState<Record<string, PortfolioQuote>>({});
  const [loading, setLoading] = useState(true);
  const [symbols, setSymbols] = useState<string[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async (syms: string[]) => {
    if (syms.length === 0) return;
    try {
      const data = await fetchPortfolioQuotes(syms);
      setQuotes(data);
    } catch { /* keep last data */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    const watchlist = getWatchlistSymbols();
    const onboarding = getOnboardingInstruments();
    const merged = deduplicateSymbols([...DEFAULT_SYMBOLS, ...watchlist, ...onboarding]);
    setSymbols(merged);
    fetchData(merged);

    intervalRef.current = setInterval(() => fetchData(merged), REFRESH_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData]);

  const orderedQuotes = symbols
    .map((s) => quotes[s])
    .filter((q): q is PortfolioQuote => !!q);

  if (orderedQuotes.length === 0 && !loading) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: EASE_EXPO }}
      style={{
        width: "100%",
        height: 32,
        background: "var(--bg-raised)",
        borderBottom: "1px solid var(--glass-border)",
        overflow: "hidden",
        position: "relative",
        flexShrink: 0,
      }}
    >
      {loading ? (
        <div style={{
          height: "100%",
          background: "linear-gradient(90deg, transparent, rgba(236,227,213,0.03), transparent)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.5s ease-in-out infinite",
        }} />
      ) : (
        <div
          className="ticker-scroll-container"
          style={{
            display: "flex",
            alignItems: "center",
            height: "100%",
            whiteSpace: "nowrap",
          }}
        >
          <div className="ticker-scroll-track" style={{ display: "flex", alignItems: "center" }}>
            {/* Duplicated content for seamless loop */}
            {[0, 1].map((copy) => (
              <div
                key={copy}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0,
                  paddingRight: 24,
                }}
              >
                {orderedQuotes.map((q) => {
                  const isUp = q.changePct >= 0;
                  return (
                    <span
                      key={`${copy}-${q.symbol}`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "0 18px",
                        fontSize: 11,
                        fontFamily: "var(--font-mono)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      <span style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: 10, letterSpacing: "0.02em" }}>
                        {q.symbol}
                      </span>
                      <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>
                        {q.price.toFixed(2)}
                      </span>
                      <span style={{
                        color: isUp ? "var(--buy)" : "var(--sell)",
                        fontWeight: 600,
                        fontSize: 10,
                      }}>
                        {isUp ? "+" : ""}{q.changePct.toFixed(2)}%
                      </span>
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .ticker-scroll-track {
          animation: marquee 40s linear infinite;
        }
        .ticker-scroll-container:hover .ticker-scroll-track {
          animation-play-state: paused;
        }
      `}</style>
    </motion.div>
  );
}
