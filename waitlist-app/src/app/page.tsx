"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import "./waitlist.css";

// ─── African Market Ticker Data (static) ───
interface WaitlistTicker {
  symbol: string;
  price: string;
  change: number;
}

const AFRICAN_TICKERS: WaitlistTicker[] = [
  { symbol: "SCOM", price: "28.50", change: 1.42 },
  { symbol: "EQTY", price: "42.75", change: -0.88 },
  { symbol: "KCB", price: "35.20", change: 2.15 },
  { symbol: "EABL", price: "158.00", change: -1.23 },
  { symbol: "BAMB", price: "31.10", change: 0.65 },
  { symbol: "ABSA", price: "12.85", change: 1.97 },
  { symbol: "COOP", price: "14.60", change: -0.41 },
  { symbol: "SBIC", price: "24.90", change: 0.81 },
  { symbol: "BAT", price: "380.00", change: -2.10 },
  { symbol: "KNRE", price: "2.48", change: 3.23 },
  { symbol: "SMER", price: "3.80", change: -0.53 },
  { symbol: "TOTL", price: "18.95", change: 1.07 },
  { symbol: "KPLC", price: "1.62", change: -1.84 },
  { symbol: "NCBA", price: "38.45", change: 0.39 },
  { symbol: "JUB", price: "305.00", change: 1.65 },
  { symbol: "SASN", price: "19.70", change: -0.76 },
];

function TickerBanner() {
  return (
    <div className="wl-ticker-banner">
      <div className="wl-ticker-track">
        {[0, 1].map((copy) => (
          <div key={copy} className="wl-ticker-set">
            {AFRICAN_TICKERS.map((t) => {
              const isUp = t.change >= 0;
              return (
                <span key={`${copy}-${t.symbol}`} className="wl-ticker-item">
                  <span className="wl-ticker-symbol">{t.symbol}</span>
                  <span className="wl-ticker-price">{t.price}</span>
                  <span className={`wl-ticker-change ${isUp ? "up" : "down"}`}>
                    {isUp ? "+" : ""}{t.change.toFixed(2)}%
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

const ALPHY_MESSAGES = [
  "Hi, I'm Alphy — your trading copilot",
  "Join the waitlist for early access",
  "AI-powered backtesting is coming",
  "NSE trading, reimagined with AI",
  "Monte Carlo simulations at your fingertips",
  "I generate PineScript indicators too",
  "Fund with M-Pesa, trade with AI",
  "50+ indicators, one AI copilot",
  "Be first to find your edge",
  "From beginner to pro — I adapt to you",
];

function AlphyBubble() {
  const [order, setOrder] = useState<string[]>([ALPHY_MESSAGES[0]]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const arr = [...ALPHY_MESSAGES];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    setOrder(arr);
  }, []);

  useEffect(() => {
    if (order.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % order.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [order]);

  return (
    <div className="wl-logo-bubble">
      <AnimatePresence mode="wait">
        <motion.span
          key={index}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          {order[index]}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

function FlowLines() {
  const paths = [
    "M-50,120 C150,80 300,200 500,140 S750,180 950,100 S1200,160 1400,120",
    "M-80,200 C100,250 280,150 480,220 S700,160 900,230 S1150,180 1450,200",
    "M-30,300 C200,260 350,340 550,280 S780,320 980,260 S1180,300 1420,280",
    "M-60,380 C120,420 300,360 500,400 S720,350 920,410 S1160,370 1450,390",
    "M-40,460 C180,430 340,490 540,440 S760,480 960,430 S1200,470 1440,450",
    "M-70,160 C160,130 320,190 520,150 S740,200 940,150 S1180,190 1430,160",
    "M-50,260 C140,300 290,230 490,270 S710,240 910,290 S1150,250 1440,270",
    "M-80,340 C110,370 280,310 480,350 S700,300 900,360 S1170,330 1450,340",
    "M-30,420 C190,390 350,440 550,400 S770,440 970,390 S1190,430 1430,410",
    "M-60,500 C130,470 300,520 500,480 S730,520 930,470 S1160,510 1440,490",
    "M-40,180 C170,210 330,160 530,200 S750,170 950,220 S1180,180 1420,200",
    "M-70,280 C150,310 310,260 510,300 S740,270 940,320 S1160,280 1440,300",
    "M-50,360 C120,340 290,380 490,350 S720,380 920,340 S1170,370 1430,350",
    "M-80,440 C140,460 310,420 510,450 S740,410 940,460 S1180,430 1450,440",
    "M-30,520 C180,500 350,540 550,510 S770,540 970,500 S1190,530 1440,510",
  ];

  return (
    <svg className="wl-flow-lines" viewBox="0 0 1400 600" preserveAspectRatio="none">
      {paths.map((d, i) => (
        <path
          key={i}
          d={d}
          className="wl-flow-line"
          style={{
            opacity: 0.04 + (i % 5) * 0.008,
            animationDuration: `${10 + i * 1.5}s`,
            animationDelay: `${i * -0.8}s`,
          }}
        />
      ))}
    </svg>
  );
}

function GradientMesh() {
  return (
    <div className="wl-gradient-mesh">
      <div className="wl-mesh-blob wl-mesh-blob-1" />
      <div className="wl-mesh-blob wl-mesh-blob-2" />
      <div className="wl-mesh-blob wl-mesh-blob-3" />
      <div className="wl-mesh-blob wl-mesh-blob-4" />
    </div>
  );
}

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

function Reveal({
  children,
  delay = 0,
  x = 0,
  y = 30,
}: {
  children: React.ReactNode;
  delay?: number;
  x?: number;
  y?: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x, y }}
      animate={isInView ? { opacity: 1, x: 0, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

function IconBrain() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a5 5 0 0 1 4.9 4 5 5 0 0 1-1 9.9M12 2a5 5 0 0 0-4.9 4 5 5 0 0 0 1 9.9" />
      <path d="M12 2v20" />
      <path d="M8 14h8" />
      <path d="M9 10h6" />
    </svg>
  );
}

function IconChart() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="M7 17l4-8 4 4 5-9" />
    </svg>
  );
}

function IconBarChart() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="12" width="4" height="9" rx="1" />
      <rect x="10" y="7" width="4" height="14" rx="1" />
      <rect x="17" y="3" width="4" height="18" rx="1" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function IconPhone() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  );
}

function IconCurrency() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9 12h6" />
      <path d="M12 9v6" />
      <path d="M14.5 8.5L9.5 15.5" />
    </svg>
  );
}

function IconGlobe() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function WorldMapBackground({ className }: { className?: string }) {
  return (
    <div className={className}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/world-map.png"
        alt=""
        aria-hidden="true"
        draggable={false}
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
      />
    </div>
  );
}

function BeadDivider({ variant = "default" }: { variant?: "default" | "kenya" | "accent" }) {
  const patterns: Record<string, string[]> = {
    default: ["bead-black", "bead-red", "bead-amber", "bead-green", "bead-white", "bead-green", "bead-amber", "bead-red", "bead-black"],
    kenya: ["bead-black", "bead-black", "bead-red", "bead-red", "bead-white", "bead-red", "bead-red", "bead-green", "bead-green"],
    accent: ["bead-amber", "bead-red", "bead-amber", "bead-green", "bead-amber", "bead-red", "bead-amber"],
  };

  return (
    <div className="wl-bead-divider">
      {patterns[variant].map((cls, i) => (
        <div key={i} className={`wl-bead ${cls} ${i === Math.floor(patterns[variant].length / 2) ? "wl-bead-lg" : ""}`} />
      ))}
    </div>
  );
}

function KenyaStrip() {
  return (
    <div className="wl-kenya-strip">
      <div className="wl-kenya-strip-band wl-ks-black" />
      <div className="wl-kenya-strip-band wl-ks-red" />
      <div className="wl-kenya-strip-band wl-ks-green" />
    </div>
  );
}

function WaitlistForm({ variant = "hero" }: { variant?: "hero" | "cta" }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [position, setPosition] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
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
      if (!res.ok) {
        throw new Error(result.error || "Request failed");
      }
      setPosition(result.position);
      setStatus("success");
    } catch {
      setErrorMsg("Something went wrong. Please try again.");
      setStatus("error");
    }
  }, [email]);

  if (status === "success") {
    return (
      <motion.div
        className={`wl-form-success ${variant === "cta" ? "wl-form-success-cta" : ""}`}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="wl-success-check">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--buy)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <div className="wl-success-text">You&apos;re on the list!</div>
        {position && (
          <div className="wl-success-position">
            You&apos;re <span className="wl-position-number">#{position}</span> on the waitlist
          </div>
        )}
      </motion.div>
    );
  }

  return (
    <form
      className={`wl-email-form ${variant === "cta" ? "wl-email-form-cta" : ""}`}
      onSubmit={handleSubmit}
    >
      <div className="wl-input-row">
        <input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (status === "error") setStatus("idle"); }}
          className="wl-email-input"
          disabled={status === "loading"}
        />
        <button
          type="submit"
          className="wl-submit-btn"
          disabled={status === "loading"}
        >
          {status === "loading" ? (
            <span className="wl-spinner" />
          ) : (
            "Join Waitlist"
          )}
        </button>
      </div>
      {status === "error" && errorMsg && (
        <motion.div
          className="wl-error-msg"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {errorMsg}
        </motion.div>
      )}
    </form>
  );
}

function ChatMockup() {
  return (
    <div className="wl-mockup-panel wl-mockup-chat">
      <div className="wl-chat-bubble wl-chat-bubble-user">
        Backtest a 20/50 EMA crossover on Safaricom
      </div>
      <div className="wl-chat-bubble wl-chat-bubble-ai">
        Running backtest on SCOM.NR with 20/50 EMA crossover across 2 years of NSE data...
      </div>
      <div className="wl-chat-bubble wl-chat-bubble-ai">
        72 trades, 58% win rate, 2.1 profit factor. Sharpe: 1.84.
      </div>
      <div className="wl-typing-indicator">
        <div className="wl-typing-dot" />
        <div className="wl-typing-dot" />
        <div className="wl-typing-dot" />
      </div>
    </div>
  );
}

function EquityCurveMockup({ visible }: { visible: boolean }) {
  const pathData = "M30,180 C60,170 90,160 120,155 S170,140 200,130 S250,120 280,100 S330,110 360,90 S410,70 440,60 S480,55 510,40";
  const fillData = pathData + " L510,200 L30,200 Z";

  return (
    <div className="wl-mockup-panel wl-mockup-equity">
      <svg width="100%" viewBox="0 0 540 220" preserveAspectRatio="xMidYMid meet">
        {[60, 100, 140, 180].map((y) => (
          <line key={y} x1="30" y1={y} x2="510" y2={y} stroke="rgba(236,227,213,0.04)" strokeWidth="1" />
        ))}
        <path d={fillData} fill="var(--buy)" className={`wl-equity-fill ${visible ? "visible" : ""}`} />
        <path
          d={pathData}
          className={`wl-equity-path wl-equity-path-animated ${visible ? "visible" : ""}`}
        />
        <text x="30" y="210" fill="var(--text-muted)" fontSize="9" fontFamily="var(--font-mono)">0</text>
        <text x="510" y="210" fill="var(--text-muted)" fontSize="9" fontFamily="var(--font-mono)" textAnchor="end">100</text>
      </svg>
    </div>
  );
}

function CandlestickMockup() {
  const candles = [
    { x: 40, open: 120, close: 90, high: 80, low: 130, green: true },
    { x: 80, open: 95, close: 110, high: 85, low: 120, green: false },
    { x: 120, open: 105, close: 80, high: 70, low: 115, green: true },
    { x: 160, open: 85, close: 100, high: 75, low: 110, green: false },
    { x: 200, open: 95, close: 70, high: 60, low: 105, green: true },
    { x: 240, open: 75, close: 65, high: 55, low: 85, green: true },
    { x: 280, open: 68, close: 80, high: 58, low: 90, green: false },
    { x: 320, open: 78, close: 55, high: 45, low: 88, green: true },
  ];

  return (
    <div className="wl-mockup-panel wl-mockup-candles">
      <svg width="100%" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid meet">
        {candles.map((c, i) => {
          const bodyTop = Math.min(c.open, c.close);
          const bodyHeight = Math.abs(c.open - c.close);
          return (
            <g key={i}>
              <line x1={c.x} y1={c.high} x2={c.x} y2={c.low} className="wl-candle-wick" />
              <rect
                x={c.x - 10}
                y={bodyTop}
                width={20}
                height={Math.max(bodyHeight, 2)}
                rx={2}
                className={c.green ? "wl-candle-body-green" : "wl-candle-body-red"}
              />
            </g>
          );
        })}
        <line x1="20" y1="75" x2="380" y2="75" className="wl-candle-level-line" />
        <text x="382" y="79" className="wl-candle-level-label">21,450.25</text>
      </svg>
    </div>
  );
}

function TrustStrip() {
  const badges = [
    { icon: <IconShield />, title: "NSE Licensed", desc: "7 CMA-regulated brokers. Trade Safaricom, KCB, Equity, EABL, and the entire NSE." },
    { icon: <IconPhone />, title: "M-Pesa Native", desc: "Fund your account instantly via M-Pesa, Airtel Money, T-Kash, or KCB M-Pesa." },
    { icon: <IconCurrency />, title: "Trade in KES", desc: "No currency conversion. See P&L, margins, and fees in Kenyan Shillings." },
    { icon: <IconGlobe />, title: "Pan-African", desc: "NSE today. Uganda, Tanzania, Rwanda, and JSE coming next." },
  ];

  return (
    <section className="wl-trust-strip">
      <WorldMapBackground className="wl-trust-strip-bg" />
      <div className="wl-trust-badges">
        {badges.map((badge, i) => (
          <Reveal key={i} delay={i * 0.1}>
            <div className="wl-trust-badge">
              <div className="wl-trust-badge-icon">{badge.icon}</div>
              <div className="wl-trust-badge-title">{badge.title}</div>
              <div className="wl-trust-badge-desc">{badge.desc}</div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function MetricsStrip() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });
  const metrics = [
    { value: 7, suffix: "", label: "NSE Brokers Connected" },
    { value: 50, suffix: "+", label: "Technical Indicators" },
    { value: 6, suffix: "", label: "African Exchanges" },
    { value: 15, suffix: "+", label: "AI Trading Tools" },
  ];

  return (
    <div className="wl-metrics-section" ref={ref}>
      <div className="wl-metrics-grid">
        {metrics.map((m, i) => (
          <MetricItem key={i} target={m.value} suffix={m.suffix} label={m.label} inView={isInView} delay={i * 150} />
        ))}
      </div>
    </div>
  );
}

function MetricItem({ target, suffix, label, inView, delay }: {
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
    <div className="wl-metric-item">
      <div className="wl-metric-value">{count}{suffix}</div>
      <div className="wl-metric-label">{label}</div>
    </div>
  );
}

type ChatMsg = { from: "alphy" | "user"; text: string };

const ALPHY_INTRO: ChatMsg[] = [
  { from: "alphy", text: "Hey! I'm Alphy, your AI trading copilot. What would you like to know about aFindr?" },
];

const QUICK_QUESTIONS: { label: string; answer: string }[] = [
  { label: "What is aFindr?", answer: "aFindr is an AI-powered trading platform built for Kenya and Africa. You get institutional-grade charting, backtesting with Monte Carlo simulations, and me — an AI copilot that speaks plain language. Fund with M-Pesa, trade in KES, no gatekeepers." },
  { label: "When does it launch?", answer: "We're putting the finishing touches on the platform right now. Join the waitlist and you'll be the first to know when we go live. Early waitlisters get priority access and exclusive perks!" },
  { label: "How does Alphy help?", answer: "I can backtest any strategy on NSE stocks like Safaricom or KCB, generate PineScript indicators, run walk-forward optimization, analyze trade patterns, and explain complex market concepts in plain language. Just ask me anything!" },
  { label: "Is it free?", answer: "aFindr will be free to get started — you'll get access to charting, AI analysis, and paper trading. We connect to 7 CMA-regulated brokers so when you're ready to go live, everything is already set up." },
  { label: "What markets?", answer: "We're launching with full support for the Nairobi Securities Exchange (NSE). Expanding to USE (Uganda), DSE (Tanzania), RSE (Rwanda), and JSE (South Africa). You can also analyze global futures, forex, and crypto." },
  { label: "How do I fund?", answer: "M-Pesa, Airtel Money, T-Kash, or KCB M-Pesa — instant deposits, no currency conversion needed. Everything is in KES. Your broker handles settlements through CMA-regulated channels." },
];

function AlphyChat({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMsg[]>(ALPHY_INTRO);
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleQuestion = useCallback((q: typeof QUICK_QUESTIONS[number]) => {
    setMessages((prev) => [...prev, { from: "user", text: q.label }]);
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      setMessages((prev) => [...prev, { from: "alphy", text: q.answer }]);
    }, 800 + Math.random() * 600);
  }, []);

  const asked = messages.filter((m) => m.from === "user").map((m) => m.text);
  const remaining = QUICK_QUESTIONS.filter((q) => !asked.includes(q.label));

  return (
    <motion.div
      className="wl-alphy-chat"
      initial={{ opacity: 0, y: 12, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.95 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="wl-alphy-chat-header">
        <svg width="24" height="24" viewBox="0 0 64 64" fill="none">
          <ellipse cx="32" cy="36" rx="18" ry="20" fill="var(--accent)" />
          <ellipse cx="25" cy="29" rx="3.5" ry="4" fill="var(--text-primary)" />
          <ellipse cx="39" cy="29" rx="3.5" ry="4" fill="var(--text-primary)" />
          <path d="M26 38 Q32 43 38 38" stroke="var(--text-primary)" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        </svg>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Alphy</div>
          <div style={{ fontSize: 10, color: "var(--accent-bright)" }}>Online</div>
        </div>
        <button className="wl-alphy-chat-close" onClick={onClose}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="wl-alphy-chat-messages">
        {messages.map((msg, i) => (
          <motion.div
            key={i}
            className={`wl-alphy-chat-msg ${msg.from === "alphy" ? "wl-alphy-msg" : "wl-user-msg"}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i === messages.length - 1 ? 0.05 : 0 }}
          >
            {msg.text}
          </motion.div>
        ))}
        {isTyping && (
          <div className="wl-alphy-chat-msg wl-alphy-msg">
            <div className="wl-alphy-typing">
              <span /><span /><span />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {remaining.length > 0 && !isTyping && (
        <div className="wl-alphy-chat-chips">
          {remaining.map((q) => (
            <button key={q.label} className="wl-alphy-chip" onClick={() => handleQuestion(q)}>
              {q.label}
            </button>
          ))}
        </div>
      )}

      {remaining.length === 0 && !isTyping && (
        <div className="wl-alphy-chat-chips">
          <button className="wl-alphy-chip wl-alphy-chip-cta" onClick={onClose}>
            Join the Waitlist Above
          </button>
        </div>
      )}
    </motion.div>
  );
}

export default function WaitlistPage() {
  const featuresRef = useRef<HTMLDivElement>(null);
  const [showAlphyChat, setShowAlphyChat] = useState(false);

  const scrollToFeatures = useCallback(() => {
    featuresRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const equityRef = useRef(null);
  const equityInView = useInView(equityRef, { once: true, margin: "-80px" });

  return (
    <div className="wl-page">
      <nav className="wl-nav">
        <div className="wl-nav-logo">
          <div className="wl-logo-alphy-wrap" onClick={() => setShowAlphyChat((v) => !v)} style={{ cursor: "pointer" }}>
            <svg className="wl-logo-alphy" viewBox="0 0 64 64" fill="none">
              <ellipse cx="32" cy="36" rx="18" ry="20" fill="var(--accent)" />
              <ellipse cx="32" cy="40" rx="12" ry="13" fill="var(--accent-bright)" opacity="0.3" />
              <ellipse cx="25" cy="29" rx="4" ry="4.5" fill="var(--text-primary)" />
              <ellipse cx="26" cy="29.5" rx="2" ry="2.5" fill="var(--bg)" />
              <circle cx="24.5" cy="28" r="1" fill="var(--text-primary)" />
              <ellipse cx="39" cy="29" rx="4" ry="4.5" fill="var(--text-primary)" />
              <ellipse cx="40" cy="29.5" rx="2" ry="2.5" fill="var(--bg)" />
              <circle cx="38.5" cy="28" r="1" fill="var(--text-primary)" />
              <path d="M20 24 Q25 21 29 24" stroke="var(--bg)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
              <path d="M35 24 Q39 21 44 24" stroke="var(--bg)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
              <path d="M26 38 Q32 43 38 38" stroke="var(--text-primary)" strokeWidth="1.8" fill="none" strokeLinecap="round" />
              <circle cx="21" cy="34" r="3" fill="var(--accent-bright)" opacity="0.35" />
              <circle cx="43" cy="34" r="3" fill="var(--accent-bright)" opacity="0.35" />
              <text x="32" y="21" textAnchor="middle" fontSize="10" fontWeight="bold" fill="var(--text-primary)" fontFamily="Georgia, serif" opacity="0.7">&#x3B1;</text>
            </svg>
            <AlphyBubble />
          </div>
        </div>
        <div className="wl-nav-actions">
          <button className="wl-btn-ghost" onClick={scrollToFeatures}>Learn More</button>
        </div>
      </nav>

      <TickerBanner />

      <AnimatePresence>
        {showAlphyChat && <AlphyChat onClose={() => setShowAlphyChat(false)} />}
      </AnimatePresence>

      <section className="wl-hero">
        <GradientMesh />
        <FlowLines />
        <div className="wl-hero-noise" />
        <motion.div
          className="wl-hero-content"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="wl-early-access-badge">
            <span className="wl-badge-dot" />
            Early Access
          </div>
          <h1 className="wl-hero-headline">Be first to trade smarter.</h1>
          <p className="wl-hero-subline">
            AI-powered analysis, backtesting, and strategy optimization &mdash; built for the Nairobi Securities Exchange and beyond. Join the waitlist for early access.
          </p>
          <WaitlistForm variant="hero" />
          <p className="wl-hero-footnote">Free to join. No spam. Unsubscribe anytime.</p>
        </motion.div>
      </section>

      <section className="wl-section" ref={featuresRef}>
        <div className="wl-section-heading">
          <Reveal><h2>Institutional-grade tools, zero barriers</h2></Reveal>
          <Reveal delay={0.1}><p>Everything Wall Street has, now on the NSE. No minimum balance. No middlemen.</p></Reveal>
        </div>

        <div className="wl-product-cards-grid">
          {[
            { icon: <IconBrain />, title: "AI Copilot", desc: "Ask Alphy to analyze Safaricom, backtest KCB momentum strategies, or explain any NSE pattern in plain language." },
            { icon: <IconBarChart />, title: "Backtesting Engine", desc: "Stress-test your strategy with Monte Carlo simulations before risking a single shilling." },
            { icon: <IconChart />, title: "Real-Time Charts", desc: "Professional candlestick charts with 50+ indicators. NSE, USE, DSE — all in real time." },
          ].map((card, i) => (
            <Reveal key={i} delay={i * 0.12}>
              <div className="wl-feature-card">
                <div className="wl-feature-card-icon">{card.icon}</div>
                <h3 className="wl-feature-card-title">{card.title}</h3>
                <p className="wl-feature-card-desc">{card.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <BeadDivider variant="kenya" />
      <TrustStrip />
      <BeadDivider variant="accent" />

      <section className="wl-deep-dives-section">
        <div className="wl-deep-dive-row">
          <Reveal x={-60}>
            <div className="wl-deep-dive-content">
              <span className="wl-deep-dive-label">Alphy AI</span>
              <h3 className="wl-deep-dive-title">Your AI trading copilot</h3>
              <p className="wl-deep-dive-desc">
                Ask Alphy to backtest Safaricom breakout strategies, run Monte Carlo analysis on your KCB position, or generate PineScript indicators for NSE blue chips. Natural language in, institutional-grade analysis out.
              </p>
            </div>
          </Reveal>
          <Reveal x={60}>
            <div className="wl-deep-dive-visual">
              <ChatMockup />
            </div>
          </Reveal>
        </div>

        <div className="wl-deep-dive-row wl-reverse" ref={equityRef}>
          <Reveal x={-60}>
            <div className="wl-deep-dive-visual">
              <EquityCurveMockup visible={equityInView} />
            </div>
          </Reveal>
          <Reveal x={60}>
            <div className="wl-deep-dive-content">
              <span className="wl-deep-dive-label">Strategy Tester</span>
              <h3 className="wl-deep-dive-title">Backtest with confidence</h3>
              <p className="wl-deep-dive-desc">
                Visualize equity curves, drawdowns, and risk metrics on NSE and global instruments. Run walk-forward optimization and Monte Carlo analysis to validate your edge before risking real capital.
              </p>
            </div>
          </Reveal>
        </div>

        <div className="wl-deep-dive-row">
          <Reveal x={-60}>
            <div className="wl-deep-dive-content">
              <span className="wl-deep-dive-label">Chart Tools</span>
              <h3 className="wl-deep-dive-title">Professional-grade charting</h3>
              <p className="wl-deep-dive-desc">
                TradingView-quality candlestick charts with drawing tools, custom indicators, and multi-timeframe analysis. NSE, futures, forex &mdash; everything renders in real time.
              </p>
            </div>
          </Reveal>
          <Reveal x={60}>
            <div className="wl-deep-dive-visual">
              <CandlestickMockup />
            </div>
          </Reveal>
        </div>
      </section>

      <BeadDivider variant="default" />
      <MetricsStrip />

      <section className="wl-cta-section">
        <Reveal><KenyaStrip /></Reveal>
        <Reveal delay={0.05}><h2 className="wl-cta-heading" style={{ marginTop: 24 }}>Don&apos;t miss the launch.</h2></Reveal>
        <Reveal delay={0.1}><p className="wl-cta-subtext">Be among the first Kenyan traders to use AI to find their edge.</p></Reveal>
        <Reveal delay={0.2}><WaitlistForm variant="cta" /></Reveal>
      </section>

      <footer className="wl-footer">
        <div className="wl-footer-left">
          &copy; 2026 aFindr. Regulated by the Capital Markets Authority, Kenya.
        </div>
        <div className="wl-footer-right">
          <span className="wl-footer-link">Built with Alphy</span>
          <span className="wl-footer-link">NSE Licensed</span>
        </div>
      </footer>
    </div>
  );
}
