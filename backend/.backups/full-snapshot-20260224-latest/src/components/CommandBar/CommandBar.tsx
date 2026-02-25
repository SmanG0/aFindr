"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CONTRACTS } from "@/lib/types";

interface CommandBarProps {
  onSubmit: (message: string) => void;
  symbol: string;
  onSymbolChange: (symbol: string) => void;
  interval: string;
  onIntervalChange: (interval: string) => void;
  isLoading: boolean;
  tickMode?: boolean;
  onTickModeChange?: (enabled: boolean) => void;
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

export default function CommandBar({
  onSubmit,
  symbol,
  onSymbolChange,
  interval,
  onIntervalChange,
  isLoading,
  tickMode,
  onTickModeChange,
}: CommandBarProps) {
  const [input, setInput] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [showSymbolMenu, setShowSymbolMenu] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const symbolRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSubmit(input.trim());
    setInput("");
  };

  const currentContract = CONTRACTS[symbol];

  return (
    <div className="flex items-center h-11 px-3 gap-3" style={{ background: "var(--bg-raised)", borderBottom: "1px solid var(--divider)" }}>
      {/* ─── Symbol Selector ─── */}
      <div ref={symbolRef} className="relative">
        <button
          onClick={() => setShowSymbolMenu(!showSymbolMenu)}
          className="flex items-center gap-2 px-2 py-1 rounded-lg transition-all"
          style={{
            color: "var(--text-primary)",
            background: showSymbolMenu ? "rgba(236,227,213,0.06)" : "transparent",
          }}
          onMouseEnter={(e) => { if (!showSymbolMenu) e.currentTarget.style.background = "rgba(236,227,213,0.04)"; }}
          onMouseLeave={(e) => { if (!showSymbolMenu) e.currentTarget.style.background = showSymbolMenu ? "rgba(236,227,213,0.06)" : "transparent"; }}
        >
          <span className="text-sm font-semibold tracking-tight">{currentContract?.name || symbol}</span>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" style={{ opacity: 0.4 }}>
            <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
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
                  onClick={() => { onSymbolChange(c.symbol); setShowSymbolMenu(false); }}
                  className="flex items-center justify-between w-full px-3 py-2.5 text-left transition-colors"
                  style={{
                    background: c.symbol === symbol ? "var(--accent-muted)" : "transparent",
                    color: c.symbol === symbol ? "var(--accent-bright)" : "var(--text-secondary)",
                  }}
                  onMouseEnter={(e) => { if (c.symbol !== symbol) e.currentTarget.style.background = "rgba(236,227,213,0.04)"; }}
                  onMouseLeave={(e) => { if (c.symbol !== symbol) e.currentTarget.style.background = "transparent"; }}
                >
                  <div>
                    <div className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{c.symbol}</div>
                    <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>{c.name}</div>
                  </div>
                  <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>${c.pointValue}/pt</span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Divider */}
      <div className="w-px h-5" style={{ background: "var(--divider)" }} />

      {/* ─── Interval Selector (TradingView pill-style) ─── */}
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
                background: isActive ? "rgba(236,227,213,0.08)" : "transparent",
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

      {/* Tick Mode Toggle */}
      {onTickModeChange && (
        <>
          <div className="w-px h-5" style={{ background: "var(--divider)" }} />
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
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            Tick
          </button>
        </>
      )}

      {/* Divider */}
      <div className="w-px h-5" style={{ background: "var(--divider)" }} />

      {/* ─── Toolbar Icons ─── */}
      <div className="flex items-center gap-0.5">
        <button className="toolbar-btn" title="Crosshair">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="2" x2="12" y2="6" />
            <line x1="12" y1="18" x2="12" y2="22" />
            <line x1="2" y1="12" x2="6" y2="12" />
            <line x1="18" y1="12" x2="22" y2="12" />
          </svg>
        </button>
        <button className="toolbar-btn" title="Trend Line">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="4" y1="20" x2="20" y2="4" />
          </svg>
        </button>
        <button className="toolbar-btn" title="Fibonacci">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="2" y1="6" x2="22" y2="6" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <line x1="2" y1="18" x2="22" y2="18" />
          </svg>
        </button>
      </div>

      {/* ─── Spacer ─── */}
      <div className="flex-1" />

      {/* ─── AI Command Input ─── */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <motion.div
          animate={{
            boxShadow: isFocused
              ? "0 0 0 2px rgba(196,123,58,0.2)"
              : "0 0 0 0px rgba(99,102,241,0)",
          }}
          transition={{ duration: 0.15 }}
          className="rounded-lg overflow-hidden"
        >
          <div className="flex items-center gap-2 px-3" style={{ background: "rgba(236,227,213,0.04)", border: "1px solid", borderColor: isFocused ? "rgba(196,123,58,0.3)" : "rgba(236,227,213,0.06)", borderRadius: "8px", height: 32 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ color: isFocused ? "var(--accent-bright)" : "var(--text-muted)", flexShrink: 0 }}>
              <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" fill="currentColor" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Describe a strategy... (⌘K)"
              disabled={isLoading}
              className="w-56 text-xs outline-none"
              style={{ color: "var(--text-primary)", background: "transparent", border: "none" }}
            />
            <AnimatePresence>
              {isLoading && (
                <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }}>
                  <div className="w-3 h-3 border-[1.5px] border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
        <motion.button
          type="submit"
          disabled={isLoading || !input.trim()}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all"
          style={{
            background: isLoading || !input.trim() ? "rgba(99,102,241,0.15)" : "var(--accent)",
            color: isLoading || !input.trim() ? "var(--text-muted)" : "var(--text-primary)",
            boxShadow: isLoading || !input.trim() ? "none" : "0 0 12px rgba(99,102,241,0.25)",
          }}
        >
          Run
        </motion.button>
      </form>
    </div>
  );
}
