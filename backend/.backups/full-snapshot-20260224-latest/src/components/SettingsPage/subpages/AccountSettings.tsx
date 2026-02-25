"use client";

import type { AppSettings, AppBroker, FundingMethod } from "@/lib/types";
import { Toggle, SettingRow, SectionHeader, SelectDropdown } from "../SettingsComponents";

const BROKERS: { id: AppBroker; name: string; desc: string; status: "connected" | "available" }[] = [
  { id: "egm", name: "EGM Securities", desc: "NSE licensed broker", status: "connected" },
  { id: "dyer-blair", name: "Dyer & Blair", desc: "Full-service investment bank", status: "available" },
  { id: "faida", name: "Faida Investment Bank", desc: "Research-driven brokerage", status: "available" },
  { id: "genghis", name: "Genghis Capital", desc: "Digital-first platform", status: "available" },
  { id: "sbg", name: "SBG Securities", desc: "Pan-African access", status: "available" },
  { id: "standard-inv", name: "Standard Investment Bank", desc: "Equity & fixed income", status: "available" },
  { id: "aib-axys", name: "AIB-AXYS Africa", desc: "Frontier markets", status: "available" },
];

const FUNDING_METHODS: { id: FundingMethod; name: string; desc: string; color: string; icon: string }[] = [
  { id: "mpesa", name: "M-Pesa", desc: "Instant", color: "#4CAF50", icon: "M" },
  { id: "airtel-money", name: "Airtel Money", desc: "Instant", color: "#ED1C24", icon: "A" },
  { id: "tkash", name: "T-Kash", desc: "Instant", color: "#00A0DF", icon: "T" },
  { id: "kcb-mpesa", name: "KCB M-Pesa", desc: "1-2 hrs", color: "#00704A", icon: "K" },
  { id: "equity-eazzy", name: "Equity Eazzy", desc: "Instant", color: "#8B0000", icon: "E" },
  { id: "bank-rtgs", name: "Bank Transfer", desc: "1-3 days", color: "#666", icon: "B" },
  { id: "visa-mc", name: "Visa / MC", desc: "Card", color: "#1A1F71", icon: "V" },
];

interface AccountSettingsProps {
  settings: AppSettings;
  onUpdate: (patch: Partial<AppSettings>) => void;
}

export default function AccountSettings({ settings, onUpdate }: AccountSettingsProps) {
  const update = (patch: Partial<AppSettings>) => onUpdate({ ...settings, ...patch });

  return (
    <div style={{ padding: "24px 32px 32px", flex: 1 }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4, letterSpacing: "-0.02em" }}>
        Account
      </h1>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20, lineHeight: 1.5 }}>
        Broker connection, funding methods, and account security.
      </p>

      <SectionHeader title="Broker" badge="CONNECTED" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8, marginBottom: 16 }}>
        {BROKERS.map((broker) => {
          const isActive = settings.broker === broker.id;
          const isConnected = broker.status === "connected" && isActive;
          return (
            <button
              key={broker.id}
              onClick={() => update({ broker: broker.id })}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 14px", borderRadius: 10, textAlign: "left",
                background: isActive ? "rgba(196,123,58,0.06)" : "rgba(236,227,213,0.015)",
                border: isActive ? "1.5px solid var(--accent)" : "1px solid rgba(236,227,213,0.05)",
                cursor: "pointer", transition: "all 120ms ease", width: "100%",
              }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.borderColor = "rgba(236,227,213,0.12)"; }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.borderColor = "rgba(236,227,213,0.05)"; }}
            >
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: isActive ? "var(--accent-muted)" : "rgba(236,227,213,0.04)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, fontWeight: 800, color: isActive ? "var(--accent)" : "var(--text-muted)",
                fontFamily: "var(--font-mono)", flexShrink: 0,
              }}>
                {broker.name.charAt(0)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{broker.name}</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{broker.desc}</div>
              </div>
              {isConnected && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 4,
                  padding: "2px 8px", borderRadius: 100,
                  background: "rgba(34,171,148,0.12)", flexShrink: 0,
                }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--buy)" }} />
                  <span style={{ fontSize: 9, fontWeight: 700, color: "var(--buy)", fontFamily: "var(--font-mono)" }}>LIVE</span>
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

      {settings.broker !== "none" && (
        <div style={{ marginBottom: 16 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            background: "rgba(236,227,213,0.03)", border: "1px solid rgba(236,227,213,0.06)",
            borderRadius: 8, padding: "8px 14px",
          }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Account ID</span>
            <span style={{ fontSize: 13, color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontWeight: 500, flex: 1 }}>
              {settings.brokerAccountId}
            </span>
            <span style={{
              fontSize: 9, padding: "2px 8px", borderRadius: 6,
              background: "rgba(34,171,148,0.1)", color: "var(--buy)",
              fontWeight: 700, fontFamily: "var(--font-mono)",
            }}>
              VERIFIED
            </span>
          </div>
        </div>
      )}

      {/* Funding + Security side by side */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, alignItems: "start" }}>
        <div>
          <SectionHeader title="Funding Method" badge="PRIMARY" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {FUNDING_METHODS.map((method) => {
              const isActive = settings.fundingMethod === method.id;
              return (
                <button
                  key={method.id}
                  onClick={() => update({ fundingMethod: method.id })}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 12px", borderRadius: 10, textAlign: "left",
                    background: isActive ? `${method.color}15` : "rgba(236,227,213,0.015)",
                    border: isActive ? `1.5px solid ${method.color}70` : "1px solid rgba(236,227,213,0.05)",
                    cursor: "pointer", transition: "all 120ms ease", width: "100%",
                  }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.borderColor = "rgba(236,227,213,0.12)"; }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.borderColor = "rgba(236,227,213,0.05)"; }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: 7,
                    background: isActive ? method.color : "rgba(236,227,213,0.06)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 800, color: isActive ? "#fff" : "var(--text-muted)",
                    fontFamily: "var(--font-mono)", transition: "all 120ms ease", flexShrink: 0,
                  }}>
                    {method.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{method.name}</div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{method.desc}</div>
                  </div>
                  {isActive && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={method.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div>
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
          <SettingRow label="Session Timeout">
            <SelectDropdown
              value="30"
              options={[{ id: "15", label: "15 min" }, { id: "30", label: "30 min" }, { id: "60", label: "1 hour" }, { id: "0", label: "Never" }]}
              onChange={() => {}}
            />
          </SettingRow>

          <div style={{ marginTop: 20, padding: 14, borderRadius: 10, border: "1px solid rgba(229,77,77,0.15)", background: "rgba(229,77,77,0.03)" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--sell)", fontFamily: "var(--font-mono)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Danger Zone
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{
                flex: 1, padding: "8px", borderRadius: 8,
                background: "transparent", border: "1px solid rgba(229,77,77,0.2)",
                color: "var(--sell)", fontSize: 12, fontWeight: 600, cursor: "pointer",
                transition: "all 100ms ease",
              }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(229,77,77,0.08)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                Disconnect
              </button>
              <button style={{
                flex: 1, padding: "8px", borderRadius: 8,
                background: "transparent", border: "1px solid rgba(229,77,77,0.2)",
                color: "var(--sell)", fontSize: 12, fontWeight: 600, cursor: "pointer",
                transition: "all 100ms ease",
              }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(229,77,77,0.08)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
