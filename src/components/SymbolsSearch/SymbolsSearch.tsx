"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CONTRACTS, type AccountState } from "@/lib/types";

interface SymbolsSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSymbol: (symbol: string) => void;
  currentSymbol: string;
  accountState: AccountState;
}

type CategoryTab = "all" | "futures";

export default function SymbolsSearch({
  isOpen,
  onClose,
  onSelectSymbol,
  currentSymbol,
}: SymbolsSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<CategoryTab>("all");
  const [showFavorites, setShowFavorites] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

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
      prev.includes(symbol)
        ? prev.filter((s) => s !== symbol)
        : [...prev, symbol]
    );
  };

  const allSymbols = Object.values(CONTRACTS);

  const filteredSymbols = allSymbols.filter((contract) => {
    // Search filter
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      !query ||
      contract.symbol.toLowerCase().includes(query) ||
      contract.name.toLowerCase().includes(query);

    // Favorites filter
    const matchesFavorites = !showFavorites || favorites.includes(contract.symbol);

    // Tab filter (all contracts are futures for now, so "all" and "futures" show the same)
    return matchesSearch && matchesFavorites;
  });

  const handleSelect = (symbol: string) => {
    onSelectSymbol(symbol);
    onClose();
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
              width: 600,
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
              {/* Magnifying glass icon */}
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="rgba(236,227,213,0.28)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
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
                placeholder="Search symbols..."
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  fontSize: 14,
                  color: "white",
                }}
              />
              {/* Close button */}
              <button
                onClick={onClose}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  background: "transparent",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  transition: "all 100ms ease",
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(236,227,213,0.06)";
                  e.currentTarget.style.color = "var(--text-primary)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--text-muted)";
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
                gap: 6,
                padding: "10px 16px",
                borderBottom: "0.667px solid rgba(236,227,213,0.06)",
              }}
            >
              {(["all", "futures"] as const).map((tab) => {
                const isActive = activeTab === tab && !showFavorites;
                return (
                  <button
                    key={tab}
                    onClick={() => {
                      setActiveTab(tab);
                      setShowFavorites(false);
                    }}
                    style={{
                      fontSize: 12,
                      padding: "6px 12px",
                      borderRadius: 6,
                      background: isActive ? "rgba(236,227,213,0.08)" : "transparent",
                      color: isActive ? "white" : "var(--text-muted)",
                      border: "none",
                      cursor: "pointer",
                      fontWeight: 500,
                      transition: "all 100ms ease",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = "rgba(236,227,213,0.04)";
                        e.currentTarget.style.color = "var(--text-secondary)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "var(--text-muted)";
                      }
                    }}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                );
              })}

              {/* Favorites toggle */}
              <button
                onClick={() => setShowFavorites(!showFavorites)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 12,
                  padding: "6px 12px",
                  borderRadius: 6,
                  background: showFavorites ? "rgba(236,227,213,0.08)" : "transparent",
                  color: showFavorites ? "white" : "var(--text-muted)",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 500,
                  transition: "all 100ms ease",
                }}
                onMouseEnter={(e) => {
                  if (!showFavorites) {
                    e.currentTarget.style.background = "rgba(236,227,213,0.04)";
                    e.currentTarget.style.color = "var(--text-secondary)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!showFavorites) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "var(--text-muted)";
                  }
                }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill={showFavorites ? "#f59e0b" : "none"}
                  stroke={showFavorites ? "#f59e0b" : "currentColor"}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                Favorites
              </button>
            </div>

            {/* ─── Symbol List ─── */}
            <div
              style={{
                overflowY: "auto",
                maxHeight: 400,
              }}
            >
              {filteredSymbols.length === 0 ? (
                <div
                  style={{
                    padding: "40px 16px",
                    textAlign: "center",
                    color: "var(--text-muted)",
                    fontSize: 13,
                  }}
                >
                  {showFavorites
                    ? "No favorite symbols yet"
                    : "No symbols match your search"}
                </div>
              ) : (
                filteredSymbols.map((contract) => {
                  const isCurrent = contract.symbol === currentSymbol;
                  const isFav = favorites.includes(contract.symbol);

                  return (
                    <div
                      key={contract.symbol}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        padding: "10px 16px",
                        gap: 12,
                        transition: "background 100ms ease",
                        borderLeft: isCurrent
                          ? "2px solid var(--accent)"
                          : "2px solid transparent",
                        background: isCurrent
                          ? "rgba(236,227,213,0.04)"
                          : "transparent",
                        cursor: "default",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = isCurrent
                          ? "rgba(236,227,213,0.05)"
                          : "rgba(236,227,213,0.04)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = isCurrent
                          ? "rgba(236,227,213,0.04)"
                          : "transparent";
                      }}
                    >
                      {/* Favorite star */}
                      <button
                        onClick={() => toggleFavorite(contract.symbol)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          padding: 2,
                          flexShrink: 0,
                        }}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill={isFav ? "#f59e0b" : "none"}
                          stroke={isFav ? "#f59e0b" : "rgba(236,227,213,0.2)"}
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{
                            transition: "all 150ms ease",
                          }}
                        >
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                      </button>

                      {/* Symbol */}
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: 13,
                          color: "white",
                          minWidth: 60,
                        }}
                      >
                        {contract.symbol}
                      </span>

                      {/* Description */}
                      <span
                        style={{
                          fontSize: 12,
                          color: "var(--text-muted)",
                        }}
                      >
                        {contract.name}
                      </span>

                      {/* Spacer */}
                      <div style={{ flex: 1 }} />

                      {/* Point value */}
                      <span
                        style={{
                          fontSize: 12,
                          color: "var(--text-muted)",
                          fontFamily: "var(--font-mono)",
                          marginRight: 12,
                        }}
                      >
                        ${contract.pointValue}/pt
                      </span>

                      {/* Launch Chart button */}
                      <button
                        onClick={() => handleSelect(contract.symbol)}
                        style={{
                          fontSize: 12,
                          color: "var(--link)",
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          padding: "4px 0",
                          fontWeight: 500,
                          whiteSpace: "nowrap",
                          transition: "all 100ms ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.textDecoration = "underline";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.textDecoration = "none";
                        }}
                      >
                        Launch Chart
                      </button>
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
