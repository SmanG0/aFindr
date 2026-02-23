"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ───

interface DrawingData {
  id: string;
  type: string;
  color: string;
  lineWidth: number;
  lineStyle: "solid" | "dashed" | "dotted";
  locked: boolean;
  extendLeft: boolean;
  extendRight: boolean;
  fillColor?: string;
  fillOpacity?: number;
  label?: string;
  fontSize?: number;
}

interface DrawingEditModalProps {
  drawing: DrawingData;
  position: { x: number; y: number };
  theme: "dark" | "light";
  onUpdate: (id: string, updates: Record<string, unknown>) => void;
  onClose: () => void;
  onDelete: (id: string) => void;
}

// ─── Constants ───

const PRESET_COLORS = [
  "#c47b3a",
  "#2962FF",
  "#22c55e",
  "#ef4444",
  "#f59e0b",
  "#8b5cf6",
  "#ffffff",
];

const LINE_WIDTHS = [1, 2, 3, 4, 5];

const FONT_SIZES = [12, 14, 16, 18, 20, 24];

const FILL_TYPES = new Set(["rectangle", "channel", "fib", "measure"]);
const EXTEND_TYPES = new Set(["trendline", "ray", "extendedline", "hline"]);

const PANEL_WIDTH = 260;
const PANEL_MARGIN = 12;

// ─── Helpers ───

function formatTypeName(type: string): string {
  const names: Record<string, string> = {
    hline: "Horizontal Line",
    trendline: "Trend Line",
    ray: "Ray",
    extendedline: "Extended Line",
    channel: "Channel",
    fib: "Fibonacci",
    rectangle: "Rectangle",
    measure: "Measure",
    text: "Text",
    ruler: "Ruler",
  };
  return names[type] || type.charAt(0).toUpperCase() + type.slice(1);
}

/** Clamp the panel position so it stays within the viewport. */
function clampPosition(
  x: number,
  y: number,
  panelHeight: number,
): { x: number; y: number } {
  const vw = typeof window !== "undefined" ? window.innerWidth : 1920;
  const vh = typeof window !== "undefined" ? window.innerHeight : 1080;

  let cx = x + PANEL_MARGIN;
  let cy = y;

  // If panel overflows right, flip to left of cursor
  if (cx + PANEL_WIDTH > vw - PANEL_MARGIN) {
    cx = x - PANEL_WIDTH - PANEL_MARGIN;
  }
  // Clamp left
  if (cx < PANEL_MARGIN) {
    cx = PANEL_MARGIN;
  }
  // Clamp bottom
  if (cy + panelHeight > vh - PANEL_MARGIN) {
    cy = vh - panelHeight - PANEL_MARGIN;
  }
  // Clamp top
  if (cy < PANEL_MARGIN) {
    cy = PANEL_MARGIN;
  }

  return { x: cx, y: cy };
}

// ─── Sub-components ───

function SectionLabel({
  children,
  isLight,
}: {
  children: React.ReactNode;
  isLight: boolean;
}) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: isLight ? "rgba(0,0,0,0.4)" : "rgba(236,227,213,0.35)",
        marginBottom: 6,
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {children}
    </div>
  );
}

function ColorSwatches({
  value,
  onChange,
  isLight,
}: {
  value: string;
  onChange: (color: string) => void;
  isLight: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      {PRESET_COLORS.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          style={{
            width: 22,
            height: 22,
            borderRadius: 4,
            border:
              value.toLowerCase() === c.toLowerCase()
                ? `2px solid ${isLight ? "rgba(0,0,0,0.6)" : "rgba(236,227,213,0.7)"}`
                : `1px solid ${isLight ? "rgba(0,0,0,0.1)" : "rgba(236,227,213,0.1)"}`,
            background: c,
            cursor: "pointer",
            padding: 0,
            flexShrink: 0,
            boxShadow:
              c === "#ffffff"
                ? `inset 0 0 0 1px ${isLight ? "rgba(0,0,0,0.08)" : "rgba(0,0,0,0.3)"}`
                : "none",
          }}
        />
      ))}
      {/* Custom color picker */}
      <button
        onClick={() => inputRef.current?.click()}
        style={{
          width: 22,
          height: 22,
          borderRadius: 4,
          border: `1px solid ${isLight ? "rgba(0,0,0,0.1)" : "rgba(236,227,213,0.1)"}`,
          background: `conic-gradient(from 0deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)`,
          cursor: "pointer",
          padding: 0,
          flexShrink: 0,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <input
          ref={inputRef}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            opacity: 0,
            cursor: "pointer",
          }}
        />
      </button>
    </div>
  );
}

function LineWidthPicker({
  value,
  onChange,
  color,
  isLight,
}: {
  value: number;
  onChange: (width: number) => void;
  color: string;
  isLight: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      {LINE_WIDTHS.map((w) => (
        <button
          key={w}
          onClick={() => onChange(w)}
          style={{
            width: 36,
            height: 28,
            borderRadius: 4,
            border: `1px solid ${
              value === w
                ? isLight
                  ? "rgba(0,0,0,0.25)"
                  : "rgba(236,227,213,0.25)"
                : isLight
                  ? "rgba(0,0,0,0.08)"
                  : "rgba(236,227,213,0.08)"
            }`,
            background:
              value === w
                ? isLight
                  ? "rgba(0,0,0,0.06)"
                  : "rgba(236,227,213,0.08)"
                : "transparent",
            cursor: "pointer",
            padding: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 20,
              height: w,
              borderRadius: w >= 3 ? 1 : 0,
              background: color,
            }}
          />
        </button>
      ))}
    </div>
  );
}

function LineStylePicker({
  value,
  onChange,
  isLight,
}: {
  value: "solid" | "dashed" | "dotted";
  onChange: (style: "solid" | "dashed" | "dotted") => void;
  isLight: boolean;
}) {
  const styles: { key: "solid" | "dashed" | "dotted"; label: string }[] = [
    { key: "solid", label: "\u2500\u2500\u2500" },
    { key: "dashed", label: "- - -" },
    { key: "dotted", label: "\u00B7\u00B7\u00B7\u00B7\u00B7" },
  ];

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      {styles.map((s) => (
        <button
          key={s.key}
          onClick={() => onChange(s.key)}
          style={{
            flex: 1,
            height: 28,
            borderRadius: 4,
            border: `1px solid ${
              value === s.key
                ? isLight
                  ? "rgba(0,0,0,0.25)"
                  : "rgba(236,227,213,0.25)"
                : isLight
                  ? "rgba(0,0,0,0.08)"
                  : "rgba(236,227,213,0.08)"
            }`,
            background:
              value === s.key
                ? isLight
                  ? "rgba(0,0,0,0.06)"
                  : "rgba(236,227,213,0.08)"
                : "transparent",
            cursor: "pointer",
            padding: 0,
            fontSize: 13,
            fontFamily: "var(--font-mono)",
            color: isLight ? "rgba(0,0,0,0.6)" : "rgba(236,227,213,0.65)",
            letterSpacing: s.key === "dotted" ? "0.15em" : "0.05em",
          }}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

function ToggleSwitch({
  checked,
  onChange,
  isLight,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  isLight: boolean;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: 34,
        height: 18,
        borderRadius: 9,
        border: "none",
        padding: 2,
        cursor: "pointer",
        background: checked
          ? "#c47b3a"
          : isLight
            ? "rgba(0,0,0,0.12)"
            : "rgba(236,227,213,0.12)",
        display: "flex",
        alignItems: "center",
        justifyContent: checked ? "flex-end" : "flex-start",
        transition: "background 150ms ease, justify-content 150ms ease",
      }}
    >
      <motion.div
        layout
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        style={{
          width: 14,
          height: 14,
          borderRadius: 7,
          background: checked
            ? "#fff"
            : isLight
              ? "rgba(0,0,0,0.3)"
              : "rgba(236,227,213,0.4)",
        }}
      />
    </button>
  );
}

function Checkbox({
  checked,
  onChange,
  label,
  isLight,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  label: string;
  isLight: boolean;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        cursor: "pointer",
        fontSize: 11,
        fontFamily: "'Inter', system-ui, sans-serif",
        color: isLight ? "rgba(0,0,0,0.65)" : "rgba(236,227,213,0.65)",
        userSelect: "none",
      }}
    >
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: 16,
          height: 16,
          borderRadius: 3,
          border: `1px solid ${
            checked
              ? "#c47b3a"
              : isLight
                ? "rgba(0,0,0,0.2)"
                : "rgba(236,227,213,0.2)"
          }`,
          background: checked
            ? "#c47b3a"
            : isLight
              ? "rgba(0,0,0,0.03)"
              : "rgba(236,227,213,0.03)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          cursor: "pointer",
          transition: "all 150ms ease",
        }}
      >
        {checked && (
          <svg
            width={10}
            height={10}
            viewBox="0 0 10 10"
            fill="none"
            stroke="#fff"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2 5.5L4 7.5L8 3" />
          </svg>
        )}
      </div>
      {label}
    </label>
  );
}

// ─── Main Component ───

export default function DrawingEditModal({
  drawing,
  position,
  theme,
  onUpdate,
  onClose,
  onDelete,
}: DrawingEditModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelPos, setPanelPos] = useState({ x: 0, y: 0 });
  const [ready, setReady] = useState(false);

  const isLight = theme === "light";
  const showFill = FILL_TYPES.has(drawing.type);
  const showExtend = EXTEND_TYPES.has(drawing.type);
  const showText = drawing.type === "text";

  // ─── Position clamping ───
  useEffect(() => {
    // Wait one frame for the panel to render so we can measure it
    const raf = requestAnimationFrame(() => {
      const height = panelRef.current?.offsetHeight ?? 400;
      const clamped = clampPosition(position.x, position.y, height);
      setPanelPos(clamped);
      setReady(true);
    });
    return () => cancelAnimationFrame(raf);
  }, [position]);

  // ─── Close on Escape ───
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // ─── Close on click outside ───
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    // Delay listener to avoid the same click that opened the modal from closing it
    const timeout = setTimeout(() => {
      window.addEventListener("mousedown", handleClickOutside);
    }, 50);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  // ─── Updaters ───
  const update = useCallback(
    (updates: Record<string, unknown>) => {
      onUpdate(drawing.id, updates);
    },
    [drawing.id, onUpdate],
  );

  // ─── Theme styles ───
  const bg = isLight ? "#ffffff" : "#1e1e22";
  const borderColor = isLight ? "rgba(0,0,0,0.1)" : "rgba(236,227,213,0.1)";
  const textPrimary = isLight ? "rgba(0,0,0,0.85)" : "#ece3d5";
  const textSecondary = isLight ? "rgba(0,0,0,0.5)" : "rgba(236,227,213,0.65)";
  const sectionBorder = isLight
    ? "rgba(0,0,0,0.06)"
    : "rgba(236,227,213,0.06)";
  const inputBg = isLight ? "rgba(0,0,0,0.04)" : "rgba(236,227,213,0.04)";

  return (
    <AnimatePresence>
      <motion.div
        ref={panelRef}
        initial={{ opacity: 0, scale: 0.95, y: -4 }}
        animate={{
          opacity: ready ? 1 : 0,
          scale: 1,
          y: 0,
        }}
        exit={{ opacity: 0, scale: 0.95, y: -4 }}
        transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position: "fixed",
          top: panelPos.y,
          left: panelPos.x,
          width: PANEL_WIDTH,
          background: bg,
          border: `0.667px solid ${borderColor}`,
          borderRadius: 8,
          boxShadow: isLight
            ? "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)"
            : "0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          zIndex: 9999,
          overflow: "hidden",
          fontFamily: "'Inter', system-ui, sans-serif",
          userSelect: "none",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ─── Header ─── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 12px",
            borderBottom: `1px solid ${sectionBorder}`,
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: textPrimary,
              letterSpacing: "-0.01em",
            }}
          >
            {formatTypeName(drawing.type)}
          </span>
          <button
            onClick={onClose}
            style={{
              width: 22,
              height: 22,
              borderRadius: 4,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: textSecondary,
              padding: 0,
              transition: "background 100ms ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = isLight
                ? "rgba(0,0,0,0.06)"
                : "rgba(236,227,213,0.08)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            <svg
              width={14}
              height={14}
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
            >
              <path d="M3 3l8 8M11 3l-8 8" />
            </svg>
          </button>
        </div>

        {/* ─── Body ─── */}
        <div
          style={{
            padding: "10px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {/* ─── Color ─── */}
          <div>
            <SectionLabel isLight={isLight}>Color</SectionLabel>
            <ColorSwatches
              value={drawing.color}
              onChange={(color) => update({ color })}
              isLight={isLight}
            />
          </div>

          {/* ─── Line Width ─── */}
          <div>
            <SectionLabel isLight={isLight}>Line Width</SectionLabel>
            <LineWidthPicker
              value={drawing.lineWidth}
              onChange={(lineWidth) => update({ lineWidth })}
              color={drawing.color}
              isLight={isLight}
            />
          </div>

          {/* ─── Line Style ─── */}
          <div>
            <SectionLabel isLight={isLight}>Line Style</SectionLabel>
            <LineStylePicker
              value={drawing.lineStyle}
              onChange={(lineStyle) => update({ lineStyle })}
              isLight={isLight}
            />
          </div>

          {/* ─── Fill (conditional) ─── */}
          {showFill && (
            <div>
              <SectionLabel isLight={isLight}>Fill</SectionLabel>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 8 }}
              >
                <ColorSwatches
                  value={drawing.fillColor ?? drawing.color}
                  onChange={(fillColor) => update({ fillColor })}
                  isLight={isLight}
                />
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      color: textSecondary,
                      fontFamily: "'Inter', system-ui, sans-serif",
                      flexShrink: 0,
                    }}
                  >
                    Opacity
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={
                      drawing.fillOpacity !== undefined
                        ? Math.round(drawing.fillOpacity * 100)
                        : 20
                    }
                    onChange={(e) =>
                      update({ fillOpacity: parseInt(e.target.value) / 100 })
                    }
                    style={{
                      flex: 1,
                      height: 4,
                      accentColor: "#c47b3a",
                      cursor: "pointer",
                    }}
                  />
                  <span
                    style={{
                      fontSize: 10,
                      fontFamily: "var(--font-mono)",
                      color: textSecondary,
                      width: 30,
                      textAlign: "right",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {drawing.fillOpacity !== undefined
                      ? Math.round(drawing.fillOpacity * 100)
                      : 20}
                    %
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ─── Extend Line (conditional) ─── */}
          {showExtend && (
            <div>
              <SectionLabel isLight={isLight}>Extend Line</SectionLabel>
              <div
                style={{ display: "flex", alignItems: "center", gap: 16 }}
              >
                <Checkbox
                  checked={drawing.extendLeft}
                  onChange={(extendLeft) => update({ extendLeft })}
                  label="Left"
                  isLight={isLight}
                />
                <Checkbox
                  checked={drawing.extendRight}
                  onChange={(extendRight) => update({ extendRight })}
                  label="Right"
                  isLight={isLight}
                />
              </div>
            </div>
          )}

          {/* ─── Text (conditional) ─── */}
          {showText && (
            <div>
              <SectionLabel isLight={isLight}>Text</SectionLabel>
              <input
                type="text"
                value={drawing.label ?? ""}
                onChange={(e) => update({ label: e.target.value })}
                placeholder="Enter text..."
                style={{
                  width: "100%",
                  height: 30,
                  borderRadius: 4,
                  border: `1px solid ${borderColor}`,
                  background: inputBg,
                  color: textPrimary,
                  fontSize: 12,
                  fontFamily: "var(--font-mono)",
                  padding: "0 8px",
                  outline: "none",
                  transition: "border-color 150ms ease",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "#c47b3a";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = borderColor;
                }}
              />
            </div>
          )}

          {/* ─── Font Size (conditional) ─── */}
          {showText && (
            <div>
              <SectionLabel isLight={isLight}>Font Size</SectionLabel>
              <select
                value={drawing.fontSize ?? 14}
                onChange={(e) =>
                  update({ fontSize: parseInt(e.target.value) })
                }
                style={{
                  width: "100%",
                  height: 30,
                  borderRadius: 4,
                  border: `1px solid ${borderColor}`,
                  background: inputBg,
                  color: textPrimary,
                  fontSize: 12,
                  fontFamily: "var(--font-mono)",
                  padding: "0 6px",
                  outline: "none",
                  cursor: "pointer",
                  appearance: "none",
                  WebkitAppearance: "none",
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='${encodeURIComponent(isLight ? "rgba(0,0,0,0.35)" : "rgba(236,227,213,0.35)")}' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 8px center",
                  paddingRight: 26,
                }}
              >
                {FONT_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}px
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* ─── Lock ─── */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingTop: 4,
              borderTop: `1px solid ${sectionBorder}`,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <svg
                width={13}
                height={13}
                viewBox="0 0 16 16"
                fill="none"
                stroke={drawing.locked ? "#c47b3a" : textSecondary}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {drawing.locked ? (
                  <>
                    <rect x="3" y="7" width="10" height="7" rx="1.5" />
                    <path d="M5 7V5a3 3 0 0 1 6 0v2" />
                  </>
                ) : (
                  <>
                    <rect x="3" y="7" width="10" height="7" rx="1.5" />
                    <path d="M5 7V5a3 3 0 0 1 6 0" />
                  </>
                )}
              </svg>
              <span
                style={{
                  fontSize: 11,
                  color: textSecondary,
                  fontFamily: "'Inter', system-ui, sans-serif",
                }}
              >
                Lock
              </span>
            </div>
            <ToggleSwitch
              checked={drawing.locked}
              onChange={(locked) => update({ locked })}
              isLight={isLight}
            />
          </div>

          {/* ─── Delete ─── */}
          <button
            onClick={() => onDelete(drawing.id)}
            style={{
              width: "100%",
              height: 32,
              borderRadius: 4,
              border: "1px solid rgba(239,68,68,0.2)",
              background: "rgba(239,68,68,0.08)",
              color: "#ef4444",
              fontSize: 11,
              fontWeight: 600,
              fontFamily: "'Inter', system-ui, sans-serif",
              letterSpacing: "0.02em",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              transition: "background 100ms ease, border-color 100ms ease",
              marginTop: 2,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background =
                "rgba(239,68,68,0.15)";
              (e.currentTarget as HTMLElement).style.borderColor =
                "rgba(239,68,68,0.3)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background =
                "rgba(239,68,68,0.08)";
              (e.currentTarget as HTMLElement).style.borderColor =
                "rgba(239,68,68,0.2)";
            }}
          >
            <svg
              width={12}
              height={12}
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 4h12M5 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1M13 4v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4" />
              <line x1="7" y1="7" x2="7" y2="12" />
              <line x1="9" y1="7" x2="9" y2="12" />
            </svg>
            Delete Drawing
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
