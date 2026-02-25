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
    <div style={{ padding: "32px 40px 48px", maxWidth: 640 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8, letterSpacing: "-0.02em" }}>
        Broker Logins
      </h1>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 32, lineHeight: 1.5 }}>
        Manage your broker account credentials and OAuth connections. Credentials are stored securely and never shared.
      </p>

      <SectionHeader title="Connected Brokers" badge="1 ACTIVE" />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {BROKERS.map((broker) => (
          <div
            key={broker.id}
            style={{
              display: "flex", alignItems: "center", gap: 16,
              padding: "16px 20px", borderRadius: 12,
              background: broker.status === "connected" ? "rgba(34,171,148,0.06)" : "rgba(236,227,213,0.02)",
              border: broker.status === "connected" ? "1px solid rgba(34,171,148,0.2)" : "1px solid rgba(236,227,213,0.06)",
            }}
          >
            <div style={{
              width: 44, height: 44, borderRadius: 10,
              background: broker.status === "connected" ? "rgba(34,171,148,0.12)" : "rgba(236,227,213,0.04)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, fontWeight: 800, color: broker.status === "connected" ? "var(--buy)" : "var(--text-muted)",
              fontFamily: "var(--font-mono)", flexShrink: 0,
            }}>
              {broker.name.charAt(0)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>{broker.name}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {broker.status === "connected" ? "Connected • Last sync: 2 min ago" : "Not connected"}
              </div>
            </div>
            <button
              style={{
                padding: "8px 16px", borderRadius: 8,
                background: broker.status === "connected" ? "rgba(229,77,77,0.1)" : "var(--accent-muted)",
                border: broker.status === "connected" ? "1px solid rgba(229,77,77,0.2)" : "1px solid rgba(196,123,58,0.2)",
                color: broker.status === "connected" ? "var(--sell)" : "var(--accent-bright)",
                fontSize: 12, fontWeight: 600, cursor: "pointer",
                transition: "all 100ms ease", fontFamily: "var(--font-mono)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = "0.9";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = "1";
              }}
            >
              {broker.status === "connected" ? "Disconnect" : "Connect"}
            </button>
          </div>
        ))}
      </div>

      <SectionHeader title="Add New Broker" />
      <div style={{
        background: "rgba(236,227,213,0.02)", borderRadius: 12,
        border: "1px dashed rgba(236,227,213,0.15)", padding: 24,
        textAlign: "center",
      }}>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>
          Connect additional NSE-licensed brokers via OAuth or API credentials
        </div>
        <button
          style={{
            padding: "10px 20px", borderRadius: 8,
            background: "transparent",
            border: "1px solid rgba(236,227,213,0.15)",
            color: "var(--text-secondary)", fontSize: 13, fontWeight: 600,
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
          + Add Broker Connection
        </button>
      </div>

      <SectionHeader title="Manual Credentials (EGM)" />
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>Client ID</div>
        <TextInput value="EGM-2847593" onChange={() => {}} placeholder="Client ID" />
      </div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>API Secret</div>
        <TextInput value="" onChange={() => {}} placeholder="••••••••••••" type="password" />
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8, lineHeight: 1.5 }}>
          Obtain from your broker. Used for order execution and position sync.
        </div>
      </div>

      <div style={{ background: "rgba(196,123,58,0.06)", borderRadius: 12, border: "1px solid rgba(196,123,58,0.15)", padding: 16, marginTop: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--accent-bright)", marginBottom: 6 }}>OAuth Recommended</div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.6 }}>
          For brokers that support it, OAuth is more secure than storing API keys. You&apos;ll be redirected to your broker&apos;s login page.
        </div>
      </div>
    </div>
  );
}
