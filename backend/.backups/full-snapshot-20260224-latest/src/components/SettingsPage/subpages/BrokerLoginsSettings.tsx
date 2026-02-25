"use client";

import { SectionHeader, TextInput } from "../SettingsComponents";

const BROKERS = [
  { id: "egm", name: "EGM Securities", status: "connected" as const },
  { id: "dyer-blair", name: "Dyer & Blair", status: "disconnected" as const },
  { id: "faida", name: "Faida Investment Bank", status: "disconnected" as const },
  { id: "genghis", name: "Genghis Capital", status: "disconnected" as const },
  { id: "sbg", name: "SBG Securities", status: "disconnected" as const },
];

export default function BrokerLoginsSettings() {
  return (
    <div style={{ padding: "24px 32px 32px", flex: 1 }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4, letterSpacing: "-0.02em" }}>
        Broker Logins
      </h1>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20, lineHeight: 1.5 }}>
        Manage broker credentials and OAuth connections. Credentials are stored securely.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, alignItems: "start" }}>
        {/* Left: Connected brokers */}
        <div>
          <SectionHeader title="Connected Brokers" badge="1 ACTIVE" />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {BROKERS.map((broker) => (
              <div
                key={broker.id}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 14px", borderRadius: 10,
                  background: broker.status === "connected" ? "rgba(34,171,148,0.06)" : "rgba(236,227,213,0.02)",
                  border: broker.status === "connected" ? "1px solid rgba(34,171,148,0.2)" : "1px solid rgba(236,227,213,0.06)",
                }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: broker.status === "connected" ? "rgba(34,171,148,0.12)" : "rgba(236,227,213,0.04)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, fontWeight: 800, color: broker.status === "connected" ? "var(--buy)" : "var(--text-muted)",
                  fontFamily: "var(--font-mono)", flexShrink: 0,
                }}>
                  {broker.name.charAt(0)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{broker.name}</div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                    {broker.status === "connected" ? "Connected • Synced 2m ago" : "Not connected"}
                  </div>
                </div>
                <button
                  style={{
                    padding: "6px 12px", borderRadius: 6,
                    background: broker.status === "connected" ? "rgba(229,77,77,0.1)" : "var(--accent-muted)",
                    border: broker.status === "connected" ? "1px solid rgba(229,77,77,0.2)" : "1px solid rgba(196,123,58,0.2)",
                    color: broker.status === "connected" ? "var(--sell)" : "var(--accent-bright)",
                    fontSize: 11, fontWeight: 600, cursor: "pointer",
                    transition: "all 100ms ease", fontFamily: "var(--font-mono)",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.9"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
                >
                  {broker.status === "connected" ? "Disconnect" : "Connect"}
                </button>
              </div>
            ))}
          </div>

          <div style={{
            background: "rgba(236,227,213,0.02)", borderRadius: 10,
            border: "1px dashed rgba(236,227,213,0.15)", padding: 16,
            textAlign: "center", marginTop: 12,
          }}>
            <button
              style={{
                padding: "8px 16px", borderRadius: 6,
                background: "transparent",
                border: "1px solid rgba(236,227,213,0.15)",
                color: "var(--text-secondary)", fontSize: 12, fontWeight: 600,
                cursor: "pointer", transition: "all 100ms ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--accent)";
                e.currentTarget.style.color = "var(--accent)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(236,227,213,0.15)";
                e.currentTarget.style.color = "var(--text-secondary)";
              }}
            >
              + Add Broker
            </button>
          </div>
        </div>

        {/* Right: Manual credentials */}
        <div>
          <SectionHeader title="Manual Credentials (EGM)" />
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>Client ID</div>
            <TextInput value="EGM-2847593" onChange={() => {}} placeholder="Client ID" />
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>API Secret</div>
            <TextInput value="" onChange={() => {}} placeholder="••••••••••••" type="password" />
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.4 }}>
              Obtain from your broker. Used for order execution and position sync.
            </div>
          </div>

          <div style={{ background: "rgba(196,123,58,0.06)", borderRadius: 10, border: "1px solid rgba(196,123,58,0.15)", padding: 14, marginTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--accent-bright)", marginBottom: 4 }}>OAuth Recommended</div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", lineHeight: 1.5 }}>
              For brokers that support it, OAuth is more secure. You&apos;ll be redirected to your broker&apos;s login page.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
