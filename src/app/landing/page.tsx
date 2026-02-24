"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { motion, useInView } from "framer-motion";
import { useRouter } from "next/navigation";
import "./landing.css";

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
            opacity: 0.04 + Math.random() * 0.04,
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

// ─── Chat Mockup ───
function ChatMockup() {
  return (
    <div className="mockup-panel mockup-chat">
      <div className="chat-bubble chat-bubble-user">
        Backtest a 20/50 EMA crossover on NQ futures
      </div>
      <div className="chat-bubble chat-bubble-ai">
        Running backtest on NQ=F with 20/50 EMA crossover strategy across 2 years of data...
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

// ─── Metrics Strip ───
function MetricsStrip() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  const metrics = [
    { value: 50, suffix: "+", label: "Technical Indicators" },
    { value: 1000, suffix: "+", label: "Monte Carlo Simulations" },
    { value: 6, suffix: "", label: "Timeframes" },
    { value: 15, suffix: "+", label: "AI Tools" },
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

// ─── Main Landing Page ───
export default function LandingPage() {
  const router = useRouter();
  const featuresRef = useRef<HTMLDivElement>(null);

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
        <div className="landing-nav-logo">aFindr</div>
        <div className="landing-nav-actions">
          <button className="btn-ghost" onClick={() => router.push("/")}>Sign In</button>
          <button className="btn-accent" onClick={() => router.push("/onboarding")}>Get Started</button>
        </div>
      </nav>

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
          <h1 className="hero-headline">Trade smarter.</h1>
          <p className="hero-subline">
            AI-powered analysis, backtesting, and strategy optimization for futures and equities.
          </p>
          <div className="hero-buttons">
            <button className="btn-hero-primary" onClick={() => router.push("/onboarding")}>
              Get Started
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
            <h2>Built for serious traders</h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p>Everything you need to analyze, test, and execute with confidence.</p>
          </Reveal>
        </div>

        <div className="product-cards-grid">
          {[
            { icon: <IconBrain />, title: "AI Copilot", desc: "Chat with Alphy to generate strategies, analyze patterns, and get real-time market insights." },
            { icon: <IconBarChart />, title: "Backtesting Engine", desc: "Run Monte Carlo simulations, walk-forward analysis, and optimize parameters in seconds." },
            { icon: <IconChart />, title: "Real-Time Charts", desc: "Professional charting with 50+ indicators, drawing tools, and custom PineScript overlays." },
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

      {/* ─── Feature Deep Dives ─── */}
      <section className="deep-dives-section">
        {/* Row 1: Alphy AI */}
        <div className="deep-dive-row">
          <Reveal x={-60}>
            <div className="deep-dive-content">
              <span className="deep-dive-label">Alphy AI</span>
              <h3 className="deep-dive-title">Your AI trading copilot</h3>
              <p className="deep-dive-desc">
                Ask Alphy to backtest any strategy, generate PineScript indicators, run Monte Carlo simulations, or analyze trade patterns. Natural language in, institutional-grade analysis out.
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
                Visualize equity curves, drawdowns, and risk metrics. Run walk-forward optimization and Monte Carlo analysis to validate your edge before risking real capital.
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
                TradingView-quality candlestick charts with drawing tools, custom indicators, and multi-timeframe analysis. Everything renders in real time with sub-second updates.
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

      {/* ─── Metrics Strip ─── */}
      <MetricsStrip />

      {/* ─── CTA ─── */}
      <section className="cta-section">
        <Reveal>
          <h2 className="cta-heading">Ready to trade smarter?</h2>
        </Reveal>
        <Reveal delay={0.15}>
          <button className="btn-cta-glow" onClick={() => router.push("/onboarding")}>
            Get Started
          </button>
        </Reveal>
      </section>

      {/* ─── Footer ─── */}
      <footer className="landing-footer">
        <div className="footer-left">
          &copy; 2026 aFindr. All rights reserved.
        </div>
        <div className="footer-right">
          <span className="footer-link">Built with Alphy</span>
          <span className="footer-link">Privacy</span>
          <span className="footer-link">Terms</span>
        </div>
      </footer>
    </div>
  );
}
