"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import "./landing.css";

// ─── Alphy Rotating Bubble Messages ───
const ALPHY_MESSAGES = [
  "Hi, I'm Alphy — your trading copilot",
  "I can backtest any strategy on the NSE",
  "Ask me to analyze Safaricom or KCB",
  "Need help with Monte Carlo simulations?",
  "I generate PineScript indicators too",
  "Let me help you find your edge",
  "I speak charts, patterns, and KES",
  "Fund with M-Pesa, trade with AI",
  "50+ indicators at your fingertips",
  "I never sleep — markets don't either",
  "Your portfolio, your rules, my analysis",
  "From beginner to pro — I adapt to you",
];

function AlphyBubble() {
  // Start with deterministic first message (same on server & client) to avoid hydration mismatch
  const [order, setOrder] = useState<string[]>([ALPHY_MESSAGES[0]]);
  const [index, setIndex] = useState(0);

  // Shuffle on mount (client only)
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
    <div className="logo-bubble">
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

// ─── Flow Lines SVG ───
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
    <svg className="flow-lines" viewBox="0 0 1400 600" preserveAspectRatio="none">
      {paths.map((d, i) => (
        <path
          key={i}
          d={d}
          className="flow-line"
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

// ─── Gradient Mesh ───
function GradientMesh() {
  return (
    <div className="gradient-mesh">
      <div className="mesh-blob mesh-blob-1" />
      <div className="mesh-blob mesh-blob-2" />
      <div className="mesh-blob mesh-blob-3" />
      <div className="mesh-blob mesh-blob-4" />
    </div>
  );
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

// ─── Scroll Reveal Wrapper ───
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

// ─── Icons (inline SVGs) ───
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

// ─── World Map (image-based, blurred behind trust strip) ───
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

// ─── Maasai Bead Divider ───
function BeadDivider({ variant = "default" }: { variant?: "default" | "kenya" | "accent" }) {
  const patterns: Record<string, string[]> = {
    default: ["bead-black", "bead-red", "bead-amber", "bead-green", "bead-white", "bead-green", "bead-amber", "bead-red", "bead-black"],
    kenya: ["bead-black", "bead-black", "bead-red", "bead-red", "bead-white", "bead-red", "bead-red", "bead-green", "bead-green"],
    accent: ["bead-amber", "bead-red", "bead-amber", "bead-green", "bead-amber", "bead-red", "bead-amber"],
  };

  return (
    <div className="bead-divider">
      {patterns[variant].map((cls, i) => (
        <div key={i} className={`bead ${cls} ${i === Math.floor(patterns[variant].length / 2) ? "bead-lg" : ""}`} />
      ))}
    </div>
  );
}

// ─── Kenya Flag Mini Strip ───
function KenyaStrip() {
  return (
    <div className="kenya-strip">
      <div className="kenya-strip-band ks-black" />
      <div className="kenya-strip-band ks-red" />
      <div className="kenya-strip-band ks-green" />
    </div>
  );
}

// ─── Trust Badge Icons ───
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

// ─── Chat Mockup ───
function ChatMockup() {
  return (
    <div className="mockup-panel mockup-chat">
      <div className="chat-bubble chat-bubble-user">
        Backtest a 20/50 EMA crossover on Safaricom
      </div>
      <div className="chat-bubble chat-bubble-ai">
        Running backtest on SCOM.NR with 20/50 EMA crossover across 2 years of NSE data...
      </div>
      <div className="chat-bubble chat-bubble-ai">
        72 trades, 58% win rate, 2.1 profit factor. Sharpe: 1.84.
      </div>
      <div className="typing-indicator">
        <div className="typing-dot" />
        <div className="typing-dot" />
        <div className="typing-dot" />
      </div>
    </div>
  );
}

// ─── Equity Curve Mockup ───
function EquityCurveMockup({ visible }: { visible: boolean }) {
  const pathData = "M30,180 C60,170 90,160 120,155 S170,140 200,130 S250,120 280,100 S330,110 360,90 S410,70 440,60 S480,55 510,40";
  const fillData = pathData + " L510,200 L30,200 Z";

  return (
    <div className="mockup-panel mockup-equity">
      <svg width="100%" viewBox="0 0 540 220" preserveAspectRatio="xMidYMid meet">
        {/* Grid lines */}
        {[60, 100, 140, 180].map((y) => (
          <line key={y} x1="30" y1={y} x2="510" y2={y} stroke="rgba(236,227,213,0.04)" strokeWidth="1" />
        ))}
        {/* Fill */}
        <path d={fillData} fill="var(--buy)" className={`equity-fill ${visible ? "visible" : ""}`} />
        {/* Line */}
        <path
          d={pathData}
          className={`equity-path equity-path-animated ${visible ? "visible" : ""}`}
        />
        {/* Axis labels */}
        <text x="30" y="210" fill="var(--text-muted)" fontSize="9" fontFamily="var(--font-mono)">0</text>
        <text x="510" y="210" fill="var(--text-muted)" fontSize="9" fontFamily="var(--font-mono)" textAnchor="end">100</text>
      </svg>
    </div>
  );
}

// ─── Candlestick Mockup ───
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
    <div className="mockup-panel mockup-candles">
      <svg width="100%" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid meet">
        {candles.map((c, i) => {
          const bodyTop = Math.min(c.open, c.close);
          const bodyHeight = Math.abs(c.open - c.close);
          return (
            <g key={i}>
              <line x1={c.x} y1={c.high} x2={c.x} y2={c.low} className="candle-wick" />
              <rect
                x={c.x - 10}
                y={bodyTop}
                width={20}
                height={Math.max(bodyHeight, 2)}
                rx={2}
                className={c.green ? "candle-body-green" : "candle-body-red"}
              />
            </g>
          );
        })}
        {/* Horizontal level line */}
        <line x1="20" y1="75" x2="380" y2="75" className="candle-level-line" />
        <text x="382" y="79" className="candle-level-label">21,450.25</text>
      </svg>
    </div>
  );
}

// ─── Trust Strip ───
function TrustStrip() {
  const badges = [
    {
      icon: <IconShield />,
      title: "NSE Licensed",
      desc: "7 CMA-regulated brokers. Trade Safaricom, KCB, Equity, EABL, and the entire NSE.",
    },
    {
      icon: <IconPhone />,
      title: "M-Pesa Native",
      desc: "Fund your account instantly via M-Pesa, Airtel Money, T-Kash, or KCB M-Pesa.",
    },
    {
      icon: <IconCurrency />,
      title: "Trade in KES",
      desc: "No currency conversion. See P&L, margins, and fees in Kenyan Shillings.",
    },
    {
      icon: <IconGlobe />,
      title: "Pan-African",
      desc: "NSE today. Uganda, Tanzania, Rwanda, and JSE coming next.",
    },
  ];

  return (
    <section className="trust-strip">
      <WorldMapBackground className="trust-strip-bg" />
      <div className="trust-badges">
        {badges.map((badge, i) => (
          <Reveal key={i} delay={i * 0.1}>
            <div className="trust-badge">
              <div className="trust-badge-icon">{badge.icon}</div>
              <div className="trust-badge-title">{badge.title}</div>
              <div className="trust-badge-desc">{badge.desc}</div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// ─── Metrics Strip ───
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
    <div className="metrics-section" ref={ref}>
      <div className="metrics-grid">
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
    <div className="metric-item">
      <div className="metric-value">{count}{suffix}</div>
      <div className="metric-label">{label}</div>
    </div>
  );
}

// ─── Alphy Quick Chat Widget ───
type ChatMsg = { from: "alphy" | "user"; text: string };

const ALPHY_INTRO: ChatMsg[] = [
  { from: "alphy", text: "Hey! I'm Alphy, your AI trading copilot. What would you like to know about aFindr?" },
];

const QUICK_QUESTIONS: { label: string; answer: string }[] = [
  {
    label: "What is aFindr?",
    answer: "aFindr is an AI-powered trading platform built for Kenya and Africa. You get institutional-grade charting, backtesting with Monte Carlo simulations, and me — an AI copilot that speaks plain language. Fund with M-Pesa, trade in KES, no gatekeepers.",
  },
  {
    label: "How does Alphy help?",
    answer: "I can backtest any strategy on NSE stocks like Safaricom or KCB, generate PineScript indicators, run walk-forward optimization, analyze trade patterns, and explain complex market concepts in plain language. Just ask me anything!",
  },
  {
    label: "Is it free?",
    answer: "aFindr is free to get started — you get access to charting, AI analysis, and paper trading. We connect to 7 CMA-regulated brokers so when you're ready to go live, everything is already set up.",
  },
  {
    label: "What markets?",
    answer: "Right now we fully support the Nairobi Securities Exchange (NSE). We're expanding to USE (Uganda), DSE (Tanzania), RSE (Rwanda), and JSE (South Africa). You can also analyze global futures, forex, and crypto.",
  },
  {
    label: "How do I fund?",
    answer: "M-Pesa, Airtel Money, T-Kash, or KCB M-Pesa — instant deposits, no currency conversion needed. Everything is in KES. Your broker handles settlements through CMA-regulated channels.",
  },
  {
    label: "What's backtesting?",
    answer: "Backtesting lets you test a trading strategy against historical data before risking real money. I run thousands of simulations to show you win rate, profit factor, drawdowns — so you know if your edge is real or just luck.",
  },
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

  // Filter out questions already asked
  const asked = messages.filter((m) => m.from === "user").map((m) => m.text);
  const remaining = QUICK_QUESTIONS.filter((q) => !asked.includes(q.label));

  return (
    <motion.div
      className="alphy-chat"
      initial={{ opacity: 0, y: 12, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.95 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Header */}
      <div className="alphy-chat-header">
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
        <button className="alphy-chat-close" onClick={onClose}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="alphy-chat-messages">
        {messages.map((msg, i) => (
          <motion.div
            key={i}
            className={`alphy-chat-msg ${msg.from === "alphy" ? "alphy-msg" : "user-msg"}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i === messages.length - 1 ? 0.05 : 0 }}
          >
            {msg.text}
          </motion.div>
        ))}
        {isTyping && (
          <div className="alphy-chat-msg alphy-msg">
            <div className="alphy-typing">
              <span /><span /><span />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick question chips */}
      {remaining.length > 0 && !isTyping && (
        <div className="alphy-chat-chips">
          {remaining.map((q) => (
            <button
              key={q.label}
              className="alphy-chip"
              onClick={() => handleQuestion(q)}
            >
              {q.label}
            </button>
          ))}
        </div>
      )}

      {remaining.length === 0 && !isTyping && (
        <div className="alphy-chat-chips">
          <button
            className="alphy-chip alphy-chip-cta"
            onClick={() => window.location.href = "/onboarding"}
          >
            Get Started with aFindr
          </button>
        </div>
      )}
    </motion.div>
  );
}

// ─── Main Landing Page ───
export default function LandingPage() {
  const router = useRouter();
  const featuresRef = useRef<HTMLDivElement>(null);
  const [showAlphyChat, setShowAlphyChat] = useState(false);

  const scrollToFeatures = useCallback(() => {
    featuresRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Equity curve visibility ref
  const equityRef = useRef(null);
  const equityInView = useInView(equityRef, { once: true, margin: "-80px" });

  return (
    <div className="landing-page">
      {/* ─── Navbar ─── */}
      <nav className="landing-nav">
        <div className="landing-nav-logo">
          <div className="logo-alphy-wrap" onClick={() => setShowAlphyChat((v) => !v)} style={{ cursor: "pointer" }}>
            <svg className="logo-alphy" viewBox="0 0 64 64" fill="none">
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
        <div className="landing-nav-actions">
          <button className="btn-ghost" onClick={() => router.push("/")}>Sign In</button>
          <button className="btn-accent" onClick={() => router.push("/onboarding")}>Get Started</button>
        </div>
      </nav>

      {/* ─── Alphy Chat Widget ─── */}
      <AnimatePresence>
        {showAlphyChat && (
          <AlphyChat onClose={() => setShowAlphyChat(false)} />
        )}
      </AnimatePresence>

      {/* ─── Hero ─── */}
      <section className="landing-hero">
        <GradientMesh />
        <FlowLines />
        <div className="hero-noise" />
        <motion.div
          className="hero-content"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        >
          <h1 className="hero-headline">The future of trading in Africa.</h1>
          <p className="hero-subline">
            AI-powered analysis, backtesting, and strategy optimization &mdash; built for the Nairobi Securities Exchange and beyond. Fund with M-Pesa. Trade in KES. No gatekeepers.
          </p>
          <div className="hero-buttons">
            <button className="btn-hero-primary" onClick={() => router.push("/onboarding")}>
              Start Trading
            </button>
            <button className="btn-hero-secondary" onClick={scrollToFeatures}>
              See How It Works
            </button>
          </div>
        </motion.div>
      </section>

      {/* ─── Product Cards ─── */}
      <section className="landing-section" ref={featuresRef}>
        <div className="section-heading">
          <Reveal>
            <h2>Institutional-grade tools, zero barriers</h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p>Everything Wall Street has, now on the NSE. No minimum balance. No middlemen.</p>
          </Reveal>
        </div>

        <div className="product-cards-grid">
          {[
            { icon: <IconBrain />, title: "AI Copilot", desc: "Ask Alphy to analyze Safaricom, backtest KCB momentum strategies, or explain any NSE pattern in plain language." },
            { icon: <IconBarChart />, title: "Backtesting Engine", desc: "Stress-test your strategy with Monte Carlo simulations before risking a single shilling." },
            { icon: <IconChart />, title: "Real-Time Charts", desc: "Professional candlestick charts with 50+ indicators. NSE, USE, DSE \u2014 all in real time." },
          ].map((card, i) => (
            <Reveal key={i} delay={i * 0.12}>
              <div className="feature-card">
                <div className="feature-card-icon">{card.icon}</div>
                <h3 className="feature-card-title">{card.title}</h3>
                <p className="feature-card-desc">{card.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ─── Bead Divider ─── */}
      <BeadDivider variant="kenya" />

      {/* ─── Built for Kenya: Trust Strip ─── */}
      <TrustStrip />

      {/* ─── Bead Divider ─── */}
      <BeadDivider variant="accent" />

      {/* ─── Feature Deep Dives ─── */}
      <section className="deep-dives-section">
        {/* Row 1: Alphy AI */}
        <div className="deep-dive-row">
          <Reveal x={-60}>
            <div className="deep-dive-content">
              <span className="deep-dive-label">Alphy AI</span>
              <h3 className="deep-dive-title">Your AI trading copilot</h3>
              <p className="deep-dive-desc">
                Ask Alphy to backtest Safaricom breakout strategies, run Monte Carlo analysis on your KCB position, or generate PineScript indicators for NSE blue chips. Natural language in, institutional-grade analysis out.
              </p>
            </div>
          </Reveal>
          <Reveal x={60}>
            <div className="deep-dive-visual">
              <ChatMockup />
            </div>
          </Reveal>
        </div>

        {/* Row 2: Strategy Tester (reversed) */}
        <div className="deep-dive-row reverse" ref={equityRef}>
          <Reveal x={-60}>
            <div className="deep-dive-visual">
              <EquityCurveMockup visible={equityInView} />
            </div>
          </Reveal>
          <Reveal x={60}>
            <div className="deep-dive-content">
              <span className="deep-dive-label">Strategy Tester</span>
              <h3 className="deep-dive-title">Backtest with confidence</h3>
              <p className="deep-dive-desc">
                Visualize equity curves, drawdowns, and risk metrics on NSE and global instruments. Run walk-forward optimization and Monte Carlo analysis to validate your edge before risking real capital.
              </p>
            </div>
          </Reveal>
        </div>

        {/* Row 3: Chart Tools */}
        <div className="deep-dive-row">
          <Reveal x={-60}>
            <div className="deep-dive-content">
              <span className="deep-dive-label">Chart Tools</span>
              <h3 className="deep-dive-title">Professional-grade charting</h3>
              <p className="deep-dive-desc">
                TradingView-quality candlestick charts with drawing tools, custom indicators, and multi-timeframe analysis. NSE, futures, forex &mdash; everything renders in real time.
              </p>
            </div>
          </Reveal>
          <Reveal x={60}>
            <div className="deep-dive-visual">
              <CandlestickMockup />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── Bead Divider ─── */}
      <BeadDivider variant="default" />

      {/* ─── Metrics Strip ─── */}
      <MetricsStrip />

      {/* ─── CTA ─── */}
      <section className="cta-section">
        <Reveal>
          <KenyaStrip />
        </Reveal>
        <Reveal delay={0.05}>
          <h2 className="cta-heading" style={{ marginTop: 24 }}>The NSE has never been this accessible.</h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="cta-subtext">Join thousands of Kenyan traders using AI to find their edge.</p>
        </Reveal>
        <Reveal delay={0.2}>
          <button className="btn-cta-glow" onClick={() => router.push("/onboarding")}>
            Start Trading
          </button>
        </Reveal>
      </section>

      {/* ─── Footer ─── */}
      <footer className="landing-footer">
        <div className="footer-left">
          &copy; 2026 aFindr. Regulated by the Capital Markets Authority, Kenya.
        </div>
        <div className="footer-right">
          <span className="footer-link">Built with Alphy</span>
          <span className="footer-link">NSE Licensed</span>
          <span className="footer-link">Privacy</span>
          <span className="footer-link">Terms</span>
        </div>
      </footer>
    </div>
  );
}
