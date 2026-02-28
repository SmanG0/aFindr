"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import "./landing.css";

// ─── Ticker Data ───
interface TickerItem {
  symbol: string;
  price: string;
  change: number;
}

const TICKERS: TickerItem[] = [
  { symbol: "AAPL", price: "187.32", change: 1.42 },
  { symbol: "NVDA", price: "875.50", change: -0.88 },
  { symbol: "MSFT", price: "412.20", change: 2.15 },
  { symbol: "GOOGL", price: "158.00", change: -1.23 },
  { symbol: "AMZN", price: "181.10", change: 0.65 },
  { symbol: "META", price: "512.85", change: 1.97 },
  { symbol: "TSLA", price: "231.60", change: -0.41 },
  { symbol: "SPY", price: "548.90", change: 0.81 },
  { symbol: "NQ=F", price: "21450", change: -2.10 },
  { symbol: "GC=F", price: "2648", change: 0.23 },
  { symbol: "AMD", price: "178.80", change: -0.53 },
  { symbol: "JPM", price: "198.95", change: 1.07 },
  { symbol: "V", price: "312.62", change: -0.84 },
  { symbol: "BTC", price: "97450", change: 3.21 },
  { symbol: "ES=F", price: "5520", change: 0.48 },
  { symbol: "CL=F", price: "78.35", change: -1.15 },
];

function TickerBanner() {
  return (
    <div className="lp-ticker-banner">
      <div className="lp-ticker-track">
        {[0, 1].map((copy) => (
          <div key={copy} className="lp-ticker-set">
            {TICKERS.map((t) => {
              const isUp = t.change >= 0;
              return (
                <span key={`${copy}-${t.symbol}`} className="lp-ticker-item">
                  <span className="lp-ticker-symbol">{t.symbol}</span>
                  <span className="lp-ticker-price">{t.price}</span>
                  <span className={`lp-ticker-change ${isUp ? "up" : "down"}`}>
                    {isUp ? "+" : ""}
                    {t.change.toFixed(2)}%
                  </span>
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Gradient Mesh Background ───
function GradientMesh() {
  return (
    <div className="lp-gradient-mesh">
      <div className="lp-mesh-blob lp-mesh-blob-1" />
      <div className="lp-mesh-blob lp-mesh-blob-2" />
      <div className="lp-mesh-blob lp-mesh-blob-3" />
    </div>
  );
}

// ─── Grid Pattern Background ───
function GridPattern() {
  return <div className="lp-grid-pattern" />;
}

// ─── Count-Up Hook ───
function useCountUp(target: number, inView: boolean, duration = 2000) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    function update(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setValue(Math.round(target * eased));
      if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
  }, [inView, target, duration]);
  return value;
}

// ─── Reveal Animation ───
function Reveal({
  children,
  delay = 0,
  y = 30,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

// ─── Browser Chrome Frame ───
function BrowserFrame({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <div className={`lp-browser-frame ${className || ""}`}>
      <div className="lp-browser-chrome">
        <div className="lp-browser-dots">
          <span className="lp-dot lp-dot-red" />
          <span className="lp-dot lp-dot-yellow" />
          <span className="lp-dot lp-dot-green" />
        </div>
        <div className="lp-browser-bar">
          <span className="lp-browser-url">app.afindr.com</span>
        </div>
      </div>
      <div className="lp-browser-content">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="lp-browser-img"
          loading="lazy"
          draggable={false}
        />
      </div>
    </div>
  );
}

// ─── Waitlist Form ───
function WaitlistForm({ variant = "hero" }: { variant?: "hero" | "cta" }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [position, setPosition] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = email.trim();
      if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        setErrorMsg("Please enter a valid email address");
        setStatus("error");
        return;
      }
      setStatus("loading");
      setErrorMsg("");
      try {
        const res = await fetch("/api/waitlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: trimmed }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "Request failed");
        setPosition(result.position);
        setStatus("success");
      } catch {
        setErrorMsg("Something went wrong. Please try again.");
        setStatus("error");
      }
    },
    [email]
  );

  if (status === "success") {
    return (
      <motion.div
        className="lp-form-success"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="lp-success-icon">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--buy)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <span className="lp-success-text">You&apos;re on the list!</span>
        {position && (
          <span className="lp-success-position">
            #{position} in line
          </span>
        )}
      </motion.div>
    );
  }

  return (
    <form
      className={`lp-waitlist-form ${variant === "cta" ? "lp-waitlist-form-cta" : ""}`}
      onSubmit={handleSubmit}
    >
      <div className="lp-form-row">
        <input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (status === "error") setStatus("idle");
          }}
          className="lp-email-input"
          disabled={status === "loading"}
        />
        <button
          type="submit"
          className="lp-submit-btn"
          disabled={status === "loading"}
        >
          {status === "loading" ? (
            <span className="lp-spinner" />
          ) : (
            "Join Waitlist"
          )}
        </button>
      </div>
      {status === "error" && errorMsg && (
        <motion.p
          className="lp-form-error"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {errorMsg}
        </motion.p>
      )}
    </form>
  );
}

// ─── Section Heading ───
function SectionHeading({
  label,
  title,
  subtitle,
}: {
  label?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="lp-section-heading">
      {label && (
        <Reveal>
          <span className="lp-section-label">{label}</span>
        </Reveal>
      )}
      <Reveal delay={0.05}>
        <h2 className="lp-section-title">{title}</h2>
      </Reveal>
      {subtitle && (
        <Reveal delay={0.1}>
          <p className="lp-section-subtitle">{subtitle}</p>
        </Reveal>
      )}
    </div>
  );
}

// ─── How It Works ───
const STEPS = [
  {
    num: "01",
    title: "Sign up",
    desc: "Create your free account in seconds. No credit card required.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <line x1="19" y1="8" x2="19" y2="14" />
        <line x1="22" y1="11" x2="16" y2="11" />
      </svg>
    ),
  },
  {
    num: "02",
    title: "Explore",
    desc: "Charts, backtesting, AI analysis, portfolio tracking — all free to explore.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
        <line x1="11" y1="8" x2="11" y2="14" />
        <line x1="8" y1="11" x2="14" y2="11" />
      </svg>
    ),
  },
  {
    num: "03",
    title: "Trade smarter",
    desc: "Connect your broker when you're ready. AI-powered insights, real results.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
        <polyline points="16 7 22 7 22 13" />
      </svg>
    ),
  },
];

function HowItWorks() {
  return (
    <section className="lp-section">
      <SectionHeading
        label="How it works"
        title="Get started in minutes"
        subtitle="From signup to your first AI-powered trade in three simple steps."
      />
      <div className="lp-steps-grid">
        {STEPS.map((step, i) => (
          <Reveal key={i} delay={i * 0.12}>
            <div className="lp-step-card">
              <div className="lp-step-num">{step.num}</div>
              <div className="lp-step-icon">{step.icon}</div>
              <h3 className="lp-step-title">{step.title}</h3>
              <p className="lp-step-desc">{step.desc}</p>
            </div>
            {i < STEPS.length - 1 && <div className="lp-step-connector" />}
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// ─── Features Grid ───
const FEATURES = [
  {
    title: "AI Copilot",
    desc: "Ask Alphy to analyze any stock, backtest momentum strategies, or explain patterns in plain language. Natural language in, institutional-grade analysis out.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a5 5 0 0 1 4.9 4 5 5 0 0 1-1 9.9M12 2a5 5 0 0 0-4.9 4 5 5 0 0 0 1 9.9" />
        <path d="M12 2v20" />
        <path d="M8 14h8" />
      </svg>
    ),
  },
  {
    title: "Backtesting Engine",
    desc: "Stress-test any strategy with Monte Carlo simulations, walk-forward optimization, and equity curve analysis before risking real capital.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="12" width="4" height="9" rx="1" />
        <rect x="10" y="7" width="4" height="14" rx="1" />
        <rect x="17" y="3" width="4" height="18" rx="1" />
      </svg>
    ),
  },
  {
    title: "Real-Time Charts",
    desc: "Professional candlestick charts with 50+ indicators, drawing tools, and multi-timeframe analysis. Stocks, futures, forex — all in real time.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" />
        <path d="M7 17l4-8 4 4 5-9" />
      </svg>
    ),
  },
];

function FeaturesGrid() {
  return (
    <section className="lp-section">
      <SectionHeading
        label="Features"
        title="Institutional-grade tools, zero barriers"
        subtitle="Everything Wall Street has, now on your screen. No minimum balance. No gatekeepers."
      />
      <div className="lp-features-grid">
        {FEATURES.map((f, i) => (
          <Reveal key={i} delay={i * 0.12}>
            <div className="lp-feature-card">
              <div className="lp-feature-icon">{f.icon}</div>
              <h3 className="lp-feature-title">{f.title}</h3>
              <p className="lp-feature-desc">{f.desc}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// ─── Feature Deep Dives ───
const DEEP_DIVES = [
  {
    label: "Alphy AI",
    title: "Your AI trading copilot",
    desc: "Ask Alphy to backtest breakout strategies, run Monte Carlo analysis, or generate PineScript indicators for any symbol. Natural language queries, institutional-grade results.",
    screenshot: "/screenshots/copilot.png",
    alt: "aFindr AI Copilot interface",
  },
  {
    label: "Strategy Tester",
    title: "Backtest with confidence",
    desc: "Visualize equity curves, drawdowns, and risk metrics. Run walk-forward optimization and Monte Carlo analysis to validate your edge before risking real capital.",
    screenshot: "/screenshots/backtesting.png",
    alt: "aFindr Backtesting results",
  },
  {
    label: "Chart Tools",
    title: "Professional-grade charting",
    desc: "TradingView-quality candlestick charts with drawing tools, custom indicators, and multi-timeframe analysis. Everything renders in real time.",
    screenshot: "/screenshots/hero-chart.png",
    alt: "aFindr Professional charting",
  },
];

function FeatureDeepDives() {
  return (
    <section className="lp-deep-dives">
      {DEEP_DIVES.map((dive, i) => (
        <div
          key={i}
          className={`lp-deep-dive-row ${i % 2 === 1 ? "lp-reverse" : ""}`}
        >
          <Reveal delay={0.1} className="lp-deep-dive-text">
            <span className="lp-deep-dive-label">{dive.label}</span>
            <h3 className="lp-deep-dive-title">{dive.title}</h3>
            <p className="lp-deep-dive-desc">{dive.desc}</p>
          </Reveal>
          <Reveal delay={0.2} className="lp-deep-dive-visual">
            <BrowserFrame src={dive.screenshot} alt={dive.alt} />
          </Reveal>
        </div>
      ))}
    </section>
  );
}

// ─── Comparison Table ───
type CompareValue = boolean | string;

interface CompareRow {
  feature: string;
  afindr: CompareValue;
  tradingview: CompareValue;
  bloomberg: CompareValue;
}

const COMPARE_DATA: CompareRow[] = [
  { feature: "AI Copilot", afindr: true, tradingview: false, bloomberg: false },
  { feature: "Natural language queries", afindr: true, tradingview: false, bloomberg: false },
  { feature: "Backtesting with Monte Carlo", afindr: true, tradingview: false, bloomberg: true },
  { feature: "Real-time charting", afindr: true, tradingview: true, bloomberg: true },
  { feature: "Walk-forward optimization", afindr: true, tradingview: false, bloomberg: true },
  { feature: "Paper trading", afindr: true, tradingview: true, bloomberg: false },
  { feature: "PineScript generation", afindr: true, tradingview: false, bloomberg: false },
  { feature: "Portfolio tracking", afindr: true, tradingview: true, bloomberg: true },
  { feature: "Free tier", afindr: "Free", tradingview: "Limited", bloomberg: "$24k/yr" },
];

function CheckIcon() {
  return (
    <svg className="lp-check" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--buy)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg className="lp-cross" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function renderCell(val: CompareValue) {
  if (val === true) return <CheckIcon />;
  if (val === false) return <CrossIcon />;
  return <span className="lp-compare-text">{val}</span>;
}

function ComparisonTable() {
  return (
    <section className="lp-section">
      <SectionHeading
        label="Compare"
        title="How aFindr compares"
        subtitle="See how we stack up against the industry."
      />
      <Reveal>
        <div className="lp-compare-wrapper">
          <table className="lp-compare-table">
            <thead>
              <tr>
                <th className="lp-compare-feature-col">Feature</th>
                <th className="lp-compare-highlight">aFindr</th>
                <th>TradingView</th>
                <th>Bloomberg</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE_DATA.map((row, i) => (
                <tr key={i}>
                  <td className="lp-compare-feature">{row.feature}</td>
                  <td className="lp-compare-highlight">{renderCell(row.afindr)}</td>
                  <td>{renderCell(row.tradingview)}</td>
                  <td>{renderCell(row.bloomberg)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Reveal>
    </section>
  );
}

// ─── Metrics Strip ───
function MetricsStrip() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });
  const metrics = [
    { value: 50, suffix: "+", label: "Technical Indicators" },
    { value: 15, suffix: "+", label: "AI Trading Tools" },
    { value: 10, suffix: "+", label: "Markets Supported" },
    { value: 1, suffix: "", label: "AI Copilot" },
  ];

  return (
    <section className="lp-metrics" ref={ref}>
      <div className="lp-metrics-grid">
        {metrics.map((m, i) => {
          return (
            <MetricItem
              key={i}
              target={m.value}
              suffix={m.suffix}
              label={m.label}
              inView={isInView}
              delay={i * 150}
            />
          );
        })}
      </div>
    </section>
  );
}

function MetricItem({
  target,
  suffix,
  label,
  inView,
  delay,
}: {
  target: number;
  suffix: string;
  label: string;
  inView: boolean;
  delay: number;
}) {
  const [started, setStarted] = useState(false);
  useEffect(() => {
    if (inView) {
      const t = setTimeout(() => setStarted(true), delay);
      return () => clearTimeout(t);
    }
  }, [inView, delay]);
  const count = useCountUp(target, started);
  return (
    <div className="lp-metric">
      <div className="lp-metric-value">
        {count}
        {suffix}
      </div>
      <div className="lp-metric-label">{label}</div>
    </div>
  );
}

// ─── Pricing ───
const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "/mo",
    desc: "Everything you need to start.",
    badge: null,
    features: [
      "Real-time charting with 50+ indicators",
      "Basic AI queries (10/day)",
      "Paper trading",
      "Portfolio tracking",
      "Community access",
    ],
    cta: "Join Waitlist",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$29",
    period: "/mo",
    desc: "For serious traders.",
    badge: "Most Popular",
    features: [
      "Everything in Free",
      "Unlimited AI queries",
      "Monte Carlo backtesting",
      "Walk-forward optimization",
      "PineScript generation",
      "Advanced alerts",
      "Priority support",
    ],
    cta: "Join Waitlist",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    desc: "For teams and institutions.",
    badge: "Coming Soon",
    features: [
      "Everything in Pro",
      "Team dashboards",
      "API access",
      "Custom strategy development",
      "Dedicated account manager",
      "SLA guarantee",
    ],
    cta: "Contact Us",
    highlighted: false,
  },
];

function Pricing() {
  return (
    <section className="lp-section" id="pricing">
      <SectionHeading
        label="Pricing"
        title="Simple, transparent pricing"
        subtitle="Start free. Upgrade when you're ready."
      />
      <div className="lp-pricing-grid">
        {PLANS.map((plan, i) => (
          <Reveal key={i} delay={i * 0.1}>
            <div
              className={`lp-pricing-card ${plan.highlighted ? "lp-pricing-highlighted" : ""}`}
            >
              {plan.badge && (
                <span className="lp-pricing-badge">{plan.badge}</span>
              )}
              <h3 className="lp-pricing-name">{plan.name}</h3>
              <div className="lp-pricing-price">
                {plan.price}
                <span className="lp-pricing-period">{plan.period}</span>
              </div>
              <p className="lp-pricing-desc">{plan.desc}</p>
              <ul className="lp-pricing-features">
                {plan.features.map((f, j) => (
                  <li key={j}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--buy)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <button className={`lp-pricing-cta ${plan.highlighted ? "lp-pricing-cta-primary" : ""}`}>
                {plan.cta}
              </button>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// ─── FAQ ───
const FAQ_DATA = [
  {
    q: "What is aFindr?",
    a: "aFindr is an AI-powered trading platform that gives you institutional-grade charting, backtesting with Monte Carlo simulations, and an AI copilot named Alphy that speaks plain language. Connect your broker, analyze any market, and trade smarter.",
  },
  {
    q: "Is aFindr free to use?",
    a: "Yes. The Free tier includes real-time charting with 50+ indicators, basic AI queries, paper trading, and portfolio tracking. Pro features like unlimited AI queries and Monte Carlo backtesting are available with a paid plan.",
  },
  {
    q: "What markets do you support?",
    a: "We support US stocks, ETFs, futures (NQ, ES, GC, CL), forex, and crypto. We're also expanding to African exchanges including the NSE (Kenya), USE (Uganda), DSE (Tanzania), and JSE (South Africa).",
  },
  {
    q: "How does the AI copilot work?",
    a: "Alphy understands natural language. Ask questions like 'Backtest a 20/50 EMA crossover on AAPL' or 'What's the RSI divergence on NVDA?' and get institutional-grade analysis instantly. No coding required.",
  },
  {
    q: "Can I connect my broker?",
    a: "Yes. We integrate with major brokers so you can trade directly from the platform. During the beta, you can paper trade and backtest strategies before connecting a live account.",
  },
  {
    q: "Is my data secure?",
    a: "Absolutely. We use bank-grade encryption, never store broker credentials on our servers, and all API connections use OAuth 2.0. Your trading data is yours alone.",
  },
  {
    q: "When will Pro launch?",
    a: "Pro is launching alongside our public release. Join the waitlist to get early access and a special founding member discount.",
  },
  {
    q: "How do I get started?",
    a: "Join the waitlist above. When we launch, you'll get an email with your invite. Create your account, explore the platform, and start trading smarter with AI.",
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`lp-faq-item ${open ? "lp-faq-open" : ""}`}>
      <button className="lp-faq-trigger" onClick={() => setOpen(!open)}>
        <span>{q}</span>
        <svg
          className="lp-faq-icon"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="12" y1="5" x2="12" y2="19" className="lp-faq-plus-v" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="lp-faq-answer"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <p>{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FAQ() {
  return (
    <section className="lp-section">
      <SectionHeading
        label="FAQ"
        title="Frequently asked questions"
        subtitle="Everything you need to know about aFindr."
      />
      <div className="lp-faq-list">
        {FAQ_DATA.map((item, i) => (
          <Reveal key={i} delay={i * 0.05}>
            <FAQItem q={item.q} a={item.a} />
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// ─── Main Landing Page ───
export default function LandingPage() {
  const heroRef = useRef<HTMLElement>(null);
  const featuresRef = useRef<HTMLElement>(null);

  const scrollToWaitlist = useCallback(() => {
    heroRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  return (
    <div className="lp-page">
      {/* ─── Navbar ─── */}
      <nav className="lp-nav">
        <div className="lp-nav-left">
          <div className="lp-nav-logo">
            <svg className="lp-logo-svg" viewBox="0 0 64 64" fill="none">
              <ellipse cx="32" cy="36" rx="18" ry="20" fill="var(--accent)" />
              <ellipse cx="32" cy="40" rx="12" ry="13" fill="var(--accent-bright)" opacity="0.3" />
              <ellipse cx="25" cy="29" rx="4" ry="4.5" fill="var(--text-primary)" />
              <ellipse cx="26" cy="29.5" rx="2" ry="2.5" fill="var(--bg)" />
              <circle cx="24.5" cy="28" r="1" fill="var(--text-primary)" />
              <ellipse cx="39" cy="29" rx="4" ry="4.5" fill="var(--text-primary)" />
              <ellipse cx="40" cy="29.5" rx="2" ry="2.5" fill="var(--bg)" />
              <circle cx="38.5" cy="28" r="1" fill="var(--text-primary)" />
              <path d="M26 38 Q32 43 38 38" stroke="var(--text-primary)" strokeWidth="1.8" fill="none" strokeLinecap="round" />
              <circle cx="21" cy="34" r="3" fill="var(--accent-bright)" opacity="0.35" />
              <circle cx="43" cy="34" r="3" fill="var(--accent-bright)" opacity="0.35" />
              <path d="M50 30 Q54 26 52 22" stroke="var(--accent)" strokeWidth="3" fill="none" strokeLinecap="round" />
              <circle cx="52" cy="21" r="2.5" fill="var(--accent)" />
            </svg>
            <span className="lp-logo-text">aFindr</span>
          </div>
        </div>
        <div className="lp-nav-links">
          <a href="#features" className="lp-nav-link">Features</a>
          <a href="#pricing" className="lp-nav-link">Pricing</a>
        </div>
        <div className="lp-nav-right">
          <button className="lp-nav-cta" onClick={scrollToWaitlist}>
            Join Waitlist
          </button>
        </div>
      </nav>

      {/* ─── Ticker Banner ─── */}
      <TickerBanner />

      {/* ─── Hero ─── */}
      <section className="lp-hero" ref={heroRef}>
        <GradientMesh />
        <GridPattern />
        <div className="lp-hero-noise" />

        <motion.div
          className="lp-hero-content"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="lp-hero-badge">
            <span className="lp-badge-dot" />
            Early Access
          </div>
          <h1 className="lp-hero-headline">
            Trade smarter<br />with AI.
          </h1>
          <p className="lp-hero-subline">
            AI-powered analysis, backtesting, and strategy optimization for
            stocks, futures, and forex. Institutional tools. Zero gatekeepers.
          </p>
          <WaitlistForm variant="hero" />
          <p className="lp-hero-footnote">
            Free to join. No spam. Unsubscribe anytime.
          </p>
        </motion.div>

        <motion.div
          className="lp-hero-screenshot"
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          <BrowserFrame
            src="/screenshots/hero-chart.png"
            alt="aFindr trading platform"
            className="lp-hero-frame"
            priority
          />
        </motion.div>
      </section>

      {/* ─── How It Works ─── */}
      <HowItWorks />

      {/* ─── Features Grid ─── */}
      <section id="features" ref={featuresRef}>
        <FeaturesGrid />
      </section>

      {/* ─── Feature Deep Dives ─── */}
      <FeatureDeepDives />

      {/* ─── Comparison Table ─── */}
      <ComparisonTable />

      {/* ─── Metrics ─── */}
      <MetricsStrip />

      {/* ─── Pricing ─── */}
      <Pricing />

      {/* ─── FAQ ─── */}
      <FAQ />

      {/* ─── Bottom CTA ─── */}
      <section className="lp-bottom-cta">
        <Reveal>
          <h2 className="lp-cta-headline">Ready to trade smarter?</h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="lp-cta-subline">
            Join thousands of traders on the waitlist.
          </p>
        </Reveal>
        <Reveal delay={0.2}>
          <WaitlistForm variant="cta" />
        </Reveal>
      </section>

      {/* ─── Footer ─── */}
      <footer className="lp-footer">
        <div className="lp-footer-left">
          &copy; 2026 aFindr. All rights reserved.
        </div>
        <div className="lp-footer-right">
          <span className="lp-footer-link">Privacy</span>
          <span className="lp-footer-link">Terms</span>
          <span className="lp-footer-link">Contact</span>
        </div>
      </footer>
    </div>
  );
}
