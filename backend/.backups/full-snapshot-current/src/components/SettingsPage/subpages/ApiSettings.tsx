"use client";

import { SectionHeader, TextInput } from "../SettingsComponents";

const API_KEYS = [
  { section: "Market Data", label: "Refinitiv / Yahoo Finance API Key", placeholder: "Enter API key (optional for demo)", help: "Real-time quotes and historical data. Demo uses public endpoints.", badge: "PRIMARY" as const },
  { section: "News & Research", label: "Perplexity Finance API Key", placeholder: "Optional: richer summaries and sentiment", help: "News feed uses Yahoo Finance RSS (free). Perplexity enriches with summaries." },
  { section: "TradingView", label: "TradingView Widget Token", placeholder: "Optional: advanced chart features", help: "Enables extended charting capabilities and drawing tools sync." },
  { section: "AI / Copilot", label: "OpenAI / Anthropic API Key", placeholder: "sk-...", help: "Used by Alphy for strategy suggestions, backtests, and NL queries." },
];

export default function ApiSettings() {
  return (
    <div style={{ padding: "24px 32px 32px", flex: 1 }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4, letterSpacing: "-0.02em" }}>
        APIs & Data
      </h1>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20, lineHeight: 1.5 }}>
        Configure API keys and data sources for market data, news, and analytics.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 24px" }}>
        {API_KEYS.map((api) => (
          <div key={api.section}>
            <SectionHeader title={api.section} badge={api.badge} />
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>{api.label}</div>
            <TextInput value="" onChange={() => {}} placeholder={api.placeholder} type="password" />
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.4 }}>
              {api.help}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 24 }}>
        <button
          style={{
            padding: "10px 20px", borderRadius: 8,
            background: "var(--accent)", border: "none",
            color: "#fff", fontSize: 12, fontWeight: 700,
            cursor: "pointer", transition: "opacity 100ms ease",
            fontFamily: "var(--font-mono)",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.9"; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
        >
          Save API Keys
        </button>
        <div style={{ background: "rgba(196,123,58,0.06)", borderRadius: 8, border: "1px solid rgba(196,123,58,0.15)", padding: "8px 14px", flex: 1 }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            API keys are stored locally and never sent to aFindr servers.
          </span>
        </div>
      </div>
    </div>
  );
}
