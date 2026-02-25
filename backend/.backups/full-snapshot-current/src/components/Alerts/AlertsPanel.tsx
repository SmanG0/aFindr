"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type AlertCondition = "above" | "below" | "crosses_above" | "crosses_below";
type AlertType = "price" | "news";

interface AlertsPanelProps {
  userId: Id<"users"> | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function AlertsPanel({ userId, isOpen, onClose }: AlertsPanelProps) {
  const alerts = useQuery(
    api.alerts.list,
    userId ? { userId } : "skip",
  );
  const createAlert = useMutation(api.alerts.create);
  const updateAlert = useMutation(api.alerts.update);
  const removeAlert = useMutation(api.alerts.remove);

  const [showCreate, setShowCreate] = useState(false);
  const [alertType, setAlertType] = useState<AlertType>("price");
  const [symbol, setSymbol] = useState("");
  const [condition, setCondition] = useState<AlertCondition>("above");
  const [targetPrice, setTargetPrice] = useState("");
  const [keywords, setKeywords] = useState("");

  const resetForm = useCallback(() => {
    setSymbol("");
    setCondition("above");
    setTargetPrice("");
    setKeywords("");
    setShowCreate(false);
  }, []);

  const handleCreate = useCallback(async () => {
    if (!userId || !symbol.trim()) return;
    await createAlert({
      userId,
      type: alertType,
      symbol: symbol.trim().toUpperCase(),
      condition: alertType === "price" ? condition : undefined,
      targetPrice: alertType === "price" && targetPrice ? parseFloat(targetPrice) : undefined,
      keywords: alertType === "news" && keywords.trim()
        ? keywords.split(",").map((k) => k.trim()).filter(Boolean)
        : undefined,
    });
    resetForm();
  }, [userId, symbol, alertType, condition, targetPrice, keywords, createAlert, resetForm]);

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.15 }}
      style={{
        position: "fixed",
        top: 52,
        right: 100,
        zIndex: 1000,
        background: "rgba(33,30,26,0.98)",
        border: "1px solid rgba(236,227,213,0.1)",
        borderRadius: 12,
        padding: 16,
        width: 360,
        maxHeight: "70vh",
        overflowY: "auto",
        backdropFilter: "blur(20px)",
        boxShadow: "0 16px 48px rgba(15,12,8,0.6)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Alerts</span>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={() => setShowCreate((v) => !v)}
            style={{
              padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
              background: showCreate ? "rgba(196,123,58,0.2)" : "rgba(236,227,213,0.06)",
              border: "1px solid rgba(236,227,213,0.1)",
              color: showCreate ? "var(--accent)" : "var(--text-secondary)",
              cursor: "pointer",
            }}
          >
            {showCreate ? "Cancel" : "+ New Alert"}
          </button>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Create Form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{ overflow: "hidden", marginBottom: 12 }}
          >
            <div style={{
              padding: 12, borderRadius: 8,
              background: "rgba(236,227,213,0.04)",
              border: "1px solid rgba(236,227,213,0.08)",
              display: "flex", flexDirection: "column", gap: 8,
            }}>
              {/* Type selector */}
              <div style={{ display: "flex", gap: 4 }}>
                {(["price", "news"] as AlertType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setAlertType(t)}
                    style={{
                      flex: 1, padding: "6px 0", borderRadius: 6, fontSize: 11,
                      fontWeight: 600, textTransform: "capitalize",
                      background: alertType === t ? "rgba(196,123,58,0.15)" : "transparent",
                      border: alertType === t ? "1px solid rgba(196,123,58,0.3)" : "1px solid rgba(236,227,213,0.08)",
                      color: alertType === t ? "var(--accent)" : "var(--text-muted)",
                      cursor: "pointer",
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {/* Symbol */}
              <input
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder="Symbol (e.g. AAPL, SCOM)"
                style={{
                  padding: "8px 10px", borderRadius: 6, fontSize: 12,
                  background: "rgba(236,227,213,0.04)",
                  border: "1px solid rgba(236,227,213,0.1)",
                  color: "var(--text-primary)", outline: "none",
                  fontFamily: "var(--font-mono)",
                }}
              />

              {alertType === "price" ? (
                <>
                  {/* Condition */}
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value as AlertCondition)}
                    style={{
                      padding: "8px 10px", borderRadius: 6, fontSize: 12,
                      background: "rgba(236,227,213,0.04)",
                      border: "1px solid rgba(236,227,213,0.1)",
                      color: "var(--text-primary)", outline: "none",
                    }}
                  >
                    <option value="above">Price above</option>
                    <option value="below">Price below</option>
                    <option value="crosses_above">Crosses above</option>
                    <option value="crosses_below">Crosses below</option>
                  </select>
                  {/* Target price */}
                  <input
                    type="number"
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(e.target.value)}
                    placeholder="Target price"
                    style={{
                      padding: "8px 10px", borderRadius: 6, fontSize: 12,
                      background: "rgba(236,227,213,0.04)",
                      border: "1px solid rgba(236,227,213,0.1)",
                      color: "var(--text-primary)", outline: "none",
                      fontFamily: "var(--font-mono)",
                    }}
                  />
                </>
              ) : (
                <input
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="Keywords (comma-separated)"
                  style={{
                    padding: "8px 10px", borderRadius: 6, fontSize: 12,
                    background: "rgba(236,227,213,0.04)",
                    border: "1px solid rgba(236,227,213,0.1)",
                    color: "var(--text-primary)", outline: "none",
                  }}
                />
              )}

              <button
                onClick={handleCreate}
                disabled={!symbol.trim()}
                style={{
                  padding: "8px 0", borderRadius: 6, fontSize: 12, fontWeight: 600,
                  background: symbol.trim() ? "var(--accent)" : "rgba(236,227,213,0.06)",
                  border: "none",
                  color: symbol.trim() ? "#fff" : "var(--text-disabled)",
                  cursor: symbol.trim() ? "pointer" : "default",
                }}
              >
                Create Alert
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Alerts List */}
      {!alerts || alerts.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: 20 }}>
          No alerts yet. Create one to get started.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {alerts.map((alert) => (
            <div
              key={alert._id}
              style={{
                padding: "10px 12px", borderRadius: 8,
                background: "rgba(236,227,213,0.04)",
                border: "1px solid rgba(236,227,213,0.06)",
                display: "flex", alignItems: "center", gap: 10,
                opacity: alert.active ? 1 : 0.5,
              }}
            >
              {/* Alert info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{
                    fontSize: 12, fontWeight: 600, color: "var(--text-primary)",
                    fontFamily: "var(--font-mono)",
                  }}>
                    {alert.symbol}
                  </span>
                  <span style={{
                    fontSize: 9, padding: "2px 6px", borderRadius: 4,
                    background: alert.type === "price" ? "rgba(34,197,94,0.1)" : "rgba(59,130,246,0.1)",
                    color: alert.type === "price" ? "var(--buy)" : "#3b82f6",
                    fontWeight: 600, textTransform: "uppercase",
                    fontFamily: "var(--font-mono)",
                  }}>
                    {alert.type}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                  {alert.type === "price"
                    ? `${alert.condition?.replace("_", " ")} ${alert.targetPrice?.toFixed(2)}`
                    : `Keywords: ${alert.keywords?.join(", ")}`}
                </div>
              </div>

              {/* Toggle */}
              <button
                onClick={() => updateAlert({ alertId: alert._id, active: !alert.active })}
                style={{
                  width: 36, height: 20, borderRadius: 10, border: "none",
                  background: alert.active ? "var(--accent)" : "rgba(236,227,213,0.1)",
                  cursor: "pointer", position: "relative", transition: "background 150ms ease",
                  flexShrink: 0,
                }}
              >
                <div style={{
                  width: 16, height: 16, borderRadius: "50%",
                  background: "#fff", position: "absolute", top: 2,
                  left: alert.active ? 18 : 2, transition: "left 150ms ease",
                }} />
              </button>

              {/* Delete */}
              <button
                onClick={() => removeAlert({ alertId: alert._id })}
                style={{
                  background: "none", border: "none",
                  color: "var(--text-muted)", cursor: "pointer",
                  opacity: 0.4, padding: 2, flexShrink: 0,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.color = "var(--sell)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.4"; e.currentTarget.style.color = "var(--text-muted)"; }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
