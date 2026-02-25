"use client";


/* ═══════════════════════════════════════════════════
   Shared layout wrapper for all static / info pages
   ═══════════════════════════════════════════════════ */

function PageShell({ title, subtitle, onBack, children }: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 32px 80px" }}>
        {/* Back button */}
        <button
          onClick={onBack}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "transparent", border: "none", cursor: "pointer",
            color: "var(--text-muted)", fontSize: 12, fontFamily: "var(--font-mono)",
            fontWeight: 600, marginBottom: 32, padding: 0,
            transition: "color 100ms ease",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to Dashboard
        </button>

        {/* Title block */}
        <h1 style={{
          fontSize: 28, fontWeight: 800, color: "var(--text-primary)",
          fontFamily: "var(--font-mono)", letterSpacing: "-0.02em",
          marginBottom: subtitle ? 8 : 32,
        }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{
            fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6,
            fontFamily: "var(--font-mono)", marginBottom: 32, maxWidth: 520,
          }}>
            {subtitle}
          </p>
        )}

        {children}
      </div>
    </div>
  );
}

/* ── Card block reused across pages ── */
function InfoCard({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: "var(--glass)", borderRadius: 12,
      border: "1px solid var(--glass-border)",
      backdropFilter: "blur(12px)", padding: "20px 24px",
      marginBottom: 16,
    }}>
      {title && (
        <div style={{
          fontSize: 13, fontWeight: 700, color: "var(--text-primary)",
          fontFamily: "var(--font-mono)", marginBottom: 10,
        }}>
          {title}
        </div>
      )}
      <div style={{
        fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7,
        fontFamily: "var(--font-mono)",
      }}>
        {children}
      </div>
    </div>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 6,
      fontSize: 9, fontWeight: 700, fontFamily: "var(--font-mono)",
      letterSpacing: "0.04em", textTransform: "uppercase",
      background: `${color}18`, color, marginRight: 8,
    }}>
      {label}
    </span>
  );
}

/* ═══════════════════════════════════════════════════
   Individual Page Contents
   ═══════════════════════════════════════════════════ */

function HelpCenterContent() {
  const topics = [
    { title: "Getting Started", desc: "Set up your account, connect a broker, and place your first paper trade.", icon: "01" },
    { title: "Chart & Indicators", desc: "Master TradingView charts, add custom indicators, and use drawing tools.", icon: "02" },
    { title: "Alphy AI Copilot", desc: "Learn how the AI agent analyzes markets, generates strategies, and assists your workflow.", icon: "03" },
    { title: "Paper Trading", desc: "Understand the paper trading engine, position management, and P&L tracking.", icon: "04" },
    { title: "Portfolio Tracking", desc: "Add real holdings, view allocation breakdowns, and monitor performance.", icon: "05" },
    { title: "Strategy Tester", desc: "Backtest strategies, analyze heatmaps, and compare parameter combinations.", icon: "06" },
  ];

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {topics.map((t) => (
          <div
            key={t.title}
            style={{
              background: "var(--glass)", borderRadius: 12,
              border: "1px solid var(--glass-border)", padding: "20px",
              cursor: "pointer", transition: "border-color 120ms ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--glass-border)"; }}
          >
            <div style={{
              fontSize: 10, fontWeight: 800, color: "var(--accent)", opacity: 0.5,
              fontFamily: "var(--font-mono)", marginBottom: 8,
            }}>
              {t.icon}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-mono)", marginBottom: 6 }}>
              {t.title}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", lineHeight: 1.5 }}>
              {t.desc}
            </div>
          </div>
        ))}
      </div>
      <div style={{
        marginTop: 24, padding: "16px 20px", borderRadius: 10,
        background: "rgba(91,141,239,0.04)", border: "1px solid rgba(91,141,239,0.1)",
        fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", lineHeight: 1.6,
      }}>
        Can&apos;t find what you need? Open the AI copilot (Cmd+K) and ask Alphy directly.
      </div>
    </>
  );
}

function ContactUsContent() {
  return (
    <>
      <InfoCard title="Email Support">
        For general inquiries and technical support, reach us at{" "}
        <span style={{ color: "var(--accent)", fontWeight: 600 }}>support@afindr.io</span>.
        We typically respond within 24 hours on business days.
      </InfoCard>
      <InfoCard title="Discord Community">
        Join our Discord server for real-time help, feature discussions, and community trading insights.
        <div style={{ marginTop: 12 }}>
          <button style={{
            padding: "8px 16px", borderRadius: 8, background: "rgba(91,141,239,0.1)",
            border: "1px solid rgba(91,141,239,0.2)", color: "var(--accent)",
            fontSize: 11, fontWeight: 700, fontFamily: "var(--font-mono)", cursor: "pointer",
          }}>
            Join Discord
          </button>
        </div>
      </InfoCard>
      <InfoCard title="Office Hours">
        Our team hosts weekly office hours every Thursday at 4 PM EST via Discord voice chat.
        Bring your questions about trading strategies, platform features, or upcoming releases.
      </InfoCard>
    </>
  );
}

function ReportBugContent() {
  return (
    <>
      <InfoCard>
        Found something broken? Help us fix it. Please include as much detail as possible so we can reproduce and resolve the issue quickly.
      </InfoCard>
      <div style={{
        background: "var(--glass)", borderRadius: 12,
        border: "1px solid var(--glass-border)", padding: "24px",
      }}>
        {[
          { label: "Summary", placeholder: "Brief description of the issue...", type: "input" },
          { label: "Steps to Reproduce", placeholder: "1. Go to...\n2. Click on...\n3. See error", type: "textarea" },
          { label: "Expected Behavior", placeholder: "What should happen...", type: "input" },
          { label: "Browser / OS", placeholder: "e.g., Chrome 121 / macOS 15.1", type: "input" },
        ].map((field) => (
          <div key={field.label} style={{ marginBottom: 16 }}>
            <label style={{
              display: "block", fontSize: 10, fontWeight: 700,
              color: "var(--text-muted)", fontFamily: "var(--font-mono)",
              letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 6,
            }}>
              {field.label}
            </label>
            {field.type === "textarea" ? (
              <textarea
                placeholder={field.placeholder}
                rows={4}
                style={{
                  width: "100%", background: "rgba(236,227,213,0.03)",
                  border: "1px solid rgba(236,227,213,0.08)", borderRadius: 8,
                  padding: "10px 14px", color: "var(--text-primary)",
                  fontSize: 12, fontFamily: "var(--font-mono)", resize: "vertical",
                  outline: "none",
                }}
              />
            ) : (
              <input
                placeholder={field.placeholder}
                style={{
                  width: "100%", background: "rgba(236,227,213,0.03)",
                  border: "1px solid rgba(236,227,213,0.08)", borderRadius: 8,
                  padding: "10px 14px", color: "var(--text-primary)",
                  fontSize: 12, fontFamily: "var(--font-mono)", outline: "none",
                }}
              />
            )}
          </div>
        ))}
        <button style={{
          padding: "10px 24px", borderRadius: 8, background: "var(--accent)",
          border: "none", color: "var(--bg)", fontSize: 12, fontWeight: 700,
          fontFamily: "var(--font-mono)", cursor: "pointer",
        }}>
          Submit Report
        </button>
      </div>
    </>
  );
}

function ChangelogContent() {
  const entries = [
    {
      version: "v0.9.0", date: "Feb 24, 2026", tag: "Latest",
      changes: [
        "Added portfolio sector, industry, and geographic breakdowns",
        "Animated allocation donut chart with staggered entrance",
        "New dashboard footer with link pages",
        "Strategy tester heatmap improvements",
      ],
    },
    {
      version: "v0.8.0", date: "Feb 22, 2026", tag: null,
      changes: [
        "Alphy AI agent with streaming responses and tool use",
        "Prediction market data integration (Kalshi, Polymarket)",
        "BLS economic data fetcher",
        "Agent guardrails and resilience layer",
      ],
    },
    {
      version: "v0.7.0", date: "Feb 20, 2026", tag: null,
      changes: [
        "ICT chart pattern detection engine",
        "Key level identification (support, resistance, pivots)",
        "Divergence and volume analysis tools",
        "PineScript overlay on TradingView charts",
      ],
    },
    {
      version: "v0.6.0", date: "Feb 18, 2026", tag: null,
      changes: [
        "Convex backend integration for real-time data",
        "Holdings management with add/remove",
        "Performance chart with S&P 500 benchmark overlay",
        "News page with multi-source aggregation",
      ],
    },
  ];

  return (
    <>
      {entries.map((entry) => (
        <div key={entry.version} style={{ marginBottom: 28 }}>
          <div className="flex items-center gap-3" style={{ marginBottom: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
              {entry.version}
            </span>
            {entry.tag && <Badge label={entry.tag} color="var(--buy)" />}
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
              {entry.date}
            </span>
          </div>
          <div style={{
            background: "var(--glass)", borderRadius: 10,
            border: "1px solid var(--glass-border)", padding: "14px 18px",
          }}>
            {entry.changes.map((c, i) => (
              <div key={i} className="flex items-start gap-2" style={{ marginBottom: i < entry.changes.length - 1 ? 8 : 0 }}>
                <span style={{ color: "var(--accent)", fontSize: 8, marginTop: 4 }}>&#9679;</span>
                <span style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "var(--font-mono)", lineHeight: 1.5 }}>
                  {c}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

function RoadmapContent() {
  const phases = [
    {
      label: "Q1 2026", status: "In Progress",
      items: [
        { text: "iOS mobile app (SwiftUI, Liquid Glass)", done: false },
        { text: "Multi-broker integration (Alpaca, IBKR)", done: false },
        { text: "Advanced risk management dashboard", done: false },
        { text: "Strategy marketplace", done: false },
      ],
    },
    {
      label: "Q2 2026", status: "Planned",
      items: [
        { text: "Social trading & copy-trading", done: false },
        { text: "Options chain analysis", done: false },
        { text: "Custom indicator builder (no-code)", done: false },
        { text: "Push notifications & alerts", done: false },
      ],
    },
    {
      label: "Q3 2026", status: "Planned",
      items: [
        { text: "Live trading with real capital", done: false },
        { text: "Automated strategy execution", done: false },
        { text: "Tax reporting & journaling export", done: false },
        { text: "Android mobile app", done: false },
      ],
    },
  ];

  return (
    <>
      {phases.map((phase) => (
        <div key={phase.label} style={{ marginBottom: 28 }}>
          <div className="flex items-center gap-3" style={{ marginBottom: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
              {phase.label}
            </span>
            <Badge label={phase.status} color={phase.status === "In Progress" ? "var(--accent)" : "var(--text-muted)"} />
          </div>
          <div style={{
            background: "var(--glass)", borderRadius: 10,
            border: "1px solid var(--glass-border)", padding: "14px 18px",
          }}>
            {phase.items.map((item, i) => (
              <div key={i} className="flex items-center gap-3" style={{ marginBottom: i < phase.items.length - 1 ? 10 : 0 }}>
                <div style={{
                  width: 16, height: 16, borderRadius: 4,
                  border: `1.5px solid ${item.done ? "var(--buy)" : "rgba(236,227,213,0.15)"}`,
                  background: item.done ? "rgba(34,197,94,0.1)" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  {item.done && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--buy)" strokeWidth="3" strokeLinecap="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <span style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                  {item.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

function ApiDocsContent() {
  const endpoints = [
    { method: "GET", path: "/api/portfolio/quotes", desc: "Fetch live quotes for a list of symbols" },
    { method: "GET", path: "/api/portfolio/stock/:ticker", desc: "Detailed stock info including fundamentals" },
    { method: "GET", path: "/api/portfolio/stock/:ticker/chart", desc: "OHLCV chart data for a given ticker and range" },
    { method: "GET", path: "/api/portfolio/market", desc: "Market overview with indices and movers" },
    { method: "GET", path: "/api/news/feed", desc: "Aggregated market news from multiple sources" },
    { method: "GET", path: "/api/news/stock/:ticker", desc: "Ticker-specific news articles" },
    { method: "POST", path: "/api/chat/stream", desc: "Stream an AI agent response with tool-use" },
    { method: "GET", path: "/api/strategies", desc: "List all saved backtest strategies" },
    { method: "POST", path: "/api/data", desc: "Fetch market data from backend engine" },
  ];

  return (
    <>
      <InfoCard>
        aFindr exposes a set of internal API endpoints used by the frontend. Below is a reference for developers building integrations or custom tooling.
      </InfoCard>
      <div style={{
        background: "var(--glass)", borderRadius: 12,
        border: "1px solid var(--glass-border)", overflow: "hidden",
      }}>
        {endpoints.map((ep, i) => (
          <div
            key={ep.path}
            className="flex items-center"
            style={{
              padding: "12px 18px", gap: 12,
              borderBottom: i < endpoints.length - 1 ? "1px solid rgba(236,227,213,0.04)" : "none",
            }}
          >
            <span style={{
              fontSize: 9, fontWeight: 800, fontFamily: "var(--font-mono)",
              padding: "2px 6px", borderRadius: 4, letterSpacing: "0.04em",
              background: ep.method === "GET" ? "rgba(34,197,94,0.1)" : "rgba(91,141,239,0.1)",
              color: ep.method === "GET" ? "var(--buy)" : "var(--accent)",
              flexShrink: 0,
            }}>
              {ep.method}
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-mono)", flexShrink: 0 }}>
              {ep.path}
            </span>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginLeft: "auto" }}>
              {ep.desc}
            </span>
          </div>
        ))}
      </div>
      <div style={{
        marginTop: 16, fontSize: 11, color: "var(--text-muted)",
        fontFamily: "var(--font-mono)", lineHeight: 1.6,
      }}>
        All endpoints return JSON. Authentication is handled via Convex session tokens. Rate limiting applies to streaming endpoints.
      </div>
    </>
  );
}

function LegalPageContent({ sections }: { sections: { title: string; text: string }[] }) {
  return (
    <>
      {sections.map((s) => (
        <InfoCard key={s.title} title={s.title}>
          {s.text}
        </InfoCard>
      ))}
      <div style={{
        marginTop: 8, fontSize: 10, color: "var(--text-disabled)",
        fontFamily: "var(--font-mono)",
      }}>
        Last updated: February 2026
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════
   Page map — used by the main export
   ═══════════════════════════════════════════════════ */

const TERMS_SECTIONS = [
  { title: "1. Acceptance of Terms", text: "By accessing or using aFindr, you agree to be bound by these Terms of Service. If you do not agree, do not use the platform." },
  { title: "2. Account Registration", text: "You must provide accurate information when creating an account. You are responsible for maintaining the security of your credentials and all activity under your account." },
  { title: "3. Paper Trading Disclaimer", text: "aFindr provides simulated (paper) trading only. No real money is at risk. Past simulated performance does not guarantee future results with real capital." },
  { title: "4. AI-Generated Content", text: "AI-generated insights, strategies, and analysis are for informational purposes only and do not constitute financial advice. Always conduct your own research before making investment decisions." },
  { title: "5. Intellectual Property", text: "All content, code, designs, and features of aFindr are the intellectual property of aFindr Inc. You may not reproduce, distribute, or create derivative works without written permission." },
  { title: "6. Limitation of Liability", text: "aFindr is provided \"as is\" without warranty. We are not liable for any trading losses, data inaccuracies, or service interruptions. Use at your own risk." },
  { title: "7. Modifications", text: "We reserve the right to modify these terms at any time. Continued use after changes constitutes acceptance of the updated terms." },
];

const PRIVACY_SECTIONS = [
  { title: "1. Information We Collect", text: "We collect account information (email, name), usage data (pages viewed, features used), and trading data (simulated positions, strategies). We do not collect financial account credentials for real brokerages." },
  { title: "2. How We Use Your Data", text: "Your data is used to provide and improve the platform, personalize your experience, generate AI insights, and communicate updates. We never sell your personal data to third parties." },
  { title: "3. Data Storage", text: "Data is stored on Convex (BaaS) with encryption at rest and in transit. Chart and market data is sourced from third-party providers and cached locally." },
  { title: "4. Cookies & Analytics", text: "We use essential cookies for authentication and session management. Optional analytics help us understand feature usage. You can opt out in Settings." },
  { title: "5. Third-Party Services", text: "We integrate with market data providers, AI services (Anthropic Claude), and payment processors. Each has its own privacy policy governing data they receive." },
  { title: "6. Your Rights", text: "You may request access to, correction of, or deletion of your personal data at any time by contacting support@afindr.io. We will respond within 30 days." },
  { title: "7. Data Retention", text: "Account data is retained while your account is active. Upon deletion, personal data is removed within 90 days. Anonymized usage data may be retained for analytics." },
];

const RISK_SECTIONS = [
  { title: "1. Not Financial Advice", text: "aFindr is a trading workspace and educational tool. Nothing on this platform constitutes financial, investment, tax, or legal advice. Consult a qualified professional before making investment decisions." },
  { title: "2. Simulated Trading", text: "All trading on aFindr is simulated (paper trading). Simulated results may not reflect real-world execution, slippage, commissions, or market impact. Do not assume simulated returns will translate to real trading." },
  { title: "3. Market Risk", text: "Financial markets carry inherent risk. Prices can move rapidly and unpredictably. You can lose some or all of your invested capital when trading with real money." },
  { title: "4. AI Limitations", text: "AI-generated strategies and analysis are based on historical patterns and may not predict future outcomes. AI models can produce inaccurate, incomplete, or misleading results. Always verify AI output independently." },
  { title: "5. Data Accuracy", text: "Market data is sourced from third-party providers and may be delayed, incomplete, or inaccurate. Do not rely solely on aFindr data for real trading decisions." },
  { title: "6. Technical Risks", text: "Platform availability is not guaranteed. Service interruptions, bugs, or data loss may occur. Do not depend on aFindr as your sole trading tool for time-sensitive decisions." },
  { title: "7. Leverage & Derivatives", text: "Trading leveraged products and derivatives carries additional risk of magnified losses. Ensure you understand these instruments before trading them with real capital." },
];

/* ═══════════════════════════════════════════════════
   Main export — renders the correct page by ID
   ═══════════════════════════════════════════════════ */

export type FooterPageId = "help-center" | "contact" | "report-bug" | "changelog" | "roadmap" | "api-docs" | "terms" | "privacy" | "risk-disclosure";

export const FOOTER_PAGE_IDS = new Set<string>([
  "help-center", "contact", "report-bug", "changelog", "roadmap", "api-docs", "terms", "privacy", "risk-disclosure",
]);

export default function FooterPage({ pageId, onBack }: { pageId: FooterPageId; onBack: () => void }) {
  switch (pageId) {
    case "help-center":
      return <PageShell title="Help Center" subtitle="Everything you need to get started and master aFindr." onBack={onBack}><HelpCenterContent /></PageShell>;
    case "contact":
      return <PageShell title="Contact Us" subtitle="We'd love to hear from you." onBack={onBack}><ContactUsContent /></PageShell>;
    case "report-bug":
      return <PageShell title="Report a Bug" subtitle="Help us improve aFindr by reporting issues." onBack={onBack}><ReportBugContent /></PageShell>;
    case "changelog":
      return <PageShell title="Changelog" subtitle="What's new in aFindr." onBack={onBack}><ChangelogContent /></PageShell>;
    case "roadmap":
      return <PageShell title="Roadmap" subtitle="Where aFindr is headed next." onBack={onBack}><RoadmapContent /></PageShell>;
    case "api-docs":
      return <PageShell title="API Reference" subtitle="Internal endpoints available for integrations." onBack={onBack}><ApiDocsContent /></PageShell>;
    case "terms":
      return <PageShell title="Terms of Service" onBack={onBack}><LegalPageContent sections={TERMS_SECTIONS} /></PageShell>;
    case "privacy":
      return <PageShell title="Privacy Policy" onBack={onBack}><LegalPageContent sections={PRIVACY_SECTIONS} /></PageShell>;
    case "risk-disclosure":
      return <PageShell title="Risk Disclosure" onBack={onBack}><LegalPageContent sections={RISK_SECTIONS} /></PageShell>;
  }
}
