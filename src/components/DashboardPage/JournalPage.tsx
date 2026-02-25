"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  OUTCOME_CONFIG,
  MMXM_OPTIONS,
  SETUP_TAG_OPTIONS,
  EMOTION_TAG_OPTIONS,
  EMOTION_TAG_COLORS,
  getMarketColor,
  calcRR,
  formatShortDate,
  formatFullDate,
  computeJournalStats,
} from "@/lib/journal-constants";

// ─── Types ───

interface JournalComment {
  id: string;
  text: string;
  date: string;
}

interface JournalEntry {
  id: string;
  date: string;
  title: string;
  market?: string;
  outcome?: "win" | "loss" | "breakeven" | "";
  mmxm?: string;
  tradeBreakdown?: string;
  risk?: number | null;
  returnVal?: number | null;
  body: string;
  comments: JournalComment[];
  mood?: "bullish" | "bearish" | "neutral";
  setupTags?: string[];
  emotionTags?: string[];
  screenshots?: string[];
  // Legacy compat
  text?: string;
}

interface JournalPageProps {
  onBack: () => void;
}

// ─── Constants ───

const STORAGE_KEY = "afindr_journal";
const EASE_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

// ─── Helpers ───

function loadEntries(): JournalEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((e: JournalEntry & { text?: string }) => ({
      ...e,
      title: e.title || "",
      body: e.body || e.text || "",
      comments: e.comments || [],
      market: e.market || "",
      outcome: e.outcome || "",
      mmxm: e.mmxm || "",
      tradeBreakdown: e.tradeBreakdown || "",
      risk: e.risk ?? null,
      returnVal: e.returnVal ?? null,
      setupTags: e.setupTags || [],
      emotionTags: e.emotionTags || [],
      screenshots: e.screenshots || [],
    }));
  } catch {
    return [];
  }
}

function saveEntries(entries: JournalEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

// ─── Stagger animation variants ───

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.35, ease: EASE_EXPO },
  }),
};

// ─── Glass Card Wrapper ───

function JournalCard({
  icon,
  title,
  badge,
  children,
  index = 0,
}: {
  icon: React.ReactNode;
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  index?: number;
}) {
  return (
    <motion.div
      custom={index}
      initial="hidden"
      animate="visible"
      variants={cardVariants}
      style={{
        background: "rgba(236,227,213,0.02)",
        border: "1px solid rgba(236,227,213,0.06)",
        borderRadius: 12,
        padding: "16px 20px",
        marginBottom: 12,
      }}
    >
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 14,
      }}>
        <span style={{ display: "flex", alignItems: "center", color: "var(--text-muted)" }}>
          {icon}
        </span>
        <span style={{
          fontSize: 12,
          fontWeight: 700,
          fontFamily: "var(--font-mono)",
          color: "var(--text-secondary)",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}>
          {title}
        </span>
        {badge && <span style={{ marginLeft: "auto" }}>{badge}</span>}
      </div>
      {children}
    </motion.div>
  );
}

// ─── Property Row ───

function PropertyRow({
  icon,
  label,
  value,
  muted,
  mono,
  highlight,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  muted?: boolean;
  mono?: boolean;
  highlight?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="jrnl-prop-row"
      style={{
        display: "flex",
        alignItems: "center",
        padding: "9px 8px",
        borderRadius: 6,
        transition: "background 80ms ease",
        gap: 0,
      }}
    >
      <div style={{
        display: "flex", alignItems: "center", gap: 8, width: 150, flexShrink: 0,
      }}>
        <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 18, color: "var(--text-muted)" }}>
          {icon}
        </span>
        <span style={{
          fontSize: 13, color: "var(--text-muted)", fontFamily: "inherit",
        }}>
          {label}
        </span>
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
        {children || (
          <span style={{
            fontSize: 13,
            color: highlight || (muted ? "var(--text-muted)" : "var(--text-primary)"),
            fontFamily: mono ? "var(--font-mono)" : "inherit",
            fontWeight: mono ? 600 : 400,
          }}>
            {value || "Empty"}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Tag Pill ───

function TagPill({
  label,
  active,
  color,
  bg,
  onClick,
}: {
  label: string;
  active: boolean;
  color?: string;
  bg?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="jrnl-tag-pill"
      style={{
        fontSize: 11,
        fontFamily: "var(--font-mono)",
        fontWeight: 600,
        color: active ? (color || "var(--accent)") : "var(--text-muted)",
        background: active ? (bg || "var(--accent-muted)") : "transparent",
        border: `1px solid ${active ? (color ? color + "30" : "var(--accent)30") : "rgba(236,227,213,0.08)"}`,
        borderRadius: 20,
        padding: "4px 12px",
        cursor: "pointer",
        transition: "all 120ms ease",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

// ─── Component ───

export default function JournalPage({ onBack }: JournalPageProps) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const screenshotInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEntries(loadEntries());
  }, []);

  const selected = useMemo(
    () => entries.find((e) => e.id === selectedId) || null,
    [entries, selectedId]
  );

  const stats = useMemo(() => computeJournalStats(entries), [entries]);

  // Auto-select first entry
  useEffect(() => {
    if (!selectedId && entries.length > 0) {
      setSelectedId(entries[0].id);
    }
  }, [entries, selectedId]);

  const persist = useCallback((updated: JournalEntry[]) => {
    setEntries(updated);
    saveEntries(updated);
  }, []);

  const flash = useCallback(() => {
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  }, []);

  const handleNewEntry = useCallback(() => {
    const entry: JournalEntry = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      title: "",
      market: "",
      outcome: "",
      mmxm: "",
      tradeBreakdown: "",
      risk: null,
      returnVal: null,
      body: "",
      comments: [],
      setupTags: [],
      emotionTags: [],
      screenshots: [],
    };
    const updated = [entry, ...entries];
    persist(updated);
    setSelectedId(entry.id);
  }, [entries, persist]);

  const updateEntry = useCallback((id: string, patch: Partial<JournalEntry>) => {
    const updated = entries.map((e) => (e.id === id ? { ...e, ...patch } : e));
    persist(updated);
    flash();
  }, [entries, persist, flash]);

  const handleDelete = useCallback((id: string) => {
    const updated = entries.filter((e) => e.id !== id);
    persist(updated);
    setDeleteConfirm(false);
    if (selectedId === id) {
      setSelectedId(updated.length > 0 ? updated[0].id : null);
    }
  }, [entries, selectedId, persist]);

  const handleAddComment = useCallback((entryId: string, text: string) => {
    if (!text.trim()) return;
    const comment: JournalComment = {
      id: crypto.randomUUID(),
      text: text.trim(),
      date: new Date().toISOString(),
    };
    const updated = entries.map((e) =>
      e.id === entryId ? { ...e, comments: [...e.comments, comment] } : e
    );
    persist(updated);
  }, [entries, persist]);

  const toggleTag = useCallback((id: string, field: "setupTags" | "emotionTags", tag: string) => {
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;
    const current = entry[field] || [];
    const next = current.includes(tag)
      ? current.filter((t) => t !== tag)
      : [...current, tag];
    updateEntry(id, { [field]: next });
  }, [entries, updateEntry]);

  const handleAddScreenshot = useCallback((id: string) => {
    const input = screenshotInputRef.current;
    if (!input) return;
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        const entry = entries.find((en) => en.id === id);
        if (!entry) return;
        const screenshots = [...(entry.screenshots || []), base64];
        updateEntry(id, { screenshots });
      };
      reader.readAsDataURL(file);
      input.value = "";
    };
    input.click();
  }, [entries, updateEntry]);

  const handleRemoveScreenshot = useCallback((id: string, idx: number) => {
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;
    const screenshots = (entry.screenshots || []).filter((_, i) => i !== idx);
    updateEntry(id, { screenshots });
  }, [entries, updateEntry]);

  // Reset delete confirm when switching entries
  useEffect(() => {
    setDeleteConfirm(false);
  }, [selectedId]);

  // ─── Render ───

  return (
    <div className="flex-1 overflow-hidden flex" style={{ background: "var(--bg)" }}>
      {/* Hidden file input for screenshots */}
      <input ref={screenshotInputRef} type="file" accept="image/*" style={{ display: "none" }} />

      {/* ─── Sidebar ─── */}
      <motion.div
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, ease: EASE_EXPO }}
        style={{
          width: 210,
          flexShrink: 0,
          borderRight: "1px solid rgba(236,227,213,0.06)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Sidebar header */}
        <div style={{
          padding: "14px 14px 10px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          borderBottom: "1px solid rgba(236,227,213,0.04)",
        }}>
          <button
            onClick={onBack}
            style={{
              width: 24, height: 24, borderRadius: 6,
              background: "transparent", border: "none",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}
            className="jrnl-sidebar-btn"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span style={{
            fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 700,
            color: "var(--text-secondary)", letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}>
            Journal
          </span>
          {entries.length > 0 && (
            <span style={{
              fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 600,
              color: "var(--text-muted)", background: "rgba(236,227,213,0.06)",
              padding: "1px 7px", borderRadius: 10, marginLeft: "auto",
            }}>
              {entries.length}
            </span>
          )}
        </div>

        {/* New Entry button — promoted accent */}
        <div style={{ padding: "10px 10px 6px" }}>
          <button
            onClick={handleNewEntry}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              width: "100%",
              padding: "8px 12px",
              borderRadius: 8,
              border: "none",
              background: "var(--accent)",
              cursor: "pointer",
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              fontWeight: 700,
              color: "var(--bg)",
              transition: "opacity 120ms ease",
            }}
            className="jrnl-new-btn"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--bg)" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Entry
          </button>
        </div>

        {/* Entry list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "4px 8px" }}>
          {entries.map((entry) => {
            const isActive = entry.id === selectedId;
            const market = entry.market || "—";
            const oc = entry.outcome ? OUTCOME_CONFIG[entry.outcome as keyof typeof OUTCOME_CONFIG] : null;
            const rr = calcRR(entry.risk, entry.returnVal);
            const pnl = (entry.returnVal ?? 0) - (entry.risk ?? 0);
            return (
              <button
                key={entry.id}
                onClick={() => setSelectedId(entry.id)}
                className="jrnl-sidebar-entry"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  width: "100%",
                  padding: "8px 10px",
                  marginBottom: 2,
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  background: isActive ? "rgba(236,227,213,0.06)" : "transparent",
                  borderLeft: isActive ? "2px solid var(--accent)" : "2px solid transparent",
                  transition: "all 100ms ease",
                  textAlign: "left",
                }}
              >
                {/* Row 1: outcome dot + market + date */}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {oc && (
                    <span style={{
                      width: 6, height: 6, borderRadius: "50%",
                      background: oc.color, flexShrink: 0,
                    }} />
                  )}
                  <span style={{
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                    fontWeight: 700,
                    color: market !== "—" ? "var(--text-primary)" : "var(--text-muted)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}>
                    {market.toUpperCase().slice(0, 6)}
                  </span>
                  <span style={{
                    fontSize: 9,
                    fontFamily: "var(--font-mono)",
                    color: "var(--text-muted)",
                    marginLeft: "auto",
                    whiteSpace: "nowrap",
                  }}>
                    {formatShortDate(entry.date)}
                  </span>
                </div>
                {/* Row 2: P&L + RR + outcome badge */}
                {(entry.outcome || entry.risk != null || entry.returnVal != null) && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {pnl !== 0 && (
                      <span style={{
                        fontSize: 10,
                        fontFamily: "var(--font-mono)",
                        fontWeight: 600,
                        color: pnl >= 0 ? "var(--buy)" : "var(--sell)",
                      }}>
                        {pnl >= 0 ? "+" : ""}{pnl.toFixed(0)}
                      </span>
                    )}
                    {rr !== "0" && (
                      <span style={{
                        fontSize: 9,
                        fontFamily: "var(--font-mono)",
                        color: "var(--text-muted)",
                      }}>
                        {rr}R
                      </span>
                    )}
                    {oc && (
                      <span style={{
                        fontSize: 9,
                        fontFamily: "var(--font-mono)",
                        fontWeight: 600,
                        color: oc.color,
                        background: oc.bg,
                        padding: "1px 6px",
                        borderRadius: 4,
                        marginLeft: "auto",
                      }}>
                        {oc.label}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* ─── Main Content ─── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35, ease: EASE_EXPO, delay: 0.05 }}
        style={{ flex: 1, overflowY: "auto", padding: "20px 32px 48px" }}
      >
        {/* ─── Stats Bar ─── */}
        {entries.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: EASE_EXPO }}
            style={{
              display: "flex",
              gap: 0,
              marginBottom: 24,
              background: "rgba(236,227,213,0.02)",
              border: "1px solid rgba(236,227,213,0.06)",
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
            {[
              { label: "Total", value: String(stats.total), color: "var(--text-primary)" },
              { label: "Win Rate", value: `${stats.winRate.toFixed(0)}%`, color: stats.winRate >= 50 ? "var(--buy)" : "var(--sell)" },
              { label: "W / L", value: `${stats.wins} / ${stats.losses}`, color: "var(--text-secondary)" },
              { label: "Avg RR", value: stats.avgRR.toFixed(2), color: stats.avgRR >= 1 ? "var(--buy)" : "var(--text-secondary)" },
              { label: "Net P&L", value: `${stats.totalPnl >= 0 ? "+" : ""}${stats.totalPnl.toFixed(0)}`, color: stats.totalPnl >= 0 ? "var(--buy)" : "var(--sell)" },
            ].map((cell, i) => (
              <div
                key={cell.label}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  textAlign: "center",
                  borderRight: i < 4 ? "1px solid rgba(236,227,213,0.06)" : "none",
                }}
              >
                <div style={{
                  fontSize: 9,
                  fontFamily: "var(--font-mono)",
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  marginBottom: 4,
                }}>
                  {cell.label}
                </div>
                <div style={{
                  fontSize: 16,
                  fontFamily: "var(--font-mono)",
                  fontWeight: 700,
                  color: cell.color,
                  fontVariantNumeric: "tabular-nums",
                }}>
                  {cell.value}
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {selected ? (
          <div style={{ maxWidth: 700 }}>
            {/* Saved indicator */}
            <AnimatePresence>
              {savedFlash && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{
                    position: "fixed", top: 16, right: 24, zIndex: 50,
                    fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 600,
                    color: "var(--buy)", background: "var(--buy-muted)",
                    padding: "4px 12px", borderRadius: 8,
                    display: "flex", alignItems: "center", gap: 4,
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--buy)" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                  Saved
                </motion.div>
              )}
            </AnimatePresence>

            {/* ─── Card 1: Header ─── */}
            <JournalCard
              index={0}
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>}
              title="Entry"
              badge={
                <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                  {formatShortDate(selected.date)}
                </span>
              }
            >
              <div style={{ marginBottom: 12 }}>
                <input
                  value={selected.title}
                  onChange={(e) => updateEntry(selected.id, { title: e.target.value })}
                  placeholder="Entry title..."
                  style={{
                    width: "100%",
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    fontSize: 24,
                    fontWeight: 700,
                    color: selected.title ? "var(--text-primary)" : "var(--text-muted)",
                    lineHeight: 1.3,
                    padding: 0,
                    fontFamily: "inherit",
                  }}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                  {formatFullDate(selected.date)}
                </span>
                {selected.outcome && (() => {
                  const oc = OUTCOME_CONFIG[selected.outcome as keyof typeof OUTCOME_CONFIG];
                  return (
                    <span style={{
                      fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 700,
                      color: oc.color, background: oc.bg,
                      padding: "2px 8px", borderRadius: 6,
                    }}>
                      {oc.label}
                    </span>
                  );
                })()}
                {selected.market && (
                  <span style={{
                    fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 700,
                    color: "#fff", background: getMarketColor(selected.market),
                    padding: "2px 8px", borderRadius: 6,
                  }}>
                    {selected.market}
                  </span>
                )}
              </div>
            </JournalCard>

            {/* ─── Card 2: Trade Details ─── */}
            <JournalCard
              index={1}
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>}
              title="Trade Details"
              badge={
                calcRR(selected.risk, selected.returnVal) !== "0" ? (
                  <span style={{
                    fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 700,
                    color: "var(--accent)", background: "var(--accent-muted)",
                    padding: "2px 8px", borderRadius: 6,
                  }}>
                    {calcRR(selected.risk, selected.returnVal)}R
                  </span>
                ) : undefined
              }
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
                {/* Market */}
                <PropertyRow
                  icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>}
                  label="Market"
                >
                  <input
                    value={selected.market || ""}
                    onChange={(e) => updateEntry(selected.id, { market: e.target.value.toUpperCase() })}
                    placeholder="Empty"
                    style={{
                      background: "transparent", border: "none", outline: "none",
                      fontSize: 13, color: selected.market ? "var(--text-primary)" : "var(--text-muted)",
                      fontFamily: "var(--font-mono)", padding: 0, width: "100%",
                    }}
                  />
                </PropertyRow>

                {/* Outcome */}
                <PropertyRow
                  icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><polyline points="8 12 11 15 16 9" /></svg>}
                  label="Outcome"
                >
                  <div style={{ display: "flex", gap: 4 }}>
                    {(["win", "loss", "breakeven"] as const).map((o) => {
                      const active = selected.outcome === o;
                      const cfg = OUTCOME_CONFIG[o];
                      return (
                        <button
                          key={o}
                          onClick={() => updateEntry(selected.id, { outcome: active ? "" : o })}
                          style={{
                            fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 600,
                            color: active ? cfg.color : "var(--text-muted)",
                            background: active ? cfg.bg : "transparent",
                            border: `1px solid ${active ? cfg.color + "40" : "rgba(236,227,213,0.08)"}`,
                            borderRadius: 6, padding: "2px 8px", cursor: "pointer",
                            transition: "all 100ms ease",
                          }}
                        >
                          {cfg.label}
                        </button>
                      );
                    })}
                  </div>
                </PropertyRow>

                {/* MMXM */}
                <PropertyRow
                  icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>}
                  label="MMXM"
                >
                  <select
                    value={selected.mmxm || ""}
                    onChange={(e) => updateEntry(selected.id, { mmxm: e.target.value })}
                    style={{
                      background: "transparent", border: "none", outline: "none",
                      fontSize: 13, color: selected.mmxm ? "var(--text-primary)" : "var(--text-muted)",
                      fontFamily: "var(--font-mono)", padding: 0, cursor: "pointer",
                      appearance: "none", width: "100%",
                    }}
                  >
                    <option value="" style={{ background: "var(--bg-raised)", color: "var(--text-muted)" }}>Empty</option>
                    {MMXM_OPTIONS.map((opt) => (
                      <option key={opt} value={opt} style={{ background: "var(--bg-raised)", color: "var(--text-primary)" }}>{opt}</option>
                    ))}
                  </select>
                </PropertyRow>

                {/* Trade Breakdown */}
                <PropertyRow
                  icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>}
                  label="Breakdown"
                >
                  <input
                    value={selected.tradeBreakdown || ""}
                    onChange={(e) => updateEntry(selected.id, { tradeBreakdown: e.target.value })}
                    placeholder="Empty"
                    style={{
                      background: "transparent", border: "none", outline: "none",
                      fontSize: 13, color: selected.tradeBreakdown ? "var(--text-primary)" : "var(--text-muted)",
                      fontFamily: "var(--font-mono)", padding: 0, width: "100%",
                    }}
                  />
                </PropertyRow>

                {/* Risk */}
                <PropertyRow
                  icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>}
                  label="Risk"
                >
                  <input
                    type="number"
                    value={selected.risk ?? ""}
                    onChange={(e) => updateEntry(selected.id, { risk: e.target.value ? Number(e.target.value) : null })}
                    placeholder="Empty"
                    style={{
                      background: "transparent", border: "none", outline: "none",
                      fontSize: 13, color: selected.risk != null ? "var(--sell)" : "var(--text-muted)",
                      fontFamily: "var(--font-mono)", padding: 0, width: 100,
                    }}
                  />
                </PropertyRow>

                {/* Return */}
                <PropertyRow
                  icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>}
                  label="Return"
                >
                  <input
                    type="number"
                    value={selected.returnVal ?? ""}
                    onChange={(e) => updateEntry(selected.id, { returnVal: e.target.value ? Number(e.target.value) : null })}
                    placeholder="Empty"
                    style={{
                      background: "transparent", border: "none", outline: "none",
                      fontSize: 13, color: selected.returnVal != null ? "var(--buy)" : "var(--text-muted)",
                      fontFamily: "var(--font-mono)", padding: 0, width: 100,
                    }}
                  />
                </PropertyRow>

                {/* RR (computed) */}
                <PropertyRow
                  icon={<span style={{ fontSize: 12, fontFamily: "var(--font-mono)", fontWeight: 700 }}>R</span>}
                  label="RR"
                  value={calcRR(selected.risk, selected.returnVal)}
                  mono
                  highlight={Number(calcRR(selected.risk, selected.returnVal)) >= 1 ? "var(--buy)" : undefined}
                />
              </div>
            </JournalCard>

            {/* ─── Card 3: Setup & Psychology ─── */}
            <JournalCard
              index={2}
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" /></svg>}
              title="Setup & Psychology"
            >
              {/* Setup Tags */}
              <div style={{ marginBottom: 16 }}>
                <div style={{
                  fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 600,
                  color: "var(--text-muted)", letterSpacing: "0.04em",
                  marginBottom: 8, textTransform: "uppercase",
                }}>
                  Setups
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {SETUP_TAG_OPTIONS.map((tag) => (
                    <TagPill
                      key={tag}
                      label={tag}
                      active={(selected.setupTags || []).includes(tag)}
                      onClick={() => toggleTag(selected.id, "setupTags", tag)}
                    />
                  ))}
                </div>
              </div>

              {/* Emotion Tags */}
              <div>
                <div style={{
                  fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 600,
                  color: "var(--text-muted)", letterSpacing: "0.04em",
                  marginBottom: 8, textTransform: "uppercase",
                }}>
                  Emotions
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {EMOTION_TAG_OPTIONS.map((tag) => {
                    const ec = EMOTION_TAG_COLORS[tag];
                    return (
                      <TagPill
                        key={tag}
                        label={tag}
                        active={(selected.emotionTags || []).includes(tag)}
                        color={ec?.color}
                        bg={ec?.bg}
                        onClick={() => toggleTag(selected.id, "emotionTags", tag)}
                      />
                    );
                  })}
                </div>
              </div>
            </JournalCard>

            {/* ─── Card 4: Screenshots ─── */}
            <JournalCard
              index={3}
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>}
              title="Screenshots"
              badge={
                <button
                  onClick={() => handleAddScreenshot(selected.id)}
                  className="jrnl-sidebar-btn"
                  style={{
                    fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 600,
                    color: "var(--accent)", background: "var(--accent-muted)",
                    border: "none", borderRadius: 6, padding: "2px 10px",
                    cursor: "pointer", transition: "opacity 120ms ease",
                    display: "flex", alignItems: "center", gap: 4,
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Add
                </button>
              }
            >
              {(selected.screenshots || []).length > 0 ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 8 }}>
                  {(selected.screenshots || []).map((src, i) => (
                    <div
                      key={i}
                      style={{
                        position: "relative",
                        borderRadius: 8,
                        overflow: "hidden",
                        border: "1px solid rgba(236,227,213,0.08)",
                        aspectRatio: "4/3",
                      }}
                    >
                      <img
                        src={src}
                        alt={`Screenshot ${i + 1}`}
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      />
                      <button
                        onClick={() => handleRemoveScreenshot(selected.id, i)}
                        className="jrnl-screenshot-delete"
                        style={{
                          position: "absolute", top: 4, right: 4,
                          width: 20, height: 20, borderRadius: "50%",
                          background: "rgba(0,0,0,0.6)", border: "none",
                          cursor: "pointer", display: "flex",
                          alignItems: "center", justifyContent: "center",
                          opacity: 0, transition: "opacity 120ms ease",
                        }}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  onClick={() => handleAddScreenshot(selected.id)}
                  style={{
                    padding: "20px",
                    textAlign: "center",
                    color: "var(--text-muted)",
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                    cursor: "pointer",
                    border: "1px dashed rgba(236,227,213,0.1)",
                    borderRadius: 8,
                    transition: "border-color 120ms ease",
                  }}
                  className="jrnl-screenshot-empty"
                >
                  Click to add screenshots
                </div>
              )}
            </JournalCard>

            {/* ─── Card 5: Notes ─── */}
            <JournalCard
              index={4}
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>}
              title="Notes"
            >
              <textarea
                ref={bodyRef}
                value={selected.body}
                onChange={(e) => updateEntry(selected.id, { body: e.target.value })}
                placeholder="Write your trade notes here..."
                className="jrnl-notes-textarea"
                style={{
                  width: "100%",
                  minHeight: 140,
                  background: "transparent",
                  border: "1px solid rgba(236,227,213,0.06)",
                  borderRadius: 8,
                  outline: "none",
                  color: "var(--text-secondary)",
                  fontSize: 13,
                  lineHeight: 1.7,
                  fontFamily: "inherit",
                  resize: "vertical",
                  padding: "12px 14px",
                  transition: "border-color 200ms ease, box-shadow 200ms ease",
                }}
              />
            </JournalCard>

            {/* ─── Card 6: Comments ─── */}
            <JournalCard
              index={5}
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>}
              title="Comments"
              badge={
                selected.comments.length > 0 ? (
                  <span style={{
                    fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 600,
                    color: "var(--text-muted)", background: "rgba(236,227,213,0.06)",
                    padding: "1px 7px", borderRadius: 10,
                  }}>
                    {selected.comments.length}
                  </span>
                ) : undefined
              }
            >
              <CommentsSection
                comments={selected.comments}
                onAdd={(text) => handleAddComment(selected.id, text)}
              />
            </JournalCard>

            {/* ─── Delete Entry Footer ─── */}
            <motion.div
              custom={6}
              initial="hidden"
              animate="visible"
              variants={cardVariants}
              style={{
                marginTop: 8,
                paddingTop: 16,
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              {deleteConfirm ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                    Delete this entry?
                  </span>
                  <button
                    onClick={() => handleDelete(selected.id)}
                    style={{
                      fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 700,
                      color: "#fff", background: "var(--sell)",
                      border: "none", borderRadius: 6,
                      padding: "5px 14px", cursor: "pointer",
                    }}
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(false)}
                    style={{
                      fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 600,
                      color: "var(--text-muted)", background: "transparent",
                      border: "1px solid rgba(236,227,213,0.08)", borderRadius: 6,
                      padding: "4px 12px", cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setDeleteConfirm(true)}
                  className="jrnl-delete-btn"
                  style={{
                    fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 600,
                    color: "var(--text-muted)", background: "transparent",
                    border: "1px solid rgba(236,227,213,0.08)", borderRadius: 8,
                    padding: "5px 12px", cursor: "pointer", transition: "all 120ms ease",
                  }}
                >
                  Delete Entry
                </button>
              )}
            </motion.div>
          </div>
        ) : (
          /* ─── Empty state ─── */
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", height: "100%", color: "var(--text-muted)",
          }}>
            <div style={{ fontSize: 14, marginBottom: 8 }}>No entries yet</div>
            <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", marginBottom: 16 }}>
              Start logging your trades
            </div>
            <button
              onClick={handleNewEntry}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 16px", borderRadius: 10,
                background: "var(--accent)", border: "none", cursor: "pointer",
                fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 700,
                color: "var(--bg)",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--bg)" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New Entry
            </button>
          </div>
        )}
      </motion.div>

      <style>{`
        .jrnl-sidebar-entry:hover {
          background: rgba(236,227,213,0.04) !important;
        }
        .jrnl-sidebar-btn:hover {
          background: rgba(236,227,213,0.06) !important;
          color: var(--text-secondary) !important;
        }
        .jrnl-new-btn:hover {
          opacity: 0.85 !important;
        }
        .jrnl-prop-row:hover {
          background: rgba(236,227,213,0.02);
        }
        .jrnl-tag-pill:hover {
          border-color: rgba(236,227,213,0.2) !important;
          transform: scale(1.02);
        }
        .jrnl-tag-pill:active {
          transform: scale(0.97);
        }
        .jrnl-delete-btn:hover {
          color: var(--sell) !important;
          border-color: var(--sell) !important;
          background: var(--sell-muted) !important;
        }
        .jrnl-notes-textarea:focus {
          border-color: rgba(236,227,213,0.15) !important;
          box-shadow: 0 0 0 2px rgba(236,227,213,0.04) !important;
        }
        .jrnl-screenshot-empty:hover {
          border-color: rgba(236,227,213,0.2) !important;
        }
        .jrnl-screenshot-delete {
          opacity: 0 !important;
        }
        div:hover > .jrnl-screenshot-delete {
          opacity: 1 !important;
        }
        select option {
          background: var(--bg-raised);
        }
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type="number"] {
          -moz-appearance: textfield;
        }
      `}</style>
    </div>
  );
}

// ─── Sub-components ───

function CommentsSection({
  comments,
  onAdd,
}: {
  comments: JournalComment[];
  onAdd: (text: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      {/* Existing comments */}
      {comments.map((c) => (
        <div key={c.id} style={{
          display: "flex", gap: 8, marginBottom: 10, alignItems: "flex-start",
        }}>
          <div style={{
            width: 24, height: 24, borderRadius: "50%",
            background: "var(--accent-muted)", display: "flex",
            alignItems: "center", justifyContent: "center", flexShrink: 0,
            fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 700,
            color: "var(--accent)",
          }}>
            S
          </div>
          <div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
              {c.text}
            </div>
            <div style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-muted)", marginTop: 2 }}>
              {formatShortDate(c.date)}
            </div>
          </div>
        </div>
      ))}

      {/* Add comment */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <div style={{
          width: 24, height: 24, borderRadius: "50%",
          background: "var(--accent-muted)", display: "flex",
          alignItems: "center", justifyContent: "center", flexShrink: 0,
          fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 700,
          color: "var(--accent)",
        }}>
          S
        </div>
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) {
              onAdd(draft);
              setDraft("");
            }
          }}
          placeholder="Add a comment..."
          style={{
            flex: 1, background: "transparent", border: "none", outline: "none",
            fontSize: 12, color: "var(--text-primary)", fontFamily: "inherit",
            padding: "4px 0", borderBottom: "1px solid rgba(236,227,213,0.06)",
          }}
        />
      </div>
    </div>
  );
}
