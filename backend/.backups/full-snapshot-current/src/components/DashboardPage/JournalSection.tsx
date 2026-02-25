"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { AppPage } from "@/components/PageNav/PageNav";

// ─── Types ───

interface JournalEntry {
  id: string;
  date: string;
  text: string;
  mood?: "bullish" | "bearish" | "neutral";
  tags?: string[];
}

interface JournalSectionProps {
  onNavigateToPage?: (page: AppPage) => void;
}

// ─── Constants ───

const STORAGE_KEY = "afindr_journal";
const EASE_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];
const VISIBLE_NOTES = 5;

const MOOD_CONFIG = {
  bullish: { color: "var(--buy)", bg: "var(--buy-muted)", label: "Bullish" },
  bearish: { color: "var(--sell)", bg: "var(--sell-muted)", label: "Bearish" },
  neutral: { color: "var(--text-muted)", bg: "rgba(236,227,213,0.06)", label: "Neutral" },
} as const;

// Subtle left-border accent per note for sticky-note feel
const NOTE_ACCENTS = ["#c47b3a", "#5a9bd4", "#22ab94", "#d4915a", "#7a5c9a"];

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

export function JournalSection({ onNavigateToPage }: JournalSectionProps) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [composing, setComposing] = useState(false);
  const [text, setText] = useState("");
  const [mood, setMood] = useState<JournalEntry["mood"]>(undefined);
  const [savedFlash, setSavedFlash] = useState<string | null>(null); // id of just-saved note
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setEntries(loadEntries());
  }, []);

  // Auto-focus textarea when compose opens
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

  const visibleEntries = entries.slice(0, VISIBLE_NOTES);
  const hiddenCount = Math.max(0, entries.length - VISIBLE_NOTES);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE_EXPO }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <SectionLabel style={{ marginBottom: 0 }}>TRADING JOURNAL</SectionLabel>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Saved flash indicator */}
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
          {entries.length > 0 && (
            <button
              onClick={() => onNavigateToPage?.("journal")}
              className="dashboard-pill-btn"
              style={{
                fontSize: 10,
                fontFamily: "var(--font-mono)",
                color: "var(--accent)",
                background: "var(--accent-muted)",
                border: "none",
                padding: "3px 12px",
                borderRadius: 16,
                cursor: "pointer",
              }}
            >
              View Notes{hiddenCount > 0 ? ` (${entries.length})` : ""}
            </button>
          )}
        </div>
      </div>

      {/* Notes grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
        gap: 10,
      }}>
        {/* + New Note tile */}
        <AnimatePresence mode="wait">
          {!composing ? (
            <motion.button
              key="add-btn"
              onClick={() => setComposing(true)}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2, ease: EASE_EXPO }}
              className="journal-add-tile"
              style={{
                minHeight: 120,
                borderRadius: 12,
                background: "var(--glass)",
                border: "1.5px dashed rgba(236,227,213,0.12)",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: 16,
                color: "var(--text-muted)",
              }}
            >
              <div style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: "var(--accent-muted)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </div>
              <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 600, letterSpacing: "0.02em" }}>
                New Note
              </span>
            </motion.button>
          ) : (
            <motion.div
              key="compose"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.25, ease: EASE_EXPO }}
              style={{
                minHeight: 120,
                borderRadius: 12,
                background: "var(--bg-raised)",
                border: "1px solid var(--accent)",
                boxShadow: "0 0 0 1px rgba(196,123,58,0.15), 0 4px 20px rgba(15,12,8,0.3)",
                padding: 12,
                display: "flex",
                flexDirection: "column",
                gridColumn: "span 2",
              }}
            >
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSave();
                  if (e.key === "Escape") { setComposing(false); setText(""); setMood(undefined); }
                }}
                placeholder="What's on your mind about the markets?"
                rows={3}
                style={{
                  flex: 1,
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "var(--text-primary)",
                  fontSize: 12,
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
                marginTop: 8,
                paddingTop: 8,
                borderTop: "1px solid rgba(236,227,213,0.04)",
              }}>
                {/* Mood pills */}
                <div style={{ display: "flex", gap: 4 }}>
                  {(Object.entries(MOOD_CONFIG) as [JournalEntry["mood"] & string, typeof MOOD_CONFIG["bullish"]][]).map(([key, cfg]) => (
                    <button
                      key={key}
                      onClick={() => setMood(mood === key ? undefined : key)}
                      style={{
                        fontSize: 9,
                        fontFamily: "var(--font-mono)",
                        fontWeight: 600,
                        color: mood === key ? cfg.color : "var(--text-muted)",
                        background: mood === key ? cfg.bg : "transparent",
                        border: `1px solid ${mood === key ? cfg.color + "40" : "rgba(236,227,213,0.06)"}`,
                        borderRadius: 12,
                        padding: "2px 8px",
                        cursor: "pointer",
                        transition: "all 120ms ease",
                      }}
                    >
                      {cfg.label}
                    </button>
                  ))}
                </div>
                {/* Action buttons */}
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
                      padding: "3px 10px",
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
                      padding: "3px 12px",
                      cursor: text.trim() ? "pointer" : "default",
                      transition: "all 150ms ease",
                    }}
                  >
                    Save
                  </button>
                </div>
              </div>
              <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 4, fontFamily: "var(--font-mono)", opacity: 0.5 }}>
                Cmd+Enter to save / Esc to cancel
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Existing sticky-note tiles */}
        {visibleEntries.map((entry, i) => {
          const accent = NOTE_ACCENTS[i % NOTE_ACCENTS.length];
          const isJustSaved = entry.id === savedFlash;
          return (
            <motion.div
              key={entry.id}
              layout
              initial={isJustSaved ? { opacity: 0, scale: 0.9, y: 10 } : { opacity: 0, y: 8 }}
              animate={isJustSaved
                ? { opacity: 1, scale: [0.9, 1.03, 1], y: 0 }
                : { opacity: 1, y: 0 }
              }
              transition={{ duration: isJustSaved ? 0.5 : 0.3, ease: EASE_EXPO, delay: isJustSaved ? 0 : i * 0.05 }}
              className="journal-note-tile"
              style={{
                minHeight: 120,
                borderRadius: 12,
                background: "var(--bg-raised)",
                border: isJustSaved ? "1px solid var(--buy)" : "1px solid rgba(236,227,213,0.06)",
                borderLeft: `3px solid ${accent}`,
                padding: 12,
                display: "flex",
                flexDirection: "column",
                position: "relative",
                overflow: "hidden",
                boxShadow: isJustSaved ? "0 0 12px rgba(34,171,148,0.15)" : "none",
                transition: "border-color 300ms ease, box-shadow 300ms ease",
              }}
            >
              {/* Delete button (top-right, appears on hover) */}
              <button
                onClick={() => handleDelete(entry.id)}
                className="journal-note-delete"
                style={{
                  position: "absolute",
                  top: 6,
                  right: 6,
                  width: 18,
                  height: 18,
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

              {/* Meta row */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
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

              {/* Note text */}
              <div style={{
                flex: 1,
                fontSize: 11,
                color: "var(--text-secondary)",
                lineHeight: 1.55,
                overflow: "hidden",
                textOverflow: "ellipsis",
                display: "-webkit-box",
                WebkitLineClamp: 4,
                WebkitBoxOrient: "vertical",
              }}>
                {entry.text}
              </div>
            </motion.div>
          );
        })}

        {/* "+N more" tile */}
        {hiddenCount > 0 && (
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: EASE_EXPO, delay: 0.3 }}
            onClick={() => onNavigateToPage?.("journal")}
            className="journal-add-tile"
            style={{
              minHeight: 120,
              borderRadius: 12,
              background: "var(--glass)",
              border: "1px solid rgba(236,227,213,0.06)",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              padding: 16,
              color: "var(--text-muted)",
            }}
          >
            <span style={{ fontSize: 18, fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--text-secondary)" }}>
              +{hiddenCount}
            </span>
            <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", fontWeight: 600 }}>
              more notes
            </span>
          </motion.button>
        )}
      </div>

      {/* Hover styles */}
      <style>{`
        .journal-add-tile {
          transition: border-color 180ms ease, background 180ms ease, transform 180ms cubic-bezier(0.16,1,0.3,1);
        }
        .journal-add-tile:hover {
          border-color: rgba(196,123,58,0.3) !important;
          background: rgba(255,245,230,0.04) !important;
          transform: translateY(-1px);
        }
        .journal-note-tile {
          transition: transform 180ms cubic-bezier(0.16,1,0.3,1), border-color 180ms ease, box-shadow 180ms ease;
        }
        .journal-note-tile:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(15,12,8,0.25) !important;
        }
        .journal-note-tile:hover .journal-note-delete {
          opacity: 0.5 !important;
        }
        .journal-note-delete:hover {
          opacity: 1 !important;
          background: rgba(229,77,77,0.12) !important;
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
