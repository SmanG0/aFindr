"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SYMBOL_LIBRARY, SYMBOL_CATEGORIES, type SymbolCategory } from "@/lib/symbols";
import type { AccountState } from "@/lib/types";

interface SymbolsSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSymbol: (symbol: string) => void;
  currentSymbol: string;
  accountState: AccountState;
}

export default function SymbolsSearch({
  isOpen,
  onClose,
  onSelectSymbol,
  currentSymbol,
}: SymbolsSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<SymbolCategory>("all");
  const [showFavorites, setShowFavorites] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("afindr_symbol_favorites");
    if (saved) {
      try { setFavorites(JSON.parse(saved)); } catch { /* ignore */ }
    }
  }, []);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Persist favorites
  useEffect(() => {
    localStorage.setItem("afindr_symbol_favorites", JSON.stringify(favorites));
  }, [favorites]);

  // Focus search input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearchQuery("");
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, onClose]);

  const toggleFavorite = (symbol: string) => {
    setFavorites((prev) =>
      prev.includes(symbol) ? prev.filter((s) => s !== symbol) : [...prev, symbol]
    );
  };

  const filteredSymbols = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return SYMBOL_LIBRARY.filter((entry) => {
      const matchesSearch =
        !query ||
        entry.symbol.toLowerCase().includes(query) ||
        entry.name.toLowerCase().includes(query);
      const matchesCategory = activeTab === "all" || entry.category === activeTab;
      const matchesFavorites = !showFavorites || favorites.includes(entry.symbol);
      return matchesSearch && matchesCategory && matchesFavorites;
    });
  }, [searchQuery, activeTab, showFavorites, favorites]);

  const handleSelect = (symbol: string) => {
    onSelectSymbol(symbol);
    onClose();
  };

  // Category badge colors
  const categoryColor: Record<string, string> = {
    stocks: "rgba(59,130,246,0.15)",
    crypto: "rgba(168,85,247,0.15)",
    futures: "rgba(234,179,8,0.15)",
    etfs: "rgba(34,197,94,0.15)",
    forex: "rgba(236,72,153,0.15)",
    nse: "rgba(251,146,60,0.15)",
  };
  const categoryTextColor: Record<string, string> = {
    stocks: "rgb(96,165,250)",
    crypto: "rgb(192,132,252)",
    futures: "rgb(250,204,21)",
    etfs: "rgb(74,222,128)",
    forex: "rgb(244,114,182)",
    nse: "rgb(251,146,60)",
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            style={{
              width: 640,
              maxHeight: "82vh",
              borderRadius: 18,
              background: "rgba(10, 10, 10, 0.95)",
              border: "0.667px solid rgba(236, 227, 213, 0.15)",
              boxShadow: "var(--shadow-xl)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ─── Search Header ─── */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "14px 16px",
                borderBottom: "0.667px solid rgba(236,227,213,0.1)",
              }}
            >
              <svg
                width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="rgba(236,227,213,0.28)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ flexShrink: 0 }}
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search symbols... (AAPL, BTC, NQ=F)"
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  fontSize: 14,
                  color: "white",
                }}
              />
              <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", flexShrink: 0 }}>
                {filteredSymbols.length} results
              </span>
              <button
                onClick={onClose}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 28, height: 28, borderRadius: 6,
                  background: "transparent", border: "none",
                  color: "var(--text-muted)", cursor: "pointer", flexShrink: 0,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* ─── Category Tabs ─── */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "8px 16px",
                borderBottom: "0.667px solid rgba(236,227,213,0.06)",
                overflowX: "auto",
              }}
            >
              {SYMBOL_CATEGORIES.map((cat) => {
                const isActive = activeTab === cat.id && !showFavorites;
                return (
                  <button
                    key={cat.id}
                    onClick={() => { setActiveTab(cat.id); setShowFavorites(false); }}
                    style={{
                      fontSize: 11, padding: "5px 12px", borderRadius: 6,
                      background: isActive ? "rgba(236,227,213,0.08)" : "transparent",
                      color: isActive ? "white" : "var(--text-muted)",
                      border: "none", cursor: "pointer", fontWeight: 500,
                      whiteSpace: "nowrap", transition: "all 100ms ease",
                    }}
                  >
                    {cat.label}
                  </button>
                );
              })}

              <div style={{ width: 1, height: 16, background: "rgba(236,227,213,0.08)", flexShrink: 0 }} />

              {/* Favorites toggle */}
              <button
                onClick={() => setShowFavorites(!showFavorites)}
                style={{
                  display: "flex", alignItems: "center", gap: 4,
                  fontSize: 11, padding: "5px 12px", borderRadius: 6,
                  background: showFavorites ? "rgba(236,227,213,0.08)" : "transparent",
                  color: showFavorites ? "white" : "var(--text-muted)",
                  border: "none", cursor: "pointer", fontWeight: 500,
                }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill={showFavorites ? "#f59e0b" : "none"} stroke={showFavorites ? "#f59e0b" : "currentColor"} strokeWidth="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                Favorites
              </button>
            </div>

            {/* ─── Symbol List ─── */}
            <div style={{ overflowY: "auto", maxHeight: 440 }}>
              {filteredSymbols.length === 0 ? (
                <div style={{ padding: "40px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                  {showFavorites ? "No favorite symbols yet" : "No symbols match your search"}
                </div>
              ) : (
                filteredSymbols.map((entry) => {
                  const isCurrent = entry.symbol === currentSymbol;
                  const isFav = favorites.includes(entry.symbol);

                  return (
                    <div
                      key={entry.symbol}
                      style={{
                        display: "flex", alignItems: "center",
                        padding: "8px 16px", gap: 10,
                        borderLeft: isCurrent ? "2px solid var(--accent)" : "2px solid transparent",
                        background: isCurrent ? "rgba(236,227,213,0.04)" : "transparent",
                        cursor: "pointer", transition: "background 80ms ease",
                      }}
                      onClick={() => handleSelect(entry.symbol)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = isCurrent ? "rgba(236,227,213,0.05)" : "rgba(236,227,213,0.03)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = isCurrent ? "rgba(236,227,213,0.04)" : "transparent";
                      }}
                    >
                      {/* Favorite star */}
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleFavorite(entry.symbol); }}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "center",
                          background: "transparent", border: "none", cursor: "pointer", padding: 2, flexShrink: 0,
                        }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill={isFav ? "#f59e0b" : "none"} stroke={isFav ? "#f59e0b" : "rgba(236,227,213,0.2)"} strokeWidth="2" style={{ transition: "all 150ms ease" }}>
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                      </button>

                      {/* Symbol */}
                      <span style={{ fontWeight: 600, fontSize: 13, color: "white", minWidth: 80, fontFamily: "var(--font-mono)" }}>
                        {entry.symbol}
                      </span>

                      {/* Description */}
                      <span style={{ fontSize: 12, color: "var(--text-muted)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {entry.name}
                      </span>

                      {/* Category badge */}
                      <span style={{
                        fontSize: 9, fontWeight: 600, fontFamily: "var(--font-mono)",
                        padding: "2px 8px", borderRadius: 100, textTransform: "uppercase",
                        background: categoryColor[entry.category] || "rgba(236,227,213,0.08)",
                        color: categoryTextColor[entry.category] || "var(--text-muted)",
                        flexShrink: 0,
                      }}>
                        {entry.category}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
