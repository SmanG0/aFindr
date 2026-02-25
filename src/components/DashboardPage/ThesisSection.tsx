"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types (mirrors StockDetailView's StockThesis) ───

interface StockThesis {
  ticker: string;
  sentiment: "bullish" | "bearish" | "neutral";
  thesis: string;
  targetPrice?: number;
  timeframe?: string;
  catalysts: string[];
  risks: string[];
  createdAt: number;
  updatedAt: number;
}

interface ThesisSectionProps {
  onNavigateToChart?: (ticker: string) => void;
  onSelectTicker?: (ticker: string) => void;
}

// ─── Constants ───

const EASE_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

const SENTIMENT_CONFIG = {
  bullish: { color: "var(--buy)", bg: "var(--buy-muted)", border: "rgba(34,171,148,0.25)" },
  bearish: { color: "var(--sell)", bg: "var(--sell-muted)", border: "rgba(229,77,77,0.25)" },
  neutral: { color: "var(--warning)", bg: "var(--warning-muted)", border: "rgba(212,145,90,0.25)" },
} as const;

// ─── Helpers ───

/** Scan localStorage for all per-ticker theses */
export function loadAllTheses(): StockThesis[] {
  const theses: StockThesis[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("afindr_thesis_")) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.ticker && parsed.thesis) {
            theses.push(parsed);
          }
        }
      }
    }
  } catch { /* ignore */ }
  // Most recently updated first
  return theses.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

/** Extract unique tickers from all theses (for watchlist prioritization) */
export function getThesisTickers(): string[] {
  return loadAllTheses().map((t) => t.ticker);
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Component ───

export function ThesisSection({ onNavigateToChart, onSelectTicker }: ThesisSectionProps) {
  const [theses, setTheses] = useState<StockThesis[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    setTheses(loadAllTheses());
  }, []);

  // Group by sentiment for the summary bar
  const summary = useMemo(() => {
    const bullish = theses.filter((t) => t.sentiment === "bullish").length;
    const bearish = theses.filter((t) => t.sentiment === "bearish").length;
    const neutral = theses.filter((t) => t.sentiment === "neutral").length;
    return { bullish, bearish, neutral, total: theses.length };
  }, [theses]);

  if (theses.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: EASE_EXPO, delay: 0.22 }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <SectionLabel style={{ marginBottom: 0 }}>MY THESES</SectionLabel>

        {/* Sentiment summary pills */}
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {summary.bullish > 0 && (
            <span style={{
              fontSize: 9, fontFamily: "var(--font-mono)", fontWeight: 700,
              color: "var(--buy)", background: "var(--buy-muted)",
              padding: "2px 8px", borderRadius: 8,
            }}>
              {summary.bullish} Bullish
            </span>
          )}
          {summary.bearish > 0 && (
            <span style={{
              fontSize: 9, fontFamily: "var(--font-mono)", fontWeight: 700,
              color: "var(--sell)", background: "var(--sell-muted)",
              padding: "2px 8px", borderRadius: 8,
            }}>
              {summary.bearish} Bearish
            </span>
          )}
          {summary.neutral > 0 && (
            <span style={{
              fontSize: 9, fontFamily: "var(--font-mono)", fontWeight: 700,
              color: "var(--warning)", background: "var(--warning-muted)",
              padding: "2px 8px", borderRadius: 8,
            }}>
              {summary.neutral} Neutral
            </span>
          )}
        </div>
      </div>

      {/* Thesis Cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {theses.map((t, i) => {
          const cfg = SENTIMENT_CONFIG[t.sentiment];
          const isExpanded = expanded === t.ticker;

          return (
            <motion.div
              key={t.ticker}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.35, ease: EASE_EXPO, delay: i * 0.03 }}
              className="thesis-card"
              style={{
                borderRadius: 12,
                background: "var(--bg-raised)",
                border: `1px solid ${isExpanded ? cfg.border : "rgba(236,227,213,0.06)"}`,
                borderLeft: `3px solid ${cfg.color}`,
                overflow: "hidden",
                transition: "border-color 200ms ease",
              }}
            >
              {/* Collapsed row — always visible */}
              <div
                onClick={() => setExpanded(isExpanded ? null : t.ticker)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 14px",
                  cursor: "pointer",
                }}
              >
                {/* Ticker */}
                <span
                  onClick={(e) => { e.stopPropagation(); (onSelectTicker || onNavigateToChart)?.(t.ticker); }}
                  style={{
                    fontSize: 13,
                    fontFamily: "var(--font-mono)",
                    fontWeight: 700,
                    color: "var(--accent)",
                    cursor: "pointer",
                    minWidth: 52,
                    transition: "opacity 120ms ease",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.7"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
                >
                  {t.ticker}
                </span>

                {/* Sentiment badge */}
                <span style={{
                  fontSize: 9,
                  fontFamily: "var(--font-mono)",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: cfg.color,
                  background: cfg.bg,
                  padding: "2px 8px",
                  borderRadius: 6,
                  flexShrink: 0,
                }}>
                  {t.sentiment}
                </span>

                {/* Thesis preview */}
                <span style={{
                  flex: 1,
                  fontSize: 11,
                  color: "var(--text-secondary)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  minWidth: 0,
                }}>
                  {t.thesis}
                </span>

                {/* Target price (if set) */}
                {t.targetPrice && (
                  <span style={{
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                    fontWeight: 600,
                    color: "var(--accent-bright)",
                    flexShrink: 0,
                  }}>
                    ${t.targetPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                )}

                {/* Timestamp */}
                <span style={{
                  fontSize: 9,
                  fontFamily: "var(--font-mono)",
                  color: "var(--text-muted)",
                  flexShrink: 0,
                  fontVariantNumeric: "tabular-nums",
                }}>
                  {relativeTime(t.updatedAt)}
                </span>

                {/* Expand chevron */}
                <svg
                  width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"
                  style={{
                    flexShrink: 0,
                    transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 200ms ease",
                  }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>

              {/* Expanded detail */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: EASE_EXPO }}
                    style={{ overflow: "hidden" }}
                  >
                    <div style={{
                      padding: "0 14px 14px",
                      borderTop: "1px solid rgba(236,227,213,0.04)",
                    }}>
                      {/* Full thesis text */}
                      <p style={{
                        fontSize: 12,
                        color: "var(--text-secondary)",
                        lineHeight: 1.65,
                        margin: "12px 0",
                        whiteSpace: "pre-wrap",
                      }}>
                        {t.thesis}
                      </p>

                      {/* Target + Timeframe row */}
                      {(t.targetPrice || t.timeframe) && (
                        <div style={{ display: "flex", gap: 24, marginBottom: 12 }}>
                          {t.targetPrice && (
                            <div>
                              <div style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontWeight: 600, marginBottom: 2 }}>TARGET</div>
                              <div style={{ fontSize: 15, fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--accent-bright)" }}>
                                ${t.targetPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                            </div>
                          )}
                          {t.timeframe && (
                            <div>
                              <div style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontWeight: 600, marginBottom: 2 }}>TIMEFRAME</div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{t.timeframe}</div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Catalysts */}
                      {t.catalysts.length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontWeight: 600, marginBottom: 5 }}>CATALYSTS</div>
                          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                            {t.catalysts.map((c, ci) => (
                              <span key={ci} style={{
                                fontSize: 10, padding: "2px 8px", borderRadius: 6,
                                background: "rgba(34,171,148,0.08)", color: "var(--buy)",
                                fontWeight: 500,
                              }}>
                                {c}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Risks */}
                      {t.risks.length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontWeight: 600, marginBottom: 5 }}>RISKS</div>
                          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                            {t.risks.map((r, ri) => (
                              <span key={ri} style={{
                                fontSize: 10, padding: "2px 8px", borderRadius: 6,
                                background: "rgba(229,77,77,0.08)", color: "var(--sell)",
                                fontWeight: 500,
                              }}>
                                {r}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Action row */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                        <button
                          onClick={() => (onSelectTicker || onNavigateToChart)?.(t.ticker)}
                          className="dashboard-pill-btn"
                          style={{
                            fontSize: 10,
                            fontFamily: "var(--font-mono)",
                            fontWeight: 600,
                            color: "var(--accent)",
                            background: "var(--accent-muted)",
                            border: "none",
                            padding: "4px 12px",
                            borderRadius: 16,
                            cursor: "pointer",
                          }}
                        >
                          View {t.ticker}
                        </button>
                        <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                          Updated {new Date(t.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      <style>{`
        .thesis-card {
          transition: transform 150ms cubic-bezier(0.16,1,0.3,1), box-shadow 150ms ease;
        }
        .thesis-card:hover {
          box-shadow: 0 2px 12px rgba(15,12,8,0.2);
        }
      `}</style>
    </motion.div>
  );
}

// ─── Sub-components ───

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
