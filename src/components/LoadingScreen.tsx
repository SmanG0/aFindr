"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";

const PHRASES = [
  "Reading the tape",
  "Scanning the markets",
  "Crunching numbers",
  "Charting setups",
  "Loading your portfolio",
];

/**
 * Branded loading screen with Alphy reading a mini chart.
 * Shown during hydration before the main app renders.
 */
export default function LoadingScreen() {
  const [phraseIdx, setPhraseIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPhraseIdx((p) => (p + 1) % PHRASES.length);
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="flex flex-col h-screen overflow-hidden"
      style={{ background: "var(--bg)" }}
    >
      <div
        className="flex flex-col items-center justify-center flex-1"
        style={{ gap: 0 }}
      >
        {/* ── Alphy reading a chart ── */}
        <motion.div
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          <svg width="140" height="140" viewBox="0 0 140 140" fill="none">
            {/* ── Body ── */}
            <ellipse cx="70" cy="80" rx="30" ry="34" fill="var(--accent)" />
            <ellipse cx="70" cy="86" rx="20" ry="22" fill="var(--accent-bright)" opacity="0.25" />

            {/* ── Eyes (looking down-right at chart) ── */}
            <g>
              <ellipse cx="59" cy="68" rx="5" ry="5.5" fill="var(--text-primary)" />
              <ellipse cx="61" cy="69.5" rx="2.5" ry="3" fill="var(--bg)" />
              <circle cx="60" cy="67" r="1.4" fill="var(--text-primary)" opacity="0.5" />
            </g>
            <g>
              <ellipse cx="81" cy="68" rx="5" ry="5.5" fill="var(--text-primary)" />
              <ellipse cx="83" cy="69.5" rx="2.5" ry="3" fill="var(--bg)" />
              <circle cx="80" cy="67" r="1.4" fill="var(--text-primary)" opacity="0.5" />
            </g>

            {/* ── Eyebrows (focused) ── */}
            <path d="M52 62 Q59 58 65 62" stroke="var(--bg)" strokeWidth="1.8" fill="none" strokeLinecap="round" />
            <path d="M75 62 Q81 58 88 62" stroke="var(--bg)" strokeWidth="1.8" fill="none" strokeLinecap="round" />

            {/* ── Slight smile ── */}
            <path d="M62 82 Q70 87 78 82" stroke="var(--text-primary)" strokeWidth="2" fill="none" strokeLinecap="round" />

            {/* ── Rosy cheeks ── */}
            <circle cx="50" cy="76" r="4.5" fill="var(--accent-bright)" opacity="0.3" />
            <circle cx="90" cy="76" r="4.5" fill="var(--accent-bright)" opacity="0.3" />

            {/* ── Alpha symbol on forehead ── */}
            <text x="70" y="57" textAnchor="middle" fontSize="13" fontWeight="bold" fill="var(--text-primary)" fontFamily="Georgia, serif" opacity="0.6">
              &#x3B1;
            </text>

            {/* ── Mini chart Alphy is "holding" ── */}
            <g transform="translate(82, 88)">
              {/* Chart background */}
              <rect x="0" y="0" width="36" height="24" rx="4" fill="var(--bg-raised)" stroke="var(--glass-border)" strokeWidth="1" />

              {/* Animated chart line */}
              <motion.path
                d="M4 18 L9 14 L14 16 L19 8 L24 10 L29 4 L32 6"
                stroke="var(--buy)"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                initial={{ pathLength: 0, opacity: 0.4 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />

              {/* Subtle grid lines */}
              <line x1="4" y1="8" x2="32" y2="8" stroke="var(--glass-border)" strokeWidth="0.5" />
              <line x1="4" y1="16" x2="32" y2="16" stroke="var(--glass-border)" strokeWidth="0.5" />
            </g>

            {/* ── Little arm pointing at chart ── */}
            <path
              d="M88 92 Q94 94 96 98"
              stroke="var(--accent)"
              strokeWidth="4"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        </motion.div>

        {/* ── Rotating phrase ── */}
        <div style={{ height: 28, position: "relative", marginTop: 8 }}>
          <motion.div
            key={phraseIdx}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: "var(--text-muted)",
              fontFamily: "var(--font-mono)",
              textAlign: "center",
            }}
          >
            {PHRASES[phraseIdx]}
          </motion.div>
        </div>

        {/* ── Animated dots ── */}
        <div className="flex items-center justify-center" style={{ gap: 5, marginTop: 16 }}>
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{ opacity: [0.25, 1, 0.25], scale: [0.85, 1, 0.85] }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                delay: i * 0.2,
                ease: "easeInOut",
              }}
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: "var(--accent)",
              }}
            />
          ))}
        </div>

        {/* ── Brand ── */}
        <div
          style={{
            marginTop: 40,
            fontSize: 11,
            color: "rgba(236,227,213,0.15)",
            fontFamily: "var(--font-mono)",
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          aFindr
        </div>
      </div>
    </div>
  );
}
