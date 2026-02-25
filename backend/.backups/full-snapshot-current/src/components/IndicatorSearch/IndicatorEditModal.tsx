"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  INDICATOR_DEFS,
  type IndicatorConfig,
} from "@/lib/indicators";

interface IndicatorEditModalProps {
  config: IndicatorConfig | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, updates: Partial<IndicatorConfig>) => void;
}

export default function IndicatorEditModal({
  config,
  isOpen,
  onClose,
  onSave,
}: IndicatorEditModalProps) {
  const [params, setParams] = useState<Record<string, number>>({});
  const [color, setColor] = useState("#2962FF");
  const [visible, setVisible] = useState(true);

  const def = config ? INDICATOR_DEFS.find((d) => d.type === config.type) : null;

  useEffect(() => {
    if (config) {
      setParams({ ...config.params });
      setColor(config.color);
      setVisible(config.visible);
    }
  }, [config]);

  if (!isOpen || !config || !def) return null;

  const handleSave = () => {
    onSave(config.id, { params, color, visible });
    onClose();
  };

  const updateParam = (key: string, value: number, isDecimal?: boolean) => {
    const defVal = def.defaultParams[key] ?? 1;
    const v = isDecimal || (defVal > 0 && defVal < 1)
      ? Math.max(0.01, Math.min(10, value))
      : Math.max(1, Math.min(999, Math.round(value)));
    setParams((prev) => ({ ...prev, [key]: v }));
  };

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
          zIndex: 20001,
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
            width: 360,
            maxWidth: "90vw",
            background: "#1e1e22",
            borderRadius: 12,
            border: "1px solid rgba(236,227,213,0.1)",
            boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "14px 16px",
              borderBottom: "1px solid rgba(236,227,213,0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "rgba(236,227,213,0.9)",
                fontFamily: "'Inter', system-ui, sans-serif",
              }}
            >
              {def.name}
            </span>
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 4,
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
          <div style={{ padding: "16px" }}>
            {/* Inputs */}
            {Object.keys(def.paramLabels).length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: "rgba(236,227,213,0.4)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: 10,
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  Inputs
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {Object.entries(def.paramLabels).map(([key, label]) => (
                    <div
                      key={key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          color: "rgba(236,227,213,0.7)",
                          fontFamily: "'Inter', system-ui, sans-serif",
                        }}
                      >
                        {label}
                      </span>
                      <input
                        type="number"
                        min={0.01}
                        max={999}
                        step={(def.defaultParams[key] ?? 1) < 1 ? 0.01 : 1}
                        value={params[key] ?? def.defaultParams[key] ?? 1}
                        onChange={(e) => updateParam(key, parseFloat(e.target.value) || (def.defaultParams[key] ?? 1), (def.defaultParams[key] ?? 1) < 1)}
                        style={{
                          width: 80,
                          padding: "6px 10px",
                          fontSize: 12,
                          fontFamily: "var(--font-mono)",
                          background: "rgba(236,227,213,0.06)",
                          border: "1px solid rgba(236,227,213,0.12)",
                          borderRadius: 6,
                          color: "rgba(236,227,213,0.9)",
                          outline: "none",
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Visibility */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 0",
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  color: "rgba(236,227,213,0.7)",
                  fontFamily: "'Inter', system-ui, sans-serif",
                }}
              >
                Visible
              </span>
              <button
                onClick={() => setVisible((v) => !v)}
                style={{
                  width: 36,
                  height: 20,
                  borderRadius: 10,
                  background: visible ? "rgba(107,99,88,0.6)" : "rgba(236,227,213,0.2)",
                  border: "none",
                  cursor: "pointer",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 2,
                    left: visible ? 18 : 2,
                    width: 16,
                    height: 16,
                    borderRadius: 8,
                    background: "#fff",
                    transition: "left 0.15s ease",
                  }}
                />
              </button>
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              padding: "12px 16px",
              borderTop: "1px solid rgba(236,227,213,0.08)",
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
            }}
          >
            <button
              onClick={onClose}
              style={{
                padding: "8px 16px",
                fontSize: 12,
                fontWeight: 500,
                background: "transparent",
                border: "1px solid rgba(236,227,213,0.2)",
                borderRadius: 6,
                color: "rgba(236,227,213,0.7)",
                cursor: "pointer",
                fontFamily: "'Inter', system-ui, sans-serif",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              style={{
                padding: "8px 16px",
                fontSize: 12,
                fontWeight: 600,
                background: "rgba(107,99,88,0.6)",
                border: "none",
                borderRadius: 6,
                color: "rgba(236,227,213,0.9)",
                cursor: "pointer",
                fontFamily: "'Inter', system-ui, sans-serif",
              }}
            >
              OK
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
