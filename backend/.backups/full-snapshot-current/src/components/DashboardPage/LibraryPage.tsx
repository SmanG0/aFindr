"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BOOKS,
  QUOTES,
  getBookCoverUrl,
  authorAccentColor,
  getAuthorHeadshotUrl,
} from "@/lib/dashboard-content";
import type { TradingBook, TradingQuote } from "@/lib/dashboard-content";

// ─── Constants ───

const EASE_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

type Tab = "books" | "quotes";
type BookCategory = TradingBook["category"] | "all";

const CATEGORY_LABELS: Record<BookCategory, string> = {
  all: "All",
  psychology: "Psychology",
  technical: "Technical",
  fundamentals: "Fundamentals",
  risk: "Risk",
  philosophy: "Philosophy",
};

interface LibraryPageProps {
  onBack: () => void;
}

// ─── Component ───

export default function LibraryPage({ onBack }: LibraryPageProps) {
  const [tab, setTab] = useState<Tab>("quotes");
  const [bookCategory, setBookCategory] = useState<BookCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");

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
    return Object.entries(map).sort((a, b) => b[1].length - a[1].length);
  }, [filteredQuotes]);

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
            <motion.div
              key="quotes"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: EASE_EXPO }}
            >
              {filteredQuotes.length === 0 ? (
                <EmptyState text="No quotes match your search" />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  {quotesByAuthor.map(([author, quotes], gi) => (
                    <motion.div
                      key={author}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, ease: EASE_EXPO, delay: gi * 0.04 }}
                    >
                      {/* Author header */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                        <AuthorBubble author={author} size={32} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{author}</div>
                          <div style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                            {quotes.length} quote{quotes.length !== 1 ? "s" : ""}
                          </div>
                        </div>
                      </div>

                      {/* Quotes */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingLeft: 42 }}>
                        {quotes.map((qt, qi) => (
                          <motion.div
                            key={qi}
                            initial={{ opacity: 0, x: -6 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.25, ease: EASE_EXPO, delay: gi * 0.04 + qi * 0.03 }}
                            style={{
                              padding: "10px 14px",
                              borderRadius: 10,
                              background: "var(--bg-raised)",
                              border: "1px solid rgba(236,227,213,0.06)",
                              borderLeft: `2px solid ${authorAccentColor(author)}40`,
                            }}
                          >
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
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
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

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
      <div style={{ fontSize: 13, marginBottom: 4 }}>{text}</div>
      <div style={{ fontSize: 11, fontFamily: "var(--font-mono)" }}>Try adjusting your search or filters</div>
    </div>
  );
}
