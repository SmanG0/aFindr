"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  OUTCOME_CONFIG,
  MMXM_OPTIONS,
  getMarketColor,
  calcRR,
  formatShortDate,
  formatFullDate,
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
    // Migrate old format entries
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
    }));
  } catch {
    return [];
  }
}

function saveEntries(entries: JournalEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

// ─── Component ───

export default function JournalPage({ onBack }: JournalPageProps) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setEntries(loadEntries());
  }, []);

  const selected = useMemo(
    () => entries.find((e) => e.id === selectedId) || null,
    [entries, selectedId]
  );

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

  // ─── Render ───

  return (
    <div className="flex-1 overflow-hidden flex" style={{ background: "var(--bg)" }}>
      {/* ─── Sidebar ─── */}
      <motion.div
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, ease: EASE_EXPO }}
        style={{
          width: 160,
          flexShrink: 0,
          borderRight: "1px solid rgba(236,227,213,0.06)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Sidebar header */}
        <div style={{
          padding: "14px 12px 10px",
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
            fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 600,
            color: "var(--text-muted)", letterSpacing: "0.04em",
          }}>
            Market
          </span>
        </div>

        {/* Entry list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "6px 8px" }}>
          {entries.map((entry) => {
            const isActive = entry.id === selectedId;
            const market = entry.market || entry.title || "—";
            const color = getMarketColor(market);
            return (
              <button
                key={entry.id}
                onClick={() => setSelectedId(entry.id)}
                className="jrnl-sidebar-entry"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  padding: "7px 8px",
                  marginBottom: 2,
                  borderRadius: 6,
                  border: "none",
                  cursor: "pointer",
                  background: isActive ? "rgba(236,227,213,0.06)" : "transparent",
                  transition: "background 100ms ease",
                }}
              >
                <span style={{
                  fontSize: 10,
                  fontFamily: "var(--font-mono)",
                  fontWeight: 700,
                  color: "#fff",
                  background: color,
                  padding: "2px 6px",
                  borderRadius: 4,
                  minWidth: 28,
                  textAlign: "center",
                  letterSpacing: "0.02em",
                }}>
                  {market.toUpperCase().slice(0, 5) || "—"}
                </span>
                <span style={{
                  fontSize: 9,
                  fontFamily: "var(--font-mono)",
                  color: "var(--text-muted)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}>
                  {formatShortDate(entry.date)}
                </span>
              </button>
            );
          })}

          {/* New entry button at bottom of sidebar */}
          <button
            onClick={handleNewEntry}
            className="jrnl-sidebar-btn"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              width: "100%",
              padding: "8px 8px",
              marginTop: 4,
              borderRadius: 6,
              border: "1px dashed rgba(236,227,213,0.1)",
              background: "transparent",
              cursor: "pointer",
              fontSize: 10,
              fontFamily: "var(--font-mono)",
              fontWeight: 600,
              color: "var(--text-muted)",
              transition: "all 120ms ease",
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Entry
          </button>
        </div>
      </motion.div>

      {/* ─── Main Content ─── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35, ease: EASE_EXPO, delay: 0.05 }}
        style={{ flex: 1, overflowY: "auto", padding: "20px 32px 48px" }}
      >
        {selected ? (
          <div style={{ maxWidth: 680 }}>
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

            {/* Title */}
            <input
              value={selected.title}
              onChange={(e) => updateEntry(selected.id, { title: e.target.value })}
              placeholder="New page"
              style={{
                width: "100%",
                background: "transparent",
                border: "none",
                outline: "none",
                fontSize: 32,
                fontWeight: 700,
                color: selected.title ? "var(--text-primary)" : "var(--text-muted)",
                lineHeight: 1.3,
                marginBottom: 24,
                padding: 0,
                fontFamily: "inherit",
              }}
            />

            {/* ─── Property Rows ─── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 0, marginBottom: 28 }}>
              {/* Date */}
              <PropertyRow
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>}
                label="Date"
                value={formatFullDate(selected.date)}
                muted
              />

              {/* Market */}
              <PropertyRow
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>}
                label="Market"
              >
                <input
                  value={selected.market || ""}
                  onChange={(e) => updateEntry(selected.id, { market: e.target.value.toUpperCase() })}
                  placeholder="Empty"
                  style={{
                    background: "transparent", border: "none", outline: "none",
                    fontSize: 13, color: selected.market ? "var(--text-primary)" : "var(--text-muted)",
                    fontFamily: "var(--font-mono)", padding: 0, width: 200,
                  }}
                />
                {selected.market && (
                  <span style={{
                    fontSize: 9, fontFamily: "var(--font-mono)", fontWeight: 700,
                    color: "#fff", background: getMarketColor(selected.market),
                    padding: "1px 5px", borderRadius: 3, marginLeft: 6,
                  }}>
                    {selected.market}
                  </span>
                )}
              </PropertyRow>

              {/* Outcome */}
              <PropertyRow
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><polyline points="8 12 11 15 16 9" /></svg>}
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
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>}
                label="MMXM"
              >
                <select
                  value={selected.mmxm || ""}
                  onChange={(e) => updateEntry(selected.id, { mmxm: e.target.value })}
                  style={{
                    background: "transparent", border: "none", outline: "none",
                    fontSize: 13, color: selected.mmxm ? "var(--text-primary)" : "var(--text-muted)",
                    fontFamily: "var(--font-mono)", padding: 0, cursor: "pointer",
                    appearance: "none",
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
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>}
                label="Trade Breakdown"
              >
                <input
                  value={selected.tradeBreakdown || ""}
                  onChange={(e) => updateEntry(selected.id, { tradeBreakdown: e.target.value })}
                  placeholder="Empty"
                  style={{
                    background: "transparent", border: "none", outline: "none",
                    fontSize: 13, color: selected.tradeBreakdown ? "var(--text-primary)" : "var(--text-muted)",
                    fontFamily: "var(--font-mono)", padding: 0, flex: 1,
                  }}
                />
              </PropertyRow>

              {/* Risk */}
              <PropertyRow
                icon={<span style={{ fontSize: 13, fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--text-muted)" }}>#</span>}
                label="Risk"
              >
                <input
                  type="number"
                  value={selected.risk ?? ""}
                  onChange={(e) => updateEntry(selected.id, { risk: e.target.value ? Number(e.target.value) : null })}
                  placeholder="Empty"
                  style={{
                    background: "transparent", border: "none", outline: "none",
                    fontSize: 13, color: selected.risk != null ? "var(--text-primary)" : "var(--text-muted)",
                    fontFamily: "var(--font-mono)", padding: 0, width: 120,
                  }}
                />
              </PropertyRow>

              {/* Return */}
              <PropertyRow
                icon={<span style={{ fontSize: 13, fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--text-muted)" }}>#</span>}
                label="Return"
              >
                <input
                  type="number"
                  value={selected.returnVal ?? ""}
                  onChange={(e) => updateEntry(selected.id, { returnVal: e.target.value ? Number(e.target.value) : null })}
                  placeholder="Empty"
                  style={{
                    background: "transparent", border: "none", outline: "none",
                    fontSize: 13, color: selected.returnVal != null ? "var(--text-primary)" : "var(--text-muted)",
                    fontFamily: "var(--font-mono)", padding: 0, width: 120,
                  }}
                />
              </PropertyRow>

              {/* RR (computed) */}
              <PropertyRow
                icon={<span style={{ fontSize: 13, fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--text-muted)" }}>Σ</span>}
                label="RR"
                value={calcRR(selected.risk, selected.returnVal)}
                mono
              />
            </div>

            {/* ─── Divider ─── */}
            <div style={{ height: 1, background: "rgba(236,227,213,0.06)", marginBottom: 20 }} />

            {/* ─── Comments Section ─── */}
            <CommentsSection
              comments={selected.comments}
              onAdd={(text) => handleAddComment(selected.id, text)}
            />

            {/* ─── Divider ─── */}
            <div style={{ height: 1, background: "rgba(236,227,213,0.06)", margin: "20px 0" }} />

            {/* ─── Body ─── */}
            <textarea
              ref={bodyRef}
              value={selected.body}
              onChange={(e) => updateEntry(selected.id, { body: e.target.value })}
              placeholder="Press 'enter' to continue with an empty page, or start typing..."
              style={{
                width: "100%",
                minHeight: 200,
                background: "transparent",
                border: "none",
                outline: "none",
                color: "var(--text-secondary)",
                fontSize: 14,
                lineHeight: 1.7,
                fontFamily: "inherit",
                resize: "none",
                padding: 0,
              }}
            />

            {/* Delete entry */}
            <div style={{ marginTop: 40, paddingTop: 16, borderTop: "1px solid rgba(236,227,213,0.04)" }}>
              <button
                onClick={() => handleDelete(selected.id)}
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
            </div>
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
        .jrnl-prop-row:hover {
          background: rgba(236,227,213,0.02);
        }
        .jrnl-delete-btn:hover {
          color: var(--sell) !important;
          border-color: var(--sell) !important;
          background: var(--sell-muted) !important;
        }
        select option {
          background: var(--bg-raised);
        }
        /* Remove number input spinners */
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

function PropertyRow({
  icon,
  label,
  value,
  muted,
  mono,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  muted?: boolean;
  mono?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="jrnl-prop-row"
      style={{
        display: "flex",
        alignItems: "center",
        padding: "8px 4px",
        borderRadius: 4,
        transition: "background 80ms ease",
        gap: 0,
      }}
    >
      <div style={{
        display: "flex", alignItems: "center", gap: 8, width: 160, flexShrink: 0,
      }}>
        <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 18 }}>
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
            color: muted ? "var(--text-muted)" : "var(--text-primary)",
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
      <div style={{
        fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12,
      }}>
        Comments
      </div>

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
