"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAgentStream } from "@/hooks/useAgentStream";
import type { ToolEvent } from "@/hooks/useAgentStream";
import { ToolDataRenderer } from "./ArtifactBlocks";

// ─── Friendly tool name labels ───
const TOOL_LABELS: Record<string, string> = {
  run_backtest: "Running backtest",
  generate_strategy: "Generating strategy",
  generate_pinescript: "Writing PineScript",
  fetch_market_data: "Fetching market data",
  fetch_news: "Fetching news",
  get_stock_info: "Getting stock info",
  run_monte_carlo: "Running Monte Carlo",
  run_walk_forward: "Walk-forward analysis",
  analyze_trades: "Analyzing trades",
  fetch_options_chain: "Fetching options chain",
  fetch_insider_activity: "Checking insider activity",
  fetch_economic_data: "Fetching economic data",
  fetch_earnings_calendar: "Checking earnings calendar",
  fetch_company_news_feed: "Fetching company news",
  detect_chart_patterns: "Detecting chart patterns",
  detect_key_levels: "Finding key levels",
  detect_divergences: "Detecting divergences",
  query_prediction_markets: "Checking prediction markets",
  fetch_labor_data: "Fetching BLS labor data",
};

// ─── Rotating thinking phrases ───
const THINKING_PHRASES = [
  "Thinking",
  "Analyzing",
  "Processing",
  "Crunching numbers",
  "Consulting the charts",
  "Reading the tape",
  "Synthesizing",
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

// ─── Alphy Mascot (big, animated, blinking + floating) ───
function AlphyHero() {
  const [isBlinking, setIsBlinking] = useState(false);

  useEffect(() => {
    const blink = () => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 180);
    };
    const schedule = () => {
      const delay = 2000 + Math.random() * 3000;
      return setTimeout(() => { blink(); schedule(); }, delay);
    };
    const tid = schedule();
    return () => clearTimeout(tid);
  }, []);

  const eyeScaleY = isBlinking ? 0.1 : 1;

  return (
    <motion.div
      animate={{ y: [0, -6, 0] }}
      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}
    >
      <svg width="120" height="120" viewBox="0 0 64 64" fill="none">
        <ellipse cx="32" cy="36" rx="18" ry="20" fill="var(--accent)" />
        <ellipse cx="32" cy="40" rx="12" ry="13" fill="var(--accent-bright)" opacity="0.25" />
        <g style={{ transformOrigin: "25px 29px", transform: `scaleY(${eyeScaleY})`, transition: "transform 80ms ease" }}>
          <ellipse cx="25" cy="29" rx="4" ry="4.5" fill="var(--text-primary)" />
          <ellipse cx="26" cy="29.5" rx="2" ry="2.5" fill="var(--bg)" />
          <circle cx="24.5" cy="28" r="1.2" fill="var(--text-primary)" />
        </g>
        <g style={{ transformOrigin: "39px 29px", transform: `scaleY(${eyeScaleY})`, transition: "transform 80ms ease" }}>
          <ellipse cx="39" cy="29" rx="4" ry="4.5" fill="var(--text-primary)" />
          <ellipse cx="40" cy="29.5" rx="2" ry="2.5" fill="var(--bg)" />
          <circle cx="38.5" cy="28" r="1.2" fill="var(--text-primary)" />
        </g>
        <path d="M20 24 Q25 21 29 24" stroke="var(--bg)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <path d="M35 24 Q39 21 44 24" stroke="var(--bg)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <path d="M26 38 Q32 44 38 38" stroke="var(--text-primary)" strokeWidth="2" fill="none" strokeLinecap="round" />
        <circle cx="20" cy="34" r="3.5" fill="var(--accent-bright)" opacity="0.35" />
        <circle cx="44" cy="34" r="3.5" fill="var(--accent-bright)" opacity="0.35" />
        <text x="32" y="20" textAnchor="middle" fontSize="11" fontWeight="bold" fill="var(--text-primary)" fontFamily="Georgia, serif" opacity="0.7">&#x3B1;</text>
      </svg>
    </motion.div>
  );
}

// ─── Small Alphy avatar for messages ───
function AlphyAvatar() {
  return (
    <svg width="28" height="28" viewBox="0 0 64 64" fill="none" style={{ flexShrink: 0 }}>
      <ellipse cx="32" cy="36" rx="18" ry="20" fill="var(--accent)" />
      <ellipse cx="32" cy="40" rx="12" ry="13" fill="var(--accent-bright)" opacity="0.3" />
      <ellipse cx="25" cy="29" rx="4" ry="4.5" fill="var(--text-primary)" />
      <ellipse cx="26" cy="29.5" rx="2" ry="2.5" fill="var(--bg)" />
      <ellipse cx="39" cy="29" rx="4" ry="4.5" fill="var(--text-primary)" />
      <ellipse cx="40" cy="29.5" rx="2" ry="2.5" fill="var(--bg)" />
      <path d="M26 38 Q32 43 38 38" stroke="var(--text-primary)" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <text x="32" y="21" textAnchor="middle" fontSize="10" fontWeight="bold" fill="var(--text-primary)" fontFamily="Georgia, serif" opacity="0.7">α</text>
    </svg>
  );
}

// ─── Tool steps display (inline) ───
function ToolSteps({ toolEvents }: { toolEvents: ToolEvent[] }) {
  if (toolEvents.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
      {toolEvents.map((te) => {
        const label = TOOL_LABELS[te.tool_name] || te.tool_name.replace(/_/g, " ");
        const isRunning = te.status === "running";
        const isDone = te.status === "success";
        const isError = te.status === "error";

        return (
          <div key={te.id} className="flex items-center" style={{ gap: 6, fontSize: 11 }}>
            {isRunning ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                style={{ width: 12, height: 12, flexShrink: 0 }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5">
                  <path d="M21 12a9 9 0 1 1-6.22-8.56" />
                </svg>
              </motion.div>
            ) : isDone ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--buy)" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : isError ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--sell)" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}>
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : null}
            <span style={{ color: isRunning ? "var(--text-secondary)" : "var(--text-muted)" }}>
              {label}{isRunning ? "..." : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}

interface AlphaPlaygroundProps {
  onNavigateToChart?: (ticker: string) => void;
}

interface ToolDataEntry {
  tool: string;
  input: Record<string, unknown>;
  data: Record<string, unknown>;
}

interface ChatEntry {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolEvents?: ToolEvent[];
  toolData?: ToolDataEntry[];
}

const TOOL_CARDS = [
  {
    id: "screener",
    label: "AI Screener",
    description: "Natural language stock screening",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        <line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" />
      </svg>
    ),
  },
  {
    id: "sentiment",
    label: "Sentiment Radar",
    description: "AI-powered market sentiment analysis",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2 a10 10 0 0 1 0 20" fill="rgba(34,171,148,0.15)" stroke="none" />
        <line x1="12" y1="12" x2="12" y2="4" /><line x1="12" y1="12" x2="18" y2="8" />
        <circle cx="12" cy="12" r="2" />
      </svg>
    ),
  },
  {
    id: "whatif",
    label: "What-If Simulator",
    description: "Scenario analysis and stress testing",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2 L12 6" /><path d="M12 18 L12 22" />
        <path d="M4.93 4.93 L7.76 7.76" /><path d="M16.24 16.24 L19.07 19.07" />
        <path d="M2 12 L6 12" /><path d="M18 12 L22 12" />
        <circle cx="12" cy="12" r="4" />
      </svg>
    ),
  },
  {
    id: "correlations",
    label: "Correlation Matrix",
    description: "Cross-asset correlation explorer",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    id: "signals",
    label: "Signal Generator",
    description: "AI trading signal detection",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    id: "journal",
    label: "Trade Journal AI",
    description: "Pattern analysis from your trades",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        <line x1="8" y1="7" x2="16" y2="7" /><line x1="8" y1="11" x2="14" y2="11" />
      </svg>
    ),
  },
];

export default function AlphaPlayground({ onNavigateToChart }: AlphaPlaygroundProps) {
  void onNavigateToChart;
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatEntry[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const userScrolledUpRef = useRef(false);

  const { streamMessage, streamingText, toolEvents, isStreaming, error, abort } = useAgentStream();
  const thinkingPhrase = useRotatingPhrase(isStreaming && !streamingText);

  // Track user scroll intent via wheel/touch (not programmatic scroll events)
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const handleWheel = () => {
      const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 80;
      if (!atBottom) userScrolledUpRef.current = true;
    };
    container.addEventListener("wheel", handleWheel);
    container.addEventListener("touchmove", handleWheel);
    return () => {
      container.removeEventListener("wheel", handleWheel);
      container.removeEventListener("touchmove", handleWheel);
    };
  }, []);

  // Reset scroll lock when user sends a new message
  useEffect(() => {
    if (isStreaming) userScrolledUpRef.current = false;
  }, [isStreaming]);

  // Auto-scroll only if user hasn't scrolled up
  useEffect(() => {
    if (!userScrolledUpRef.current) {
      const container = scrollContainerRef.current;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [chatHistory, streamingText]);

  const handleSend = useCallback(async (text?: string) => {
    const msg = (text || prompt).trim();
    if (!msg || isStreaming) return;
    setPrompt("");

    // Add user message
    const userEntry: ChatEntry = { id: `user_${Date.now()}`, role: "user", content: msg };
    setChatHistory(prev => [...prev, userEntry]);

    // Build conversation history for context
    const convHistory = chatHistory.map(e => ({ role: e.role, content: e.content }));

    const done = await streamMessage({
      message: msg,
      symbol: "NQ=F",
      conversation_history: convHistory,
    });

    // Add assistant response
    if (done?.message) {
      const assistantEntry: ChatEntry = {
        id: `asst_${Date.now()}`,
        role: "assistant",
        content: done.message,
        toolEvents: [...(toolEvents || [])],
        toolData: (done.tool_data as ToolDataEntry[] | null) || undefined,
      };
      setChatHistory(prev => [...prev, assistantEntry]);
    } else if (error) {
      setChatHistory(prev => [...prev, {
        id: `err_${Date.now()}`,
        role: "assistant",
        content: `Something went wrong: ${error}`,
      }]);
    }
  }, [prompt, isStreaming, chatHistory, streamMessage, toolEvents, error]);

  const hasMessages = chatHistory.length > 0 || isStreaming;

  return (
    <div className="flex-1" style={{ background: "var(--bg)", display: "flex", flexDirection: "column", height: "100%", minHeight: 0, overflow: "hidden" }}>
      <div ref={scrollContainerRef} style={{ flex: 1, overflowY: "auto", scrollbarWidth: "thin" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "48px 32px 120px" }}>

          {/* Hero — only when no messages */}
          {!hasMessages && (
            <>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 48, textAlign: "center" }}>
                <AlphyHero />
                <p style={{ fontSize: 14, color: "var(--text-muted)", maxWidth: 480, lineHeight: 1.6, margin: "8px 0 0" }}>
                  Your AI-powered research playground. Ask me anything about the markets.
                </p>
              </div>

              {/* Tool Grid */}
              <div style={{ marginBottom: 48 }}>
                <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-muted)", marginBottom: 16, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Analysis Tools
                </h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                  {TOOL_CARDS.map((tool) => {
                    const isActive = activeTool === tool.id;
                    return (
                      <motion.button
                        key={tool.id}
                        onClick={() => setActiveTool(isActive ? null : tool.id)}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        style={{
                          background: isActive ? "rgba(196,123,58,0.08)" : "var(--bg-raised)",
                          border: isActive ? "1px solid rgba(196,123,58,0.3)" : "1px solid var(--glass-border)",
                          borderRadius: 12, padding: 20, cursor: "pointer",
                          textAlign: "left", transition: "all 120ms ease",
                        }}
                      >
                        <div style={{ color: isActive ? "var(--accent-bright)" : "var(--text-muted)", marginBottom: 12, transition: "color 120ms ease" }}>
                          {tool.icon}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: isActive ? "var(--text-primary)" : "var(--text-secondary)", marginBottom: 4 }}>
                          {tool.label}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.4 }}>
                          {tool.description}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Quick Prompts */}
              <div>
                <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-muted)", marginBottom: 16, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Quick Prompts
                </h2>
                <div className="flex flex-wrap" style={{ gap: 8 }}>
                  {[
                    "Show me the options chain for AAPL",
                    "Are insiders buying NVDA?",
                    "What's the current yield curve?",
                    "When does TSLA report earnings?",
                    "Unusual options activity on SPY",
                    "What's the latest CPI data?",
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => handleSend(q)}
                      style={{
                        padding: "8px 14px", borderRadius: 20,
                        background: "rgba(236,227,213,0.04)",
                        border: "1px solid rgba(236,227,213,0.08)",
                        color: "var(--text-muted)", fontSize: 12,
                        fontFamily: "var(--font-mono)", cursor: "pointer",
                        transition: "all 100ms ease",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(196,123,58,0.3)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(236,227,213,0.08)"; e.currentTarget.style.color = "var(--text-muted)"; }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ─── Chat Messages ─── */}
          {hasMessages && (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {chatHistory.map((entry) => (
                <div key={entry.id} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  {entry.role === "assistant" ? (
                    <AlphyAvatar />
                  ) : (
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                      background: "rgba(236,227,213,0.1)", display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, fontWeight: 700, color: "var(--text-muted)",
                    }}>
                      Y
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {entry.role === "assistant" && entry.toolEvents && entry.toolEvents.length > 0 && (
                      <ToolSteps toolEvents={entry.toolEvents} />
                    )}
                    <div style={{
                      fontSize: 14, lineHeight: 1.7,
                      color: entry.role === "user" ? "var(--text-primary)" : "var(--text-secondary)",
                      whiteSpace: "pre-wrap", wordBreak: "break-word",
                    }}>
                      {entry.content}
                    </div>
                    {entry.role === "assistant" && entry.toolData && entry.toolData.length > 0 && (
                      <ToolDataRenderer toolData={entry.toolData} />
                    )}
                  </div>
                </div>
              ))}

              {/* ─── Streaming response ─── */}
              {isStreaming && (
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <AlphyAvatar />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {toolEvents.length > 0 && <ToolSteps toolEvents={toolEvents} />}
                    {streamingText ? (
                      <div style={{ fontSize: 14, lineHeight: 1.7, color: "var(--text-secondary)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                        {streamingText}
                        <motion.span
                          animate={{ opacity: [1, 0] }}
                          transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }}
                          style={{ display: "inline-block", width: 6, height: 16, background: "var(--accent)", marginLeft: 2, borderRadius: 1, verticalAlign: "text-bottom" }}
                        />
                      </div>
                    ) : (
                      <div className="flex items-center" style={{ gap: 8 }}>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          style={{ width: 14, height: 14 }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5">
                            <path d="M21 12a9 9 0 1 1-6.22-8.56" />
                          </svg>
                        </motion.div>
                        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{thinkingPhrase}...</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* ─── Sticky Prompt Bar at Bottom ─── */}
      <div style={{
        borderTop: "1px solid var(--glass-border)",
        background: "var(--bg)",
        padding: "12px 32px 16px",
      }}>
        <div style={{
          maxWidth: 900, margin: "0 auto",
          background: "var(--glass)", borderRadius: 14,
          border: "1px solid var(--glass-border)",
          padding: "4px 4px 4px 20px",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" style={{ flexShrink: 0 }}>
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10" />
          </svg>
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={
              activeTool === "screener" ? "e.g. Tech stocks with P/E under 20 and revenue growth > 15%..."
              : activeTool === "sentiment" ? "e.g. What's the market sentiment on NVDA this week?"
              : activeTool === "whatif" ? "e.g. What happens to my portfolio if rates rise 50bps?"
              : activeTool === "correlations" ? "e.g. Show correlation between AAPL, MSFT, GOOGL over 6 months..."
              : activeTool === "signals" ? "e.g. Find RSI divergences on S&P 500 stocks..."
              : activeTool === "journal" ? "e.g. Analyze my win rate patterns by time of day..."
              : "Ask Alphy anything about the markets..."
            }
            disabled={isStreaming}
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              fontSize: 14, color: "var(--text-primary)", padding: "12px 0",
              fontFamily: "inherit", opacity: isStreaming ? 0.5 : 1,
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && prompt.trim() && !isStreaming) {
                handleSend();
              }
            }}
          />
          {isStreaming ? (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={abort}
              style={{
                padding: "10px 20px", borderRadius: 10,
                background: "rgba(255,53,53,0.12)",
                border: "1px solid rgba(255,53,53,0.2)",
                cursor: "pointer", color: "var(--sell)",
                fontSize: 13, fontWeight: 600,
              }}
            >
              Stop
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => handleSend()}
              disabled={!prompt.trim()}
              style={{
                padding: "10px 20px", borderRadius: 10,
                background: prompt.trim() ? "var(--accent)" : "rgba(236,227,213,0.06)",
                border: "none", cursor: prompt.trim() ? "pointer" : "default",
                color: prompt.trim() ? "#fff" : "var(--text-disabled)",
                fontSize: 13, fontWeight: 600, transition: "all 150ms ease",
              }}
            >
              Run
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
}
