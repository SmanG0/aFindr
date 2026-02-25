"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { AppPage } from "@/components/PageNav/PageNav";
import type { AccountState } from "@/lib/types";

// ─── Tip System ───

interface AlphyTip {
  id: string;
  text: string;
  /** Which pages this tip is relevant to (empty = all pages) */
  pages: AppPage[];
  /** Priority: higher = shown first */
  priority: number;
  /** Only show once? */
  once?: boolean;
  /** Condition function — return true to show */
  condition?: (ctx: AlphyContext) => boolean;
}

interface AlphyContext {
  page: AppPage;
  accountState: AccountState;
  /** How many seconds on the current page */
  pageTime: number;
  /** Total session time in seconds */
  sessionTime: number;
}

// ─── Contextual Tips Database ───

const TIPS: AlphyTip[] = [
  // Dashboard
  { id: "dash-welcome", text: "Welcome back! Here's your portfolio overview. Click any section to dive deeper.", pages: ["dashboard"], priority: 10, once: true },
  { id: "dash-explore", text: "Try the Portfolio tab to see individual holdings, or Trade to start charting.", pages: ["dashboard"], priority: 5 },

  // Portfolio
  { id: "port-click-holding", text: "Click any holding to see detailed charts, news, and analysis for that stock.", pages: ["portfolio"], priority: 10, once: true },
  { id: "port-dropdown", text: "Use the dropdown on Holdings to switch between P&L, % change, equity, and share views.", pages: ["portfolio"], priority: 7 },
  { id: "port-no-positions", text: "No positions yet! Head to the Trade tab and place your first order.", pages: ["portfolio"], priority: 9, condition: (ctx) => ctx.accountState.positions.length === 0 },
  { id: "port-loss-warning", text: "Some positions are underwater. Consider reviewing your stop-loss levels.", pages: ["portfolio"], priority: 8, condition: (ctx) => ctx.accountState.positions.some(p => p.unrealizedPnl < -100) },
  { id: "port-winning", text: "Nice! Your portfolio is in profit. Consider taking partial profits on your best performers.", pages: ["portfolio"], priority: 6, condition: (ctx) => ctx.accountState.unrealizedPnl > 500 },

  // Trade (chart)
  { id: "trade-drawing", text: "Use the drawing tools on the left to mark support/resistance levels, trendlines, and Fibonacci retracements.", pages: ["trade"], priority: 10, once: true },
  { id: "trade-indicators", text: "Press the indicators button (fx) to add RSI, MACD, Bollinger Bands and more to your chart.", pages: ["trade"], priority: 8 },
  { id: "trade-timeframes", text: "Switch timeframes in the top bar. Try 1H for day trading or 1D for swing trades.", pages: ["trade"], priority: 6 },
  { id: "trade-replay", text: "Use Replay mode to practice trading on historical data — great for building muscle memory.", pages: ["trade"], priority: 5 },

  // News
  { id: "news-click", text: "Click any article to read the full story. I'll highlight tickers mentioned so you can jump to their charts.", pages: ["news"], priority: 10, once: true },
  { id: "news-sentiment", text: "Pay attention to sentiment scores — they can signal market-moving events before price reacts.", pages: ["news"], priority: 6 },

  // Alpha Lab
  { id: "alpha-intro", text: "Welcome to Alpha Lab! Type a question in natural language — like 'find momentum stocks with low PE' — and I'll research it for you.", pages: ["alpha"], priority: 10, once: true },
  { id: "alpha-tools", text: "Select a tool card to focus your analysis. Each tool is optimized for a specific type of research.", pages: ["alpha"], priority: 7 },
  { id: "alpha-prompts", text: "Try the quick prompts at the bottom if you're not sure where to start.", pages: ["alpha"], priority: 5 },

  // Settings
  { id: "settings-theme", text: "Try different themes! Dark Amber is my favorite, but Midnight Blue is great for late-night sessions.", pages: ["settings"], priority: 8, once: true },

  // General tips (shown on any page after idle)
  { id: "gen-alphy-chat", text: "Click my logo in the top-left to open the AI chat. Ask me to backtest strategies, generate PineScript, or explain market concepts.", pages: [], priority: 3 },
  { id: "gen-keyboard", text: "Pro tip: Press ⌘S to quickly search for any stock or futures contract.", pages: [], priority: 2 },
  { id: "gen-risk", text: "Always manage your risk. A good rule: never risk more than 2% of your account on a single trade.", pages: [], priority: 1 },
  { id: "gen-backtest", text: "Before trading a strategy live, backtest it first. Ask me in the chat — I can test any idea in seconds.", pages: [], priority: 2 },
];

// ─── Alphy Moods ───

type AlphyMood = "neutral" | "happy" | "thinking" | "celebrating" | "concerned" | "waving" | "sleeping";

function getMoodForContext(ctx: AlphyContext): AlphyMood {
  if (ctx.pageTime > 120) return "sleeping"; // idle
  if (ctx.accountState.unrealizedPnl > 1000) return "celebrating";
  if (ctx.accountState.unrealizedPnl < -500) return "concerned";
  if (ctx.page === "alpha") return "thinking";
  if (ctx.sessionTime < 10) return "waving";
  return "neutral";
}

// ─── Alphy SVG Face ───

function AlphyFace({ mood, size = 48 }: { mood: AlphyMood; size?: number }) {
  // Eye positions shift based on mood
  const eyeY = mood === "sleeping" ? 15 : 13;
  const mouthPath = mood === "happy" || mood === "celebrating"
    ? "M10 20 Q16 25 22 20"     // smile
    : mood === "concerned"
    ? "M10 22 Q16 19 22 22"     // slight frown
    : mood === "sleeping"
    ? "M12 21 L20 21"           // flat line
    : "M11 20 Q16 23 21 20";   // neutral smile

  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <defs>
        <linearGradient id="alphy-face-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="var(--accent)" />
          <stop offset="100%" stopColor="var(--accent-bright)" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="10" fill="url(#alphy-face-grad)" />

      {/* Eyes */}
      {mood === "sleeping" ? (
        <>
          <line x1="8" y1={eyeY} x2="13" y2={eyeY} stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="19" y1={eyeY} x2="24" y2={eyeY} stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="11" cy={eyeY} r={mood === "celebrating" ? 2.5 : 2} fill="#fff" />
          <circle cx="21" cy={eyeY} r={mood === "celebrating" ? 2.5 : 2} fill="#fff" />
          {/* Pupils */}
          <circle cx={mood === "thinking" ? 12 : 11.5} cy={eyeY + 0.3} r="1" fill="rgba(0,0,0,0.6)" />
          <circle cx={mood === "thinking" ? 22 : 21.5} cy={eyeY + 0.3} r="1" fill="rgba(0,0,0,0.6)" />
        </>
      )}

      {/* Mouth */}
      <path d={mouthPath} stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round" />

      {/* Blush when happy */}
      {(mood === "happy" || mood === "celebrating") && (
        <>
          <circle cx="7" cy="18" r="2.5" fill="rgba(255,255,255,0.15)" />
          <circle cx="25" cy="18" r="2.5" fill="rgba(255,255,255,0.15)" />
        </>
      )}

      {/* Sparkles when celebrating */}
      {mood === "celebrating" && (
        <>
          <circle cx="4" cy="4" r="1" fill="#fff" opacity="0.7" />
          <circle cx="28" cy="6" r="0.8" fill="#fff" opacity="0.5" />
          <circle cx="6" cy="28" r="0.6" fill="#fff" opacity="0.6" />
        </>
      )}

      {/* Thinking dots */}
      {mood === "thinking" && (
        <g opacity="0.5">
          <circle cx="27" cy="5" r="1.2" fill="#fff" />
          <circle cx="30" cy="2" r="0.8" fill="#fff" />
        </g>
      )}

      {/* Wave hand */}
      {mood === "waving" && (
        <text x="28" y="10" fontSize="8" fill="#fff">👋</text>
      )}
    </svg>
  );
}

// ─── Seen Tips Storage ───

const STORAGE_KEY = "afindr_alphy_seen_tips";

function getSeenTips(): Set<string> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

function markTipSeen(tipId: string) {
  try {
    const seen = getSeenTips();
    seen.add(tipId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...seen]));
  } catch {
    // Ignore storage errors
  }
}

// ─── Main Component ───

interface AlphyCompanionProps {
  currentPage: AppPage;
  accountState: AccountState;
  onOpenChat?: () => void;
}

export default function AlphyCompanion({
  currentPage,
  accountState,
  onOpenChat,
}: AlphyCompanionProps) {
  const [visible, setVisible] = useState(true);
  const [currentTip, setCurrentTip] = useState<AlphyTip | null>(null);
  const [showBubble, setShowBubble] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const pageTimeRef = useRef(0);
  const sessionTimeRef = useRef(0);
  const tipCooldownRef = useRef(false);
  const lastPageRef = useRef(currentPage);
  const shownTipsRef = useRef<Set<string>>(new Set());

  // Reset page timer on page change
  useEffect(() => {
    if (currentPage !== lastPageRef.current) {
      lastPageRef.current = currentPage;
      pageTimeRef.current = 0;
      setDismissed(false);
      // Show tip for new page after short delay
      tipCooldownRef.current = false;
    }
  }, [currentPage]);

  // Tick timers
  useEffect(() => {
    const interval = setInterval(() => {
      pageTimeRef.current += 1;
      sessionTimeRef.current += 1;
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Pick and show tips
  const pickTip = useCallback(() => {
    if (dismissed || tipCooldownRef.current) return;

    const seen = getSeenTips();
    const ctx: AlphyContext = {
      page: currentPage,
      accountState,
      pageTime: pageTimeRef.current,
      sessionTime: sessionTimeRef.current,
    };

    // Filter applicable tips
    const applicable = TIPS.filter((tip) => {
      // Page match (empty pages = all pages)
      if (tip.pages.length > 0 && !tip.pages.includes(currentPage)) return false;
      // Already shown this session
      if (shownTipsRef.current.has(tip.id)) return false;
      // Once-only tips that were already seen
      if (tip.once && seen.has(tip.id)) return false;
      // Condition check
      if (tip.condition && !tip.condition(ctx)) return false;
      return true;
    });

    if (applicable.length === 0) return;

    // Sort by priority (highest first)
    applicable.sort((a, b) => b.priority - a.priority);
    const tip = applicable[0];

    setCurrentTip(tip);
    setShowBubble(true);
    shownTipsRef.current.add(tip.id);
    if (tip.once) markTipSeen(tip.id);

    // Cooldown before showing another tip
    tipCooldownRef.current = true;
    setTimeout(() => { tipCooldownRef.current = false; }, 45000);

    // Auto-dismiss after 12 seconds
    setTimeout(() => {
      setShowBubble(false);
    }, 12000);
  }, [currentPage, accountState, dismissed]);

  // Show first tip after landing on a page
  useEffect(() => {
    const timer = setTimeout(pickTip, 3000);
    return () => clearTimeout(timer);
  }, [currentPage, pickTip]);

  // Show idle tips
  useEffect(() => {
    const idleTimer = setInterval(() => {
      if (pageTimeRef.current > 30 && !showBubble) {
        pickTip();
      }
    }, 20000);
    return () => clearInterval(idleTimer);
  }, [pickTip, showBubble]);

  const mood = getMoodForContext({
    page: currentPage,
    accountState,
    pageTime: pageTimeRef.current,
    sessionTime: sessionTimeRef.current,
  });

  const handleDismiss = useCallback(() => {
    setShowBubble(false);
    setDismissed(true);
  }, []);

  const handleAlphyClick = useCallback(() => {
    if (showBubble) {
      setShowBubble(false);
    } else if (onOpenChat) {
      onOpenChat();
    }
  }, [showBubble, onOpenChat]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        zIndex: 900,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 8,
        pointerEvents: "none",
      }}
    >
      {/* Speech Bubble */}
      <AnimatePresence>
        {showBubble && currentTip && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            style={{
              pointerEvents: "auto",
              maxWidth: 280,
              background: "rgba(30,28,24,0.96)",
              border: "1px solid rgba(236,227,213,0.12)",
              borderRadius: 14,
              padding: "14px 16px",
              backdropFilter: "blur(20px)",
              boxShadow: "0 12px 40px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2)",
              position: "relative",
            }}
          >
            {/* Close button */}
            <button
              onClick={handleDismiss}
              style={{
                position: "absolute", top: 6, right: 8,
                background: "none", border: "none", cursor: "pointer",
                color: "var(--text-disabled)", fontSize: 12, padding: 2,
                lineHeight: 1,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-disabled)"; }}
            >
              &times;
            </button>

            <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, paddingRight: 12 }}>
              {currentTip.text}
            </div>

            {/* Speech bubble tail */}
            <div
              style={{
                position: "absolute",
                bottom: -6,
                right: 24,
                width: 12,
                height: 12,
                background: "rgba(30,28,24,0.96)",
                border: "1px solid rgba(236,227,213,0.12)",
                borderTop: "none",
                borderLeft: "none",
                transform: "rotate(45deg)",
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Alphy Avatar */}
      <motion.button
        onClick={handleAlphyClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        animate={
          mood === "celebrating"
            ? { y: [0, -4, 0], rotate: [0, -3, 3, 0] }
            : mood === "waving"
            ? { rotate: [0, -5, 5, -3, 0] }
            : mood === "sleeping"
            ? { y: [0, 2, 0] }
            : {}
        }
        transition={
          mood === "celebrating"
            ? { duration: 0.6, repeat: Infinity, repeatDelay: 3 }
            : mood === "waving"
            ? { duration: 0.5, delay: 1 }
            : mood === "sleeping"
            ? { duration: 2, repeat: Infinity, ease: "easeInOut" }
            : {}
        }
        style={{
          pointerEvents: "auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 52,
          height: 52,
          borderRadius: 16,
          background: hovered ? "rgba(196,123,58,0.12)" : "rgba(30,28,24,0.6)",
          border: hovered ? "1px solid rgba(196,123,58,0.3)" : "1px solid rgba(236,227,213,0.08)",
          cursor: "pointer",
          backdropFilter: "blur(12px)",
          boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
          transition: "background 150ms ease, border-color 150ms ease",
          padding: 0,
        }}
        title="Click to chat with Alphy"
      >
        <AlphyFace mood={hovered ? "happy" : mood} size={40} />
      </motion.button>

      {/* Hide button (appears on hover) */}
      <AnimatePresence>
        {hovered && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={(e) => { e.stopPropagation(); setVisible(false); }}
            style={{
              pointerEvents: "auto",
              position: "absolute", top: -8, right: -4,
              width: 18, height: 18, borderRadius: "50%",
              background: "rgba(30,28,24,0.9)", border: "1px solid rgba(236,227,213,0.15)",
              color: "var(--text-muted)", fontSize: 10, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              lineHeight: 1, padding: 0,
            }}
            title="Hide Alphy"
          >
            &times;
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
