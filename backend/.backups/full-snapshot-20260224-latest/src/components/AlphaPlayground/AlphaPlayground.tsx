"use client";

import React, { useState, useEffect, useRef, useCallback, memo } from "react";
import { motion } from "framer-motion";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAgentStream } from "@/hooks/useAgentStream";
import type { ToolEvent, TokenUsage } from "@/hooks/useAgentStream";
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

/** Live token counter shown during streaming */
function PlaygroundTokenCounter({ tokenUsage }: { tokenUsage: TokenUsage }) {
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

// ─── Code block with copy button + language label (ChatGPT style) ───
function CodeBlock({ children, className }: { children?: React.ReactNode; className?: string }) {
  const [copied, setCopied] = useState(false);
  const lang = className?.replace("language-", "") || "";
  const code = String(children).replace(/\n$/, "");

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ position: "relative", margin: "10px 0 14px" }}>
      {/* Header bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(255,255,255,0.04)",
        borderRadius: "8px 8px 0 0",
        border: "1px solid rgba(236,227,213,0.06)",
        borderBottom: "none",
        padding: "6px 12px",
        fontSize: 11, color: "var(--text-muted)",
      }}>
        <span style={{ fontFamily: "var(--font-mono)", textTransform: "lowercase" }}>{lang || "code"}</span>
        <button
          onClick={handleCopy}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: copied ? "var(--buy)" : "var(--text-muted)",
            fontSize: 11, display: "flex", alignItems: "center", gap: 4,
            padding: "2px 6px", borderRadius: 4,
            transition: "color 150ms ease",
          }}
        >
          {copied ? (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
              Copied
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
              Copy
            </>
          )}
        </button>
      </div>
      {/* Code body */}
      <pre style={{
        background: "rgba(0,0,0,0.35)",
        border: "1px solid rgba(236,227,213,0.06)",
        borderTop: "none",
        borderRadius: "0 0 8px 8px",
        padding: "14px 18px",
        margin: 0,
        overflowX: "auto",
        scrollbarWidth: "thin",
        scrollbarColor: "rgba(236,227,213,0.12) transparent",
      }}>
        <code style={{
          fontSize: 13, lineHeight: 1.6,
          color: "var(--text-secondary)",
          fontFamily: "var(--font-mono)",
          whiteSpace: "pre",
        }}>
          {code}
        </code>
      </pre>
    </div>
  );
}

// ─── Custom component overrides for ReactMarkdown ───
const markdownComponents: Components = {
  // Code blocks: ChatGPT-style header + copy button
  pre({ children }) {
    // react-markdown wraps fenced code in <pre><code>. Extract the code element.
    const codeEl = React.Children.toArray(children).find(
      (child) => React.isValidElement(child) && child.type === "code"
    ) as React.ReactElement<{ children?: React.ReactNode; className?: string }> | undefined;
    if (codeEl) {
      return <CodeBlock className={codeEl.props.className}>{codeEl.props.children}</CodeBlock>;
    }
    return <pre>{children}</pre>;
  },
};

// ─── Memoized markdown renderer (prevents re-parsing unchanged messages) ───
const MemoMarkdown = memo(function MemoMarkdown({ content }: { content: string }) {
  return (
    <div className="alphy-markdown" style={{ fontSize: 14, lineHeight: 1.7, color: "var(--text-secondary)", wordBreak: "break-word" }}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{content}</ReactMarkdown>
    </div>
  );
});

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

const SLASH_COMMANDS = [
  {
    command: "/screener",
    label: "Screener",
    description: "Stock screening",
    hint: "describe what you're looking for...",
    examples: [
      "/screener tech stocks under $50 with revenue growth above 20%",
      "/screener high dividend yield blue chips with low P/E",
      "/screener small cap biotech with insider buying last 30 days",
      "/screener oversold large caps RSI below 30 near 52-week lows",
    ],
  },
  {
    command: "/sentiment",
    label: "Sentiment",
    description: "Market sentiment",
    hint: "enter a symbol like AAPL or NVDA...",
    examples: [
      "/sentiment NVDA",
      "/sentiment TSLA",
      "/sentiment SPY",
      "/sentiment AAPL",
    ],
  },
  {
    command: "/whatif",
    label: "What-If",
    description: "Scenario analysis",
    hint: "describe a scenario like 'rates rise 50bps'...",
    examples: [
      "/whatif Fed cuts rates 50bps at the next meeting",
      "/whatif oil spikes to $120 per barrel",
      "/whatif NVDA misses earnings by 10%",
      "/whatif China invades Taiwan — impact on semis",
    ],
  },
  {
    command: "/correlations",
    label: "Correlations",
    description: "Cross-asset",
    hint: "list symbols like AAPL MSFT GOOGL...",
    examples: [
      "/correlations AAPL MSFT GOOGL AMZN META",
      "/correlations SPY QQQ IWM DIA",
      "/correlations BTC-USD ETH-USD GOLD GC=F",
      "/correlations XLF XLK XLE XLV XLY",
    ],
  },
  {
    command: "/signals",
    label: "Signals",
    description: "Signal detection",
    hint: "enter a symbol to scan for setups...",
    examples: [
      "/signals NQ=F",
      "/signals AAPL",
      "/signals ES=F",
      "/signals BTC-USD",
    ],
  },
  {
    command: "/journal",
    label: "Journal",
    description: "Trade patterns",
    hint: "analyze your trading patterns and habits",
    examples: [
      "/journal",
      "/journal what time of day do I trade best",
      "/journal show my biggest winners and losers",
      "/journal am I overtrading",
    ],
  },
];

export default function AlphaPlayground({ onNavigateToChart }: AlphaPlaygroundProps) {
  void onNavigateToChart;
  const [prompt, setPrompt] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatEntry[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const userScrolledUpRef = useRef(false);

  const { streamMessage, streamingText, toolEvents, isStreaming, error, abort, liveTokenUsage } = useAgentStream();
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

  const inputRef = useRef<HTMLInputElement>(null);

  // ─── Tab-to-cycle example prompts ───
  const [exampleIndex, setExampleIndex] = useState(-1); // -1 = no example active (show hint)

  // Detect if prompt starts with a slash command for highlighting
  const slashMatch = SLASH_COMMANDS.find((c) => prompt.startsWith(c.command));
  // Show hint only when prompt is exactly the command — any keystroke (even space) hides it
  const showSlashHint = slashMatch && prompt === slashMatch.command;
  // Show the current ghost example when hint is visible
  const currentExample = showSlashHint && slashMatch ? slashMatch.examples[exampleIndex >= 0 ? exampleIndex : 0] : null;
  // The ghost portion is the text after the command
  const ghostText = currentExample ? currentExample.slice(slashMatch!.command.length) : null;

  // Tab / Right Arrow = accept ghost into real text, Down Arrow = cycle examples
  const handleExampleKey = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSlashHint || !slashMatch) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      // Cycle to next example
      setExampleIndex((prev) => {
        if (prev <= 0) return 1 % slashMatch.examples.length;
        return (prev + 1) % slashMatch.examples.length;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      // Cycle to previous example
      setExampleIndex((prev) => {
        if (prev <= 0) return slashMatch.examples.length - 1;
        return prev - 1;
      });
    } else if (e.key === "Tab" || e.key === "ArrowRight") {
      // Accept the ghost example into the input as real text
      if (currentExample) {
        e.preventDefault();
        setPrompt(currentExample);
        setExampleIndex(-1);
      }
    }
  }, [showSlashHint, slashMatch, currentExample]);

  // Reset example index when command changes
  useEffect(() => {
    setExampleIndex(-1);
  }, [slashMatch?.command]);

  return (
    <div className="flex-1" style={{ background: "var(--bg)", display: "flex", flexDirection: "column", height: "100%", minHeight: 0, overflow: "hidden" }}>
      <div ref={scrollContainerRef} style={{ flex: 1, overflowY: "auto", scrollbarWidth: "thin" }}>

        {/* ─── Empty state: centered mascot + prompt bar + commands ─── */}
        {!hasMessages && (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            minHeight: "100%", padding: "0 32px 120px",
          }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", width: "100%", maxWidth: 680 }}>
              <AlphyHero />
              <p style={{ fontSize: 14, color: "var(--text-muted)", maxWidth: 400, lineHeight: 1.6, margin: "8px 0 40px" }}>
                Your AI-powered research playground. Ask me anything about the markets.
              </p>

              {/* ─── Centered Prompt Pill ─── */}
              <div style={{
                width: "100%", maxWidth: 620, marginBottom: 24,
                background: "rgba(236,227,213,0.03)",
                borderRadius: 999,
                border: "1px solid rgba(236,227,213,0.08)",
                boxShadow: "0 0 0 1px rgba(236,227,213,0.02), 0 8px 32px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.03)",
                backdropFilter: "blur(20px)",
                padding: "4px 5px 4px 24px",
                display: "flex", alignItems: "center", gap: 8,
                transition: "border-color 200ms ease, box-shadow 200ms ease",
              }}>
                <div style={{ flex: 1, position: "relative" }}>
                  {/* Colored overlay */}
                  {slashMatch && prompt && (
                    <div
                      aria-hidden
                      style={{
                        position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                        pointerEvents: "none", display: "flex", alignItems: "center",
                        fontSize: 14, fontFamily: "inherit", padding: "14px 0",
                        whiteSpace: "pre", overflow: "hidden",
                      }}
                    >
                      <span style={{ color: "var(--accent-bright)" }}>{slashMatch.command}</span>
                      {showSlashHint ? (
                        <>
                          <span style={{ color: "var(--text-muted)", opacity: 0.3, fontWeight: 400 }}>
                            {ghostText || ` ${slashMatch.hint}`}
                          </span>
                          <span style={{
                            color: "var(--text-muted)", opacity: 0.22, fontWeight: 400,
                            marginLeft: 10, fontSize: 10, display: "inline-flex", alignItems: "center", gap: 4,
                          }}>
                            <span style={{ border: "1px solid rgba(236,227,213,0.15)", borderRadius: 3, padding: "0px 4px", fontSize: 10, lineHeight: "16px" }}>Tab</span>
                            <span style={{ opacity: 0.6 }}>accept</span>
                            <span style={{ border: "1px solid rgba(236,227,213,0.15)", borderRadius: 3, padding: "0px 3px", fontSize: 10, lineHeight: "16px", marginLeft: 4 }}>↓</span>
                            <span style={{ opacity: 0.6 }}>cycle</span>
                          </span>
                        </>
                      ) : (
                        <span style={{ color: "var(--text-primary)", fontWeight: 400 }}>{prompt.slice(slashMatch.command.length)}</span>
                      )}
                    </div>
                  )}
                  <input
                    ref={inputRef}
                    type="text"
                    value={prompt}
                    onChange={(e) => { setPrompt(e.target.value); setExampleIndex(-1); }}
                    placeholder="Ask Alphy anything, or type / for commands..."
                    disabled={isStreaming}
                    style={{
                      width: "100%", background: "transparent", border: "none", outline: "none",
                      fontSize: 14,
                      color: slashMatch ? "transparent" : "var(--text-primary)",
                      caretColor: "var(--text-primary)",
                      padding: "14px 0",
                      fontFamily: "inherit", opacity: isStreaming ? 0.5 : 1,
                    }}
                    onFocus={(e) => {
                      const pill = e.currentTarget.parentElement!.parentElement!;
                      pill.style.borderColor = "rgba(196,123,58,0.3)";
                      pill.style.boxShadow = "0 0 0 1px rgba(196,123,58,0.08), 0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.03)";
                    }}
                    onBlur={(e) => {
                      const pill = e.currentTarget.parentElement!.parentElement!;
                      pill.style.borderColor = "rgba(236,227,213,0.08)";
                      pill.style.boxShadow = "0 0 0 1px rgba(236,227,213,0.02), 0 8px 32px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.03)";
                    }}
                    onKeyDown={(e) => {
                      handleExampleKey(e);
                      if (e.key === "Enter" && prompt.trim() && !isStreaming && !showSlashHint) {
                        handleSend();
                      }
                    }}
                  />
                </div>
                {isStreaming ? (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.93 }}
                    onClick={abort}
                    style={{
                      width: 42, height: 42, borderRadius: 999,
                      background: "rgba(229,77,77,0.12)",
                      border: "1px solid rgba(229,77,77,0.2)",
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--sell)">
                      <rect x="4" y="4" width="16" height="16" rx="2" />
                    </svg>
                  </motion.button>
                ) : (
                  <motion.button
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.92 }}
                    onClick={() => handleSend()}
                    disabled={!prompt.trim()}
                    style={{
                      width: 42, height: 42, borderRadius: 999,
                      background: prompt.trim()
                        ? "linear-gradient(135deg, var(--accent) 0%, var(--accent-bright) 100%)"
                        : "rgba(236,227,213,0.05)",
                      border: "none", cursor: prompt.trim() ? "pointer" : "default",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                      boxShadow: prompt.trim() ? "0 2px 12px rgba(196,123,58,0.3)" : "none",
                      transition: "background 150ms ease, box-shadow 150ms ease",
                    }}
                  >
                    {/* Alpha symbol as send icon */}
                    <span style={{
                      fontSize: 18, fontWeight: 800,
                      fontFamily: "Georgia, 'Times New Roman', serif",
                      color: prompt.trim() ? "#fff" : "var(--text-disabled)",
                      lineHeight: 1, marginTop: -1,
                    }}>
                      α
                    </span>
                  </motion.button>
                )}
              </div>

              {/* ─── Slash Commands ─── */}
              <div className="flex flex-wrap justify-center" style={{ gap: 6 }}>
                {SLASH_COMMANDS.map((cmd) => (
                  <button
                    key={cmd.command}
                    onClick={() => { setPrompt(cmd.command); inputRef.current?.focus(); }}
                    style={{
                      padding: "5px 10px", borderRadius: 8,
                      background: "rgba(236,227,213,0.03)",
                      border: "1px solid rgba(236,227,213,0.06)",
                      cursor: "pointer", transition: "all 100ms ease",
                      display: "flex", alignItems: "center", gap: 5,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(196,123,58,0.25)"; e.currentTarget.style.background = "rgba(196,123,58,0.05)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(236,227,213,0.06)"; e.currentTarget.style.background = "rgba(236,227,213,0.03)"; }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--accent)", fontFamily: "var(--font-mono)" }}>
                      {cmd.command}
                    </span>
                    <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                      {cmd.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── Chat Messages ─── */}
        {hasMessages && (
          <div style={{ maxWidth: 900, margin: "0 auto", padding: "48px 32px 120px" }}>
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
                    {entry.role === "user" ? (
                      <div style={{ fontSize: 14, lineHeight: 1.7, color: "var(--text-primary)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                        {entry.content}
                      </div>
                    ) : (
                      <MemoMarkdown content={entry.content} />
                    )}
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
                      <div className="alphy-markdown" style={{ fontSize: 14, lineHeight: 1.7, color: "var(--text-secondary)", wordBreak: "break-word" }}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{streamingText}</ReactMarkdown>
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
                    {/* Live token counter */}
                    {liveTokenUsage && (
                      <PlaygroundTokenCounter tokenUsage={liveTokenUsage} />
                    )}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>
        )}
      </div>

      {/* ─── Sticky Prompt Bar (only when chat is active) ─── */}
      {hasMessages && (
        <div style={{
          borderTop: "1px solid rgba(236,227,213,0.04)",
          background: "var(--bg)",
          padding: "12px 32px 16px",
        }}>
          <div style={{
            maxWidth: 680, margin: "0 auto",
            background: "rgba(236,227,213,0.03)",
            borderRadius: 999,
            border: "1px solid rgba(236,227,213,0.08)",
            boxShadow: "0 0 0 1px rgba(236,227,213,0.02), 0 4px 20px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.03)",
            backdropFilter: "blur(20px)",
            padding: "4px 5px 4px 24px",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <div style={{ flex: 1, position: "relative" }}>
              {slashMatch && prompt && (
                <div
                  aria-hidden
                  style={{
                    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                    pointerEvents: "none", display: "flex", alignItems: "center",
                    fontSize: 14, fontFamily: "inherit", padding: "12px 0",
                    whiteSpace: "pre", overflow: "hidden",
                  }}
                >
                  <span style={{ color: "var(--accent-bright)" }}>{slashMatch.command}</span>
                  {showSlashHint ? (
                    <>
                      <span style={{ color: "var(--text-muted)", opacity: 0.3 }}>
                        {ghostText || ` ${slashMatch.hint}`}
                      </span>
                      <span style={{
                        color: "var(--text-muted)", opacity: 0.22,
                        marginLeft: 10, fontSize: 10, display: "inline-flex", alignItems: "center", gap: 4,
                      }}>
                        <span style={{ border: "1px solid rgba(236,227,213,0.15)", borderRadius: 3, padding: "0px 4px", fontSize: 10, lineHeight: "16px" }}>Tab</span>
                        <span style={{ opacity: 0.6 }}>accept</span>
                        <span style={{ border: "1px solid rgba(236,227,213,0.15)", borderRadius: 3, padding: "0px 3px", fontSize: 10, lineHeight: "16px", marginLeft: 4 }}>↓</span>
                        <span style={{ opacity: 0.6 }}>cycle</span>
                      </span>
                    </>
                  ) : (
                    <span style={{ color: "var(--text-primary)" }}>{prompt.slice(slashMatch.command.length)}</span>
                  )}
                </div>
              )}
              <input
                type="text"
                value={prompt}
                onChange={(e) => { setPrompt(e.target.value); setExampleIndex(-1); }}
                placeholder="Ask Alphy anything, or type / for commands..."
                disabled={isStreaming}
                style={{
                  width: "100%", background: "transparent", border: "none", outline: "none",
                  fontSize: 14,
                  color: slashMatch ? "transparent" : "var(--text-primary)",
                  caretColor: "var(--text-primary)",
                  padding: "12px 0",
                  fontFamily: "inherit", opacity: isStreaming ? 0.5 : 1,
                }}
                onKeyDown={(e) => {
                  handleExampleKey(e);
                  if (e.key === "Enter" && prompt.trim() && !isStreaming && !showSlashHint) {
                    handleSend();
                  }
                }}
              />
            </div>
            {isStreaming ? (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.93 }}
                onClick={abort}
                style={{
                  width: 40, height: 40, borderRadius: 999,
                  background: "rgba(229,77,77,0.12)",
                  border: "1px solid rgba(229,77,77,0.2)",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--sell)">
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                </svg>
              </motion.button>
            ) : (
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => handleSend()}
                disabled={!prompt.trim()}
                style={{
                  width: 40, height: 40, borderRadius: 999,
                  background: prompt.trim()
                    ? "linear-gradient(135deg, var(--accent) 0%, var(--accent-bright) 100%)"
                    : "rgba(236,227,213,0.05)",
                  border: "none", cursor: prompt.trim() ? "pointer" : "default",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                  boxShadow: prompt.trim() ? "0 2px 12px rgba(196,123,58,0.3)" : "none",
                  transition: "background 150ms ease, box-shadow 150ms ease",
                }}
              >
                <span style={{
                  fontSize: 17, fontWeight: 800,
                  fontFamily: "Georgia, 'Times New Roman', serif",
                  color: prompt.trim() ? "#fff" : "var(--text-disabled)",
                  lineHeight: 1, marginTop: -1,
                }}>
                  α
                </span>
              </motion.button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
