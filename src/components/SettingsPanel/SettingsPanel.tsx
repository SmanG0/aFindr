"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { AppSettings } from "@/lib/types";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        position: "relative",
        width: 36,
        height: 20,
        borderRadius: 9999,
        background: checked ? "var(--accent)" : "rgba(236,227,213,0.1)",
        border: "none",
        cursor: "pointer",
        transition: "background 0.2s ease",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: checked ? 18 : 2,
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: "#fff",
          transition: "left 0.2s ease",
        }}
      />
    </button>
  );
}

function SettingRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 0",
      }}
    >
      <span style={{ fontSize: 14, color: "var(--text-primary)" }}>{label}</span>
      {children}
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div
      style={{
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        color: "var(--text-muted)",
        marginTop: 24,
        marginBottom: 12,
      }}
    >
      {title}
    </div>
  );
}

function NumberInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => {
        const parsed = parseFloat(e.target.value);
        if (!isNaN(parsed)) {
          onChange(parsed);
        }
      }}
      style={{
        width: "100%",
        background: "transparent",
        border: "none",
        borderBottom: "1px solid rgba(236,227,213,0.1)",
        color: "var(--text-primary)",
        fontSize: 13,
        padding: "6px 0",
        outline: "none",
        fontVariantNumeric: "tabular-nums",
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderBottomColor = "var(--accent)";
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderBottomColor = "rgba(236,227,213,0.1)";
      }}
    />
  );
}

export default function SettingsPanel({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}: SettingsPanelProps) {
  const update = (patch: Partial<AppSettings>) => {
    onUpdateSettings({ ...settings, ...patch });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={onClose}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 14999,
              background: "rgba(15,12,8,0.4)",
            }}
          />

          {/* Panel */}
          <motion.div
            className="settings-slide"
            initial={{ x: 340 }}
            animate={{ x: 0 }}
            exit={{ x: 340 }}
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 24,
              }}
            >
              <span style={{ fontSize: 18, fontWeight: 500, color: "var(--text-primary)" }}>
                Settings
              </span>
              <button
                onClick={onClose}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  padding: 4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
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
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6L6 18" />
                  <path d="M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* ─── Trading ─── */}
            <SectionHeader title="Trading" />
            <SettingRow label="Buy/Sell Buttons on Chart">
              <Toggle
                checked={settings.showBuySellButtons ?? true}
                onChange={(v) => update({ showBuySellButtons: v })}
              />
            </SettingRow>
            <SettingRow label="One-Click Trading">
              <Toggle
                checked={settings.oneClickTrading}
                onChange={(v) => update({ oneClickTrading: v })}
              />
            </SettingRow>
            <SettingRow label="Trade Execution Sound">
              <Toggle
                checked={settings.tradeExecutionSound}
                onChange={(v) => update({ tradeExecutionSound: v })}
              />
            </SettingRow>
            <SettingRow label="Positions & Orders on Chart">
              <Toggle
                checked={settings.showPositionsOnChart ?? true}
                onChange={(v) => update({ showPositionsOnChart: v })}
              />
            </SettingRow>
            <SettingRow label="Reverse Position Button">
              <Toggle
                checked={settings.reversePositionButton ?? false}
                onChange={(v) => update({ reversePositionButton: v })}
              />
            </SettingRow>
            <SettingRow label="Profit & Loss Value">
              <Toggle
                checked={settings.showPnlOnChart ?? true}
                onChange={(v) => update({ showPnlOnChart: v })}
              />
            </SettingRow>

            {/* ─── Notifications ─── */}
            <SectionHeader title="Notifications" />
            <SettingRow label="Show Notifications">
              <Toggle
                checked={settings.showNotifications}
                onChange={(v) => update({ showNotifications: v })}
              />
            </SettingRow>
            <div style={{ padding: "8px 0" }}>
              <div
                style={{
                  fontSize: 14,
                  color: "var(--text-primary)",
                  marginBottom: 6,
                }}
              >
                Duration (seconds)
              </div>
              <NumberInput
                value={settings.notificationDuration}
                onChange={(v) => update({ notificationDuration: v })}
              />
            </div>

            {/* ─── Display ─── */}
            <SectionHeader title="Display" />
            <SettingRow label="Show Trade History">
              <Toggle
                checked={settings.showTradeHistoryOnChart}
                onChange={(v) => update({ showTradeHistoryOnChart: v })}
              />
            </SettingRow>
            <div style={{ padding: "8px 0" }}>
              <div
                style={{
                  fontSize: 14,
                  color: "var(--text-primary)",
                  marginBottom: 6,
                }}
              >
                Big Lot Threshold
              </div>
              <NumberInput
                value={settings.bigLotThreshold}
                onChange={(v) => update({ bigLotThreshold: v })}
              />
            </div>

            {/* ─── About ─── */}
            <SectionHeader title="About" />
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Charts by TradingView
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--text-disabled)",
                marginTop: 4,
              }}
            >
              Version 0.2.0
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
