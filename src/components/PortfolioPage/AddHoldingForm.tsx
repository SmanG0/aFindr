"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SYMBOL_LIBRARY } from "@/lib/symbols";

interface AddHoldingFormProps {
  isOpen: boolean;
  onAdd: (symbol: string, shares: number, avgCost: number, purchaseDate?: number) => void;
  onClose: () => void;
}

export default function AddHoldingForm({ isOpen, onAdd, onClose }: AddHoldingFormProps) {
  const [symbolQuery, setSymbolQuery] = useState("");
  const [selectedSymbol, setSelectedSymbol] = useState("");
  const [shares, setShares] = useState("");
  const [avgCost, setAvgCost] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredSymbols = useMemo(() => {
    if (!symbolQuery.trim() || selectedSymbol) return [];
    const q = symbolQuery.toUpperCase();
    return SYMBOL_LIBRARY
      .filter((s) => s.symbol.includes(q) || s.name.toUpperCase().includes(q))
      .slice(0, 5);
  }, [symbolQuery, selectedSymbol]);

  useEffect(() => {
    setShowDropdown(filteredSymbols.length > 0);
  }, [filteredSymbols]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const resetForm = useCallback(() => {
    setSymbolQuery("");
    setSelectedSymbol("");
    setShares("");
    setAvgCost("");
    setPurchaseDate("");
    setShowDropdown(false);
  }, []);

  const handleSubmit = useCallback(() => {
    const sym = selectedSymbol || symbolQuery.trim().toUpperCase();
    const sharesNum = parseFloat(shares);
    const costNum = parseFloat(avgCost);
    if (!sym || isNaN(sharesNum) || sharesNum <= 0 || isNaN(costNum) || costNum <= 0) return;

    const dateTs = purchaseDate ? new Date(purchaseDate).getTime() : undefined;
    onAdd(sym, sharesNum, costNum, dateTs);
    resetForm();
    onClose();
  }, [selectedSymbol, symbolQuery, shares, avgCost, purchaseDate, onAdd, onClose, resetForm]);

  const selectSymbol = useCallback((symbol: string) => {
    setSelectedSymbol(symbol);
    setSymbolQuery(symbol);
    setShowDropdown(false);
  }, []);

  const canSubmit = (selectedSymbol || symbolQuery.trim()) && shares && avgCost && parseFloat(shares) > 0 && parseFloat(avgCost) > 0;

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid rgba(236,227,213,0.1)",
    background: "rgba(236,227,213,0.03)",
    color: "var(--text-primary)",
    fontSize: 12,
    fontFamily: "var(--font-mono)",
    outline: "none",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    fontFamily: "var(--font-mono)",
    fontWeight: 600,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    marginBottom: 4,
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
          style={{ overflow: "hidden" }}
        >
          <div
            style={{
              background: "var(--glass)",
              borderRadius: 12,
              border: "1px solid var(--glass-border)",
              backdropFilter: "blur(12px)",
              padding: "16px 20px",
              marginBottom: 16,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {/* Symbol */}
            <div style={{ position: "relative" }} ref={dropdownRef}>
              <div style={labelStyle}>Symbol</div>
              <input
                ref={inputRef}
                value={symbolQuery}
                onChange={(e) => {
                  setSymbolQuery(e.target.value);
                  setSelectedSymbol("");
                }}
                placeholder="Search AAPL, BTC..."
                style={inputStyle}
                autoFocus
              />
              <AnimatePresence>
                {showDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.12 }}
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      right: 0,
                      marginTop: 4,
                      background: "var(--glass)",
                      backdropFilter: "blur(16px)",
                      border: "1px solid var(--glass-border)",
                      borderRadius: 8,
                      overflow: "hidden",
                      zIndex: 50,
                    }}
                  >
                    {filteredSymbols.map((s) => (
                      <button
                        key={s.symbol}
                        onClick={() => selectSymbol(s.symbol)}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "8px 12px",
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          transition: "background 80ms ease",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(236,227,213,0.05)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>
                            {s.symbol}
                          </span>
                          <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                            {s.name}
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: 8,
                            fontFamily: "var(--font-mono)",
                            fontWeight: 600,
                            color: "var(--text-muted)",
                            background: "rgba(236,227,213,0.06)",
                            padding: "2px 5px",
                            borderRadius: 3,
                            textTransform: "uppercase",
                          }}
                        >
                          {s.category}
                        </span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Shares + Avg Cost side by side */}
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={labelStyle}>Shares / Units</div>
                <input
                  type="number"
                  value={shares}
                  onChange={(e) => setShares(e.target.value)}
                  placeholder="0"
                  min="0"
                  step="any"
                  style={inputStyle}
                />
              </div>
              <div style={{ flex: 1 }}>
                <div style={labelStyle}>Avg Cost Basis</div>
                <input
                  type="number"
                  value={avgCost}
                  onChange={(e) => setAvgCost(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="any"
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Purchase Date (optional) */}
            <div>
              <div style={labelStyle}>Purchase Date (optional)</div>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                style={{
                  ...inputStyle,
                  colorScheme: "dark",
                }}
              />
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => { resetForm(); onClose(); }}
                style={{
                  padding: "6px 14px",
                  borderRadius: 8,
                  background: "transparent",
                  border: "1px solid rgba(236,227,213,0.1)",
                  color: "var(--text-muted)",
                  fontSize: 11,
                  fontFamily: "var(--font-mono)",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                style={{
                  padding: "6px 14px",
                  borderRadius: 8,
                  background: canSubmit ? "var(--accent)" : "rgba(236,227,213,0.06)",
                  border: "none",
                  color: canSubmit ? "var(--bg)" : "var(--text-disabled)",
                  fontSize: 11,
                  fontFamily: "var(--font-mono)",
                  fontWeight: 700,
                  cursor: canSubmit ? "pointer" : "default",
                  transition: "all 120ms ease",
                }}
              >
                Add Holding
              </button>
            </div>
          </div>

          <style>{`
            input[type="number"]::-webkit-inner-spin-button,
            input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
            input[type="number"] { -moz-appearance: textfield; }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
