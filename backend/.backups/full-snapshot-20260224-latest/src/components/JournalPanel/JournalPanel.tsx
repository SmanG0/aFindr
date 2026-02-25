"use client";

import { useState, useCallback, useRef, useMemo, useEffect, type RefObject } from "react";
import { motion } from "framer-motion";
import { toPng } from "html-to-image";
import { useJournal, type JournalEntry } from "@/hooks/useJournal";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
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

interface DraftEntry {
  _id: string;
  date: string;
  title: string;
  market?: string;
  outcome?: "win" | "loss" | "breakeven";
  mmxm?: string;
  tradeBreakdown?: string;
  risk?: number;
  returnVal?: number;
  body: string;
  screenshotIds: Id<"_storage">[];
  commentsJson: string;
}

type DisplayEntry = (JournalEntry | DraftEntry) & { isDraft: boolean };

const PANEL_WIDTH = 380;
const THUMB_MAX = 400; // max px for thumbnail resize

/** Resize an image blob/dataURL to a small thumbnail, returns base64 data URL */
function resizeImage(src: string | Blob): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, THUMB_MAX / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.7));
    };
    img.onerror = () => resolve("");
    if (src instanceof Blob) {
      img.src = URL.createObjectURL(src);
    } else {
      img.src = src;
    }
  });
}

interface JournalPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onExpand: () => void;
  chartContainerRef: RefObject<HTMLDivElement | null>;
}

// ─── Panel ───

export default function JournalPanel({ isOpen, onClose, onExpand, chartContainerRef }: JournalPanelProps) {
  const {
    entries,
    isLoading,
    createEntry,
    updateEntry,
    removeEntry,
    uploadScreenshot,
  } = useJournal();
  void uploadScreenshot; // available for future Convex persistence

  const [selectedId, setSelectedId] = useState<Id<"journalEntries"> | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [draft, setDraft] = useState<DraftEntry | null>(null);
  const [localImages, setLocalImages] = useState<string[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => entries.find((e) => e._id === selectedId) ?? null,
    [entries, selectedId],
  );

  // The active entry is either a persisted Convex entry or a local draft
  const activeEntry: DisplayEntry | null = useMemo(() => {
    if (selected) return { ...selected, isDraft: false };
    if (draft) return { ...draft, isDraft: true };
    return null;
  }, [selected, draft]);

  // Auto-select first entry when entries load
  useEffect(() => {
    if (!selectedId && entries.length > 0 && !isLoading) {
      setSelectedId(entries[0]._id);
    }
  }, [selectedId, entries, isLoading]);

  const currentIndex = useMemo(
    () => (selectedId ? entries.findIndex((e) => e._id === selectedId) : -1),
    [entries, selectedId],
  );

  const comments: JournalComment[] = useMemo(() => {
    if (!activeEntry) return [];
    try {
      return JSON.parse(activeEntry.commentsJson);
    } catch {
      return [];
    }
  }, [activeEntry]);

  const handleNewEntry = useCallback(async () => {
    const id = await createEntry();
    if (id) {
      setDraft(null);
      setSelectedId(id);
    } else {
      // No auth — create a local draft so the form still appears
      setSelectedId(null);
      setDraft({
        _id: `draft-${Date.now()}`,
        date: new Date().toISOString(),
        title: "",
        body: "",
        screenshotIds: [],
        commentsJson: "[]",
      });
    }
  }, [createEntry]);

  const handleUpdate = useCallback(
    (patch: Partial<Omit<JournalEntry, "_id" | "createdAt" | "updatedAt">>) => {
      if (draft) {
        // Update local draft
        setDraft((prev) => prev ? { ...prev, ...patch } : prev);
        return;
      }
      if (!selectedId) return;
      updateEntry(selectedId, patch);
    },
    [selectedId, updateEntry, draft],
  );

  const handleDelete = useCallback(async () => {
    if (draft) {
      setDraft(null);
      return;
    }
    if (!selectedId) return;
    await removeEntry(selectedId);
    const remaining = entries.filter((e) => e._id !== selectedId);
    setSelectedId(remaining.length > 0 ? remaining[0]._id : null);
  }, [selectedId, entries, removeEntry, draft]);

  const handleAddComment = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      const comment: JournalComment = {
        id: crypto.randomUUID(),
        text: text.trim(),
        date: new Date().toISOString(),
      };
      const updated = [...comments, comment];
      const json = JSON.stringify(updated);
      if (draft) {
        setDraft((prev) => prev ? { ...prev, commentsJson: json } : prev);
      } else if (selectedId) {
        updateEntry(selectedId, { commentsJson: json });
      }
    },
    [selectedId, comments, updateEntry, draft],
  );

  /** Add a resized image to the local images list */
  const addLocalImage = useCallback(async (src: string | Blob) => {
    const thumb = await resizeImage(src);
    if (thumb) setLocalImages((prev) => [...prev, thumb]);
  }, []);

  const handleCaptureChart = useCallback(async () => {
    if (!chartContainerRef.current || !activeEntry) return;
    setIsCapturing(true);
    try {
      const dataUrl = await toPng(chartContainerRef.current, {
        cacheBust: true,
        backgroundColor: "#1a1814",
      });
      await addLocalImage(dataUrl);
    } catch (err) {
      console.error("Screenshot capture failed:", err);
    } finally {
      setIsCapturing(false);
    }
  }, [chartContainerRef, activeEntry, addLocalImage]);

  /** Handle paste from clipboard */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (blob) await addLocalImage(blob);
        return;
      }
    }
  }, [addLocalImage]);

  /** Handle drag & drop */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer?.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      if (file.type.startsWith("image/")) {
        await addLocalImage(file);
      }
    }
  }, [addLocalImage]);

  const handleRemoveLocalImage = useCallback((index: number) => {
    setLocalImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSave = useCallback(() => {
    // Entry auto-persists on change — this is a visual confirmation
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    setShowSaved(true);
    savedTimerRef.current = setTimeout(() => setShowSaved(false), 1800);
  }, []);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) setSelectedId(entries[currentIndex - 1]._id);
  }, [currentIndex, entries]);

  const goNext = useCallback(() => {
    if (currentIndex < entries.length - 1) setSelectedId(entries[currentIndex + 1]._id);
  }, [currentIndex, entries]);

  return (
    <motion.div
      animate={{ width: isOpen ? PANEL_WIDTH : 0 }}
      initial={false}
      transition={{ type: "tween", duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
      style={{
        flexShrink: 0,
        height: "100%",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: PANEL_WIDTH,
          height: "100%",
          borderLeft: isOpen ? "1px solid rgba(236,227,213,0.1)" : "none",
          background: "var(--bg)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* ─── Header ─── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 14px",
            borderBottom: "1px solid rgba(236,227,213,0.06)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* New entry button */}
            <button
              onClick={handleNewEntry}
              className="jp-btn"
              style={{
                width: 24, height: 24, borderRadius: 6,
                background: "transparent", border: "none",
                cursor: "pointer", display: "flex",
                alignItems: "center", justifyContent: "center",
                color: "var(--text-muted)",
              }}
              title="New Entry"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>

            <span
              style={{
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                fontWeight: 700,
                color: "var(--text-secondary)",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              Trade Journal
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {/* Expand to full page */}
            <button
              onClick={onExpand}
              className="jp-btn"
              style={{
                width: 24, height: 24, borderRadius: 6,
                background: "transparent", border: "none",
                cursor: "pointer", display: "flex",
                alignItems: "center", justifyContent: "center",
                color: "var(--text-muted)",
              }}
              title="Open full journal page"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polyline points="15 3 21 3 21 9" />
                <polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            </button>
            {/* Close */}
            <button
              onClick={onClose}
              className="jp-btn"
              style={{
                width: 24, height: 24, borderRadius: 6,
                background: "transparent", border: "none",
                cursor: "pointer", display: "flex",
                alignItems: "center", justifyContent: "center",
                color: "var(--text-muted)",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* ─── Entry Navigation Bar ─── */}
        {(entries.length > 0 || draft) && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "6px 14px",
              borderBottom: "1px solid rgba(236,227,213,0.06)",
              flexShrink: 0,
            }}
          >
            <button
              onClick={goPrev}
              disabled={currentIndex <= 0}
              className="jp-btn"
              style={{
                width: 22, height: 22, borderRadius: 5,
                background: "transparent", border: "none",
                cursor: currentIndex > 0 ? "pointer" : "default",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: currentIndex > 0 ? "var(--text-muted)" : "var(--text-disabled)",
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {activeEntry?.market && (
                <span
                  style={{
                    fontSize: 8,
                    fontFamily: "var(--font-mono)",
                    fontWeight: 700,
                    color: "#fff",
                    background: getMarketColor(activeEntry.market),
                    padding: "1px 5px",
                    borderRadius: 3,
                  }}
                >
                  {activeEntry.market.toUpperCase().slice(0, 4)}
                </span>
              )}
              <span style={{
                fontSize: 10, fontFamily: "var(--font-mono)",
                color: "var(--text-muted)",
              }}>
                {activeEntry ? formatShortDate(activeEntry.date) : ""}
              </span>
              <span style={{
                fontSize: 9, fontFamily: "var(--font-mono)",
                color: "var(--text-disabled)",
              }}>
                {draft ? "Draft" : entries.length > 0 ? `${currentIndex + 1} / ${entries.length}` : ""}
              </span>
            </div>

            <button
              onClick={goNext}
              disabled={currentIndex >= entries.length - 1}
              className="jp-btn"
              style={{
                width: 22, height: 22, borderRadius: 5,
                background: "transparent", border: "none",
                cursor: currentIndex < entries.length - 1 ? "pointer" : "default",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: currentIndex < entries.length - 1 ? "var(--text-muted)" : "var(--text-disabled)",
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        )}

        {/* ─── Content ─── */}
        {isLoading && !draft ? (
          /* Skeleton loading state */
          <div style={{ flex: 1, padding: "16px 14px", display: "flex", flexDirection: "column", gap: 12 }}>
            {[140, 80, 100, 60, 120].map((w, i) => (
              <div
                key={i}
                className="jp-skeleton"
                style={{
                  height: i === 0 ? 24 : 14,
                  width: `${w}px`,
                  maxWidth: "100%",
                  borderRadius: 6,
                  background: "rgba(236,227,213,0.04)",
                }}
              />
            ))}
            <div
              className="jp-skeleton"
              style={{
                height: 80,
                width: "100%",
                borderRadius: 8,
                background: "rgba(236,227,213,0.04)",
                marginTop: 8,
              }}
            />
          </div>
        ) : activeEntry ? (
          <div ref={contentRef} onPaste={handlePaste} style={{ flex: 1, overflowY: "auto", padding: "12px 14px 32px" }}>
            {/* Title */}
            <input
              value={activeEntry.title}
              onChange={(e) => handleUpdate({ title: e.target.value })}
              placeholder="New page"
              style={{
                width: "100%",
                background: "transparent",
                border: "none",
                outline: "none",
                fontSize: 20,
                fontWeight: 700,
                color: activeEntry.title ? "var(--text-primary)" : "var(--text-muted)",
                lineHeight: 1.3,
                marginBottom: 16,
                padding: 0,
                fontFamily: "inherit",
              }}
            />

            {/* ─── Property Rows ─── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 0, marginBottom: 16 }}>
              {/* Date */}
              <PanelPropRow label="Date">
                <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                  {formatFullDate(activeEntry.date)}
                </span>
              </PanelPropRow>

              {/* Market */}
              <PanelPropRow label="Market">
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input
                    value={activeEntry.market || ""}
                    onChange={(e) => handleUpdate({ market: e.target.value.toUpperCase() })}
                    placeholder="Empty"
                    style={{
                      background: "transparent",
                      border: "none",
                      outline: "none",
                      fontSize: 11,
                      color: activeEntry.market ? "var(--text-primary)" : "var(--text-muted)",
                      fontFamily: "var(--font-mono)",
                      padding: 0,
                      width: 80,
                    }}
                  />
                  {activeEntry.market && (
                    <span
                      style={{
                        fontSize: 8,
                        fontFamily: "var(--font-mono)",
                        fontWeight: 700,
                        color: "#fff",
                        background: getMarketColor(activeEntry.market),
                        padding: "1px 5px",
                        borderRadius: 3,
                      }}
                    >
                      {activeEntry.market}
                    </span>
                  )}
                </div>
              </PanelPropRow>

              {/* Outcome */}
              <PanelPropRow label="Outcome">
                <div style={{ display: "flex", gap: 3 }}>
                  {(["win", "loss", "breakeven"] as const).map((o) => {
                    const active = activeEntry.outcome === o;
                    const cfg = OUTCOME_CONFIG[o];
                    return (
                      <button
                        key={o}
                        onClick={() => handleUpdate({ outcome: active ? undefined : o })}
                        style={{
                          fontSize: 9,
                          fontFamily: "var(--font-mono)",
                          fontWeight: 600,
                          color: active ? cfg.color : "var(--text-muted)",
                          background: active ? cfg.bg : "transparent",
                          border: `1px solid ${active ? cfg.color + "40" : "rgba(236,227,213,0.08)"}`,
                          borderRadius: 5,
                          padding: "1px 6px",
                          cursor: "pointer",
                        }}
                      >
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </PanelPropRow>

              {/* MMXM */}
              <PanelPropRow label="MMXM">
                <select
                  value={activeEntry.mmxm || ""}
                  onChange={(e) => handleUpdate({ mmxm: e.target.value || undefined })}
                  style={{
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    fontSize: 11,
                    color: activeEntry.mmxm ? "var(--text-primary)" : "var(--text-muted)",
                    fontFamily: "var(--font-mono)",
                    padding: 0,
                    cursor: "pointer",
                    appearance: "none",
                  }}
                >
                  <option value="" style={{ background: "var(--bg-raised)", color: "var(--text-muted)" }}>
                    Empty
                  </option>
                  {MMXM_OPTIONS.map((opt) => (
                    <option key={opt} value={opt} style={{ background: "var(--bg-raised)", color: "var(--text-primary)" }}>
                      {opt}
                    </option>
                  ))}
                </select>
              </PanelPropRow>

              {/* Trade Breakdown */}
              <PanelPropRow label="Breakdown">
                <input
                  value={activeEntry.tradeBreakdown || ""}
                  onChange={(e) => handleUpdate({ tradeBreakdown: e.target.value || undefined })}
                  placeholder="Empty"
                  style={{
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    fontSize: 11,
                    color: activeEntry.tradeBreakdown ? "var(--text-primary)" : "var(--text-muted)",
                    fontFamily: "var(--font-mono)",
                    padding: 0,
                    flex: 1,
                  }}
                />
              </PanelPropRow>

              {/* Risk */}
              <PanelPropRow label="Risk">
                <input
                  type="number"
                  value={activeEntry.risk ?? ""}
                  onChange={(e) =>
                    handleUpdate({ risk: e.target.value ? Number(e.target.value) : undefined })
                  }
                  placeholder="Empty"
                  style={{
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    fontSize: 11,
                    color: activeEntry.risk != null ? "var(--text-primary)" : "var(--text-muted)",
                    fontFamily: "var(--font-mono)",
                    padding: 0,
                    width: 80,
                  }}
                />
              </PanelPropRow>

              {/* Return */}
              <PanelPropRow label="Return">
                <input
                  type="number"
                  value={activeEntry.returnVal ?? ""}
                  onChange={(e) =>
                    handleUpdate({ returnVal: e.target.value ? Number(e.target.value) : undefined })
                  }
                  placeholder="Empty"
                  style={{
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    fontSize: 11,
                    color: activeEntry.returnVal != null ? "var(--text-primary)" : "var(--text-muted)",
                    fontFamily: "var(--font-mono)",
                    padding: 0,
                    width: 80,
                  }}
                />
              </PanelPropRow>

              {/* RR */}
              <PanelPropRow label="RR">
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                  }}
                >
                  {calcRR(activeEntry.risk, activeEntry.returnVal)}
                </span>
              </PanelPropRow>
            </div>

            {/* ─── Divider ─── */}
            <div style={{ height: 1, background: "rgba(236,227,213,0.06)", marginBottom: 12 }} />

            {/* ─── Screenshot Section ─── */}
            <div style={{ marginBottom: 12 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: "var(--font-mono)",
                    fontWeight: 600,
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  Screenshots
                </span>
                <button
                  onClick={handleCaptureChart}
                  disabled={isCapturing}
                  className="jp-btn"
                  style={{
                    fontSize: 9,
                    fontFamily: "var(--font-mono)",
                    fontWeight: 600,
                    color: isCapturing ? "var(--text-disabled)" : "var(--accent)",
                    background: isCapturing ? "transparent" : "var(--accent-muted)",
                    border: "none",
                    borderRadius: 6,
                    padding: "3px 8px",
                    cursor: isCapturing ? "default" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                  {isCapturing ? "Capturing..." : "Capture Chart"}
                </button>
              </div>

              {/* Thumbnails (Convex-stored + local images) */}
              {(activeEntry.screenshotIds.length > 0 || localImages.length > 0) && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                  {activeEntry.screenshotIds.map((storageId) => (
                    <ScreenshotThumb key={storageId} storageId={storageId} onPreview={setPreviewSrc} />
                  ))}
                  {localImages.map((src, i) => (
                    <div key={i} style={{ position: "relative" }}>
                      <img
                        src={src}
                        alt="Screenshot"
                        onClick={() => setPreviewSrc(src)}
                        style={{
                          width: 80, height: 50, objectFit: "cover",
                          borderRadius: 6, border: "1px solid rgba(236,227,213,0.08)",
                          cursor: "pointer",
                        }}
                      />
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemoveLocalImage(i); }}
                        style={{
                          position: "absolute", top: -4, right: -4,
                          width: 16, height: 16, borderRadius: "50%",
                          background: "rgba(0,0,0,0.7)", border: "none",
                          color: "#fff", fontSize: 9, cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Drag & drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                style={{
                  border: `1px dashed ${isDragOver ? "var(--accent)" : "rgba(236,227,213,0.1)"}`,
                  borderRadius: 8,
                  padding: "10px 0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  background: isDragOver ? "rgba(236,227,213,0.03)" : "transparent",
                  transition: "all 120ms ease",
                  cursor: "default",
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ color: "var(--text-disabled)" }}>
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-disabled)" }}>
                  Drop image or paste from clipboard
                </span>
              </div>
            </div>

            {/* ─── Divider ─── */}
            <div style={{ height: 1, background: "rgba(236,227,213,0.06)", marginBottom: 12 }} />

            {/* ─── Comments ─── */}
            <PanelComments comments={comments} onAdd={handleAddComment} />

            {/* ─── Divider ─── */}
            <div style={{ height: 1, background: "rgba(236,227,213,0.06)", margin: "12px 0" }} />

            {/* ─── Body ─── */}
            <textarea
              ref={bodyRef}
              value={activeEntry.body}
              onChange={(e) => handleUpdate({ body: e.target.value })}
              placeholder="Start writing..."
              style={{
                width: "100%",
                minHeight: 120,
                background: "transparent",
                border: "none",
                outline: "none",
                color: "var(--text-secondary)",
                fontSize: 12,
                lineHeight: 1.7,
                fontFamily: "inherit",
                resize: "none",
                padding: 0,
              }}
            />

          </div>
        ) : (
          /* Empty state */
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-muted)",
              gap: 8,
            }}
          >
            <span style={{ fontSize: 12 }}>No entries yet</span>
            <button
              onClick={handleNewEntry}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "6px 14px",
                borderRadius: 8,
                background: "var(--accent)",
                border: "none",
                cursor: "pointer",
                fontSize: 10,
                fontFamily: "var(--font-mono)",
                fontWeight: 700,
                color: "var(--bg)",
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New Entry
            </button>
          </div>
        )}

        {/* ─── Footer Bar ─── */}
        {activeEntry && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 14px",
              borderTop: "1px solid rgba(236,227,213,0.06)",
              background: "var(--bg)",
              flexShrink: 0,
            }}
          >
            <button
              onClick={handleDelete}
              className="jp-delete-btn"
              style={{
                fontSize: 9,
                fontFamily: "var(--font-mono)",
                fontWeight: 600,
                color: "var(--text-muted)",
                background: "transparent",
                border: "1px solid rgba(236,227,213,0.08)",
                borderRadius: 6,
                padding: "4px 10px",
                cursor: "pointer",
              }}
            >
              Delete Entry
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {showSaved && (
                <span
                  key={Date.now()}
                  className="jp-saved-fade"
                  style={{
                    fontSize: 9,
                    fontFamily: "var(--font-mono)",
                    fontWeight: 600,
                    color: "var(--buy)",
                  }}
                >
                  Saved
                </span>
              )}
              <button
                onClick={handleSave}
                className="jp-save-btn"
                style={{
                  fontSize: 9,
                  fontFamily: "var(--font-mono)",
                  fontWeight: 600,
                  color: "var(--accent)",
                  background: "var(--accent-muted)",
                  border: "none",
                  borderRadius: 6,
                  padding: "4px 12px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
                Save
              </button>
            </div>
          </div>
        )}

        {/* ─── Image Preview Overlay ─── */}
        {previewSrc && (
          <div
            onClick={() => setPreviewSrc(null)}
            style={{
              position: "fixed", inset: 0, zIndex: 9999,
              background: "rgba(0,0,0,0.85)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <button
              onClick={() => setPreviewSrc(null)}
              style={{
                position: "absolute", top: 16, right: 16,
                width: 32, height: 32, borderRadius: 8,
                background: "rgba(255,255,255,0.1)", border: "none",
                color: "#fff", fontSize: 18, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              &times;
            </button>
            <img
              src={previewSrc}
              alt="Preview"
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: "90vw", maxHeight: "85vh",
                borderRadius: 8, objectFit: "contain",
                cursor: "default",
              }}
            />
          </div>
        )}

        <style>{`
          .jp-btn:hover { background: rgba(236,227,213,0.06) !important; color: var(--text-secondary) !important; }
          .jp-prop-row:hover { background: rgba(236,227,213,0.02); }
          .jp-delete-btn:hover { color: var(--sell) !important; border-color: var(--sell) !important; background: var(--sell-muted) !important; }
          .jp-save-btn:hover { filter: brightness(1.15); }
          @keyframes jp-saved-fade {
            0% { opacity: 0; transform: translateY(2px); }
            15% { opacity: 1; transform: translateY(0); }
            70% { opacity: 1; transform: translateY(0); }
            100% { opacity: 0; transform: translateY(-2px); }
          }
          .jp-saved-fade { animation: jp-saved-fade 1.8s ease forwards; }
          select option { background: var(--bg-raised); }
          input[type="number"]::-webkit-inner-spin-button,
          input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
          input[type="number"] { -moz-appearance: textfield; }
          @keyframes jp-pulse {
            0%, 100% { opacity: 0.4; }
            50% { opacity: 0.8; }
          }
          .jp-skeleton { animation: jp-pulse 1.5s ease-in-out infinite; }
        `}</style>
      </div>
    </motion.div>
  );
}

// ─── Sub-components ───

function PanelPropRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      className="jp-prop-row"
      style={{
        display: "flex",
        alignItems: "center",
        padding: "5px 4px",
        borderRadius: 4,
        gap: 0,
      }}
    >
      <div
        style={{
          width: 80,
          flexShrink: 0,
          fontSize: 10,
          color: "var(--text-muted)",
          fontFamily: "var(--font-mono)",
        }}
      >
        {label}
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center" }}>{children}</div>
    </div>
  );
}

function ScreenshotThumb({ storageId, onPreview }: { storageId: Id<"_storage">; onPreview: (src: string) => void }) {
  const url = useQuery(api.journal.getScreenshotUrl, { storageId });

  if (!url) {
    return (
      <div
        style={{
          width: 80,
          height: 50,
          borderRadius: 6,
          background: "rgba(236,227,213,0.04)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ fontSize: 8, color: "var(--text-disabled)" }}>...</span>
      </div>
    );
  }

  return (
    <img
      src={url}
      alt="Chart screenshot"
      onClick={() => onPreview(url)}
      style={{
        width: 80,
        height: 50,
        objectFit: "cover",
        borderRadius: 6,
        border: "1px solid rgba(236,227,213,0.08)",
        cursor: "pointer",
      }}
    />
  );
}

function PanelComments({
  comments,
  onAdd,
}: {
  comments: JournalComment[];
  onAdd: (text: string) => void;
}) {
  const [draft, setDraft] = useState("");

  return (
    <div>
      <div
        style={{
          fontSize: 10,
          fontFamily: "var(--font-mono)",
          fontWeight: 600,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          marginBottom: 8,
        }}
      >
        Comments
      </div>

      {comments.map((c) => (
        <div key={c.id} style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "flex-start" }}>
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: "var(--accent-muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              fontSize: 8,
              fontFamily: "var(--font-mono)",
              fontWeight: 700,
              color: "var(--accent)",
            }}
          >
            S
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.5 }}>{c.text}</div>
            <div style={{ fontSize: 8, fontFamily: "var(--font-mono)", color: "var(--text-muted)", marginTop: 1 }}>
              {formatShortDate(c.date)}
            </div>
          </div>
        </div>
      ))}

      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "var(--accent-muted)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            fontSize: 8,
            fontFamily: "var(--font-mono)",
            fontWeight: 700,
            color: "var(--accent)",
          }}
        >
          S
        </div>
        <input
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
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            fontSize: 11,
            color: "var(--text-primary)",
            fontFamily: "inherit",
            padding: "3px 0",
            borderBottom: "1px solid rgba(236,227,213,0.06)",
          }}
        />
      </div>
    </div>
  );
}
