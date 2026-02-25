"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ───

interface JournalEntry {
  id: string;
  date: string;
  text: string;
  mood?: "bullish" | "bearish" | "neutral";
  tags?: string[];
}

interface JournalPageProps {
  onBack: () => void;
}

// ─── Constants ───

const STORAGE_KEY = "afindr_journal";
const EASE_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

const MOOD_CONFIG = {
  bullish: { color: "var(--buy)", bg: "var(--buy-muted)", label: "Bullish" },
  bearish: { color: "var(--sell)", bg: "var(--sell-muted)", label: "Bearish" },
  neutral: { color: "var(--text-muted)", bg: "rgba(236,227,213,0.06)", label: "Neutral" },
} as const;

const NOTE_ACCENTS = ["#c47b3a", "#5a9bd4", "#22ab94", "#d4915a", "#7a5c9a", "#6a8a4a", "#9a5a6a", "#4a7a8a"];

type MoodFilter = "all" | "bullish" | "bearish" | "neutral";

// ─── Helpers ───

function loadEntries(): JournalEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveEntries(entries: JournalEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    + " at " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Component ───

export default function JournalPage({ onBack }: JournalPageProps) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [composing, setComposing] = useState(false);
  const [text, setText] = useState("");
  const [mood, setMood] = useState<JournalEntry["mood"]>(undefined);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);
  const [moodFilter, setMoodFilter] = useState<MoodFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setEntries(loadEntries());
  }, []);

  useEffect(() => {
    if (composing) textareaRef.current?.focus();
  }, [composing]);

  const handleSave = useCallback(() => {
    if (!text.trim()) return;
    const entry: JournalEntry = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      text: text.trim(),
      mood,
    };
    const updated = [entry, ...entries];
    setEntries(updated);
    saveEntries(updated);
    setText("");
    setMood(undefined);
    setComposing(false);
    setSavedFlash(entry.id);
    setTimeout(() => setSavedFlash(null), 2000);
  }, [text, mood, entries]);

  const handleDelete = useCallback((id: string) => {
    const updated = entries.filter((e) => e.id !== id);
    setEntries(updated);
    saveEntries(updated);
  }, [entries]);

  // Filtered entries
  const filtered = entries.filter((e) => {
    if (moodFilter !== "all" && e.mood !== moodFilter) return false;
    if (searchQuery && !e.text.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  // Group by date
  const grouped: Record<string, JournalEntry[]> = {};
  for (const entry of filtered) {
    const day = new Date(entry.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    if (!grouped[day]) grouped[day] = [];
    grouped[day].push(entry);
  }

  return (
    <div className="flex-1 overflow-auto" style={{ background: "var(--bg)" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 24px 48px" }}>

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
                width: 28,
                height: 28,
                borderRadius: 8,
                background: "var(--glass)",
                border: "1px solid var(--glass-border)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                transition: "background 120ms ease",
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
                fontSize: 20,
                fontWeight: 700,
                background: "linear-gradient(135deg, var(--accent-bright), var(--accent))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                lineHeight: 1.2,
              }}>
                Trading Journal
              </h1>
              <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)", marginTop: 2 }}>
                {entries.length} note{entries.length !== 1 ? "s" : ""}
              </div>
            </div>

            <div style={{ flex: 1 }} />

            {/* Saved flash */}
            <AnimatePresence>
              {savedFlash && (
                <motion.span
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.3, ease: EASE_EXPO }}
                  style={{
                    fontSize: 10,
                    fontFamily: "var(--font-mono)",
                    fontWeight: 600,
                    color: "var(--buy)",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--buy)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Note saved
                </motion.span>
              )}
            </AnimatePresence>

            {/* New note button */}
            <button
              onClick={() => setComposing(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 14px",
                borderRadius: 10,
                background: "var(--accent)",
                border: "none",
                cursor: "pointer",
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                fontWeight: 700,
                color: "var(--bg)",
                transition: "opacity 150ms ease",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.85"; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--bg)" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New Note
            </button>
          </div>

          {/* Toolbar: search + mood filter */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Search */}
            <div style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "var(--glass)",
              border: "1px solid var(--glass-border)",
              borderRadius: 10,
              padding: "6px 12px",
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search notes..."
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "var(--text-primary)",
                  fontSize: 11,
                  fontFamily: "var(--font-mono)",
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 1 }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>

            {/* Mood filter pills */}
            <div style={{ display: "flex", gap: 4 }}>
              {(["all", "bullish", "bearish", "neutral"] as MoodFilter[]).map((f) => {
                const active = moodFilter === f;
                const cfg = f === "all" ? { color: "var(--accent)", bg: "var(--accent-muted)", label: "All" } : MOOD_CONFIG[f];
                return (
                  <button
                    key={f}
                    onClick={() => setMoodFilter(f)}
                    style={{
                      fontSize: 9,
                      fontFamily: "var(--font-mono)",
                      fontWeight: 600,
                      color: active ? cfg.color : "var(--text-muted)",
                      background: active ? cfg.bg : "transparent",
                      border: `1px solid ${active ? cfg.color + "40" : "rgba(236,227,213,0.06)"}`,
                      borderRadius: 12,
                      padding: "3px 10px",
                      cursor: "pointer",
                      transition: "all 120ms ease",
                    }}
                  >
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>
        </motion.div>

        {/* Compose card */}
        <AnimatePresence>
          {composing && (
            <motion.div
              initial={{ opacity: 0, y: -8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -8, height: 0 }}
              transition={{ duration: 0.3, ease: EASE_EXPO }}
              style={{ overflow: "hidden", marginBottom: 20 }}
            >
              <div style={{
                borderRadius: 14,
                background: "var(--bg-raised)",
                border: "1px solid var(--accent)",
                boxShadow: "0 0 0 1px rgba(196,123,58,0.15), 0 4px 24px rgba(15,12,8,0.3)",
                padding: 16,
              }}>
                <textarea
                  ref={textareaRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSave();
                    if (e.key === "Escape") { setComposing(false); setText(""); setMood(undefined); }
                  }}
                  placeholder="What's on your mind about the markets?"
                  rows={4}
                  style={{
                    width: "100%",
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    color: "var(--text-primary)",
                    fontSize: 13,
                    lineHeight: 1.6,
                    fontFamily: "inherit",
                    resize: "none",
                    padding: 0,
                  }}
                />
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: 10,
                  paddingTop: 10,
                  borderTop: "1px solid rgba(236,227,213,0.04)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ display: "flex", gap: 4 }}>
                      {(Object.entries(MOOD_CONFIG) as [JournalEntry["mood"] & string, typeof MOOD_CONFIG["bullish"]][]).map(([key, cfg]) => (
                        <button
                          key={key}
                          onClick={() => setMood(mood === key ? undefined : key)}
                          style={{
                            fontSize: 10,
                            fontFamily: "var(--font-mono)",
                            fontWeight: 600,
                            color: mood === key ? cfg.color : "var(--text-muted)",
                            background: mood === key ? cfg.bg : "transparent",
                            border: `1px solid ${mood === key ? cfg.color + "40" : "rgba(236,227,213,0.08)"}`,
                            borderRadius: 12,
                            padding: "3px 10px",
                            cursor: "pointer",
                            transition: "all 120ms ease",
                          }}
                        >
                          {cfg.label}
                        </button>
                      ))}
                    </div>
                    <span style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "var(--font-mono)", opacity: 0.5 }}>
                      Cmd+Enter to save
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={() => { setComposing(false); setText(""); setMood(undefined); }}
                      style={{
                        fontSize: 10,
                        fontFamily: "var(--font-mono)",
                        fontWeight: 600,
                        color: "var(--text-muted)",
                        background: "transparent",
                        border: "1px solid rgba(236,227,213,0.08)",
                        borderRadius: 12,
                        padding: "4px 12px",
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={!text.trim()}
                      style={{
                        fontSize: 10,
                        fontFamily: "var(--font-mono)",
                        fontWeight: 700,
                        color: text.trim() ? "var(--bg)" : "var(--text-disabled)",
                        background: text.trim() ? "var(--accent)" : "rgba(236,227,213,0.06)",
                        border: "none",
                        borderRadius: 12,
                        padding: "4px 14px",
                        cursor: text.trim() ? "pointer" : "default",
                        transition: "all 150ms ease",
                      }}
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Notes grouped by date */}
        {Object.keys(grouped).length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            style={{
              textAlign: "center",
              padding: "60px 20px",
              color: "var(--text-muted)",
            }}
          >
            <div style={{ fontSize: 13, marginBottom: 6 }}>
              {entries.length === 0 ? "No notes yet" : "No notes match your filters"}
            </div>
            <div style={{ fontSize: 11, fontFamily: "var(--font-mono)" }}>
              {entries.length === 0
                ? "Capture thoughts, trade ideas, and market observations"
                : "Try adjusting your search or mood filter"}
            </div>
          </motion.div>
        ) : (
          Object.entries(grouped).map(([day, dayEntries], gi) => (
            <motion.div
              key={day}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: EASE_EXPO, delay: gi * 0.06 }}
              style={{ marginBottom: 24 }}
            >
              {/* Date header */}
              <div style={{
                fontSize: 10,
                fontFamily: "var(--font-mono)",
                fontWeight: 600,
                color: "var(--text-muted)",
                letterSpacing: "0.04em",
                marginBottom: 10,
                paddingBottom: 6,
                borderBottom: "1px solid rgba(236,227,213,0.04)",
              }}>
                {day}
              </div>

              {/* Notes grid for this day */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: 10,
              }}>
                {dayEntries.map((entry, i) => {
                  const accent = NOTE_ACCENTS[(gi * 3 + i) % NOTE_ACCENTS.length];
                  const isJustSaved = entry.id === savedFlash;
                  return (
                    <motion.div
                      key={entry.id}
                      layout
                      initial={isJustSaved ? { opacity: 0, scale: 0.9 } : { opacity: 0, y: 6 }}
                      animate={isJustSaved
                        ? { opacity: 1, scale: [0.9, 1.03, 1] }
                        : { opacity: 1, y: 0 }
                      }
                      transition={{ duration: isJustSaved ? 0.5 : 0.25, ease: EASE_EXPO, delay: isJustSaved ? 0 : i * 0.04 }}
                      className="jp-note-tile"
                      style={{
                        borderRadius: 12,
                        background: "var(--bg-raised)",
                        border: isJustSaved ? "1px solid var(--buy)" : "1px solid rgba(236,227,213,0.06)",
                        borderLeft: `3px solid ${accent}`,
                        padding: 14,
                        position: "relative",
                        boxShadow: isJustSaved ? "0 0 12px rgba(34,171,148,0.15)" : "none",
                        transition: "border-color 300ms ease, box-shadow 300ms ease",
                      }}
                    >
                      {/* Delete */}
                      <button
                        onClick={() => handleDelete(entry.id)}
                        className="jp-note-delete"
                        style={{
                          position: "absolute",
                          top: 8,
                          right: 8,
                          width: 20,
                          height: 20,
                          borderRadius: 6,
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          opacity: 0,
                          transition: "opacity 120ms ease, background 120ms ease",
                        }}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>

                      {/* Meta */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                        <span style={{
                          fontSize: 9,
                          fontFamily: "var(--font-mono)",
                          color: "var(--text-muted)",
                          fontVariantNumeric: "tabular-nums",
                        }}>
                          {relativeTime(entry.date)}
                        </span>
                        {entry.mood && (
                          <span style={{
                            fontSize: 8,
                            fontFamily: "var(--font-mono)",
                            fontWeight: 700,
                            color: MOOD_CONFIG[entry.mood].color,
                            background: MOOD_CONFIG[entry.mood].bg,
                            padding: "1px 5px",
                            borderRadius: 6,
                          }}>
                            {MOOD_CONFIG[entry.mood].label}
                          </span>
                        )}
                      </div>

                      {/* Full text (no clamp on full page) */}
                      <div style={{
                        fontSize: 12,
                        color: "var(--text-secondary)",
                        lineHeight: 1.6,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}>
                        {entry.text}
                      </div>

                      {/* Timestamp on hover */}
                      <div style={{
                        fontSize: 8,
                        fontFamily: "var(--font-mono)",
                        color: "var(--text-muted)",
                        marginTop: 8,
                        opacity: 0.4,
                      }}>
                        {formatDate(entry.date)}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          ))
        )}
      </div>

      <style>{`
        .jp-note-tile {
          transition: transform 180ms cubic-bezier(0.16,1,0.3,1), border-color 180ms ease, box-shadow 180ms ease;
        }
        .jp-note-tile:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(15,12,8,0.25) !important;
        }
        .jp-note-tile:hover .jp-note-delete {
          opacity: 0.5 !important;
        }
        .jp-note-delete:hover {
          opacity: 1 !important;
          background: rgba(229,77,77,0.12) !important;
        }
      `}</style>
    </div>
  );
}
