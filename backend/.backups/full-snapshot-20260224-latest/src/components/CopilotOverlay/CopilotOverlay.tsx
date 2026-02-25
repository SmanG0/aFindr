"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ChatMessage, Trade } from "@/lib/types";
import type { ToolEvent, TokenUsage } from "@/hooks/useAgentStream";
import { ToolDataRenderer } from "@/components/AlphaPlayground/ArtifactBlocks";
import type { AppPage } from "@/components/PageNav/PageNav";

interface Conversation {
  _id: string;
  title: string;
  updatedAt: number;
}

interface CopilotOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  symbol: string;
  streamingText?: string;
  toolEvents?: ToolEvent[];
  agentError?: string | null;
  liveTokenUsage?: TokenUsage | null;
  onNewChat?: () => void;
  conversations?: Conversation[];
  activeConversationId?: string | null;
  onSelectConversation?: (id: string) => void;
  onDeleteConversation?: (id: string) => void;
  currentPage?: AppPage;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
}

/** Cute Clippy-inspired alpha mascot */
function AlphyMascot({ size = 64, bounce = false }: { size?: number; bounce?: boolean }) {
  const mascot = (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <ellipse cx="32" cy="36" rx="18" ry="20" fill="var(--accent)" />
      <ellipse cx="32" cy="40" rx="12" ry="13" fill="var(--accent-bright)" opacity="0.3" />
      <ellipse cx="25" cy="29" rx="4" ry="4.5" fill="var(--text-primary)" />
      <ellipse cx="26" cy="29.5" rx="2" ry="2.5" fill="var(--bg)" />
      <circle cx="24.5" cy="28" r="1" fill="var(--text-primary)" />
      <ellipse cx="39" cy="29" rx="4" ry="4.5" fill="var(--text-primary)" />
      <ellipse cx="40" cy="29.5" rx="2" ry="2.5" fill="var(--bg)" />
      <circle cx="38.5" cy="28" r="1" fill="var(--text-primary)" />
      <path d="M20 24 Q25 21 29 24" stroke="var(--bg-overlay)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M35 24 Q39 21 44 24" stroke="var(--bg-overlay)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M26 38 Q32 43 38 38" stroke="var(--text-primary)" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <circle cx="21" cy="34" r="3" fill="var(--accent-bright)" opacity="0.35" />
      <circle cx="43" cy="34" r="3" fill="var(--accent-bright)" opacity="0.35" />
      <text x="32" y="21" textAnchor="middle" fontSize="10" fontWeight="bold" fill="var(--text-primary)" fontFamily="Georgia, serif" opacity="0.7">α</text>
      <path d="M50 30 Q54 26 52 22" stroke="var(--accent)" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="52" cy="21" r="2.5" fill="var(--accent)" />
    </svg>
  );

  if (bounce) {
    return (
      <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}>
        {mascot}
      </motion.div>
    );
  }
  return mascot;
}

/** Per-message token usage badge (premium feature) */
function TokenBadge({ tokenUsage }: { tokenUsage: NonNullable<ChatMessage["tokenUsage"]> }) {
  const [expanded, setExpanded] = useState(false);

  const formatTokens = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : `${n}`;
  const formatCost = (c: number) => c >= 0.01 ? `$${c.toFixed(2)}` : `$${c.toFixed(3)}`;

  return (
    <div
      onClick={() => setExpanded((v) => !v)}
      style={{
        marginTop: 6,
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        cursor: "pointer",
        fontSize: 10,
        color: "var(--text-muted)",
        opacity: 0.6,
        transition: "opacity 150ms ease",
        userSelect: "none",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
      onMouseLeave={(e) => { if (!expanded) e.currentTarget.style.opacity = "0.6"; }}
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, opacity: 0.7 }}>
        <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
      </svg>
      <span>{formatTokens(tokenUsage.totalTokens)} tokens</span>
      <span style={{ opacity: 0.4 }}>&middot;</span>
      <span>{formatCost(tokenUsage.estimatedCost)}</span>
      {expanded && (
        <span style={{ marginLeft: 4, opacity: 0.7 }}>
          In: {formatTokens(tokenUsage.inputTokens)} &middot; Out: {formatTokens(tokenUsage.outputTokens)}
        </span>
      )}
    </div>
  );
}

/** Live token counter shown during streaming */
function LiveTokenCounter({ tokenUsage }: { tokenUsage: TokenUsage }) {
  const total = tokenUsage.total_input_tokens + tokenUsage.total_output_tokens;
  const formatTokens = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : `${n}`;
  const formatCost = (c: number) => c >= 0.01 ? `$${c.toFixed(2)}` : `$${c.toFixed(3)}`;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 10,
        color: "var(--text-muted)",
        opacity: 0.7,
        marginTop: 4,
        fontFamily: "var(--font-mono)",
      }}
    >
      <motion.svg
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" style={{ flexShrink: 0 }}
      >
        <path d="M21 12a9 9 0 1 1-6.22-8.56" />
      </motion.svg>
      <span>{formatTokens(total)} tokens</span>
      <span style={{ opacity: 0.4 }}>&middot;</span>
      <span>{formatCost(tokenUsage.estimated_cost_usd)}</span>
    </motion.div>
  );
}

/** PineScript code display with copy-to-clipboard button */
function PineScriptBlock({ result }: { result: NonNullable<ChatMessage["pinescriptResult"]> }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(result.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [result.code]);

  return (
    <div style={{ marginTop: 12, background: "rgba(236,227,213,0.04)", borderRadius: 8, border: "1px solid rgba(236,227,213,0.08)", overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderBottom: "1px solid rgba(236,227,213,0.06)", fontSize: 11, color: "var(--text-muted)" }}>
        <span style={{ fontWeight: 600, color: "var(--accent)" }}>PineScript v5 — {result.name}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="chip chip-neutral" style={{ fontSize: 10, padding: "2px 8px" }}>{result.script_type}</span>
          <button onClick={handleCopy} style={{ padding: "3px 10px", borderRadius: 4, border: "1px solid rgba(236,227,213,0.1)", background: copied ? "rgba(34,197,94,0.15)" : "rgba(236,227,213,0.06)", color: copied ? "var(--buy)" : "var(--text-secondary)", cursor: "pointer", fontSize: 10, fontFamily: "var(--font-mono)" }}>
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>
      <pre style={{ margin: 0, padding: "12px", fontSize: 11, lineHeight: 1.5, fontFamily: "'JetBrains Mono', 'SF Mono', monospace", color: "rgba(236,227,213,0.8)", overflowX: "auto", maxHeight: 300, overflowY: "auto", whiteSpace: "pre" }}>
        {result.code}
      </pre>
      <div style={{ padding: "6px 12px", borderTop: "1px solid rgba(236,227,213,0.06)", fontSize: 10, color: "var(--text-muted)" }}>
        Paste into TradingView Pine Editor to backtest on any chart
      </div>
    </div>
  );
}

/** Backtest results display */
function BacktestResultBlock({ result }: { result: NonNullable<ChatMessage["strategyResult"]> }) {
  const [showTrades, setShowTrades] = useState(false);
  const m = result.metrics;

  return (
    <div style={{ marginTop: 12, background: "rgba(236,227,213,0.04)", borderRadius: 8, border: "1px solid rgba(236,227,213,0.08)", overflow: "hidden" }}>
      {result.strategyName && (
        <div style={{ padding: "6px 12px", borderBottom: "1px solid rgba(236,227,213,0.06)", fontSize: 11, fontWeight: 600, color: "var(--accent)", fontFamily: "var(--font-mono)" }}>
          {result.strategyName}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0, borderBottom: "1px solid rgba(236,227,213,0.06)" }}>
        {[
          { label: "Trades", value: m.totalTrades.toString() },
          { label: "Win Rate", value: `${(m.winRate * 100).toFixed(1)}%`, color: m.winRate >= 0.5 ? "var(--buy)" : "var(--sell)" },
          { label: "Net P/L", value: `${m.totalReturn >= 0 ? "+" : ""}$${m.totalReturn.toFixed(0)}`, color: m.totalReturn >= 0 ? "var(--buy)" : "var(--sell)" },
          { label: "Profit Factor", value: m.profitFactor === Infinity ? "\u221e" : m.profitFactor.toFixed(2), color: m.profitFactor >= 1.5 ? "var(--buy)" : "var(--text-secondary)" },
        ].map((item, i) => (
          <div key={i} style={{ padding: "6px 10px", borderRight: i % 4 !== 3 ? "1px solid rgba(236,227,213,0.06)" : "none" }}>
            <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "var(--font-mono)", textTransform: "uppercase" }}>{item.label}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: item.color || "var(--text-primary)", fontFamily: "var(--font-mono)" }}>{item.value}</div>
          </div>
        ))}
      </div>
      <button onClick={() => setShowTrades(!showTrades)} style={{ width: "100%", padding: "6px 12px", border: "none", background: "transparent", color: "var(--text-muted)", cursor: "pointer", fontSize: 10, fontFamily: "var(--font-mono)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span>{showTrades ? "Hide" : "Show"} {result.trades.length} trades</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: showTrades ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 150ms ease" }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      <AnimatePresence>
        {showTrades && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
            <div style={{ maxHeight: 250, overflowY: "auto", borderTop: "1px solid rgba(236,227,213,0.06)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, fontFamily: "var(--font-mono)" }}>
                <thead><tr style={{ borderBottom: "1px solid rgba(236,227,213,0.06)" }}>
                  {["#", "Side", "Entry", "Exit", "P/L"].map((h) => (
                    <th key={h} style={{ padding: "4px 8px", textAlign: h === "Side" ? "left" : "right", color: "var(--text-muted)", fontWeight: 500, fontSize: 9 }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {result.trades.map((t: Trade, i: number) => (
                    <tr key={t.id || i} style={{ borderBottom: "1px solid rgba(236,227,213,0.03)" }}>
                      <td style={{ padding: "3px 8px", textAlign: "right", color: "var(--text-muted)" }}>{i + 1}</td>
                      <td style={{ padding: "3px 8px", color: t.side === "long" ? "var(--buy)" : "var(--sell)", fontWeight: 600, textTransform: "uppercase" }}>{t.side}</td>
                      <td style={{ padding: "3px 8px", textAlign: "right", color: "var(--text-secondary)" }}>{t.entryPrice.toFixed(2)}</td>
                      <td style={{ padding: "3px 8px", textAlign: "right", color: "var(--text-secondary)" }}>{t.exitPrice.toFixed(2)}</td>
                      <td style={{ padding: "3px 8px", textAlign: "right", fontWeight: 600, color: t.pnl >= 0 ? "var(--buy)" : "var(--sell)" }}>{t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Friendly tool name labels ───
const TOOL_LABELS: Record<string, string> = {
  run_backtest: "Running backtest",
  generate_strategy: "Generating strategy",
  generate_pinescript: "Writing PineScript",
  fetch_market_data: "Pulling market data",
  run_monte_carlo: "Running Monte Carlo sim",
  run_walk_forward: "Walk-forward analysis",
  run_parameter_sweep: "Sweeping parameters",
  run_preset_strategy: "Running preset strategy",
  analyze_trades: "Analyzing trades",
  optimize_parameters: "Optimizing parameters",
  search_rag: "Searching knowledge base",
  validate_strategy_code: "Validating strategy",
  execute_strategy_code: "Executing strategy",
  fetch_options_chain: "Pulling options chain",
  fetch_insider_activity: "Checking insider activity",
  fetch_economic_data: "Pulling economic data",
  fetch_earnings_calendar: "Checking earnings",
  fetch_company_news_feed: "Scanning company news",
  search_news: "Searching headlines",
  get_stock_info: "Looking up stock info",
  fetch_news: "Scanning news feed",
  get_contract_info: "Getting contract info",
  list_saved_strategies: "Loading strategies",
  load_saved_strategy: "Loading strategy",
  list_preset_strategies: "Listing presets",
  get_trading_summary: "Getting trade summary",
  query_trade_history: "Querying trade history",
  get_backtest_history: "Loading backtest history",
  create_chart_script: "Creating chart script",
  query_prediction_markets: "Checking prediction markets",
  fetch_labor_data: "Pulling labor data",
};

// ─── Rotating thinking phrases ───
const THINKING_PHRASES = [
  "Reading the tape",
  "Scanning levels",
  "Measuring the move",
  "Checking the spread",
  "Sizing the position",
  "Marking the chart",
  "Running the numbers",
  "Pulling the data",
];

function useRotatingPhrase(active: boolean) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!active) return;
    setIndex(Math.floor(Math.random() * THINKING_PHRASES.length));
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % THINKING_PHRASES.length);
    }, 2500);
    return () => clearInterval(timer);
  }, [active]);
  return THINKING_PHRASES[index];
}

/** Deduplicate tool events — collapse consecutive same-tool calls into one with count */
function dedupeToolEvents(events: ToolEvent[]): (ToolEvent & { count: number })[] {
  const result: (ToolEvent & { count: number })[] = [];
  for (const te of events) {
    const last = result[result.length - 1];
    if (last && last.tool_name === te.tool_name) {
      last.count++;
      // Keep the latest status (if any is still running, show running)
      if (te.status === "running") last.status = "running";
      else if (last.status !== "running") last.status = te.status;
    } else {
      result.push({ ...te, count: 1 });
    }
  }
  return result;
}

/** Animated checkmark that draws itself in */
function AnimatedCheck() {
  return (
    <motion.svg
      width="10" height="10" viewBox="0 0 24 24" fill="none"
      stroke="var(--buy)" strokeWidth="2.5" style={{ flexShrink: 0 }}
    >
      <motion.polyline
        points="20 6 9 17 4 12"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        style={{ strokeDasharray: 1, strokeDashoffset: 0 }}
      />
    </motion.svg>
  );
}

/** Inline tool step chips that appear as tools are called */
function ToolStepsInline({ toolEvents }: { toolEvents: ToolEvent[] }) {
  const deduped = dedupeToolEvents(toolEvents);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 6 }}>
      <AnimatePresence initial={false}>
        {deduped.map((te) => {
          const label = TOOL_LABELS[te.tool_name] || te.tool_name.replace(/_/g, " ");
          const isRunning = te.status === "running";
          const isDone = te.status === "success";
          const isError = te.status === "error" || te.status === "denied";

          return (
            <motion.div
              key={te.id}
              initial={{ opacity: 0, x: -8, height: 0 }}
              animate={{ opacity: 1, x: 0, height: "auto" }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "4px 0", fontSize: 12, overflow: "hidden",
              }}
            >
              {/* Status icon */}
              {isRunning ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                  style={{ width: 10, height: 10, flexShrink: 0 }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5">
                    <path d="M21 12a9 9 0 1 1-6.22-8.56" />
                  </svg>
                </motion.div>
              ) : isDone ? (
                <AnimatedCheck />
              ) : isError ? (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--sell)" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              ) : null}

              {/* Label */}
              <span style={{
                color: isRunning ? "var(--text-secondary)" : "var(--text-muted)",
                fontWeight: isRunning ? 500 : 400,
                transition: "color 0.2s ease",
              }}>
                {label}{te.count > 1 ? ` (${te.count})` : ""}
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

/** Relative time label: "just now", "2m ago", "3h ago", "yesterday", "Feb 20" */
function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Context-aware suggested prompts ───
const CONTEXT_PROMPTS: Record<string, string[]> = {
  trade: [
    "Generate an EMA crossover strategy",
    "Analyze my recent trade performance",
    "Create a RSI divergence indicator",
  ],
  portfolio: [
    "What's the earnings outlook for this stock?",
    "Show me insider activity",
    "What if I bought after the last earnings dip?",
  ],
  dashboard: [
    "Give me a market overview",
    "What's moving today?",
    "Summarize my portfolio performance",
  ],
  news: [
    "What's the market impact of these headlines?",
    "Which sectors are most affected?",
    "Any trading opportunities from this news?",
  ],
  settings: [
    "Help me optimize my trading settings",
    "What risk parameters should I use?",
    "Explain one-click trading",
  ],
};
const DEFAULT_PROMPTS = [
  "What's the market looking like today?",
  "Research AAPL's recent performance",
  "Help me analyze a trade idea",
];

export default function CopilotOverlay({
  isOpen,
  onClose,
  messages,
  onSendMessage,
  isLoading,
  streamingText = "",
  toolEvents = [],
  agentError = null,
  liveTokenUsage,
  onNewChat,
  conversations = [],
  activeConversationId,
  onSelectConversation,
  onDeleteConversation,
  currentPage,
}: CopilotOverlayProps) {
  const [input, setInput] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(messages.length);
  const thinkingPhrase = useRotatingPhrase(isLoading && !streamingText && toolEvents.length === 0);

  useEffect(() => {
    if (isOpen) setTimeout(() => textareaRef.current?.focus(), 200);
  }, [isOpen]);

  // Only auto-scroll when messages change or streaming updates — NOT on panel open/close
  useEffect(() => {
    const messageCountChanged = messages.length !== prevMessageCountRef.current;
    prevMessageCountRef.current = messages.length;
    // Scroll on new messages, streaming text, or loading state changes
    if (messageCountChanged || streamingText || isLoading) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, isLoading, streamingText]);

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    onSendMessage(trimmed);
    setInput("");
  }, [input, isLoading, onSendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
    },
    [handleSubmit]
  );

  return (
    <motion.div
      initial={false}
      animate={{ width: isOpen ? 420 : 0, opacity: isOpen ? 1 : 0 }}
      transition={{ type: "spring", damping: 30, stiffness: 300 }}
      style={{
        flexShrink: 0,
        overflow: "hidden",
        background: "var(--bg)",
        borderRight: isOpen ? "1px solid rgba(236,227,213,0.12)" : "none",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        pointerEvents: isOpen ? "auto" : "none",
      }}
    >
      <div style={{ width: 420, minWidth: 420, display: "flex", flexDirection: "column", height: "100%" }}>
          {/* ─── Header ─── */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: "1px solid rgba(236,227,213,0.08)", flexShrink: 0 }}>
            <AlphyMascot size={32} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Alphy</div>
              <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Trading Assistant</div>
            </div>
            <button
              onClick={() => { onNewChat?.(); setShowHistory(false); }}
              className="nav-pill"
              style={{ padding: "4px 8px", fontSize: 10 }}
              title="New chat"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
              New
            </button>
            {conversations.length > 0 && (
              <button
                onClick={() => setShowHistory((v) => !v)}
                className="nav-pill"
                style={{
                  padding: "4px 8px", fontSize: 10,
                  background: showHistory ? "rgba(236,227,213,0.1)" : undefined,
                }}
                title="Chat history"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                width: 28, height: 28, borderRadius: 6, border: "none",
                background: "transparent", color: "var(--text-muted)", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>

          {/* ─── Chat History Panel ─── */}
          <AnimatePresence>
            {showHistory && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                style={{ overflow: "hidden", flexShrink: 0, borderBottom: "1px solid rgba(236,227,213,0.08)" }}
              >
                <div style={{ maxHeight: 260, overflowY: "auto", padding: "4px 0" }}>
                  {conversations.map((conv) => {
                    const isActive = conv._id === activeConversationId;
                    return (
                      <div
                        key={conv._id}
                        onClick={() => {
                          onSelectConversation?.(conv._id);
                          setShowHistory(false);
                        }}
                        style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "10px 16px", cursor: "pointer",
                          background: isActive ? "rgba(196,123,58,0.1)" : "transparent",
                          borderLeft: isActive ? "2px solid var(--accent)" : "2px solid transparent",
                          transition: "background 100ms ease",
                        }}
                        onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "rgba(236,227,213,0.04)"; }}
                        onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: 12, fontWeight: isActive ? 600 : 400,
                            color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                          }}>
                            {conv.title}
                          </div>
                          <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                            {relativeTime(conv.updatedAt)}
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteConversation?.(conv._id);
                          }}
                          style={{
                            width: 24, height: 24, borderRadius: 4, border: "none",
                            background: "transparent", color: "var(--text-muted)",
                            cursor: "pointer", display: "flex", alignItems: "center",
                            justifyContent: "center", opacity: 0.4, flexShrink: 0,
                            transition: "opacity 100ms ease",
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.4"; }}
                          title="Delete conversation"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                  {conversations.length === 0 && (
                    <div style={{ padding: "16px", textAlign: "center", fontSize: 12, color: "var(--text-muted)" }}>
                      No conversations yet
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ─── Messages ─── */}
          <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {messages.length === 0 ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 24 }}>
                <AlphyMascot size={72} bounce />
                <div style={{ fontSize: 20, fontWeight: 600, color: "var(--text-primary)", textAlign: "center" }}>
                  {getGreeting()}!
                </div>
                <p style={{ color: "var(--text-muted)", fontSize: 12, textAlign: "center", maxWidth: 280, lineHeight: 1.5 }}>
                  {currentPage === "portfolio"
                    ? "Ask me about earnings, news, options, or test trading scenarios."
                    : currentPage === "news"
                      ? "Ask me about the news you're seeing or its market impact."
                      : currentPage === "dashboard"
                        ? "Ask me about your portfolio, market conditions, or trading ideas."
                        : "Ask me to generate strategies, analyze your trades, or create PineScript indicators."}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%", maxWidth: 300, marginTop: 8 }}>
                  {(CONTEXT_PROMPTS[currentPage ?? ""] ?? DEFAULT_PROMPTS).map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => onSendMessage(prompt)}
                      style={{
                        padding: "10px 14px", borderRadius: 10,
                        background: "rgba(236,227,213,0.04)", border: "1px solid rgba(236,227,213,0.08)",
                        color: "var(--text-secondary)", fontSize: 12, cursor: "pointer",
                        textAlign: "left", transition: "all 100ms ease",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(236,227,213,0.08)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(236,227,213,0.04)"; }}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
                {messages.map((msg, msgIdx) => (
                  <motion.div
                    key={msg.id}
                    initial={msg.role === "assistant" ? { opacity: 0, y: 6 } : false}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", marginBottom: 10 }}
                  >
                    {msg.role === "assistant" && (
                      <div style={{ width: 24, height: 24, flexShrink: 0, marginRight: 8, marginTop: 2 }}>
                        <AlphyMascot size={24} />
                      </div>
                    )}
                    <div style={{
                      maxWidth: "85%",
                      padding: msg.role === "user" ? "10px 14px" : "10px 0",
                      background: msg.role === "user" ? "rgba(196,123,58,0.12)" : "transparent",
                      border: msg.role === "user" ? "1px solid rgba(196,123,58,0.15)" : "none",
                      borderRadius: msg.role === "user" ? 14 : 0,
                      color: "var(--text-primary)", fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap",
                    }}>
                      {msg.content}
                      {msg.pinescriptResult && (
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ duration: 0.35, ease: "easeOut", delay: msgIdx === messages.length - 1 ? 0.1 : 0 }}
                        >
                          <PineScriptBlock result={msg.pinescriptResult} />
                        </motion.div>
                      )}
                      {msg.strategyResult && (
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ duration: 0.35, ease: "easeOut", delay: msgIdx === messages.length - 1 ? 0.1 : 0 }}
                        >
                          <BacktestResultBlock result={msg.strategyResult} />
                        </motion.div>
                      )}
                      {/* Rich tool data artifacts (options chains, earnings, news, etc.) */}
                      {msg.toolData && msg.toolData.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ duration: 0.35, ease: "easeOut", delay: msgIdx === messages.length - 1 ? 0.15 : 0 }}
                          style={{ maxWidth: "100%", overflowX: "auto" }}
                        >
                          <ToolDataRenderer toolData={msg.toolData} />
                        </motion.div>
                      )}
                      {/* Per-message token usage badge */}
                      {msg.role === "assistant" && msg.tokenUsage && (
                        <TokenBadge tokenUsage={msg.tokenUsage} />
                      )}
                    </div>
                  </motion.div>
                ))}
                {/* ─── Agent Error ─── */}
                {agentError && (
                  <div style={{ display: "flex", gap: 8, padding: "4px 0" }}>
                    <div style={{ width: 24, height: 24, flexShrink: 0, marginTop: 2 }}>
                      <AlphyMascot size={24} />
                    </div>
                    <div style={{
                      fontSize: 12, lineHeight: 1.5, color: "var(--sell)",
                      padding: "8px 12px", borderRadius: 8,
                      background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)",
                    }}>
                      Something went wrong — {agentError}
                    </div>
                  </div>
                )}
                {/* ─── Streaming / Loading UI ─── */}
                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                    style={{ padding: "4px 0" }}
                  >
                    <div style={{ display: "flex", gap: 8 }}>
                      <div style={{ width: 24, height: 24, flexShrink: 0, marginTop: 2 }}>
                        <AlphyMascot size={24} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Inline tool step chips */}
                        {toolEvents.length > 0 && (
                          <ToolStepsInline toolEvents={toolEvents} />
                        )}

                        {/* Streaming text (live tokens) */}
                        {streamingText ? (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.15 }}
                            style={{
                              fontSize: 13, lineHeight: 1.6, color: "var(--text-primary)",
                              whiteSpace: "pre-wrap", marginTop: toolEvents.length > 0 ? 2 : 0,
                            }}
                          >
                            {streamingText}
                            <motion.span
                              animate={{ opacity: [1, 0.2] }}
                              transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }}
                              style={{
                                display: "inline-block",
                                width: 7, height: 16, marginLeft: 1,
                                background: "var(--accent)",
                                borderRadius: 1,
                                verticalAlign: "text-bottom",
                              }}
                            />
                          </motion.div>
                        ) : toolEvents.length === 0 ? (
                          /* Thinking indicator (before anything arrives) */
                          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 0" }}>
                            {/* Three-dot pulse */}
                            <div style={{ display: "flex", gap: 3 }}>
                              {[0, 1, 2].map((i) => (
                                <motion.div
                                  key={i}
                                  animate={{ opacity: [0.3, 1, 0.3], scale: [0.85, 1, 0.85] }}
                                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.15 }}
                                  style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent)" }}
                                />
                              ))}
                            </div>
                            <AnimatePresence mode="wait">
                              <motion.span
                                key={thinkingPhrase}
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                transition={{ duration: 0.2 }}
                                style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}
                              >
                                {thinkingPhrase}...
                              </motion.span>
                            </AnimatePresence>
                          </div>
                        ) : null}
                        {/* Live token counter */}
                        {liveTokenUsage && (
                          <LiveTokenCounter tokenUsage={liveTokenUsage} />
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* ─── Input ─── */}
          <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(236,227,213,0.08)", flexShrink: 0 }}>
            <div style={{ position: "relative" }}>
              <textarea
                ref={textareaRef}
                placeholder="Ask Alphy anything..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                rows={1}
                style={{
                  width: "100%", padding: "12px 44px 12px 14px",
                  background: "rgba(236,227,213,0.04)", border: "1px solid rgba(236,227,213,0.1)",
                  borderRadius: 12, color: "var(--text-primary)", fontSize: 13,
                  resize: "none", outline: "none", fontFamily: "inherit",
                  lineHeight: "20px",
                }}
              />
              <button
                onClick={handleSubmit}
                disabled={isLoading || !input.trim()}
                style={{
                  position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                  width: 28, height: 28, borderRadius: "50%", border: "none",
                  background: input.trim() && !isLoading ? "var(--accent)" : "rgba(236,227,213,0.06)",
                  color: "#fff", cursor: input.trim() && !isLoading ? "pointer" : "default",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
              </button>
            </div>
          </div>
      </div>
    </motion.div>
  );
}
