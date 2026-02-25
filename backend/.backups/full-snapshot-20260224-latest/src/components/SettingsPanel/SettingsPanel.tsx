"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { AppSettings, AppTheme, AppBroker, FundingMethod, AppCurrency } from "@/lib/types";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
}

// ─── Theme Definitions ───
const THEMES: { id: AppTheme; label: string; colors: [string, string, string] }[] = [
  { id: "dark-amber", label: "Dark Amber", colors: ["#1a1714", "#c47b3a", "#ece3d5"] },
  { id: "midnight-blue", label: "Midnight Blue", colors: ["#141a22", "#6b9bd4", "#e3eaf2"] },
  { id: "forest-green", label: "Forest Green", colors: ["#141a16", "#5a9b7a", "#e0ebe4"] },
  { id: "obsidian", label: "Obsidian", colors: ["#0f0f12", "#9b8bb8", "#e8e6ed"] },
  { id: "classic-light", label: "Classic Light", colors: ["#f5f2ed", "#8b6f47", "#2c2620"] },
];

// ─── Broker Definitions ───
const BROKERS: { id: AppBroker; name: string; desc: string; status: "connected" | "available" }[] = [
  { id: "egm", name: "EGM Securities", desc: "NSE licensed broker • est. 1994", status: "connected" },
  { id: "dyer-blair", name: "Dyer & Blair", desc: "Full-service investment bank", status: "available" },
  { id: "faida", name: "Faida Investment Bank", desc: "Research-driven brokerage", status: "available" },
  { id: "genghis", name: "Genghis Capital", desc: "Digital-first trading platform", status: "available" },
  { id: "sbg", name: "SBG Securities (Stanbic)", desc: "Pan-African market access", status: "available" },
  { id: "standard-inv", name: "Standard Investment Bank", desc: "Equity & fixed income", status: "available" },
  { id: "aib-axys", name: "AIB-AXYS Africa", desc: "Frontier markets specialist", status: "available" },
];

// ─── Funding Methods ───
const FUNDING_METHODS: { id: FundingMethod; name: string; desc: string; color: string; icon: string }[] = [
  { id: "mpesa", name: "M-Pesa", desc: "Safaricom • Instant", color: "#4CAF50", icon: "M" },
  { id: "airtel-money", name: "Airtel Money", desc: "Airtel Kenya • Instant", color: "#ED1C24", icon: "A" },
  { id: "tkash", name: "T-Kash", desc: "Telkom Kenya • Instant", color: "#00A0DF", icon: "T" },
  { id: "kcb-mpesa", name: "KCB M-Pesa", desc: "KCB Bank • 1-2 hrs", color: "#00704A", icon: "K" },
  { id: "equity-eazzy", name: "Equity Eazzy", desc: "Equity Bank • Instant", color: "#8B0000", icon: "E" },
  { id: "bank-rtgs", name: "Bank Transfer", desc: "RTGS/EFT • 1-3 days", color: "#666", icon: "B" },
  { id: "visa-mc", name: "Visa / Mastercard", desc: "Debit or credit card", color: "#1A1F71", icon: "V" },
];

// ─── Currency Options ───
const CURRENCIES: { id: AppCurrency; label: string; symbol: string }[] = [
  { id: "KES", label: "Kenyan Shilling", symbol: "KSh" },
  { id: "USD", label: "US Dollar", symbol: "$" },
  { id: "GBP", label: "British Pound", symbol: "£" },
  { id: "EUR", label: "Euro", symbol: "€" },
];

const LANGUAGES = [
  { id: "en", label: "English" },
  { id: "sw", label: "Kiswahili" },
];

const REGIONS = [
  { id: "ke", label: "Kenya (NSE)" },
  { id: "ug", label: "Uganda (USE)" },
  { id: "tz", label: "Tanzania (DSE)" },
  { id: "rw", label: "Rwanda (RSE)" },
  { id: "us", label: "United States (NYSE/NASDAQ)" },
  { id: "gb", label: "United Kingdom (LSE)" },
];

// ─── Shared Components ───

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        position: "relative", width: 36, height: 20, borderRadius: 9999,
        background: checked ? "var(--accent)" : "rgba(236,227,213,0.1)",
        border: "none", cursor: "pointer", transition: "background 0.2s ease", flexShrink: 0,
      }}
    >
      <span style={{
        position: "absolute", top: 2, left: checked ? 18 : 2,
        width: 16, height: 16, borderRadius: "50%", background: "#fff",
        transition: "left 0.2s ease",
      }} />
    </button>
  );
}

function SettingRow({ label, subtitle, children }: { label: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 13, color: "var(--text-primary)", display: "block" }}>{label}</span>
        {subtitle && <span style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2, display: "block" }}>{subtitle}</span>}
      </div>
      {children}
    </div>
  );
}

function SectionHeader({ title, badge }: { title: string; badge?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 28, marginBottom: 14 }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontWeight: 600 }}>
        {title}
      </div>
      {badge && (
        <span style={{
          fontSize: 9, padding: "1px 6px", borderRadius: 100,
          background: "rgba(34,171,148,0.12)", color: "var(--buy)",
          fontWeight: 700, fontFamily: "var(--font-mono)", letterSpacing: "0.04em",
        }}>
          {badge}
        </span>
      )}
    </div>
  );
}

function SelectDropdown({ value, options, onChange }: { value: string; options: { id: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: "rgba(236,227,213,0.04)", border: "1px solid rgba(236,227,213,0.08)",
        borderRadius: 8, color: "var(--text-primary)", fontSize: 12, padding: "6px 10px",
        outline: "none", cursor: "pointer", minWidth: 120, appearance: "none",
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%23888' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 8px center",
        paddingRight: 28,
      }}
    >
      {options.map((o) => <option key={o.id} value={o.id} style={{ background: "#1a1714", color: "#ece3d5" }}>{o.label}</option>)}
    </select>
  );
}

function NumberInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => {
        const parsed = parseFloat(e.target.value);
        if (!isNaN(parsed)) onChange(parsed);
      }}
      style={{
        width: 80, background: "rgba(236,227,213,0.04)",
        border: "1px solid rgba(236,227,213,0.08)", borderRadius: 8,
        color: "var(--text-primary)", fontSize: 12, padding: "6px 10px",
        outline: "none", fontVariantNumeric: "tabular-nums", textAlign: "right",
      }}
      onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(236,227,213,0.08)"; }}
    />
  );
}

// ─── Tab Navigation ───
type SettingsTab = "general" | "trading" | "account";

const TABS: { id: SettingsTab; label: string }[] = [
  { id: "general", label: "General" },
  { id: "trading", label: "Trading" },
  { id: "account", label: "Account" },
];

export default function SettingsPanel({ isOpen, onClose, settings, onUpdateSettings }: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const update = (patch: Partial<AppSettings>) => onUpdateSettings({ ...settings, ...patch });

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 14999, background: "rgba(15,12,8,0.4)" }} />

          <motion.div
            className="settings-slide"
            initial={{ x: 380 }}
            animate={{ x: 0 }}
            exit={{ x: 380 }}
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
            style={{ width: 380, padding: 0 }}
          >
            {/* ─── Header ─── */}
            <div style={{ padding: "20px 24px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>Settings</span>
              <button
                onClick={onClose}
                style={{ background: "rgba(236,227,213,0.06)", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 6, borderRadius: 8, display: "flex", alignItems: "center" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(236,227,213,0.1)"; e.currentTarget.style.color = "var(--text-primary)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(236,227,213,0.06)"; e.currentTarget.style.color = "var(--text-muted)"; }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18" /><path d="M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* ─── Tab Bar ─── */}
            <div style={{ display: "flex", gap: 0, padding: "16px 24px 0", borderBottom: "1px solid rgba(236,227,213,0.06)" }}>
              {TABS.map((tab) => {
                const isActive = tab.id === activeTab;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      flex: 1, padding: "8px 0", fontSize: 12, fontWeight: 600, fontFamily: "var(--font-mono)",
                      color: isActive ? "var(--accent)" : "var(--text-muted)",
                      background: "transparent", border: "none",
                      borderBottom: isActive ? "2px solid var(--accent)" : "2px solid transparent",
                      cursor: "pointer", transition: "color 120ms ease", marginBottom: -1,
                    }}
                    onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = "var(--text-secondary)"; }}
                    onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = isActive ? "var(--accent)" : "var(--text-muted)"; }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* ─── Tab Content ─── */}
            <div style={{ padding: "0 24px 32px", overflowY: "auto", height: "calc(100vh - 110px)" }}>

              {/* ═══════════════════════════════════════ */}
              {/* GENERAL TAB                            */}
              {/* ═══════════════════════════════════════ */}
              {activeTab === "general" && (
                <>
                  {/* ─── Theme Selection ─── */}
                  <SectionHeader title="Appearance" />
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12 }}>Theme</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
                    {THEMES.map((theme) => {
                      const isActive = settings.theme === theme.id;
                      return (
                        <button
                          key={theme.id}
                          onClick={() => update({ theme: theme.id })}
                          style={{
                            display: "flex", alignItems: "center", gap: 10,
                            padding: "10px 12px", borderRadius: 10,
                            background: isActive ? "rgba(196,123,58,0.08)" : "rgba(236,227,213,0.02)",
                            border: isActive ? "1.5px solid var(--accent)" : "1px solid rgba(236,227,213,0.06)",
                            cursor: "pointer", transition: "all 120ms ease", textAlign: "left",
                          }}
                          onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.borderColor = "rgba(236,227,213,0.12)"; }}
                          onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.borderColor = "rgba(236,227,213,0.06)"; }}
                        >
                          <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                            {theme.colors.map((c, i) => (
                              <div key={i} style={{
                                width: i === 0 ? 20 : 10, height: 20,
                                borderRadius: i === 0 ? "4px 0 0 4px" : i === 2 ? "0 4px 4px 0" : 0,
                                background: c,
                                border: c === "#f8f6f3" ? "1px solid rgba(0,0,0,0.1)" : "none",
                              }} />
                            ))}
                          </div>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)" }}>{theme.label}</div>
                          </div>
                          {isActive && (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: "auto" }}>
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <SettingRow label="Compact Mode" subtitle="Reduce spacing for more data density">
                    <Toggle checked={settings.compactMode} onChange={(v) => update({ compactMode: v })} />
                  </SettingRow>

                  {/* ─── Language & Region ─── */}
                  <SectionHeader title="Language & Region" />
                  <SettingRow label="Language">
                    <SelectDropdown value={settings.language} options={LANGUAGES} onChange={(v) => update({ language: v })} />
                  </SettingRow>
                  <SettingRow label="Market Region">
                    <SelectDropdown value={settings.marketRegion} options={REGIONS} onChange={(v) => update({ marketRegion: v })} />
                  </SettingRow>
                  <SettingRow label="Currency">
                    <SelectDropdown
                      value={settings.currency}
                      options={CURRENCIES.map((c) => ({ id: c.id, label: `${c.symbol} ${c.id}` }))}
                      onChange={(v) => update({ currency: v as AppCurrency })}
                    />
                  </SettingRow>

                  {/* ─── Notifications ─── */}
                  <SectionHeader title="Notifications" />
                  <SettingRow label="In-App Notifications">
                    <Toggle checked={settings.showNotifications} onChange={(v) => update({ showNotifications: v })} />
                  </SettingRow>
                  <SettingRow label="Push Notifications" subtitle="Browser push for price alerts">
                    <Toggle checked={settings.pushNotifications} onChange={(v) => update({ pushNotifications: v })} />
                  </SettingRow>
                  <SettingRow label="SMS Alerts" subtitle="Via Safaricom SMS gateway">
                    <Toggle checked={settings.smsAlerts} onChange={(v) => update({ smsAlerts: v })} />
                  </SettingRow>
                  {settings.smsAlerts && (
                    <div style={{ padding: "4px 0 10px" }}>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>Phone Number</div>
                      <input
                        type="tel"
                        value={settings.smsPhone}
                        onChange={(e) => update({ smsPhone: e.target.value })}
                        placeholder="+254 7XX XXX XXX"
                        style={{
                          width: "100%", background: "rgba(236,227,213,0.04)",
                          border: "1px solid rgba(236,227,213,0.08)", borderRadius: 8,
                          color: "var(--text-primary)", fontSize: 13, padding: "8px 12px", outline: "none",
                        }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(236,227,213,0.08)"; }}
                      />
                    </div>
                  )}
                  <SettingRow label="Notification Duration">
                    <NumberInput value={settings.notificationDuration} onChange={(v) => update({ notificationDuration: v })} />
                  </SettingRow>

                  {/* ─── About ─── */}
                  <SectionHeader title="About" />
                  <div style={{ background: "rgba(236,227,213,0.02)", borderRadius: 10, border: "1px solid rgba(236,227,213,0.04)", padding: 16 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
                      aFindr
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 12 }}>
                      Version 1.0.0 (Build 2026.02)
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>
                      Regulated by the Capital Markets Authority (CMA) Kenya. Licensed under the Nairobi Securities Exchange.
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8, lineHeight: 1.5 }}>
                      Charts by TradingView. Market data provided by Refinitiv.
                    </div>
                    <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                      <button style={{ fontSize: 11, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}>
                        Terms of Service
                      </button>
                      <button style={{ fontSize: 11, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}>
                        Privacy Policy
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* ═══════════════════════════════════════ */}
              {/* TRADING TAB                            */}
              {/* ═══════════════════════════════════════ */}
              {activeTab === "trading" && (
                <>
                  <SectionHeader title="Order Defaults" />
                  <SettingRow label="Default Order Type">
                    <SelectDropdown
                      value={settings.defaultOrderType}
                      options={[{ id: "market", label: "Market" }, { id: "limit", label: "Limit" }]}
                      onChange={(v) => update({ defaultOrderType: v as "market" | "limit" })}
                    />
                  </SettingRow>
                  <SettingRow label="Default Lot Size">
                    <NumberInput value={settings.defaultLotSize} onChange={(v) => update({ defaultLotSize: v })} />
                  </SettingRow>

                  <SectionHeader title="Execution" />
                  <SettingRow label="One-Click Trading" subtitle="Skip confirmation dialog">
                    <Toggle checked={settings.oneClickTrading} onChange={(v) => update({ oneClickTrading: v })} />
                  </SettingRow>
                  <SettingRow label="Trade Execution Sound">
                    <Toggle checked={settings.tradeExecutionSound} onChange={(v) => update({ tradeExecutionSound: v })} />
                  </SettingRow>

                  <SectionHeader title="Chart Overlay" />
                  <SettingRow label="Buy/Sell Buttons on Chart">
                    <Toggle checked={settings.showBuySellButtons} onChange={(v) => update({ showBuySellButtons: v })} />
                  </SettingRow>
                  <SettingRow label="Positions & Orders on Chart">
                    <Toggle checked={settings.showPositionsOnChart} onChange={(v) => update({ showPositionsOnChart: v })} />
                  </SettingRow>
                  <SettingRow label="Reverse Position Button">
                    <Toggle checked={settings.reversePositionButton} onChange={(v) => update({ reversePositionButton: v })} />
                  </SettingRow>
                  <SettingRow label="Profit & Loss Value">
                    <Toggle checked={settings.showPnlOnChart} onChange={(v) => update({ showPnlOnChart: v })} />
                  </SettingRow>

                  <SectionHeader title="Display" />
                  <SettingRow label="Show Trade History on Chart">
                    <Toggle checked={settings.showTradeHistoryOnChart} onChange={(v) => update({ showTradeHistoryOnChart: v })} />
                  </SettingRow>
                  <div style={{ padding: "8px 0" }}>
                    <SettingRow label="Big Lot Threshold">
                      <NumberInput value={settings.bigLotThreshold} onChange={(v) => update({ bigLotThreshold: v })} />
                    </SettingRow>
                  </div>
                </>
              )}

              {/* ═══════════════════════════════════════ */}
              {/* ACCOUNT TAB                            */}
              {/* ═══════════════════════════════════════ */}
              {activeTab === "account" && (
                <>
                  {/* ─── Broker Selection ─── */}
                  <SectionHeader title="Broker" badge="CONNECTED" />
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
                    {BROKERS.map((broker) => {
                      const isActive = settings.broker === broker.id;
                      const isConnected = broker.status === "connected" && isActive;
                      return (
                        <button
                          key={broker.id}
                          onClick={() => update({ broker: broker.id })}
                          style={{
                            display: "flex", alignItems: "center", gap: 12,
                            padding: "12px 14px", borderRadius: 10, textAlign: "left",
                            background: isActive ? "rgba(196,123,58,0.06)" : "rgba(236,227,213,0.015)",
                            border: isActive ? "1.5px solid var(--accent)" : "1px solid rgba(236,227,213,0.05)",
                            cursor: "pointer", transition: "all 120ms ease", width: "100%",
                          }}
                          onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.borderColor = "rgba(236,227,213,0.12)"; }}
                          onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.borderColor = isActive ? "var(--accent)" : "rgba(236,227,213,0.05)"; }}
                        >
                          <div style={{
                            width: 36, height: 36, borderRadius: 8,
                            background: isActive ? "var(--accent-muted)" : "rgba(236,227,213,0.04)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 14, fontWeight: 800, color: isActive ? "var(--accent)" : "var(--text-muted)",
                            fontFamily: "var(--font-mono)", flexShrink: 0,
                          }}>
                            {broker.name.charAt(0)}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>{broker.name}</div>
                            <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{broker.desc}</div>
                          </div>
                          {isConnected && (
                            <div style={{
                              display: "flex", alignItems: "center", gap: 4,
                              padding: "2px 8px", borderRadius: 100,
                              background: "rgba(34,171,148,0.12)", flexShrink: 0,
                            }}>
                              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--buy)" }} />
                              <span style={{ fontSize: 9, fontWeight: 700, color: "var(--buy)", fontFamily: "var(--font-mono)", letterSpacing: "0.03em" }}>LIVE</span>
                            </div>
                          )}
                          {isActive && !isConnected && (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* ─── Account ID ─── */}
                  {settings.broker !== "none" && (
                    <div style={{ padding: "8px 0 4px" }}>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>Account ID</div>
                      <div style={{
                        display: "flex", alignItems: "center", gap: 8,
                        background: "rgba(236,227,213,0.03)", border: "1px solid rgba(236,227,213,0.06)",
                        borderRadius: 8, padding: "8px 12px",
                      }}>
                        <span style={{ fontSize: 13, color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontWeight: 500, flex: 1 }}>
                          {settings.brokerAccountId}
                        </span>
                        <span style={{
                          fontSize: 9, padding: "2px 6px", borderRadius: 4,
                          background: "rgba(34,171,148,0.1)", color: "var(--buy)",
                          fontWeight: 700, fontFamily: "var(--font-mono)",
                        }}>
                          VERIFIED
                        </span>
                      </div>
                    </div>
                  )}

                  {/* ─── Funding Methods ─── */}
                  <SectionHeader title="Funding Method" badge="PRIMARY" />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
                    {FUNDING_METHODS.map((method) => {
                      const isActive = settings.fundingMethod === method.id;
                      return (
                        <button
                          key={method.id}
                          onClick={() => update({ fundingMethod: method.id })}
                          style={{
                            display: "flex", flexDirection: "column", gap: 8,
                            padding: "12px", borderRadius: 10, textAlign: "left",
                            background: isActive ? `${method.color}10` : "rgba(236,227,213,0.015)",
                            border: isActive ? `1.5px solid ${method.color}60` : "1px solid rgba(236,227,213,0.05)",
                            cursor: "pointer", transition: "all 120ms ease", width: "100%",
                          }}
                          onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.borderColor = "rgba(236,227,213,0.12)"; }}
                          onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.borderColor = isActive ? `${method.color}60` : "rgba(236,227,213,0.05)"; }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{
                              width: 28, height: 28, borderRadius: 6,
                              background: isActive ? method.color : "rgba(236,227,213,0.06)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 12, fontWeight: 800, color: isActive ? "#fff" : "var(--text-muted)",
                              fontFamily: "var(--font-mono)", transition: "all 120ms ease",
                            }}>
                              {method.icon}
                            </div>
                            {isActive && (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={method.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: "auto" }}>
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </div>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)" }}>{method.name}</div>
                            <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 1 }}>{method.desc}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* ─── Quick Deposit ─── */}
                  {settings.fundingMethod !== "none" && (
                    <>
                      <SectionHeader title="Quick Deposit" />
                      <div style={{
                        background: "rgba(236,227,213,0.02)", borderRadius: 10,
                        border: "1px solid rgba(236,227,213,0.06)", padding: 16,
                      }}>
                        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                          {[1000, 5000, 10000, 50000].map((amount) => (
                            <button
                              key={amount}
                              style={{
                                flex: 1, padding: "6px 0", borderRadius: 6,
                                background: "rgba(236,227,213,0.04)",
                                border: "1px solid rgba(236,227,213,0.06)",
                                color: "var(--text-secondary)", fontSize: 11, fontWeight: 600,
                                fontFamily: "var(--font-mono)", cursor: "pointer",
                                transition: "all 100ms ease",
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
                              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(236,227,213,0.06)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
                            >
                              {settings.currency === "KES" ? "KSh" : "$"}{amount.toLocaleString()}
                            </button>
                          ))}
                        </div>
                        <button
                          style={{
                            width: "100%", padding: "10px", borderRadius: 8,
                            background: "var(--accent)", border: "none",
                            color: "#fff", fontSize: 13, fontWeight: 700,
                            cursor: "pointer", transition: "opacity 100ms ease",
                            fontFamily: "var(--font-mono)",
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.85"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
                        >
                          Deposit via {FUNDING_METHODS.find((m) => m.id === settings.fundingMethod)?.name ?? "Selected Method"}
                        </button>
                        {settings.fundingMethod === "mpesa" && (
                          <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 8, textAlign: "center", lineHeight: 1.4 }}>
                            STK push will be sent to your registered M-Pesa number. Paybill: 247247
                          </div>
                        )}
                      </div>

                      {/* ─── Withdrawal ─── */}
                      <SectionHeader title="Withdrawal" />
                      <div style={{
                        background: "rgba(236,227,213,0.02)", borderRadius: 10,
                        border: "1px solid rgba(236,227,213,0.06)", padding: 16,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                          <div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>Available Balance</div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
                              {settings.currency === "KES" ? "KSh 3,250,000" : "$25,000.00"}
                            </div>
                          </div>
                        </div>
                        <button
                          style={{
                            width: "100%", padding: "10px", borderRadius: 8,
                            background: "transparent",
                            border: "1px solid rgba(236,227,213,0.12)",
                            color: "var(--text-secondary)", fontSize: 13, fontWeight: 600,
                            cursor: "pointer", transition: "all 100ms ease",
                            fontFamily: "var(--font-mono)",
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--text-primary)"; e.currentTarget.style.color = "var(--text-primary)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(236,227,213,0.12)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
                        >
                          Withdraw to {FUNDING_METHODS.find((m) => m.id === settings.fundingMethod)?.name ?? "Account"}
                        </button>
                        <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 8, textAlign: "center", lineHeight: 1.4 }}>
                          Processing: M-Pesa instant • Bank 1-3 business days
                        </div>
                      </div>
                    </>
                  )}

                  {/* ─── Security ─── */}
                  <SectionHeader title="Security" />
                  <SettingRow label="Two-Factor Auth" subtitle="Enabled via SMS">
                    <span style={{
                      fontSize: 10, padding: "3px 8px", borderRadius: 100,
                      background: "rgba(34,171,148,0.1)", color: "var(--buy)",
                      fontWeight: 700, fontFamily: "var(--font-mono)",
                    }}>
                      ENABLED
                    </span>
                  </SettingRow>
                  <SettingRow label="Biometric Login" subtitle="Touch ID / Face ID">
                    <Toggle checked={true} onChange={() => {}} />
                  </SettingRow>
                  <SettingRow label="Session Timeout" subtitle="Auto-logout after inactivity">
                    <SelectDropdown
                      value="30"
                      options={[{ id: "15", label: "15 min" }, { id: "30", label: "30 min" }, { id: "60", label: "1 hour" }, { id: "0", label: "Never" }]}
                      onChange={() => {}}
                    />
                  </SettingRow>

                  {/* ─── Danger Zone ─── */}
                  <div style={{ marginTop: 32, padding: 16, borderRadius: 10, border: "1px solid rgba(229,77,77,0.15)", background: "rgba(229,77,77,0.03)" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--sell)", fontFamily: "var(--font-mono)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      Danger Zone
                    </div>
                    <button style={{
                      width: "100%", padding: "8px", borderRadius: 6,
                      background: "transparent", border: "1px solid rgba(229,77,77,0.2)",
                      color: "var(--sell)", fontSize: 12, fontWeight: 600, cursor: "pointer",
                      transition: "all 100ms ease",
                    }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(229,77,77,0.08)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      Disconnect Broker
                    </button>
                    <button style={{
                      width: "100%", padding: "8px", borderRadius: 6, marginTop: 6,
                      background: "transparent", border: "1px solid rgba(229,77,77,0.2)",
                      color: "var(--sell)", fontSize: 12, fontWeight: 600, cursor: "pointer",
                      transition: "all 100ms ease",
                    }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(229,77,77,0.08)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      Delete Account & Data
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
