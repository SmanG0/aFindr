"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  INDICATOR_DEFS,
  type IndicatorType,
  type IndicatorConfig,
  type IndicatorDef,
} from "@/lib/indicators";

interface IndicatorSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddIndicator: (type: IndicatorType, params?: Record<string, number>) => void;
  onRemoveIndicator: (id: string) => void;
  onToggleIndicator: (id: string) => void;
  onEditIndicator?: (config: IndicatorConfig) => void;
  activeIndicators: IndicatorConfig[];
}

const CATEGORY_MAP: Record<string, IndicatorType[]> = {
  Favorites: ["sma", "ema", "rsi", "macd", "bb", "atr"],
  "Moving Averages": ["sma", "ema", "wma", "dema", "tema"],
  Oscillators: ["rsi", "macd", "stoch", "cci", "willr", "roc", "trix", "cmo"],
  Volatility: ["bb", "atr", "donchian", "keltner"],
  Volume: ["vwap", "obv", "mfi", "chaikin", "force"],
  Trend: ["adx", "psar", "supertrend", "aroon"],
};

export default function IndicatorSearchModal({
  isOpen,
  onClose,
  onAddIndicator,
  onRemoveIndicator,
  onToggleIndicator,
  onEditIndicator,
  activeIndicators,
}: IndicatorSearchModalProps) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("Favorites");

  const filteredDefs = useMemo(() => {
    if (search.trim()) {
      const q = search.toLowerCase();
      return INDICATOR_DEFS.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.shortName.toLowerCase().includes(q) ||
          d.type.includes(q)
      );
    }
    const types = CATEGORY_MAP[activeCategory] || [];
    return INDICATOR_DEFS.filter((d) => types.includes(d.type));
  }, [search, activeCategory]);

  const getActiveCount = (type: IndicatorType) =>
    activeIndicators.filter((c) => c.type === type).length;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 20000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(4px)",
        }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: 560,
            maxWidth: "90vw",
            maxHeight: "75vh",
            background: "#1e1e22",
            borderRadius: 12,
            border: "1px solid rgba(236,227,213,0.1)",
            boxShadow: "0 24px 80px rgba(0,0,0,0.5), 0 8px 24px rgba(0,0,0,0.3)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Search Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 16px",
              borderBottom: "1px solid rgba(236,227,213,0.08)",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(236,227,213,0.4)" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search indicators..."
              style={{
                flex: 1,
                background: "none",
                border: "none",
                outline: "none",
                color: "rgba(236,227,213,0.9)",
                fontSize: 14,
                fontFamily: "'Inter', system-ui, sans-serif",
              }}
            />
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 4,
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                color: "rgba(236,227,213,0.4)",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>
            {/* Category sidebar */}
            {!search.trim() && (
              <div
                style={{
                  width: 150,
                  flexShrink: 0,
                  borderRight: "1px solid rgba(236,227,213,0.06)",
                  padding: "6px 0",
                  overflowY: "auto",
                }}
              >
                {Object.keys(CATEGORY_MAP).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 14px",
                      fontSize: 12,
                      fontWeight: activeCategory === cat ? 600 : 400,
                      color: activeCategory === cat ? "rgba(236,227,213,0.9)" : "rgba(236,227,213,0.5)",
                      background: activeCategory === cat ? "rgba(107,99,88,0.3)" : "transparent",
                      borderLeft: activeCategory === cat ? "3px solid rgba(180,170,155,0.6)" : "3px solid transparent",
                      border: "none",
                      cursor: "pointer",
                      fontFamily: "'Inter', system-ui, sans-serif",
                      transition: "all 100ms",
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}

            {/* Indicator list */}
            <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
              {filteredDefs.length === 0 && (
                <div
                  style={{
                    padding: 40,
                    textAlign: "center",
                    color: "rgba(236,227,213,0.3)",
                    fontSize: 12,
                  }}
                >
                  No indicators found
                </div>
              )}
              {filteredDefs.map((def) => (
                <IndicatorRow
                  key={def.type}
                  def={def}
                  activeCount={getActiveCount(def.type)}
                  activeConfigs={activeIndicators.filter((c) => c.type === def.type)}
                  onAdd={() => onAddIndicator(def.type)}
                  onRemove={onRemoveIndicator}
                />
              ))}
            </div>
          </div>

          {/* Active indicators footer */}
          {activeIndicators.length > 0 && (
            <div
              style={{
                borderTop: "1px solid rgba(236,227,213,0.08)",
                padding: "8px 16px",
                display: "flex",
                alignItems: "center",
                gap: 6,
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontSize: 10, color: "rgba(236,227,213,0.3)", marginRight: 4 }}>
                Active:
              </span>
              {activeIndicators.map((config) => {
                const def = INDICATOR_DEFS.find((d) => d.type === config.type);
                return (
                  <span
                    key={config.id}
                    onDoubleClick={() => onEditIndicator?.(config)}
                    title="Double-click to edit"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "2px 8px",
                      borderRadius: 4,
                      background: "rgba(107,99,88,0.3)",
                      fontSize: 10,
                      fontWeight: 600,
                      color: "rgba(236,227,213,0.7)",
                      fontFamily: "var(--font-mono)",
                      opacity: config.visible ? 1 : 0.4,
                      cursor: onEditIndicator ? "pointer" : "default",
                    }}
                  >
                    {def?.shortName}({Object.values(config.params).join(",")})
                    <button
                      onClick={(e) => { e.stopPropagation(); onToggleIndicator(config.id); }}
                      title={config.visible ? "Hide" : "Show"}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                        color: "rgba(236,227,213,0.4)",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        {config.visible ? (
                          <>
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </>
                        ) : (
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22" />
                        )}
                      </svg>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onRemoveIndicator(config.id); }}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                        color: "rgba(236,227,213,0.3)",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function IndicatorRow({
  def,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  activeCount,
  activeConfigs,
  onAdd,
  onRemove,
}: {
  def: IndicatorDef;
  activeCount: number;
  activeConfigs: IndicatorConfig[];
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        padding: "10px 16px",
        cursor: "pointer",
        background: hovered ? "rgba(236,227,213,0.04)" : "transparent",
        transition: "background 100ms",
      }}
      onClick={onAdd}
    >
      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: "rgba(236,227,213,0.85)",
            fontFamily: "'Inter', system-ui, sans-serif",
          }}
        >
          {def.name}
          <span
            style={{
              marginLeft: 6,
              fontSize: 10,
              fontWeight: 600,
              color: "rgba(236,227,213,0.4)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {def.shortName}
          </span>
        </div>
        <div
          style={{
            fontSize: 11,
            color: "rgba(236,227,213,0.35)",
            marginTop: 2,
            fontFamily: "'Inter', system-ui, sans-serif",
          }}
        >
          {def.description}
        </div>
      </div>

      {/* Actions */}
      <div
        style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        {activeConfigs.length > 0 && (
          <button
            onClick={() => onRemove(activeConfigs[activeConfigs.length - 1].id)}
            style={{
              background: "none",
              border: "none",
              borderRadius: 4,
              padding: 4,
              cursor: "pointer",
              color: "rgba(236,227,213,0.4)",
              display: "flex",
              alignItems: "center",
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
        <button
          onClick={onAdd}
          style={{
            background: "rgba(107,99,88,0.4)",
            border: "none",
            borderRadius: 4,
            padding: 4,
            cursor: "pointer",
            color: "rgba(236,227,213,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
