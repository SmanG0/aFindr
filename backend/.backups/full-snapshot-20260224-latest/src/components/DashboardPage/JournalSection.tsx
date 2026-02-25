"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, animate, PanInfo } from "framer-motion";
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

const MOOD_CONFIG = {
  bullish: { color: "var(--buy)", bg: "var(--buy-muted)", label: "Bullish" },
  bearish: { color: "var(--sell)", bg: "var(--sell-muted)", label: "Bearish" },
  neutral: { color: "var(--text-muted)", bg: "rgba(236,227,213,0.06)", label: "Neutral" },
} as const;

const NOTE_ACCENTS = ["#c47b3a", "#5a9bd4", "#22ab94", "#d4915a", "#7a5c9a"];
const CARD_WIDTH = 320;
const SWIPE_THRESHOLD = 60;

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
  const [savedFlash, setSavedFlash] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dragX = useMotionValue(0);

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
    setActiveIndex(0);
    setSavedFlash(entry.id);
    setTimeout(() => setSavedFlash(null), 2000);
  }, [text, mood, entries]);

  const handleDelete = useCallback((id: string) => {
    const updated = entries.filter((e) => e.id !== id);
    setEntries(updated);
    saveEntries(updated);
    if (activeIndex >= updated.length && activeIndex > 0) {
      setActiveIndex(updated.length - 1);
    }
  }, [entries, activeIndex]);

  // Build the carousel items: [+ New Note] + entries
  const allCards: ({ type: "new" } | { type: "entry"; entry: JournalEntry })[] = [
    { type: "new" },
    ...entries.map((entry) => ({ type: "entry" as const, entry })),
  ];

  const canGoLeft = activeIndex > 0;
  const canGoRight = activeIndex < allCards.length - 1;

  const goTo = useCallback((idx: number) => {
    const clamped = Math.max(0, Math.min(idx, allCards.length - 1));
    setActiveIndex(clamped);
    animate(dragX, 0, { type: "spring", stiffness: 300, damping: 30 });
  }, [allCards.length, dragX]);

  const handleDragEnd = useCallback((_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x < -SWIPE_THRESHOLD && canGoRight) {
      goTo(activeIndex + 1);
    } else if (info.offset.x > SWIPE_THRESHOLD && canGoLeft) {
      goTo(activeIndex - 1);
    } else {
      animate(dragX, 0, { type: "spring", stiffness: 300, damping: 30 });
    }
  }, [activeIndex, canGoLeft, canGoRight, goTo, dragX]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: EASE_EXPO, delay: 0.24 }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <SectionLabel style={{ marginBottom: 0 }}>NOTES</SectionLabel>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <AnimatePresence>
            {savedFlash && (
              <motion.span
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.3, ease: EASE_EXPO }}
                style={{ fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--buy)", display: "flex", alignItems: "center", gap: 4 }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--buy)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                Saved
              </motion.span>
            )}
          </AnimatePresence>
          {entries.length > 0 && (
            <button
              onClick={() => onNavigateToPage?.("journal")}
              className="dashboard-pill-btn"
              style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--accent)", background: "var(--accent-muted)", border: "none", padding: "3px 12px", borderRadius: 16, cursor: "pointer" }}
            >
              View All{entries.length > 1 ? ` (${entries.length})` : ""}
            </button>
          )}
        </div>
      </div>

      {/* Carousel */}
      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", minHeight: composing ? 190 : 160, overflow: "hidden" }}>
        {/* Compose overlay — replaces carousel when active */}
        <AnimatePresence>
          {composing && (
            <motion.div
              key="compose-overlay"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.25, ease: EASE_EXPO }}
              style={{
                width: CARD_WIDTH + 40,
                maxWidth: "90%",
                borderRadius: 14,
                background: "var(--bg-raised)",
                border: "1px solid var(--accent)",
                boxShadow: "0 0 0 1px rgba(196,123,58,0.15), 0 8px 32px rgba(15,12,8,0.4)",
                padding: 14,
                display: "flex",
                flexDirection: "column",
                zIndex: 10,
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
                placeholder="What's on your mind?"
                rows={3}
                style={{ flex: 1, width: "100%", background: "transparent", border: "none", outline: "none", color: "var(--text-primary)", fontSize: 12, lineHeight: 1.6, fontFamily: "inherit", resize: "none", padding: 0 }}
              />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(236,227,213,0.04)" }}>
                <div style={{ display: "flex", gap: 4 }}>
                  {(Object.entries(MOOD_CONFIG) as [JournalEntry["mood"] & string, typeof MOOD_CONFIG["bullish"]][]).map(([key, cfg]) => (
                    <button key={key} onClick={() => setMood(mood === key ? undefined : key)} style={{ fontSize: 9, fontFamily: "var(--font-mono)", fontWeight: 600, color: mood === key ? cfg.color : "var(--text-muted)", background: mood === key ? cfg.bg : "transparent", border: `1px solid ${mood === key ? cfg.color + "40" : "rgba(236,227,213,0.06)"}`, borderRadius: 12, padding: "2px 8px", cursor: "pointer", transition: "all 120ms ease" }}>
                      {cfg.label}
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => { setComposing(false); setText(""); setMood(undefined); }} style={{ fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--text-muted)", background: "transparent", border: "1px solid rgba(236,227,213,0.08)", borderRadius: 12, padding: "3px 10px", cursor: "pointer" }}>Cancel</button>
                  <button onClick={handleSave} disabled={!text.trim()} style={{ fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 700, color: text.trim() ? "var(--bg)" : "var(--text-disabled)", background: text.trim() ? "var(--accent)" : "rgba(236,227,213,0.06)", border: "none", borderRadius: 12, padding: "3px 12px", cursor: text.trim() ? "pointer" : "default", transition: "all 150ms ease" }}>Save</button>
                </div>
              </div>
              <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 4, fontFamily: "var(--font-mono)", opacity: 0.5 }}>Cmd+Enter to save / Esc to cancel</div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Card stack — hidden when composing */}
        {!composing && (
          <motion.div
            style={{ x: dragX, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", width: "100%", height: 150, cursor: "grab" }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.15}
            onDragEnd={handleDragEnd}
            whileTap={{ cursor: "grabbing" }}
          >
            {allCards.map((card, i) => {
              const offset = i - activeIndex;
              // Only render cards within ±2 of active
              if (Math.abs(offset) > 2) return null;

              const isActive = offset === 0;
              const xShift = offset * (CARD_WIDTH * 0.28);
              const rotate = offset * 1.5;
              const scale = isActive ? 1 : 0.93;
              const zIndex = 10 - Math.abs(offset);
              const opacity = isActive ? 1 : Math.abs(offset) === 1 ? 1 : 0.7;

              return (
                <motion.div
                  key={card.type === "new" ? "new-note" : card.entry.id}
                  initial={{
                    x: xShift,
                    rotate,
                    scale,
                    opacity: 0,
                  }}
                  animate={{
                    x: xShift,
                    rotate,
                    scale,
                    opacity,
                  }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  onClick={() => {
                    if (!isActive) goTo(i);
                  }}
                  style={{
                    position: "absolute",
                    width: CARD_WIDTH,
                    zIndex,
                    pointerEvents: isActive ? "auto" : "auto",
                    cursor: isActive ? "default" : "pointer",
                  }}
                >
                  {card.type === "new" ? (
                    /* ─── New Note Card ─── */
                    <div
                      onClick={(e) => { if (isActive) { e.stopPropagation(); setComposing(true); } }}
                      className="journal-slide-card"
                      style={{
                        height: 130,
                        borderRadius: 14,
                        background: isActive
                          ? "rgba(236,227,213,0.04)"
                          : "var(--glass)",
                        backdropFilter: isActive ? "blur(24px) saturate(1.4)" : "none",
                        WebkitBackdropFilter: isActive ? "blur(24px) saturate(1.4)" : "none",
                        border: isActive
                          ? "1px solid rgba(236,227,213,0.1)"
                          : "1.5px dashed rgba(236,227,213,0.12)",
                        boxShadow: isActive
                          ? "inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 32px rgba(0,0,0,0.2)"
                          : "none",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--accent-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                      </div>
                      <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.02em" }}>New Note</span>
                    </div>
                  ) : (
                    /* ─── Entry Card ─── */
                    <NoteCard
                      entry={card.entry}
                      accent={NOTE_ACCENTS[(i - 1) % NOTE_ACCENTS.length]}
                      isJustSaved={card.entry.id === savedFlash}
                      isActive={isActive}
                      onDelete={() => handleDelete(card.entry.id)}
                    />
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>

      {/* Dot indicators */}
      {!composing && allCards.length > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 5, marginTop: 8 }}>
          {allCards.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              style={{
                width: activeIndex === i ? 16 : 6,
                height: 6,
                borderRadius: 3,
                background: activeIndex === i ? "var(--accent)" : "rgba(236,227,213,0.12)",
                border: "none",
                padding: 0,
                cursor: "pointer",
                transition: "all 200ms ease",
              }}
            />
          ))}
        </div>
      )}

      <style>{`
        .journal-slide-card {
          transition: border-color 180ms ease, background 180ms ease;
        }
        .journal-slide-card:hover {
          border-color: rgba(196,123,58,0.3) !important;
          background: rgba(255,245,230,0.04) !important;
        }
        .journal-note-card:hover .journal-note-delete {
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

function NoteCard({
  entry,
  accent,
  isJustSaved,
  isActive,
  onDelete,
}: {
  entry: JournalEntry;
  accent: string;
  isJustSaved: boolean;
  isActive: boolean;
  onDelete: () => void;
}) {
  return (
    <div
      className="journal-note-card"
      style={{
        height: 130,
        borderRadius: 14,
        background: "var(--bg-raised)",
        border: isJustSaved ? "1px solid var(--buy)" : "1px solid rgba(236,227,213,0.06)",
        borderLeft: `3px solid ${accent}`,
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
        boxShadow: isJustSaved ? "0 0 12px rgba(34,171,148,0.15)" : "0 4px 16px rgba(15,12,8,0.2)",
      }}
    >
      {/* Delete button */}
      {isActive && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="journal-note-delete"
          style={{ position: "absolute", top: 6, right: 6, width: 18, height: 18, borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0, transition: "opacity 120ms ease, background 120ms ease" }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      )}

      {/* Meta row */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
          {relativeTime(entry.date)}
        </span>
        {entry.mood && (
          <span style={{ fontSize: 8, fontFamily: "var(--font-mono)", fontWeight: 700, color: MOOD_CONFIG[entry.mood].color, background: MOOD_CONFIG[entry.mood].bg, padding: "1px 5px", borderRadius: 6 }}>
            {MOOD_CONFIG[entry.mood].label}
          </span>
        )}
      </div>

      {/* Note text */}
      <div style={{
        flex: 1, fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.55,
        overflow: "hidden", textOverflow: "ellipsis",
        display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical",
      }}>
        {entry.text}
      </div>
    </div>
  );
}

function SectionLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)",
      fontWeight: 600, letterSpacing: "0.06em", marginBottom: 8, ...style,
    }}>
      {children}
    </div>
  );
}
