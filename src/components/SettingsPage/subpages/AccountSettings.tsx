"use client";

import type { AppSettings, AppBroker, FundingMethod } from "@/lib/types";
import { Toggle, SettingRow, SectionHeader, SelectDropdown } from "../SettingsComponents";

const BROKERS: { id: AppBroker; name: string; desc: string; status: "connected" | "available" }[] = [
  { id: "egm", name: "EGM Securities", desc: "NSE licensed broker • est. 1994", status: "connected" },
  { id: "dyer-blair", name: "Dyer & Blair", desc: "Full-service investment bank", status: "available" },
  { id: "faida", name: "Faida Investment Bank", desc: "Research-driven brokerage", status: "available" },
  { id: "genghis", name: "Genghis Capital", desc: "Digital-first trading platform", status: "available" },
  { id: "sbg", name: "SBG Securities (Stanbic)", desc: "Pan-African market access", status: "available" },
  { id: "standard-inv", name: "Standard Investment Bank", desc: "Equity & fixed income", status: "available" },
  { id: "aib-axys", name: "AIB-AXYS Africa", desc: "Frontier markets specialist", status: "available" },
];

const FUNDING_METHODS: { id: FundingMethod; name: string; desc: string; color: string; icon: string }[] = [
  { id: "mpesa", name: "M-Pesa", desc: "Safaricom • Instant", color: "#4CAF50", icon: "M" },
  { id: "airtel-money", name: "Airtel Money", desc: "Airtel Kenya • Instant", color: "#ED1C24", icon: "A" },
  { id: "tkash", name: "T-Kash", desc: "Telkom Kenya • Instant", color: "#00A0DF", icon: "T" },
  { id: "kcb-mpesa", name: "KCB M-Pesa", desc: "KCB Bank • 1-2 hrs", color: "#00704A", icon: "K" },
  { id: "equity-eazzy", name: "Equity Eazzy", desc: "Equity Bank • Instant", color: "#8B0000", icon: "E" },
  { id: "bank-rtgs", name: "Bank Transfer", desc: "RTGS/EFT • 1-3 days", color: "#666", icon: "B" },
  { id: "visa-mc", name: "Visa / Mastercard", desc: "Debit or credit card", color: "#1A1F71", icon: "V" },
];

interface AccountSettingsProps {
  settings: AppSettings;
  onUpdate: (patch: Partial<AppSettings>) => void;
}

export default function AccountSettings({ settings, onUpdate }: AccountSettingsProps) {
  const update = (patch: Partial<AppSettings>) => onUpdate({ ...settings, ...patch });

  return (
    <div style={{ padding: "32px 40px 48px", maxWidth: 640 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8, letterSpacing: "-0.02em" }}>
        Account
      </h1>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 32, lineHeight: 1.5 }}>
        Broker connection, funding methods, and account security.
      </p>

      <SectionHeader title="Broker" badge="CONNECTED" />
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
        {BROKERS.map((broker) => {
          const isActive = settings.broker === broker.id;
          const isConnected = broker.status === "connected" && isActive;
          return (
            <button
              key={broker.id}
              onClick={() => update({ broker: broker.id })}
              style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "14px 18px", borderRadius: 12, textAlign: "left",
                background: isActive ? "rgba(196,123,58,0.06)" : "rgba(236,227,213,0.015)",
                border: isActive ? "1.5px solid var(--accent)" : "1px solid rgba(236,227,213,0.05)",
                cursor: "pointer", transition: "all 120ms ease", width: "100%",
              }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.borderColor = "rgba(236,227,213,0.12)"; }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.borderColor = "rgba(236,227,213,0.05)"; }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: isActive ? "var(--accent-muted)" : "rgba(236,227,213,0.04)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16, fontWeight: 800, color: isActive ? "var(--accent)" : "var(--text-muted)",
                fontFamily: "var(--font-mono)", flexShrink: 0,
              }}>
                {broker.name.charAt(0)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>{broker.name}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{broker.desc}</div>
              </div>
              {isConnected && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "4px 10px", borderRadius: 100,
                  background: "rgba(34,171,148,0.12)", flexShrink: 0,
                }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--buy)" }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: "var(--buy)", fontFamily: "var(--font-mono)", letterSpacing: "0.03em" }}>LIVE</span>
                </div>
              )}
              {isActive && !isConnected && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          );
        })}
      </div>

      {settings.broker !== "none" && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>Account ID</div>
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            background: "rgba(236,227,213,0.03)", border: "1px solid rgba(236,227,213,0.06)",
            borderRadius: 10, padding: "12px 16px",
          }}>
            <span style={{ fontSize: 14, color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontWeight: 500, flex: 1 }}>
              {settings.brokerAccountId}
            </span>
            <span style={{
              fontSize: 10, padding: "3px 8px", borderRadius: 6,
              background: "rgba(34,171,148,0.1)", color: "var(--buy)",
              fontWeight: 700, fontFamily: "var(--font-mono)",
            }}>
              VERIFIED
            </span>
          </div>
        </div>
      )}

      <SectionHeader title="Funding Method" badge="PRIMARY" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
        {FUNDING_METHODS.map((method) => {
          const isActive = settings.fundingMethod === method.id;
          return (
            <button
              key={method.id}
              onClick={() => update({ fundingMethod: method.id })}
              style={{
                display: "flex", flexDirection: "column", gap: 10,
                padding: "14px", borderRadius: 12, textAlign: "left",
                background: isActive ? `${method.color}15` : "rgba(236,227,213,0.015)",
                border: isActive ? `1.5px solid ${method.color}70` : "1px solid rgba(236,227,213,0.05)",
                cursor: "pointer", transition: "all 120ms ease", width: "100%",
              }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.borderColor = "rgba(236,227,213,0.12)"; }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.borderColor = "rgba(236,227,213,0.05)"; }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: isActive ? method.color : "rgba(236,227,213,0.06)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, fontWeight: 800, color: isActive ? "#fff" : "var(--text-muted)",
                  fontFamily: "var(--font-mono)", transition: "all 120ms ease",
                }}>
                  {method.icon}
                </div>
                {isActive && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={method.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: "auto" }}>
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{method.name}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{method.desc}</div>
              </div>
            </button>
          );
        })}
      </div>

      <SectionHeader title="Security" />
      <SettingRow label="Two-Factor Auth" subtitle="Enabled via SMS">
        <span style={{
          fontSize: 11, padding: "4px 10px", borderRadius: 100,
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

      <div style={{ marginTop: 40, padding: 20, borderRadius: 12, border: "1px solid rgba(229,77,77,0.15)", background: "rgba(229,77,77,0.03)" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--sell)", fontFamily: "var(--font-mono)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Danger Zone
        </div>
        <button style={{
          width: "100%", padding: "10px", borderRadius: 8,
          background: "transparent", border: "1px solid rgba(229,77,77,0.2)",
          color: "var(--sell)", fontSize: 13, fontWeight: 600, cursor: "pointer",
          transition: "all 100ms ease",
        }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(229,77,77,0.08)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
          Disconnect Broker
        </button>
        <button style={{
          width: "100%", padding: "10px", borderRadius: 8, marginTop: 8,
          background: "transparent", border: "1px solid rgba(229,77,77,0.2)",
          color: "var(--sell)", fontSize: 13, fontWeight: 600, cursor: "pointer",
          transition: "all 100ms ease",
        }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(229,77,77,0.08)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
          Delete Account & Data
        </button>
      </div>
    </div>
  );
}
