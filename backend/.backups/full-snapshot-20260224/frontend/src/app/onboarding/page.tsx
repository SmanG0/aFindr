"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { applyTheme, THEME_VARIABLES } from "@/lib/theme";
import type { AppTheme } from "@/lib/types";
import "./onboarding.css";

// ─── Types ───
interface OnboardingState {
  name: string;
  experience: "beginner" | "intermediate" | "advanced" | "";
  markets: string[];
  instruments: string[];
  riskTolerance: "conservative" | "moderate" | "aggressive";
  requireStopLoss: boolean;
  positionSizeLimits: boolean;
  theme: AppTheme;
}

const TOTAL_STEPS = 6;

const MARKETS = ["Futures", "Stocks", "Crypto", "Forex", "Options", "Commodities"];
const INSTRUMENTS = ["NQ=F", "ES=F", "GC=F", "CL=F", "AAPL", "NVDA", "BTC"];

const THEME_META: { key: AppTheme; label: string }[] = [
  { key: "dark-amber", label: "Amber" },
  { key: "midnight-blue", label: "Midnight" },
  { key: "forest-green", label: "Forest" },
  { key: "obsidian", label: "Obsidian" },
  { key: "classic-light", label: "Light" },
];

// ─── Alphy Mascot (inline SVG) ───
function AlphyMascot() {
  return (
    <svg className="alphy-mascot" viewBox="0 0 80 80" fill="none">
      <circle cx="40" cy="40" r="36" fill="var(--accent-muted)" stroke="var(--accent)" strokeWidth="1.5" />
      <circle cx="40" cy="40" r="24" fill="var(--glass)" stroke="var(--accent)" strokeWidth="1" opacity="0.6" />
      <text x="40" y="48" textAnchor="middle" fill="var(--accent-bright)" fontSize="28" fontWeight="700" fontFamily="inherit">
        a
      </text>
    </svg>
  );
}

// ─── Step Transition Variants ───
const stepVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? 80 : -80,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (dir: number) => ({
    x: dir > 0 ? -80 : 80,
    opacity: 0,
  }),
};

// ─── Theme Preview Component ───
function ThemePreview({
  themeKey,
  label,
  selected,
  onSelect,
}: {
  themeKey: AppTheme;
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const vars = THEME_VARIABLES[themeKey];
  const bands = [
    vars["--bg"],
    vars["--accent"],
    vars["--buy"],
    vars["--sell"],
  ];

  return (
    <div className="theme-option">
      <div
        className={`theme-preview ${selected ? "selected" : ""}`}
        onClick={onSelect}
      >
        <div className="theme-preview-bands">
          {bands.map((color, i) => (
            <div
              key={i}
              className="theme-preview-band"
              style={{ background: color }}
            />
          ))}
        </div>
        <div className="theme-check">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3.5 8.5L6.5 11.5L12.5 5.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
      <span className="theme-preview-label">{label}</span>
    </div>
  );
}

// ─── Main Onboarding Page ───
export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [state, setState] = useState<OnboardingState>({
    name: "",
    experience: "",
    markets: [],
    instruments: [],
    riskTolerance: "moderate",
    requireStopLoss: false,
    positionSizeLimits: false,
    theme: "dark-amber",
  });

  const progress = (step / TOTAL_STEPS) * 100;

  const goNext = useCallback(() => {
    setDirection(1);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  }, []);

  const goBack = useCallback(() => {
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 1));
  }, []);

  const update = useCallback(<K extends keyof OnboardingState>(key: K, value: OnboardingState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleArrayItem = useCallback((key: "markets" | "instruments", item: string) => {
    setState((prev) => {
      const arr = prev[key];
      return {
        ...prev,
        [key]: arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item],
      };
    });
  }, []);

  const handleComplete = useCallback(() => {
    const data = {
      name: state.name,
      experience: state.experience,
      markets: state.markets,
      instruments: state.instruments,
      riskTolerance: state.riskTolerance,
      requireStopLoss: state.requireStopLoss,
      positionSizeLimits: state.positionSizeLimits,
      theme: state.theme,
      completed: true,
      completedAt: Date.now(),
    };
    localStorage.setItem("afindr_onboarding", JSON.stringify(data));
    router.push("/");
  }, [state, router]);

  const canContinue = (): boolean => {
    switch (step) {
      case 1: return state.name.trim().length > 0;
      case 2: return state.experience !== "";
      case 3: return state.markets.length > 0;
      case 4: return true;
      case 5: return true;
      default: return true;
    }
  };

  const riskIndex = state.riskTolerance === "conservative" ? 0 : state.riskTolerance === "moderate" ? 1 : 2;

  return (
    <div className="onboarding-page">
      {/* Background mesh */}
      <div className="onboarding-mesh">
        <div
          className="mesh-blob"
          style={{
            width: 500,
            height: 500,
            background: "radial-gradient(circle, rgba(196,123,58,0.06) 0%, transparent 70%)",
            top: "-10%",
            left: "-10%",
            animation: "drift-1 15s ease-in-out infinite",
            filter: "blur(120px)",
          }}
        />
        <div
          className="mesh-blob"
          style={{
            width: 400,
            height: 400,
            background: "radial-gradient(circle, rgba(107,155,212,0.04) 0%, transparent 70%)",
            bottom: "-10%",
            right: "-10%",
            animation: "drift-2 20s ease-in-out infinite",
            filter: "blur(120px)",
          }}
        />
      </div>

      {/* Card */}
      <div className="onboarding-card">
        {/* Progress bar */}
        <div className="onboarding-progress">
          <div className="onboarding-progress-fill" style={{ width: `${progress}%` }} />
        </div>

        {/* Step content */}
        <div className="onboarding-body">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              className="step-content"
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              {step === 1 && (
                <>
                  <div className="alphy-mascot-wrapper">
                    <AlphyMascot />
                  </div>
                  <h2 className="step-headline" style={{ textAlign: "center" }}>Welcome to aFindr</h2>
                  <div style={{ marginTop: "auto" }}>
                    <label className="input-label">What should we call you?</label>
                    <input
                      className="glass-input"
                      type="text"
                      placeholder="Your name"
                      value={state.name}
                      onChange={(e) => update("name", e.target.value)}
                      autoFocus
                      onKeyDown={(e) => { if (e.key === "Enter" && canContinue()) goNext(); }}
                    />
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <h2 className="step-headline">What&apos;s your trading experience?</h2>
                  <div className="experience-cards">
                    {([
                      { key: "beginner", title: "Beginner", desc: "Just getting started with markets" },
                      { key: "intermediate", title: "Intermediate", desc: "I've traded before, learning strategies" },
                      { key: "advanced", title: "Advanced", desc: "I backtest, optimize, and manage risk" },
                    ] as const).map((opt) => (
                      <div
                        key={opt.key}
                        className={`experience-card ${state.experience === opt.key ? "selected" : ""}`}
                        onClick={() => update("experience", opt.key)}
                      >
                        <div className="experience-card-title">{opt.title}</div>
                        <div className="experience-card-desc">{opt.desc}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <h2 className="step-headline">What do you trade?</h2>
                  <div className="chip-grid">
                    {MARKETS.map((m) => (
                      <button
                        key={m}
                        className={`market-chip ${state.markets.includes(m.toLowerCase()) ? "selected" : ""}`}
                        onClick={() => toggleArrayItem("markets", m.toLowerCase())}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                  <div className="instruments-section">
                    <div className="instruments-label">Popular instruments</div>
                    <div className="instruments-grid">
                      {INSTRUMENTS.map((inst) => (
                        <button
                          key={inst}
                          className={`instrument-chip ${state.instruments.includes(inst) ? "selected" : ""}`}
                          onClick={() => toggleArrayItem("instruments", inst)}
                        >
                          {inst}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {step === 4 && (
                <>
                  <h2 className="step-headline">How do you manage risk?</h2>
                  <div className="risk-slider-wrapper">
                    <div className="risk-labels">
                      <span className={`risk-label ${riskIndex === 0 ? "active" : ""}`}>Conservative</span>
                      <span className={`risk-label ${riskIndex === 1 ? "active" : ""}`}>Moderate</span>
                      <span className={`risk-label ${riskIndex === 2 ? "active" : ""}`}>Aggressive</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={2}
                      step={1}
                      value={riskIndex}
                      className="risk-slider"
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        update("riskTolerance", (["conservative", "moderate", "aggressive"] as const)[val]);
                      }}
                    />
                  </div>
                  <div>
                    <div className="toggle-row">
                      <span className="toggle-text">Require stop-loss on every trade</span>
                      <div
                        className={`toggle-switch ${state.requireStopLoss ? "active" : ""}`}
                        onClick={() => update("requireStopLoss", !state.requireStopLoss)}
                      >
                        <div className="toggle-thumb" />
                      </div>
                    </div>
                    <div className="toggle-row">
                      <span className="toggle-text">Enable position size limits</span>
                      <div
                        className={`toggle-switch ${state.positionSizeLimits ? "active" : ""}`}
                        onClick={() => update("positionSizeLimits", !state.positionSizeLimits)}
                      >
                        <div className="toggle-thumb" />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {step === 5 && (
                <>
                  <h2 className="step-headline">Pick your look</h2>
                  <div className="themes-row">
                    {THEME_META.map((t) => (
                      <ThemePreview
                        key={t.key}
                        themeKey={t.key}
                        label={t.label}
                        selected={state.theme === t.key}
                        onSelect={() => {
                          update("theme", t.key);
                          applyTheme(t.key);
                        }}
                      />
                    ))}
                  </div>
                </>
              )}

              {step === 6 && (
                <>
                  <h2 className="step-headline">
                    You&apos;re all set,{" "}
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.6, delay: 0.2 }}
                    >
                      {state.name}
                    </motion.span>
                  </h2>
                  <div className="recap-list">
                    {[
                      { label: "Experience", value: state.experience.charAt(0).toUpperCase() + state.experience.slice(1) },
                      { label: "Markets", value: state.markets.map((m) => m.charAt(0).toUpperCase() + m.slice(1)).join(", ") || "None selected" },
                      { label: "Risk", value: state.riskTolerance.charAt(0).toUpperCase() + state.riskTolerance.slice(1) },
                      { label: "Theme", value: THEME_META.find((t) => t.key === state.theme)?.label || state.theme },
                    ].map((item, i) => (
                      <motion.div
                        key={item.label}
                        className="recap-item"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.15 + i * 0.2, ease: [0.16, 1, 0.3, 1] }}
                      >
                        <span className="recap-item-label">{item.label}</span>
                        <span className="recap-item-value">{item.value}</span>
                      </motion.div>
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Actions */}
        <div className="onboarding-actions">
          {step > 1 && step < 6 && (
            <button className="btn-back" onClick={goBack}>Back</button>
          )}
          {step < 6 && (
            <button className="btn-continue" onClick={goNext} disabled={!canContinue()}>
              Continue
            </button>
          )}
          {step === 6 && (
            <button className="btn-launch" onClick={handleComplete}>
              Launch aFindr
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
