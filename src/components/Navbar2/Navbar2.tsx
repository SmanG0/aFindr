"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CONTRACTS, AccountState } from "@/lib/types";

interface Navbar2Props {
  symbol: string;
  onSymbolChange: (symbol: string) => void;
  interval: string;
  onIntervalChange: (interval: string) => void;
  tickMode: boolean;
  onTickModeChange: (enabled: boolean) => void;
  chartTheme: "dark" | "light";
  onChartThemeChange: (theme: "dark" | "light") => void;
  accountState: AccountState;
  onOpenTrade: () => void;
}

const INTERVALS = [
  { value: "1m", label: "1m" },
  { value: "3m", label: "3m" },
  { value: "5m", label: "5m" },
  { value: "15m", label: "15" },
  { value: "30m", label: "30" },
  { value: "1h", label: "1H" },
  { value: "4h", label: "4H" },
  { value: "1d", label: "D" },
  { value: "1wk", label: "W" },
];

function formatUSD(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function Navbar2({
  symbol,
  onSymbolChange,
  interval,
  onIntervalChange,
  tickMode,
  onTickModeChange,
  chartTheme,
  onChartThemeChange,
  accountState,
  onOpenTrade,
}: Navbar2Props) {
  const [showSymbolMenu, setShowSymbolMenu] = useState(false);
  const symbolRef = useRef<HTMLDivElement>(null);

  // Close symbol menu on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (symbolRef.current && !symbolRef.current.contains(e.target as Node)) {
        setShowSymbolMenu(false);
      }
    };
    if (showSymbolMenu) {
      window.addEventListener("click", handleClick);
      return () => window.removeEventListener("click", handleClick);
    }
  }, [showSymbolMenu]);

  const currentContract = CONTRACTS[symbol];

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
      <div ref={symbolRef} className="relative">
        <button
          onClick={() => setShowSymbolMenu(!showSymbolMenu)}
          className="flex items-center gap-2 px-2 py-1 rounded-lg transition-all"
          style={{
            color: "var(--text-primary)",
            background: showSymbolMenu
              ? "rgba(236,227,213,0.06)"
              : "transparent",
          }}
          onMouseEnter={(e) => {
            if (!showSymbolMenu)
              e.currentTarget.style.background = "rgba(236,227,213,0.04)";
          }}
          onMouseLeave={(e) => {
            if (!showSymbolMenu)
              e.currentTarget.style.background = "transparent";
          }}
        >
          <span className="text-sm font-semibold tracking-tight">
            {currentContract?.name || symbol}
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

        {/* Symbol dropdown */}
        <AnimatePresence>
          {showSymbolMenu && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.12 }}
              className="absolute top-full left-0 mt-1 z-50 glass-elevated overflow-hidden"
              style={{ borderRadius: "var(--radius-md)", minWidth: 220 }}
            >
              {Object.values(CONTRACTS).map((c) => (
                <button
                  key={c.symbol}
                  onClick={() => {
                    onSymbolChange(c.symbol);
                    setShowSymbolMenu(false);
                  }}
                  className="flex items-center justify-between w-full px-3 py-2.5 text-left transition-colors"
                  style={{
                    background:
                      c.symbol === symbol
                        ? "var(--accent-muted)"
                        : "transparent",
                    color:
                      c.symbol === symbol
                        ? "var(--accent-bright)"
                        : "var(--text-secondary)",
                  }}
                  onMouseEnter={(e) => {
                    if (c.symbol !== symbol)
                      e.currentTarget.style.background =
                        "rgba(236,227,213,0.04)";
                  }}
                  onMouseLeave={(e) => {
                    if (c.symbol !== symbol)
                      e.currentTarget.style.background = "transparent";
                  }}
                >
                  <div>
                    <div
                      className="text-xs font-semibold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {c.symbol}
                    </div>
                    <div
                      className="text-[10px]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {c.name}
                    </div>
                  </div>
                  <span
                    className="text-[10px] font-mono"
                    style={{ color: "var(--text-muted)" }}
                  >
                    ${c.pointValue}/pt
                  </span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ─── Account Metrics (center) ─── */}
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

      {/* Divider */}
      <div
        style={{
          width: 1,
          height: 24,
          background: "rgba(236,227,213,0.1)",
          flexShrink: 0,
        }}
      />

      {/* ─── Interval Selector Pills ─── */}
      <div className="flex items-center gap-0.5">
        {INTERVALS.map((i) => {
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
      </div>

      {/* ─── Tick Mode Toggle ─── */}
      <button
        onClick={() => onTickModeChange(!tickMode)}
        className="relative px-2.5 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5"
        style={{
          color: tickMode ? "var(--text-primary)" : "var(--text-muted)",
          background: tickMode ? "var(--accent)" : "transparent",
          boxShadow: tickMode ? "0 0 10px rgba(196,123,58,0.3)" : "none",
        }}
        onMouseEnter={(e) => {
          if (!tickMode) {
            e.currentTarget.style.color = "var(--text-secondary)";
            e.currentTarget.style.background = "rgba(236,227,213,0.04)";
          }
        }}
        onMouseLeave={(e) => {
          if (!tickMode) {
            e.currentTarget.style.color = "var(--text-muted)";
            e.currentTarget.style.background = "transparent";
          }
        }}
        title="Tick-by-tick replay mode"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
        Tick
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

      {/* ─── Trade Button ─── */}
      <button
        onClick={onOpenTrade}
        className="flex items-center gap-1.5 text-xs font-semibold transition-all"
        style={{
          background: "var(--buy)",
          color: "white",
          borderRadius: 30,
          padding: "0 18px",
          height: 30,
          border: "none",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.filter = "brightness(1.1)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.filter = "brightness(1)";
        }}
      >
        Trade
        <span
          style={{
            opacity: 0.6,
            fontSize: 10,
            fontWeight: 400,
          }}
        >
          (Ctrl+A)
        </span>
      </button>
    </div>
  );
}
