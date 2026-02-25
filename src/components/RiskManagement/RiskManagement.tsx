"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { RiskSettings } from "@/lib/types";

interface RiskManagementProps {
  isOpen: boolean;
  onClose: () => void;
  settings: RiskSettings;
  onUpdateSettings: (settings: RiskSettings) => void;
  embedded?: boolean;
}

export default function RiskManagement({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  embedded,
}: RiskManagementProps) {
  const [localSettings, setLocalSettings] = useState<RiskSettings>(settings);
  const [symbolInput, setSymbolInput] = useState("");

  // Re-sync local state when the modal opens with new settings
  useEffect(() => {
    if (isOpen) {
      setLocalSettings(settings);
      setSymbolInput("");
    }
  }, [isOpen, settings]);

  const handleAddSymbol = () => {
    const trimmed = symbolInput.trim().toUpperCase();
    if (trimmed && !localSettings.allowedSymbols.includes(trimmed)) {
      setLocalSettings((prev) => ({
        ...prev,
        allowedSymbols: [...prev.allowedSymbols, trimmed],
      }));
      setSymbolInput("");
    }
  };

  const handleRemoveSymbol = (symbol: string) => {
    setLocalSettings((prev) => ({
      ...prev,
      allowedSymbols: prev.allowedSymbols.filter((s) => s !== symbol),
    }));
  };

  const handleSave = () => {
    onUpdateSettings(localSettings);
    onClose();
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    textTransform: "uppercase",
    color: "var(--text-muted)",
    letterSpacing: "0.04em",
    marginBottom: 6,
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "transparent",
    borderTop: "none",
    borderRight: "none",
    borderLeft: "none",
    borderBottom: "1px solid rgba(236,227,213,0.1)",
    padding: "8px 0",
    color: "white",
    fontSize: 14,
    outline: "none",
  };

  // ─── Shared form content ───
  const formContent = (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <span className="gradient-title">Risk Management</span>
        {!embedded && (
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 6,
              transition: "color 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--text-muted)";
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

            {/* ─── Form Fields ─── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Max Open Positions */}
              <div>
                <div style={labelStyle}>Max Open Positions</div>
                <input
                  type="number"
                  min={0}
                  placeholder="No limit"
                  value={localSettings.maxOpenPositions ?? ""}
                  onChange={(e) =>
                    setLocalSettings((prev) => ({
                      ...prev,
                      maxOpenPositions:
                        e.target.value === "" ? null : Number(e.target.value),
                    }))
                  }
                  style={inputStyle}
                  onFocus={(e) => {
                    e.currentTarget.style.borderBottomColor = "var(--accent)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderBottomColor =
                      "rgba(236,227,213,0.1)";
                  }}
                />
              </div>

              {/* Allowed Symbols */}
              <div>
                <div style={labelStyle}>Allowed Symbols</div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <input
                    type="text"
                    placeholder="e.g. NQ=F"
                    value={symbolInput}
                    onChange={(e) => setSymbolInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddSymbol();
                      }
                    }}
                    style={{ ...inputStyle, flex: 1 }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderBottomColor = "var(--accent)";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderBottomColor =
                        "rgba(236,227,213,0.1)";
                    }}
                  />
                  <button
                    onClick={handleAddSymbol}
                    style={{
                      background: "rgba(236,227,213,0.06)",
                      border: "none",
                      color: "var(--text-secondary)",
                      fontSize: 12,
                      fontWeight: 500,
                      padding: "6px 14px",
                      borderRadius: 6,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background =
                        "rgba(236,227,213,0.1)";
                      e.currentTarget.style.color = "var(--text-primary)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background =
                        "rgba(236,227,213,0.06)";
                      e.currentTarget.style.color = "var(--text-secondary)";
                    }}
                  >
                    Add
                  </button>
                </div>
                {/* Symbol Chips */}
                {localSettings.allowedSymbols.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                      marginTop: 10,
                    }}
                  >
                    {localSettings.allowedSymbols.map((sym) => (
                      <span key={sym} className="chip chip-accent">
                        {sym}
                        <button
                          onClick={() => handleRemoveSymbol(sym)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "inherit",
                            cursor: "pointer",
                            padding: 0,
                            marginLeft: 2,
                            display: "flex",
                            alignItems: "center",
                            opacity: 0.7,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.opacity = "1";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.opacity = "0.7";
                          }}
                        >
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Require SL/TP Checkbox */}
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  cursor: "pointer",
                  userSelect: "none",
                }}
              >
                <div
                  onClick={() =>
                    setLocalSettings((prev) => ({
                      ...prev,
                      requireSlTp: !prev.requireSlTp,
                    }))
                  }
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 4,
                    border: localSettings.requireSlTp
                      ? "none"
                      : "1.5px solid rgba(236,227,213,0.2)",
                    background: localSettings.requireSlTp
                      ? "var(--accent)"
                      : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.15s ease",
                    flexShrink: 0,
                    cursor: "pointer",
                  }}
                >
                  {localSettings.requireSlTp && (
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                  Require Stop Loss or Take Profit
                </span>
              </label>

              {/* Max Loss Per Trade */}
              <div>
                <div style={labelStyle}>Maximum Loss Per Trade</div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    placeholder="No limit"
                    value={localSettings.maxLossPerTradePct ?? ""}
                    onChange={(e) =>
                      setLocalSettings((prev) => ({
                        ...prev,
                        maxLossPerTradePct:
                          e.target.value === ""
                            ? null
                            : Number(e.target.value),
                      }))
                    }
                    style={{ ...inputStyle, flex: 1 }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderBottomColor = "var(--accent)";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderBottomColor =
                        "rgba(236,227,213,0.1)";
                    }}
                  />
                  <span
                    style={{
                      fontSize: 13,
                      color: "var(--text-muted)",
                      flexShrink: 0,
                    }}
                  >
                    %
                  </span>
                </div>
              </div>

              {/* Preset Stop Loss */}
              <div>
                <div style={labelStyle}>Preset Stop Loss (% of balance)</div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    placeholder="None"
                    value={localSettings.presetSlPct ?? ""}
                    onChange={(e) =>
                      setLocalSettings((prev) => ({
                        ...prev,
                        presetSlPct:
                          e.target.value === ""
                            ? null
                            : Number(e.target.value),
                      }))
                    }
                    style={{ ...inputStyle, flex: 1 }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderBottomColor = "var(--accent)";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderBottomColor =
                        "rgba(236,227,213,0.1)";
                    }}
                  />
                  <span
                    style={{
                      fontSize: 13,
                      color: "var(--text-muted)",
                      flexShrink: 0,
                    }}
                  >
                    %
                  </span>
                </div>
              </div>

              {/* Preset Take Profit */}
              <div>
                <div style={labelStyle}>Preset Take Profit (% of balance)</div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    placeholder="None"
                    value={localSettings.presetTpPct ?? ""}
                    onChange={(e) =>
                      setLocalSettings((prev) => ({
                        ...prev,
                        presetTpPct:
                          e.target.value === ""
                            ? null
                            : Number(e.target.value),
                      }))
                    }
                    style={{ ...inputStyle, flex: 1 }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderBottomColor = "var(--accent)";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderBottomColor =
                        "rgba(236,227,213,0.1)";
                    }}
                  />
                  <span
                    style={{
                      fontSize: 13,
                      color: "var(--text-muted)",
                      flexShrink: 0,
                    }}
                  >
                    %
                  </span>
                </div>
              </div>
            </div>

            {/* ─── Footer ─── */}
            <button
              onClick={handleSave}
              style={{
                width: "100%",
                height: 40,
                marginTop: 28,
                background: "var(--accent)",
                color: "white",
                border: "none",
                borderRadius: 30,
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow =
                  "0 0 20px rgba(99,102,241,0.35)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              Save Settings
            </button>
    </>
  );

  // Embedded mode: render inline without modal overlay
  if (embedded) {
    return (
      <div style={{ padding: "24px 32px", maxWidth: 560 }}>
        {formContent}
      </div>
    );
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          <motion.div
            className="modal-content"
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
          >
            {formContent}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
