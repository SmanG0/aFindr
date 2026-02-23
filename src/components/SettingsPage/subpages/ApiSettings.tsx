"use client";

import { SectionHeader, TextInput } from "../SettingsComponents";

export default function ApiSettings() {
  return (
    <div style={{ padding: "32px 40px 48px", maxWidth: 640 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8, letterSpacing: "-0.02em" }}>
        APIs & Data
      </h1>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 32, lineHeight: 1.5 }}>
        Configure API keys and data sources for market data, news, and analytics.
      </p>

      <SectionHeader title="Market Data" badge="PRIMARY" />
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>Refinitiv / Yahoo Finance API Key</div>
        <TextInput value="" onChange={() => {}} placeholder="Enter API key (optional for demo)" type="password" />
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8, lineHeight: 1.5 }}>
          Used for real-time quotes and historical data. Demo mode uses public endpoints with rate limits.
        </div>
      </div>

      <SectionHeader title="News & Research" />
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>Perplexity Finance API Key</div>
        <TextInput value="" onChange={() => {}} placeholder="Optional: for richer summaries and sentiment" type="password" />
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8, lineHeight: 1.5 }}>
          News feed uses Yahoo Finance RSS (free). Perplexity can enrich with summaries and sentiment when provided.
        </div>
      </div>

      <SectionHeader title="TradingView" />
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>TradingView Widget Token</div>
        <TextInput value="" onChange={() => {}} placeholder="Optional: for advanced chart features" type="password" />
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8, lineHeight: 1.5 }}>
          Enables extended charting capabilities and drawing tools sync.
        </div>
      </div>

      <SectionHeader title="AI / Copilot" />
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>OpenAI / Anthropic API Key</div>
        <TextInput value="" onChange={() => {}} placeholder="sk-..." type="password" />
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8, lineHeight: 1.5 }}>
          Used by Alphy for strategy suggestions, backtests, and natural language queries.
        </div>
      </div>

      <div style={{ background: "rgba(196,123,58,0.06)", borderRadius: 12, border: "1px solid rgba(196,123,58,0.15)", padding: 16, marginTop: 32 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--accent-bright)", marginBottom: 6 }}>Security Note</div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.6 }}>
          API keys are stored locally and never sent to aFindr servers. Use environment variables in production for added security.
        </div>
      </div>

      <button
        style={{
          marginTop: 24, padding: "12px 24px", borderRadius: 10,
          background: "var(--accent)", border: "none",
          color: "#fff", fontSize: 13, fontWeight: 700,
          cursor: "pointer", transition: "opacity 100ms ease",
          fontFamily: "var(--font-mono)",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.9"; }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
      >
        Save API Keys
      </button>
    </div>
  );
}
