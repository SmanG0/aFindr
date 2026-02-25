"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BOOKS,
  QUOTES,
  AUTHOR_PROFILES,
  APPROACH_TAG_COLORS,
  getBookCoverUrl,
  authorAccentColor,
  getAuthorHeadshotUrl,
} from "@/lib/dashboard-content";
import type { TradingBook, TradingQuote, QuoteCategory } from "@/lib/dashboard-content";

// ─── Constants ───

const EASE_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

type Tab = "books" | "quotes";
type DetailTab = "backstory" | "methodology" | "quotes";
type BookCategory = TradingBook["category"] | "all";

const CATEGORY_LABELS: Record<BookCategory, string> = {
  all: "All",
  psychology: "Psychology",
  technical: "Technical",
  fundamentals: "Fundamentals",
  risk: "Risk",
  philosophy: "Philosophy",
};

const QUOTE_CATEGORY_LABELS: Record<QuoteCategory, string> = {
  mindset: "Mindset",
  risk: "Risk & Caution",
  strategy: "Strategy",
  philosophy: "Philosophy",
  discipline: "Discipline",
  wisdom: "Wisdom",
};

const QUOTE_CATEGORY_COLORS: Record<QuoteCategory, string> = {
  mindset: "#c47b3a",
  risk: "#e54d4d",
  strategy: "#22ab94",
  philosophy: "#7c6bbf",
  discipline: "#3a8fc4",
  wisdom: "#b8952a",
};

interface LibraryPageProps {
  onBack: () => void;
}

// ─── Component ───

export default function LibraryPage({ onBack }: LibraryPageProps) {
  const [tab, setTab] = useState<Tab>("quotes");
  const [bookCategory, setBookCategory] = useState<BookCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAuthor, setSelectedAuthor] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("backstory");

  // ─── Books ───
  const filteredBooks = useMemo(() => {
    let pool = BOOKS;
    if (bookCategory !== "all") pool = pool.filter((b) => b.category === bookCategory);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      pool = pool.filter((b) =>
        b.title.toLowerCase().includes(q)
        || b.author.toLowerCase().includes(q)
        || b.tagline.toLowerCase().includes(q)
      );
    }
    return pool;
  }, [bookCategory, searchQuery]);

  // ─── Quotes ───
  const filteredQuotes = useMemo(() => {
    if (!searchQuery) return QUOTES;
    const q = searchQuery.toLowerCase();
    return QUOTES.filter((qt) =>
      qt.text.toLowerCase().includes(q) || qt.author.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  // Unique authors for quote grouping
  const quotesByAuthor = useMemo(() => {
    const map: Record<string, TradingQuote[]> = {};
    for (const qt of filteredQuotes) {
      if (!map[qt.author]) map[qt.author] = [];
      map[qt.author].push(qt);
    }
    return Object.entries(map).sort((a, b) => {
      const aHasPhoto = getAuthorHeadshotUrl(a[0]) ? 1 : 0;
      const bHasPhoto = getAuthorHeadshotUrl(b[0]) ? 1 : 0;
      if (bHasPhoto !== aHasPhoto) return bHasPhoto - aHasPhoto;
      return b[1].length - a[1].length;
    });
  }, [filteredQuotes]);

  // Selected author's quotes grouped by category
  const selectedAuthorQuotesByCategory = useMemo(() => {
    if (!selectedAuthor) return [];
    const authorQuotes = filteredQuotes.filter((q) => q.author === selectedAuthor);
    const map: Record<string, TradingQuote[]> = {};
    for (const qt of authorQuotes) {
      if (!map[qt.category]) map[qt.category] = [];
      map[qt.category].push(qt);
    }
    return Object.entries(map) as [QuoteCategory, TradingQuote[]][];
  }, [selectedAuthor, filteredQuotes]);

  return (
    <div className="flex-1 overflow-auto" style={{ background: "var(--bg)" }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "20px 24px 48px" }}>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE_EXPO }}
          style={{ marginBottom: 24 }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            {!selectedAuthor && (
              <button
                onClick={onBack}
                style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: "var(--glass)", border: "1px solid var(--glass-border)",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, transition: "background 120ms ease",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--glass-hover)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "var(--glass)"; }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
            )}
            <div>
              <h1 style={{
                fontSize: 20, fontWeight: 700,
                background: "linear-gradient(135deg, var(--accent-bright), var(--accent))",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
                lineHeight: 1.2,
              }}>
                Wisdom Library
              </h1>
              <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)", marginTop: 2 }}>
                {BOOKS.length} books, {QUOTES.length} quotes
              </div>
            </div>
          </div>

          {/* Tabs + Search */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Tab toggle */}
            <div style={{
              display: "flex", background: "var(--glass)", border: "1px solid var(--glass-border)",
              borderRadius: 10, overflow: "hidden", flexShrink: 0,
            }}>
              {(["quotes", "books"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  style={{
                    fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 600,
                    padding: "6px 16px", border: "none", cursor: "pointer",
                    color: tab === t ? "var(--accent-bright)" : "var(--text-muted)",
                    background: tab === t ? "var(--accent-muted)" : "transparent",
                    transition: "all 150ms ease",
                    textTransform: "capitalize",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Search */}
            <div style={{
              flex: 1, display: "flex", alignItems: "center", gap: 8,
              background: "var(--glass)", border: "1px solid var(--glass-border)",
              borderRadius: 10, padding: "6px 12px",
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={tab === "books" ? "Search books or authors..." : "Search quotes or authors..."}
                style={{
                  flex: 1, background: "transparent", border: "none", outline: "none",
                  color: "var(--text-primary)", fontSize: 11, fontFamily: "var(--font-mono)",
                }}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 1 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>

            {/* Category filter (books only) */}
            {tab === "books" && (
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                {(Object.entries(CATEGORY_LABELS) as [BookCategory, string][]).map(([cat, label]) => (
                  <button
                    key={cat}
                    onClick={() => setBookCategory(cat)}
                    style={{
                      fontSize: 9, fontFamily: "var(--font-mono)", fontWeight: 600,
                      color: bookCategory === cat ? "var(--accent)" : "var(--text-muted)",
                      background: bookCategory === cat ? "var(--accent-muted)" : "transparent",
                      border: `1px solid ${bookCategory === cat ? "rgba(196,123,58,0.3)" : "rgba(236,227,213,0.06)"}`,
                      borderRadius: 12, padding: "3px 10px", cursor: "pointer",
                      transition: "all 120ms ease",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {tab === "quotes" ? (
            <AnimatePresence mode="wait">
              {selectedAuthor ? (
                /* ─── Author Detail View (Tabbed) ─── */
                <motion.div
                  key={`author-${selectedAuthor}`}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3, ease: EASE_EXPO }}
                >
                  {/* Author header */}
                  <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                    <button
                      onClick={() => { setSelectedAuthor(null); setDetailTab("backstory"); }}
                      style={{
                        width: 28, height: 28, borderRadius: 8,
                        background: "var(--glass)", border: "1px solid var(--glass-border)",
                        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0, transition: "background 120ms ease",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--glass-hover)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "var(--glass)"; }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                      </svg>
                    </button>
                    <AuthorBubble author={selectedAuthor} size={52} />
                    <div>
                      <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.2 }}>
                        {selectedAuthor}
                      </div>
                      {(() => {
                        const profile = AUTHOR_PROFILES[selectedAuthor];
                        return profile ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                            <span style={{
                              fontSize: 9, fontFamily: "var(--font-mono)", fontWeight: 600,
                              color: APPROACH_TAG_COLORS[profile.approachTag],
                              background: `${APPROACH_TAG_COLORS[profile.approachTag]}18`,
                              padding: "2px 8px", borderRadius: 10, textTransform: "uppercase",
                              letterSpacing: "0.06em",
                            }}>
                              {profile.approachTag}
                            </span>
                            <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                              {profile.era}
                            </span>
                          </div>
                        ) : (
                          <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-muted)", marginTop: 2 }}>
                            {filteredQuotes.filter((q) => q.author === selectedAuthor).length} quotes
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Detail tabs */}
                  <div style={{
                    display: "flex", gap: 0, marginBottom: 20,
                    borderBottom: "1px solid rgba(236,227,213,0.08)",
                  }}>
                    {(["backstory", "methodology", "quotes"] as DetailTab[]).map((t) => (
                      <button
                        key={t}
                        onClick={() => setDetailTab(t)}
                        style={{
                          fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 600,
                          padding: "8px 18px", borderTop: "none", borderRight: "none", borderLeft: "none", cursor: "pointer",
                          color: detailTab === t ? "var(--accent-bright)" : "var(--text-muted)",
                          background: "transparent",
                          borderBottom: detailTab === t ? "2px solid var(--accent-bright)" : "2px solid transparent",
                          transition: "all 150ms ease",
                          textTransform: "capitalize",
                          display: "flex", alignItems: "center", gap: 6,
                        }}
                      >
                        {t}
                        {t === "methodology" && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#d4af37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Tab content */}
                  <AnimatePresence mode="wait">
                    {detailTab === "backstory" && (
                      <motion.div
                        key="backstory"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.25, ease: EASE_EXPO }}
                      >
                        {(() => {
                          const profile = AUTHOR_PROFILES[selectedAuthor];
                          if (!profile) return (
                            <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "20px 0" }}>
                              No profile data available for this author.
                            </div>
                          );
                          const accent = APPROACH_TAG_COLORS[profile.approachTag];
                          return (
                            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                              {/* Stats strip */}
                              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                                <StatPill label="Peak Returns" value={profile.peakReturns} />
                                {profile.netWorth && <StatPill label="Net Worth" value={profile.netWorth} />}
                                <StatPill label="Era" value={profile.era} />
                                <StatPill label="Style" value={profile.approach} />
                              </div>

                              {/* Market Era Timeline */}
                              <SectionCard title="Market Era" icon={SectionIcons.chart(accent)} accentColor={accent}>
                                <EraTimeline era={profile.era} accent={accent} />
                              </SectionCard>

                              {/* Macro Economic Context */}
                              <SectionCard title="Economic Environment" icon={SectionIcons.chart(accent)} accentColor={accent}>
                                <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 10, fontFamily: "var(--font-mono)" }}>
                                  Key macro indicators during {selectedAuthor.split(" ").pop()}&apos;s active years ({profile.era})
                                </div>
                                <MacroCharts era={profile.era} accent={accent} />
                              </SectionCard>

                              {/* Backstory */}
                              <SectionCard title="Origin Story" icon={SectionIcons.book(accent)} accentColor={accent}>
                                <FormattedText text={profile.backstory} />
                              </SectionCard>

                              {/* Notable Trade / Key Moment — case study card */}
                              {profile.notableTrade && (
                                <div style={{
                                  padding: "18px 20px", borderRadius: 14,
                                  background: `linear-gradient(135deg, ${accent}08, ${accent}03)`,
                                  border: `1px solid ${accent}20`,
                                  borderLeft: `3px solid ${accent}`,
                                  position: "relative", overflow: "hidden",
                                }}>
                                  {/* Decorative watermark */}
                                  <div style={{
                                    position: "absolute", top: -8, right: -8, opacity: 0.04,
                                    fontSize: 80, fontWeight: 900, color: accent, lineHeight: 1,
                                    pointerEvents: "none", userSelect: "none",
                                  }}>$</div>
                                  <div style={{
                                    display: "flex", alignItems: "center", gap: 8, marginBottom: 12,
                                  }}>
                                    <span style={{ display: "flex", opacity: 0.8 }}>{SectionIcons.zap(accent)}</span>
                                    <div style={{
                                      fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 700,
                                      color: accent, textTransform: "uppercase",
                                      letterSpacing: "0.08em",
                                    }}>
                                      Signature Trade
                                    </div>
                                    <div style={{ flex: 1, height: 1, background: `${accent}15` }} />
                                  </div>
                                  <FormattedText text={profile.notableTrade} fontSize={12} />
                                </div>
                              )}

                              {/* Known For — highlight banner */}
                              <div style={{
                                padding: "14px 18px", borderRadius: 12,
                                background: `linear-gradient(90deg, ${accent}10, transparent)`,
                                borderLeft: `3px solid ${accent}`,
                              }}>
                                <div style={{
                                  display: "flex", alignItems: "center", gap: 8, marginBottom: 8,
                                }}>
                                  <span style={{ display: "flex", opacity: 0.7 }}>{SectionIcons.compass(accent)}</span>
                                  <div style={{
                                    fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 700,
                                    color: accent, textTransform: "uppercase",
                                    letterSpacing: "0.08em",
                                  }}>
                                    Known For
                                  </div>
                                </div>
                                <div style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-primary)", fontWeight: 500 }}>
                                  {profile.famousFor}
                                </div>
                              </div>

                              {/* Influences */}
                              {(profile.influences?.length ?? 0) > 0 && (
                                <SectionCard title="Influences & Mentors" icon={SectionIcons.users(accent)} accentColor={accent}>
                                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                    {profile.influences?.map((inf, i) => (
                                      <span key={i} style={{
                                        fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 500,
                                        padding: "5px 14px", borderRadius: 20,
                                        background: `${accent}08`,
                                        border: `1px solid ${accent}15`,
                                        color: "var(--text-primary)",
                                        transition: "all 150ms ease",
                                      }}>
                                        {inf}
                                      </span>
                                    ))}
                                  </div>
                                </SectionCard>
                              )}
                            </div>
                          );
                        })()}
                      </motion.div>
                    )}

                    {detailTab === "methodology" && (
                      <motion.div
                        key="methodology"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.25, ease: EASE_EXPO }}
                      >
                        {(() => {
                          const profile = AUTHOR_PROFILES[selectedAuthor];
                          if (!profile) return (
                            <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "20px 0" }}>
                              No profile data available for this author.
                            </div>
                          );
                          const accent = APPROACH_TAG_COLORS[profile.approachTag];
                          return (
                            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                              {/* Approach header + thesis */}
                              <div style={{
                                padding: "18px 20px", borderRadius: 14,
                                background: `linear-gradient(135deg, ${accent}06, var(--bg-raised))`,
                                border: "1px solid rgba(236,227,213,0.06)",
                              }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                                  <span style={{ display: "flex", opacity: 0.7 }}>{SectionIcons.compass(accent)}</span>
                                  <div style={{
                                    fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 700,
                                    color: "var(--text-muted)", textTransform: "uppercase",
                                    letterSpacing: "0.08em",
                                  }}>
                                    Trading Philosophy
                                  </div>
                                  <span style={{
                                    fontSize: 9, fontFamily: "var(--font-mono)", fontWeight: 600,
                                    color: accent, background: `${accent}18`,
                                    padding: "3px 10px", borderRadius: 10,
                                  }}>
                                    {profile.approach}
                                  </span>
                                  <div style={{ flex: 1, height: 1, background: `${accent}15` }} />
                                </div>
                                <div style={{ fontSize: 14, lineHeight: 1.7, color: "var(--text-primary)", fontWeight: 500, fontStyle: "italic" }}>
                                  &ldquo;{profile.thesis}&rdquo;
                                </div>
                              </div>

                              {/* Macro Environment Context */}
                              <SectionCard title="Market Regime During Active Years" icon={SectionIcons.chart(accent)} accentColor={accent}>
                                <MacroCharts era={profile.era} accent={accent} />
                              </SectionCard>

                              {/* Deep Methodology */}
                              {profile.methodologyDetail && (
                              <SectionCard title="How They Execute" icon={SectionIcons.target(accent)} accentColor={accent}>
                                <FormattedText text={profile.methodologyDetail} />
                              </SectionCard>
                              )}

                              {/* Core Principles — numbered cards */}
                              {(profile.corePrinciples?.length ?? 0) > 0 && (
                              <SectionCard title="Core Principles" icon={SectionIcons.target(accent)} accentColor={accent}>
                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                  {profile.corePrinciples!.map((principle, i) => {
                                    const dashIdx = principle.indexOf(" — ");
                                    const hasLabel = dashIdx > 0 && dashIdx < 40;
                                    return (
                                      <div key={i} style={{
                                        display: "flex", gap: 12, alignItems: "flex-start",
                                        padding: "12px 16px", borderRadius: 12,
                                        background: `${accent}05`,
                                        border: `1px solid ${accent}10`,
                                        borderLeft: `3px solid ${accent}40`,
                                      }}>
                                        {/* Number badge */}
                                        <div style={{
                                          width: 22, height: 22, borderRadius: "50%",
                                          background: `${accent}15`, display: "flex",
                                          alignItems: "center", justifyContent: "center",
                                          fontSize: 10, fontFamily: "var(--font-mono)",
                                          fontWeight: 700, color: accent, flexShrink: 0,
                                          marginTop: 1,
                                        }}>
                                          {i + 1}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                          {hasLabel ? (
                                            <>
                                              <div style={{
                                                fontSize: 12, fontWeight: 700,
                                                color: accent, marginBottom: 4,
                                              }}>
                                                {principle.slice(0, dashIdx)}
                                              </div>
                                              <div style={{ fontSize: 12, lineHeight: 1.65, color: "var(--text-secondary)" }}>
                                                {principle.slice(dashIdx + 3)}
                                              </div>
                                            </>
                                          ) : (
                                            <div style={{ fontSize: 12, lineHeight: 1.65, color: "var(--text-secondary)" }}>
                                              {principle}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </SectionCard>
                              )}

                              {/* Risk Management */}
                              {profile.riskManagement && (
                              <SectionCard title="Risk Management" icon={SectionIcons.shield("#e54d4d")} accentColor="#e54d4d">
                                <FormattedText text={profile.riskManagement} />
                              </SectionCard>
                              )}

                              {/* Psychology Edge */}
                              {profile.psychologyEdge && (
                              <SectionCard title="Psychology & Mental Edge" icon={SectionIcons.brain("#7c6bbf")} accentColor="#7c6bbf">
                                <FormattedText text={profile.psychologyEdge} />
                              </SectionCard>
                              )}

                              {/* Key Metrics — table layout */}
                              <SectionCard title="Key Metrics & Criteria" icon={SectionIcons.chart(accent)} accentColor={accent}>
                                <div style={{
                                  display: "grid",
                                  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                                  gap: 6,
                                }}>
                                  {profile.keyMetrics.map((metric, i) => {
                                    const colonIdx = metric.indexOf(":");
                                    const hasKV = colonIdx > 0 && colonIdx < 35;
                                    return (
                                      <div key={i} style={{
                                        display: "flex", alignItems: "flex-start", gap: 10,
                                        padding: "10px 14px", borderRadius: 10,
                                        background: `${accent}05`,
                                        border: `1px solid ${accent}10`,
                                      }}>
                                        <div style={{
                                          width: 7, height: 7, borderRadius: "50%",
                                          background: accent, flexShrink: 0, marginTop: 5,
                                        }} />
                                        {hasKV ? (
                                          <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{
                                              fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 700,
                                              color: accent, textTransform: "uppercase",
                                              letterSpacing: "0.04em", marginBottom: 2,
                                            }}>
                                              {metric.slice(0, colonIdx)}
                                            </div>
                                            <div style={{
                                              fontSize: 12, fontWeight: 500,
                                              color: "var(--text-primary)", lineHeight: 1.4,
                                            }}>
                                              {metric.slice(colonIdx + 1).trim()}
                                            </div>
                                          </div>
                                        ) : (
                                          <div style={{
                                            fontSize: 12, fontFamily: "var(--font-mono)", fontWeight: 500,
                                            color: "var(--text-primary)", lineHeight: 1.4,
                                          }}>
                                            {metric}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </SectionCard>
                            </div>
                          );
                        })()}
                      </motion.div>
                    )}

                    {detailTab === "quotes" && (
                      <motion.div
                        key="quotes"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.25, ease: EASE_EXPO }}
                      >
                        {selectedAuthorQuotesByCategory.length === 0 ? (
                          <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "20px 0" }}>
                            No quotes available for this author.
                          </div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                            {selectedAuthorQuotesByCategory.map(([cat, quotes], ci) => (
                              <motion.div
                                key={cat}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3, ease: EASE_EXPO, delay: ci * 0.06 }}
                              >
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                                  <div style={{
                                    width: 8, height: 8, borderRadius: "50%",
                                    background: QUOTE_CATEGORY_COLORS[cat],
                                    flexShrink: 0,
                                  }} />
                                  <div style={{
                                    fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 700,
                                    color: QUOTE_CATEGORY_COLORS[cat],
                                    textTransform: "uppercase", letterSpacing: "0.08em",
                                  }}>
                                    {QUOTE_CATEGORY_LABELS[cat]}
                                  </div>
                                  <div style={{ flex: 1, height: 1, background: `${QUOTE_CATEGORY_COLORS[cat]}20` }} />
                                </div>

                                <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingLeft: 16 }}>
                                  {quotes.map((qt, qi) => (
                                    <motion.div
                                      key={qi}
                                      initial={{ opacity: 0, x: -6 }}
                                      animate={{ opacity: 1, x: 0 }}
                                      transition={{ duration: 0.25, ease: EASE_EXPO, delay: ci * 0.06 + qi * 0.03 }}
                                      style={{
                                        display: "flex", gap: 12, alignItems: "flex-start",
                                        padding: "10px 14px", borderRadius: 10,
                                        background: "var(--bg-raised)",
                                        border: "1px solid rgba(236,227,213,0.06)",
                                        borderLeft: `2px solid ${QUOTE_CATEGORY_COLORS[cat]}40`,
                                      }}
                                    >
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{
                                          fontSize: 12, lineHeight: 1.65, color: "var(--text-secondary)", fontStyle: "italic",
                                        }}>
                                          &ldquo;{qt.text}&rdquo;
                                        </div>
                                        {qt.source && (
                                          <div style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-muted)", marginTop: 4 }}>
                                            -- {qt.source}
                                          </div>
                                        )}
                                      </div>
                                    </motion.div>
                                  ))}
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ) : (
                /* ─── Author Grid View ─── */
                <motion.div
                  key="author-grid"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3, ease: EASE_EXPO }}
                >
                  {filteredQuotes.length === 0 ? (
                    <EmptyState text="No quotes match your search" />
                  ) : (
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                      gap: 8,
                    }}>
                      {quotesByAuthor.map(([author, quotes], i) => (
                        <motion.div
                          key={author}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, ease: EASE_EXPO, delay: i * 0.03 }}
                          onClick={() => { setSelectedAuthor(author); setDetailTab("backstory"); }}
                          style={{
                            padding: "16px 10px",
                            cursor: "pointer",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            textAlign: "center",
                            gap: 10,
                            borderRadius: 12,
                            transition: "background 150ms ease",
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(236,227,213,0.04)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                        >
                          <AuthorBubble author={author} size={110} />
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.25, marginBottom: 3 }}>
                              {author}
                            </div>
                            <div style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                              {quotes.length} quote{quotes.length !== 1 ? "s" : ""}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          ) : (
            <motion.div
              key="books"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: EASE_EXPO }}
            >
              {filteredBooks.length === 0 ? (
                <EmptyState text="No books match your filters" />
              ) : (
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                  gap: 12,
                }}>
                  {filteredBooks.map((book, i) => (
                    <motion.div
                      key={book.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, ease: EASE_EXPO, delay: i * 0.03 }}
                      className="lib-book-card"
                      style={{
                        borderRadius: 12,
                        padding: 16,
                        background: `linear-gradient(135deg, ${book.coverAccent}10, var(--bg-raised))`,
                        border: "1px solid rgba(236,227,213,0.06)",
                      }}
                    >
                      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                        <BookCover isbn={book.isbn} title={book.title} accent={book.coverAccent} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{
                            display: "inline-block", fontSize: 8, fontFamily: "var(--font-mono)",
                            fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em",
                            color: book.coverAccent, background: `${book.coverAccent}18`,
                            padding: "1px 6px", borderRadius: 12, marginBottom: 6,
                          }}>
                            {book.category}
                          </span>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 2, lineHeight: 1.25 }}>
                            {book.title}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>
                            {book.author}
                          </div>
                          <div style={{ fontSize: 10, color: "var(--accent-bright)", marginBottom: 8, lineHeight: 1.4 }}>
                            {book.tagline}
                          </div>
                        </div>
                      </div>
                      {/* Pull quote */}
                      <div style={{
                        borderLeft: `2px solid ${book.coverAccent}40`,
                        paddingLeft: 12, marginTop: 10,
                        fontSize: 11, lineHeight: 1.55, color: "var(--text-muted)", fontStyle: "italic",
                      }}>
                        &ldquo;{book.pullQuote}&rdquo;
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style>{`
        .lib-book-card {
          transition: transform 180ms cubic-bezier(0.16,1,0.3,1), border-color 180ms ease, box-shadow 180ms ease;
        }
        .lib-book-card:hover {
          transform: translateY(-2px);
          border-color: rgba(236,227,213,0.14) !important;
          box-shadow: 0 4px 20px rgba(15,12,8,0.3);
        }
      `}</style>
    </div>
  );
}

// ─── Sub-components ───

function AuthorBubble({ author, size = 32 }: { author: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const headshotUrl = getAuthorHeadshotUrl(author);
  const accent = authorAccentColor(author);
  const initials = author.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", overflow: "hidden",
      background: `${accent}25`, border: "1px solid rgba(236,227,213,0.08)",
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    }}>
      {headshotUrl && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={headshotUrl} alt={author} onError={() => setFailed(true)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <span style={{ fontSize: size * 0.32, fontFamily: "var(--font-mono)", fontWeight: 600, color: accent, letterSpacing: "-0.02em" }}>
          {initials}
        </span>
      )}
    </div>
  );
}

function BookCover({ isbn, title, accent }: { isbn: string; title: string; accent: string }) {
  const [failed, setFailed] = useState(false);
  const initials = title.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div style={{
      width: 48, height: 48, borderRadius: "50%", overflow: "hidden",
      background: `${accent}25`, border: "1px solid rgba(236,227,213,0.08)",
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    }}>
      {!failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={getBookCoverUrl(isbn, "S")} alt={title} onError={() => setFailed(true)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <span style={{ fontSize: 14, fontFamily: "var(--font-mono)", fontWeight: 600, color: accent, letterSpacing: "-0.02em" }}>
          {initials}
        </span>
      )}
    </div>
  );
}

function SectionCard({ title, icon, accentColor, children }: {
  title: string;
  icon?: React.ReactNode;
  accentColor?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      padding: "18px 20px", borderRadius: 14,
      background: "var(--bg-raised)", border: "1px solid rgba(236,227,213,0.06)",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8, marginBottom: 14,
      }}>
        {icon && <span style={{ display: "flex", opacity: 0.7 }}>{icon}</span>}
        <div style={{
          fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 700,
          color: accentColor || "var(--text-muted)", textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}>
          {title}
        </div>
        <div style={{ flex: 1, height: 1, background: `${accentColor || "var(--text-muted)"}15` }} />
      </div>
      {children}
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      padding: "10px 16px", borderRadius: 10,
      background: "var(--bg-raised)", border: "1px solid rgba(236,227,213,0.06)",
      display: "flex", flexDirection: "column", gap: 3, minWidth: 120,
    }}>
      <div style={{
        fontSize: 9, fontFamily: "var(--font-mono)", fontWeight: 700,
        color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em",
      }}>
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.3 }}>
        {value}
      </div>
    </div>
  );
}

/** Render multi-paragraph text with proper formatting */
function FormattedText({ text, fontSize = 13 }: { text: string; fontSize?: number }) {
  const paragraphs = text.split(/\n\n+/).filter(Boolean);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {paragraphs.map((p, i) => (
        <p key={i} style={{
          fontSize, lineHeight: 1.75, color: "var(--text-secondary)", margin: 0,
          textAlign: "justify", textAlignLast: "left",
        }}>
          {p}
        </p>
      ))}
    </div>
  );
}

/** ─── Historical Macro Data (approximate key data points) ─── */

const MARKET_EVENTS = [
  { year: 1929, label: "Wall St. Crash", color: "#ef4444", desc: "87% drawdown over 3 years" },
  { year: 1933, label: "New Deal Rally", color: "#22c55e", desc: "Bottomed at Dow 41" },
  { year: 1962, label: "Kennedy Slide", color: "#ef4444", desc: "S&P fell 28% in 6 months" },
  { year: 1973, label: "Oil Crisis Bear", color: "#ef4444", desc: "OPEC embargo, stagflation" },
  { year: 1980, label: "Volcker Shock", color: "#f59e0b", desc: "Fed Funds hit 20%" },
  { year: 1982, label: "Secular Bull Begins", color: "#22c55e", desc: "18-year expansion" },
  { year: 1987, label: "Black Monday", color: "#ef4444", desc: "22.6% single-day drop" },
  { year: 1995, label: "Dot-Com Boom", color: "#22c55e", desc: "Internet mania begins" },
  { year: 2000, label: "Dot-Com Bust", color: "#ef4444", desc: "Nasdaq lost 78%" },
  { year: 2008, label: "GFC", color: "#ef4444", desc: "Lehman collapse, S&P -57%" },
  { year: 2020, label: "COVID Crash", color: "#ef4444", desc: "34% drop in 23 days" },
  { year: 2021, label: "Meme / ZIRP Rally", color: "#22c55e", desc: "Zero rates, retail frenzy" },
  { year: 2024, label: "AI Bull Run", color: "#22c55e", desc: "Mag 7 driven rally" },
];

/** S&P 500 index level (approximate year-end) */
const SP500_DATA: [number, number][] = [
  [1920,7],[1925,12],[1929,32],[1932,5],[1937,18],[1942,8],[1945,15],[1950,17],
  [1955,40],[1960,55],[1965,85],[1968,100],[1970,83],[1973,120],[1974,62],
  [1978,96],[1980,115],[1982,102],[1985,210],[1987,247],[1990,330],[1995,615],
  [1998,1229],[2000,1469],[2002,880],[2005,1248],[2007,1468],[2009,1115],
  [2011,1258],[2013,1848],[2015,2044],[2017,2674],[2019,3231],[2020,3756],
  [2021,4766],[2022,3840],[2023,4770],[2024,5881],[2025,6000],
];

/** Effective Federal Funds Rate (%) */
const FED_FUNDS_DATA: [number, number][] = [
  [1920,5.0],[1925,3.5],[1929,6.0],[1932,2.5],[1937,1.0],[1940,1.0],[1945,1.0],
  [1950,1.5],[1955,2.5],[1958,1.8],[1960,4.0],[1965,4.0],[1968,5.5],[1970,8.0],
  [1973,10.0],[1975,5.5],[1978,7.9],[1980,20.0],[1982,12.0],[1985,8.1],
  [1987,6.7],[1990,8.1],[1992,3.0],[1995,5.8],[1998,5.4],[2000,6.5],[2003,1.0],
  [2006,5.25],[2008,2.0],[2009,0.15],[2012,0.15],[2015,0.4],[2018,2.4],
  [2020,0.1],[2022,4.3],[2023,5.3],[2025,4.5],
];

/** CPI Year-over-Year Inflation (%) */
const INFLATION_DATA: [number, number][] = [
  [1920,15.6],[1921,-10.5],[1925,2.3],[1929,0.0],[1932,-10.3],[1935,2.2],
  [1940,0.7],[1942,10.9],[1945,2.3],[1947,14.4],[1950,1.3],[1955,0.4],
  [1960,1.7],[1965,1.6],[1968,4.2],[1970,5.7],[1973,6.2],[1975,9.1],
  [1978,7.6],[1980,13.5],[1982,6.2],[1985,3.6],[1988,4.1],[1990,5.4],
  [1995,2.8],[2000,3.4],[2003,2.3],[2005,3.4],[2008,3.8],[2010,1.6],
  [2015,0.1],[2018,2.4],[2020,1.2],[2021,4.7],[2022,8.0],[2023,4.1],[2025,2.8],
];

/** 10-Year US Treasury Yield (%) */
const TREASURY_10Y_DATA: [number, number][] = [
  [1920,5.0],[1925,3.9],[1929,3.6],[1932,3.7],[1937,2.7],[1940,2.2],
  [1945,2.4],[1950,2.3],[1955,2.8],[1960,4.0],[1965,4.3],[1968,5.7],
  [1970,7.4],[1975,7.9],[1978,8.4],[1980,11.4],[1982,13.0],[1985,10.6],
  [1988,8.8],[1990,8.6],[1993,5.9],[1995,6.6],[2000,6.0],[2003,4.0],
  [2007,4.6],[2010,3.2],[2012,1.8],[2015,2.1],[2018,2.9],[2020,0.9],
  [2022,3.9],[2023,4.6],[2025,4.3],
];

/** Parse era string into [startYear, endYear] */
function parseEra(era: string): [number, number] | null {
  const m = era.match(/(\d{4})\s*[-–]\s*(\d{4}|present)/i);
  if (!m) return null;
  return [parseInt(m[1]), m[2].toLowerCase() === "present" ? 2026 : parseInt(m[2])];
}

/** Filter data series to a year range with 1-point padding on each end */
function filterToEra(data: [number, number][], start: number, end: number): [number, number][] {
  const padStart = start - 5;
  const padEnd = end + 3;
  return data.filter(([y]) => y >= padStart && y <= padEnd);
}

/** Build an SVG path (area or line) from data points */
function buildPath(
  data: [number, number][],
  width: number, height: number,
  minY: number, maxY: number,
  minX: number, maxX: number,
  close: boolean,
): string {
  if (data.length < 2) return "";
  const xRange = maxX - minX || 1;
  const yRange = maxY - minY || 1;
  const px = (yr: number) => ((yr - minX) / xRange) * width;
  const py = (val: number) => height - ((val - minY) / yRange) * height;

  let d = `M ${px(data[0][0]).toFixed(1)} ${py(data[0][1]).toFixed(1)}`;
  for (let i = 1; i < data.length; i++) {
    // Smooth curve using cubic bezier
    const prev = data[i - 1];
    const curr = data[i];
    const cpx = (px(prev[0]) + px(curr[0])) / 2;
    d += ` C ${cpx.toFixed(1)} ${py(prev[1]).toFixed(1)}, ${cpx.toFixed(1)} ${py(curr[1]).toFixed(1)}, ${px(curr[0]).toFixed(1)} ${py(curr[1]).toFixed(1)}`;
  }
  if (close) {
    d += ` L ${px(data[data.length - 1][0]).toFixed(1)} ${height} L ${px(data[0][0]).toFixed(1)} ${height} Z`;
  }
  return d;
}

/** SVG mini area chart with gradient fill */
function MiniAreaChart({ data, color, label, unit, height = 80, era }: {
  data: [number, number][];
  color: string;
  label: string;
  unit: string;
  height?: number;
  era: [number, number];
}) {
  if (data.length < 2) return null;
  const W = 300;
  const H = height;
  const PAD = 2;
  const values = data.map(d => d[1]);
  const minY = Math.min(...values);
  const maxY = Math.max(...values);
  const minX = data[0][0];
  const maxX = data[data.length - 1][0];
  const uid = `grad-${label.replace(/\s/g, "")}-${color.replace("#", "")}`;

  // Find value at start and end of person's era
  const valAtYear = (yr: number) => {
    for (let i = data.length - 1; i >= 0; i--) {
      if (data[i][0] <= yr) return data[i][1];
    }
    return data[0][1];
  };
  const eraStart = valAtYear(era[0]);
  const eraEnd = valAtYear(era[1]);
  const change = eraEnd - eraStart;
  // For index-level data (no unit), show % return instead of absolute points
  const changeStr = unit === "" && eraStart !== 0
    ? `${change >= 0 ? "+" : ""}${((change / eraStart) * 100).toFixed(0)}%`
    : `${change >= 0 ? "+" : ""}${change.toFixed(1)}${unit}`;

  // Y-axis ticks (3 ticks)
  const yTicks = [minY, (minY + maxY) / 2, maxY];

  return (
    <div style={{ padding: "12px 14px", borderRadius: 12, background: "var(--bg-raised)", border: "1px solid rgba(236,227,213,0.06)" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {label}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 600, color: change >= 0 ? "#22c55e" : "#ef4444" }}>
            {changeStr}
          </div>
          <div style={{ fontSize: 8, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
            across era
          </div>
        </div>
      </div>

      {/* Chart */}
      <div style={{ position: "relative" }}>
        {/* Y-axis labels */}
        <div style={{
          position: "absolute", left: -2, top: 0, bottom: 0,
          display: "flex", flexDirection: "column", justifyContent: "space-between",
          pointerEvents: "none", zIndex: 1,
        }}>
          {[...yTicks].reverse().map((v, i) => (
            <span key={i} style={{
              fontSize: 7, fontFamily: "var(--font-mono)", color: "var(--text-muted)",
              opacity: 0.6, lineHeight: 1,
            }}>
              {v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(v < 10 ? 1 : 0)}
            </span>
          ))}
        </div>
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: "block" }}>
          <defs>
            <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.25" />
              <stop offset="100%" stopColor={color} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {/* Grid lines */}
          {yTicks.map((v, i) => {
            const y = H - ((v - minY) / ((maxY - minY) || 1)) * (H - PAD * 2) - PAD;
            return <line key={i} x1="0" y1={y} x2={W} y2={y} stroke="rgba(236,227,213,0.06)" strokeWidth="0.5" />;
          })}
          {/* Era highlight band */}
          {(() => {
            const xRange = maxX - minX || 1;
            const x1 = ((era[0] - minX) / xRange) * W;
            const x2 = ((era[1] - minX) / xRange) * W;
            return <rect x={x1} y="0" width={Math.max(0, x2 - x1)} height={H} fill={color} opacity="0.06" />;
          })()}
          {/* Area fill */}
          <path d={buildPath(data, W, H - PAD * 2, minY, maxY, minX, maxX, true)} fill={`url(#${uid})`} transform={`translate(0, ${PAD})`} />
          {/* Line */}
          <path d={buildPath(data, W, H - PAD * 2, minY, maxY, minX, maxX, false)} fill="none" stroke={color} strokeWidth="1.5" transform={`translate(0, ${PAD})`} />
        </svg>
      </div>

      {/* X-axis year labels */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <span style={{ fontSize: 7, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>{minX}</span>
        <span style={{ fontSize: 7, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>{Math.round((minX + maxX) / 2)}</span>
        <span style={{ fontSize: 7, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>{maxX}</span>
      </div>
    </div>
  );
}

/** Premium era timeline with S&P 500 backdrop and event markers */
function EraTimeline({ era, accent }: { era: string; accent: string }) {
  const parsed = parseEra(era);
  if (!parsed) return null;
  const [startYear, endYear] = parsed;

  const TL_START = 1920;
  const TL_END = 2026;
  const range = TL_END - TL_START;
  const pct = (yr: number) => Math.max(0, Math.min(100, ((yr - TL_START) / range) * 100));

  // S&P 500 backdrop
  const W = 800;
  const CHART_H = 110;
  const spVals = SP500_DATA.map(d => d[1]);
  const spMin = Math.min(...spVals);
  const spMax = Math.max(...spVals);

  const eraEvents = MARKET_EVENTS.filter(e => e.year >= startYear && e.year <= endYear);
  const allEvents = MARKET_EVENTS;

  // Decade ticks every 10 years
  const decadeTicks: number[] = [];
  for (let y = 1920; y <= 2020; y += 10) decadeTicks.push(y);

  return (
    <div style={{ padding: "4px 0" }}>
      {/* ── Chart area ── */}
      <div style={{ position: "relative", marginBottom: 6 }}>
        {/* S&P 500 area chart */}
        <svg
          width="100%"
          height={CHART_H}
          viewBox={`0 0 ${W} ${CHART_H}`}
          preserveAspectRatio="none"
          style={{ display: "block", borderRadius: 8 }}
        >
          <defs>
            <linearGradient id="eraSpGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(236,227,213,0.10)" />
              <stop offset="100%" stopColor="rgba(236,227,213,0.01)" />
            </linearGradient>
            <linearGradient id="eraActiveGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity="0.12" />
              <stop offset="100%" stopColor={accent} stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Faint grid lines */}
          {[0.25, 0.5, 0.75].map(f => (
            <line key={f} x1="0" y1={CHART_H * (1 - f)} x2={W} y2={CHART_H * (1 - f)}
              stroke="rgba(236,227,213,0.05)" strokeWidth="0.5" />
          ))}

          {/* Full S&P area */}
          <path
            d={buildPath(SP500_DATA, W, CHART_H - 6, spMin, spMax, TL_START, TL_END, true)}
            fill="url(#eraSpGrad)" transform="translate(0,3)"
          />
          <path
            d={buildPath(SP500_DATA, W, CHART_H - 6, spMin, spMax, TL_START, TL_END, false)}
            fill="none" stroke="rgba(236,227,213,0.10)" strokeWidth="1" transform="translate(0,3)"
          />

          {/* Active era highlight band */}
          {(() => {
            const x1 = ((startYear - TL_START) / range) * W;
            const x2 = ((endYear - TL_START) / range) * W;
            return (
              <>
                <rect x={x1} y="0" width={x2 - x1} height={CHART_H} fill="url(#eraActiveGrad)" />
                <line x1={x1} y1="0" x2={x1} y2={CHART_H} stroke={accent} strokeWidth="1" strokeDasharray="3,3" opacity="0.5" />
                <line x1={x2} y1="0" x2={x2} y2={CHART_H} stroke={accent} strokeWidth="1" strokeDasharray="3,3" opacity="0.5" />
              </>
            );
          })()}

          {/* Event vertical markers */}
          {allEvents.map(ev => {
            const x = ((ev.year - TL_START) / range) * W;
            const inEra = ev.year >= startYear && ev.year <= endYear;
            return (
              <g key={ev.year}>
                <line x1={x} y1="0" x2={x} y2={CHART_H}
                  stroke={ev.color} strokeWidth={inEra ? "1" : "0.5"}
                  opacity={inEra ? 0.4 : 0.12}
                />
                <circle cx={x} cy={CHART_H - 8} r={inEra ? 4 : 2.5}
                  fill={inEra ? ev.color : "transparent"}
                  stroke={ev.color}
                  strokeWidth={inEra ? 0 : 0.8}
                  opacity={inEra ? 1 : 0.3}
                />
              </g>
            );
          })}
        </svg>

        {/* "ACTIVE" label — positioned above chart */}
        <div style={{
          position: "absolute", top: 4,
          left: `${pct(startYear)}%`,
          fontSize: 8, fontFamily: "var(--font-mono)", fontWeight: 700,
          color: accent, letterSpacing: "0.06em", whiteSpace: "nowrap",
          background: "var(--bg-raised)", padding: "1px 5px", borderRadius: 4,
          border: `1px solid ${accent}30`,
          opacity: 0.9,
        }}>
          {startYear}–{endYear}
        </div>

        {/* S&P label */}
        <div style={{
          position: "absolute", top: 4, right: 4,
          fontSize: 7, fontFamily: "var(--font-mono)", fontWeight: 600,
          color: "var(--text-muted)", opacity: 0.5,
        }}>
          S&P 500
        </div>
      </div>

      {/* ── Timeline track + decade labels ── */}
      <div style={{ position: "relative", height: 20, marginBottom: 10 }}>
        {/* Background track */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 3,
          background: "rgba(236,227,213,0.06)", borderRadius: 2,
        }} />
        {/* Active era bar */}
        <div style={{
          position: "absolute", top: 0, height: 3, borderRadius: 2,
          left: `${pct(startYear)}%`,
          width: `${Math.max(1, pct(endYear) - pct(startYear))}%`,
          background: `linear-gradient(90deg, ${accent}, ${accent}80)`,
        }} />
        {/* Decade tick marks */}
        {decadeTicks.map(y => (
          <div key={y} style={{ position: "absolute", left: `${pct(y)}%` }}>
            <div style={{
              width: 1, height: 5, background: "rgba(236,227,213,0.12)",
              position: "absolute", top: 0, left: -0.5,
            }} />
            <span style={{
              position: "absolute", top: 7,
              transform: "translateX(-50%)",
              fontSize: 7, fontFamily: "var(--font-mono)", color: "var(--text-muted)",
              opacity: 0.6,
            }}>
              {y}
            </span>
          </div>
        ))}
      </div>

      {/* ── Events legend grid ── */}
      {eraEvents.length > 0 && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: 6,
        }}>
          {eraEvents.map(ev => (
            <div key={ev.year} style={{
              display: "flex", gap: 10, alignItems: "flex-start",
              padding: "8px 12px", borderRadius: 10,
              background: `${ev.color}08`,
              border: `1px solid ${ev.color}12`,
              borderLeft: `3px solid ${ev.color}`,
            }}>
              <div style={{
                fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 800,
                color: ev.color, lineHeight: 1, marginTop: 1, flexShrink: 0,
              }}>
                {ev.year}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: ev.color, lineHeight: 1.2 }}>
                  {ev.label}
                </div>
                <div style={{ fontSize: 9, color: "var(--text-muted)", lineHeight: 1.4, marginTop: 2 }}>
                  {ev.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** 2×2 macro economic indicator dashboard for a given era */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function MacroCharts({ era, accent }: { era: string; accent: string }) {
  const parsed = parseEra(era);
  if (!parsed) return null;
  const [startYear, endYear] = parsed;

  const spFiltered = filterToEra(SP500_DATA, startYear, endYear);
  const ffFiltered = filterToEra(FED_FUNDS_DATA, startYear, endYear);
  const cpFiltered = filterToEra(INFLATION_DATA, startYear, endYear);
  const tyFiltered = filterToEra(TREASURY_10Y_DATA, startYear, endYear);

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(2, 1fr)",
      gap: 8,
    }}>
      <MiniAreaChart data={spFiltered} color="#22ab94" label="S&P 500" unit="" era={parsed} />
      <MiniAreaChart data={ffFiltered} color="#e54d4d" label="Fed Funds Rate" unit="%" era={parsed} />
      <MiniAreaChart data={cpFiltered} color="#f59e0b" label="CPI Inflation" unit="%" era={parsed} />
      <MiniAreaChart data={tyFiltered} color="#3a8fc4" label="10Y Treasury" unit="%" era={parsed} />
    </div>
  );
}

/** SVG icons for section headers */
const SectionIcons = {
  book: (color: string) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  ),
  target: (color: string) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
    </svg>
  ),
  shield: (color: string) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  brain: (color: string) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a5 5 0 0 1 5 5c0 1.5-.5 2.8-1.3 3.8A5 5 0 0 1 17 14a5 5 0 0 1-5 5 5 5 0 0 1-5-5c0-1.2.4-2.3 1.1-3.2A5 5 0 0 1 7 7a5 5 0 0 1 5-5z" />
      <path d="M12 2v20" />
    </svg>
  ),
  chart: (color: string) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  compass: (color: string) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  ),
  users: (color: string) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  zap: (color: string) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
};

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
      <div style={{ fontSize: 13, marginBottom: 4 }}>{text}</div>
      <div style={{ fontSize: 11, fontFamily: "var(--font-mono)" }}>Try adjusting your search or filters</div>
    </div>
  );
}
