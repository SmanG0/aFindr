"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CONTRACTS, AccountState } from "@/lib/types";
import { SYMBOL_LIBRARY } from "@/lib/symbols";

interface Navbar2Props {
  symbol: string;
  onOpenSymbolSearch: () => void;
  interval: string;
  onIntervalChange: (interval: string) => void;
  chartTheme: "dark" | "light";
  onChartThemeChange: (theme: "dark" | "light") => void;
  accountState: AccountState;
  currentPrice: number;
  spread: number;
  onBuy: (price: number) => void;
  onSell: (price: number) => void;
  onOpenIndicators?: () => void;
  indicatorCount?: number;
  showAccountMetrics?: boolean;
}

const INTERVALS = [
  { value: "1m", label: "1m" },
  { value: "5m", label: "5m" },
  { value: "15m", label: "15" },
  { value: "30m", label: "30" },
  { value: "1h", label: "1H" },
  { value: "4h", label: "4H" },
  { value: "1d", label: "D" },
  { value: "1wk", label: "W" },
];

const DEFAULT_FAVORITES = ["1m", "5m", "15m", "1h", "4h", "1d", "1wk"];

function formatUSD(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPrice(price: number, sym: string): string {
  if (sym === "GC=F") return price.toFixed(1);
  return price.toFixed(2);
}

export default function Navbar2({
  symbol,
  onOpenSymbolSearch,
  interval,
  onIntervalChange,
  chartTheme,
  onChartThemeChange,
  accountState,
  currentPrice,
  spread,
  onBuy,
  onSell,
  onOpenIndicators,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  indicatorCount = 0,
  showAccountMetrics = false,
}: Navbar2Props) {
  const [tradeExpanded, setTradeExpanded] = useState(false);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        e.preventDefault();
        setTradeExpanded(prev => !prev);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);
  const [showIntervalMenu, setShowIntervalMenu] = useState(false);
  const intervalMenuRef = useRef<HTMLDivElement>(null);

  const [favoriteIntervals, setFavoriteIntervals] = useState<string[]>(DEFAULT_FAVORITES);

  useEffect(() => {
    const saved = localStorage.getItem("afindr_interval_favorites");
    if (saved) {
      try { setFavoriteIntervals(JSON.parse(saved)); } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("afindr_interval_favorites", JSON.stringify(favoriteIntervals));
  }, [favoriteIntervals]);

  // Close interval menu on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (intervalMenuRef.current && !intervalMenuRef.current.contains(e.target as Node)) {
        setShowIntervalMenu(false);
      }
    };
    if (showIntervalMenu) {
      window.addEventListener("click", handleClick);
      return () => window.removeEventListener("click", handleClick);
    }
  }, [showIntervalMenu]);

  const toggleIntervalFavorite = (value: string) => {
    setFavoriteIntervals(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    );
  };

  const visibleIntervals = INTERVALS.filter(i => favoriteIntervals.includes(i.value));
  const currentContract = CONTRACTS[symbol];
  const symbolEntry = SYMBOL_LIBRARY.find(s => s.symbol === symbol);

  const pnlColor =
    accountState.unrealizedPnl > 0
      ? "var(--buy)"
      : accountState.unrealizedPnl < 0
        ? "var(--sell)"
        : "var(--text-primary)";

  return (
    <div
      className="flex items-center"
      style={{
        height: 64,
        padding: "0 16px",
        gap: 12,
        background: "var(--bg)",
        borderBottom: "0.667px solid rgba(236,227,213,0.15)",
      }}
    >
      {/* ─── Symbol Selector ─── */}
      <button
        onClick={onOpenSymbolSearch}
        className="flex items-center gap-2 px-2 py-1 rounded-lg transition-all"
        style={{
          color: "var(--text-primary)",
          background: "transparent",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(236,227,213,0.04)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
      >
        <span className="text-sm font-semibold tracking-tight">
          {currentContract?.name || symbolEntry?.name || symbol}
        </span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="currentColor"
          style={{ opacity: 0.4 }}
        >
          <path
            d="M2 3.5L5 6.5L8 3.5"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {/* ─── Account Metrics (only in broker/backtest state) ─── */}
      {showAccountMetrics && (
        <>
          <div className="metric-group">
            <span className="metric-label">BALANCE</span>
            <span className="metric-value">{formatUSD(accountState.balance)}</span>
          </div>

          <div className="metric-group">
            <span className="metric-label">EQUITY</span>
            <span className="metric-value">{formatUSD(accountState.equity)}</span>
          </div>

          <div className="metric-group">
            <span className="metric-label">UNREALIZED P&L</span>
            <span className="metric-value" style={{ color: pnlColor }}>
              {formatUSD(accountState.unrealizedPnl)}
            </span>
          </div>

          <div
            style={{
              width: 1,
              height: 24,
              background: "rgba(236,227,213,0.1)",
              flexShrink: 0,
            }}
          />
        </>
      )}

      {/* ─── Interval Selector Pills (favorites only) ─── */}
      <div className="flex items-center gap-0.5">
        {visibleIntervals.map((i) => {
          const isActive = interval === i.value;
          return (
            <button
              key={i.value}
              onClick={() => onIntervalChange(i.value)}
              className="relative px-2.5 py-1 text-xs font-medium rounded-md transition-colors"
              style={{
                color: isActive ? "var(--text-primary)" : "var(--text-muted)",
                background: isActive
                  ? "rgba(236,227,213,0.08)"
                  : "transparent",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = "var(--text-secondary)";
                  e.currentTarget.style.background = "rgba(236,227,213,0.04)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = "var(--text-muted)";
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              {isActive && (
                <motion.div
                  layoutId="interval-active"
                  className="absolute inset-0 rounded-md"
                  style={{ background: "rgba(236,227,213,0.08)" }}
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <span className="relative z-10">{i.label}</span>
            </button>
          );
        })}

        {/* Interval config dropdown */}
        <div ref={intervalMenuRef} className="relative">
          <button
            onClick={() => setShowIntervalMenu(!showIntervalMenu)}
            className="px-1.5 py-1 rounded-md transition-colors"
            style={{
              color: showIntervalMenu ? "var(--text-primary)" : "var(--text-muted)",
              background: showIntervalMenu ? "rgba(236,227,213,0.06)" : "transparent",
            }}
            onMouseEnter={(e) => {
              if (!showIntervalMenu) e.currentTarget.style.background = "rgba(236,227,213,0.04)";
            }}
            onMouseLeave={(e) => {
              if (!showIntervalMenu) e.currentTarget.style.background = "transparent";
            }}
            title="Configure visible intervals"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>

          <AnimatePresence>
            {showIntervalMenu && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.12 }}
                style={{
                  position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)",
                  marginTop: 4, zIndex: 50, minWidth: 160,
                  background: "rgba(33,30,26,0.98)", border: "1px solid rgba(236,227,213,0.12)",
                  borderRadius: 10, padding: 6, backdropFilter: "blur(20px)",
                  boxShadow: "0 12px 40px rgba(15,12,8,0.5)",
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", padding: "4px 8px 6px", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Visible Intervals
                </div>
                {INTERVALS.map((i) => {
                  const isFav = favoriteIntervals.includes(i.value);
                  return (
                    <button
                      key={i.value}
                      onClick={(e) => { e.stopPropagation(); toggleIntervalFavorite(i.value); }}
                      style={{
                        display: "flex", alignItems: "center", gap: 8, width: "100%",
                        padding: "6px 8px", borderRadius: 6, border: "none", cursor: "pointer",
                        background: "transparent", color: isFav ? "var(--text-primary)" : "var(--text-muted)",
                        fontSize: 12, textAlign: "left", transition: "background 80ms ease",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(236,227,213,0.06)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill={isFav ? "#f59e0b" : "none"} stroke={isFav ? "#f59e0b" : "rgba(236,227,213,0.25)"} strokeWidth="2" style={{ flexShrink: 0, transition: "all 150ms ease" }}>
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                      <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>{i.label}</span>
                      <span style={{ flex: 1 }} />
                      <span style={{ fontSize: 10, color: "var(--text-disabled)", fontFamily: "var(--font-mono)" }}>{i.value}</span>
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ─── Indicators Button (plus only, grey/brown) ─── */}
      <button
        onClick={onOpenIndicators}
        className="relative flex items-center justify-center rounded-md transition-colors"
        style={{
          color: "rgba(236,227,213,0.5)",
          background: "transparent",
          padding: 0,
          width: 28,
          height: 28,
          border: "none",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = "rgba(236,227,213,0.8)"; e.currentTarget.style.background = "rgba(107,99,88,0.3)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(236,227,213,0.5)"; e.currentTarget.style.background = "transparent"; }}
        title="Indicators"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {/* ─── Chart Theme Toggle ─── */}
      <button
        onClick={() => onChartThemeChange(chartTheme === "dark" ? "light" : "dark")}
        className="relative px-2.5 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5"
        style={{
          color: chartTheme === "light" ? "#1a1a1a" : "var(--text-muted)",
          background: chartTheme === "light" ? "rgba(236,227,213,0.25)" : "transparent",
        }}
        onMouseEnter={(e) => {
          if (chartTheme !== "light") {
            e.currentTarget.style.color = "var(--text-secondary)";
            e.currentTarget.style.background = "rgba(236,227,213,0.04)";
          }
        }}
        onMouseLeave={(e) => {
          if (chartTheme !== "light") {
            e.currentTarget.style.color = "var(--text-muted)";
            e.currentTarget.style.background = "transparent";
          }
        }}
        title="Toggle chart light/dark mode"
      >
        {chartTheme === "dark" ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        )}
        {chartTheme === "dark" ? "Light" : "Dark"}
      </button>

      {/* Divider */}
      <div
        style={{
          width: 1,
          height: 24,
          background: "rgba(236,227,213,0.1)",
          flexShrink: 0,
        }}
      />

      {/* ─── Inline Trade Widget ─── */}
      <div className="flex items-center" style={{ gap: 0 }}>
        <AnimatePresence mode="popLayout">
          {!tradeExpanded && (
            <motion.button
              key="eye-left"
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15 }}
              onClick={() => setTradeExpanded(true)}
              className="flex items-center gap-1.5"
              style={{
                background: "rgba(236,227,213,0.06)",
                border: "1px solid rgba(236,227,213,0.1)",
                borderRadius: 20,
                padding: "0 12px",
                height: 30,
                cursor: "pointer",
                color: "var(--text-secondary)",
                fontSize: 11,
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(236,227,213,0.1)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(236,227,213,0.06)"; }}
              title="Show trade buttons (Ctrl+A)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              Trade
            </motion.button>
          )}

          {tradeExpanded && (
            <motion.div
              key="trade-row"
              layout
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="flex items-center"
              style={{
                gap: 3,
                overflow: "hidden",
              }}
            >
              {/* SELL */}
              <button
                onClick={() => onSell(currentPrice - spread / 2)}
                style={{
                  background: "linear-gradient(135deg, var(--sell), hsl(0 65% 42%))",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  padding: "0 14px",
                  height: 30,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontVariantNumeric: "tabular-nums",
                  fontFamily: "var(--font-mono)",
                  letterSpacing: "0.02em",
                  whiteSpace: "nowrap",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  lineHeight: 1,
                  minWidth: 72,
                }}
              >
                <span style={{ fontSize: 8, fontWeight: 700, opacity: 0.7, letterSpacing: "0.08em" }}>SELL</span>
                <span style={{ fontSize: 11, marginTop: 1 }}>{formatPrice(currentPrice - spread / 2, symbol)}</span>
              </button>

              {/* Spread */}
              <div style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: "0 4px",
                minWidth: 28,
              }}>
                <span style={{ fontSize: 9, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums", fontFamily: "var(--font-mono)" }}>
                  {spread.toFixed(1)}
                </span>
              </div>

              {/* BUY */}
              <button
                onClick={() => onBuy(currentPrice + spread / 2)}
                style={{
                  background: "linear-gradient(135deg, var(--buy), hsl(163 70% 32%))",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  padding: "0 14px",
                  height: 30,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontVariantNumeric: "tabular-nums",
                  fontFamily: "var(--font-mono)",
                  letterSpacing: "0.02em",
                  whiteSpace: "nowrap",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  lineHeight: 1,
                  minWidth: 72,
                }}
              >
                <span style={{ fontSize: 8, fontWeight: 700, opacity: 0.7, letterSpacing: "0.08em" }}>BUY</span>
                <span style={{ fontSize: 11, marginTop: 1 }}>{formatPrice(currentPrice + spread / 2, symbol)}</span>
              </button>

              {/* Eye toggle (collapse) */}
              <button
                onClick={() => setTradeExpanded(false)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "0 4px",
                  height: 30,
                  display: "flex",
                  alignItems: "center",
                  color: "var(--text-muted)",
                  borderRadius: 6,
                }}
                onMouseEnter={e => { e.currentTarget.style.color = "var(--text-secondary)"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "var(--text-muted)"; }}
                title="Hide trade buttons"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
