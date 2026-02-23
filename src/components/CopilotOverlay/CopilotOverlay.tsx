"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ChatMessage } from "@/lib/types";

interface CopilotOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  symbol: string;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning, Trader";
  if (hour < 18) return "Good Afternoon, Trader";
  return "Good Evening, Trader";
}

/** Cute Clippy-inspired alpha mascot */
function AlphyMascot({ size = 64, bounce = false }: { size?: number; bounce?: boolean }) {
  const mascot = (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      {/* Body - warm rounded shape */}
      <ellipse cx="32" cy="36" rx="18" ry="20" fill="var(--accent)" />
      {/* Belly lighter */}
      <ellipse cx="32" cy="40" rx="12" ry="13" fill="var(--accent-bright)" opacity="0.3" />
      {/* Left eye */}
      <ellipse cx="25" cy="29" rx="4" ry="4.5" fill="var(--text-primary)" />
      <ellipse cx="26" cy="29.5" rx="2" ry="2.5" fill="var(--bg)" />
      <circle cx="24.5" cy="28" r="1" fill="var(--text-primary)" />
      {/* Right eye */}
      <ellipse cx="39" cy="29" rx="4" ry="4.5" fill="var(--text-primary)" />
      <ellipse cx="40" cy="29.5" rx="2" ry="2.5" fill="var(--bg)" />
      <circle cx="38.5" cy="28" r="1" fill="var(--text-primary)" />
      {/* Friendly eyebrows */}
      <path d="M20 24 Q25 21 29 24" stroke="var(--bg-overlay)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M35 24 Q39 21 44 24" stroke="var(--bg-overlay)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      {/* Smile */}
      <path d="M26 38 Q32 43 38 38" stroke="var(--text-primary)" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      {/* Rosy cheeks */}
      <circle cx="21" cy="34" r="3" fill="var(--accent-bright)" opacity="0.35" />
      <circle cx="43" cy="34" r="3" fill="var(--accent-bright)" opacity="0.35" />
      {/* Alpha symbol on forehead */}
      <text x="32" y="21" textAnchor="middle" fontSize="10" fontWeight="bold" fill="var(--text-primary)" fontFamily="Georgia, serif" opacity="0.7">α</text>
      {/* Tiny hand waving */}
      <path d="M50 30 Q54 26 52 22" stroke="var(--accent)" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="52" cy="21" r="2.5" fill="var(--accent)" />
    </svg>
  );

  if (bounce) {
    return (
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        {mascot}
      </motion.div>
    );
  }
  return mascot;
}

export default function CopilotOverlay({
  isOpen,
  onClose,
  messages,
  onSendMessage,
  isLoading,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  symbol,
}: CopilotOverlayProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-focus textarea when overlay opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 200);
    }
  }, [isOpen]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    onSendMessage(trimmed);
    setInput("");
  }, [input, isLoading, onSendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10000,
            background: "var(--bg)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* ─── Header ─── */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "16px 24px",
              flexShrink: 0,
            }}
          >
            {/* Left: Logo + mascot */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <AlphyMascot size={28} />
              <span
                style={{
                  color: "var(--text-primary)",
                  fontSize: 16,
                  fontWeight: 500,
                }}
              >
                Alphy
              </span>
            </div>

            {/* Center: Nav pills */}
            <div style={{ display: "flex", gap: 8 }}>
              <button className="nav-pill">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
                New Chat
              </button>
              <button className="nav-pill">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 8v4l3 3" />
                  <circle cx="12" cy="12" r="10" />
                </svg>
                History
              </button>
            </div>

            {/* Right: Close button */}
            <button
              onClick={onClose}
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                border: "none",
                background: "transparent",
                color: "rgba(236,227,213,0.6)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background 150ms ease",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "rgba(236,227,213,0.06)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* ─── Main Content ─── */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: messages.length === 0 ? "center" : "flex-start",
              overflow: "hidden",
              position: "relative",
            }}
          >
            {messages.length === 0 ? (
              /* ─── Empty State: Greeting ─── */
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <AlphyMascot size={80} bounce />
                <h1
                  className="gradient-title"
                  style={{ fontSize: 32, margin: 0 }}
                >
                  {getGreeting()}
                </h1>
                <p
                  style={{
                    color: "var(--text-muted)",
                    fontSize: 14,
                    margin: 0,
                  }}
                >
                  I&apos;m Alphy, your trading assistant. How can I help?
                </p>
              </div>
            ) : (
              /* ─── Message List ─── */
              <div
                style={{
                  maxWidth: 700,
                  width: "100%",
                  flex: 1,
                  overflowY: "auto",
                  padding: 20,
                }}
              >
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    style={{
                      display: "flex",
                      justifyContent:
                        msg.role === "user" ? "flex-end" : "flex-start",
                      marginBottom: 12,
                    }}
                  >
                    <div
                      style={{
                        maxWidth: "80%",
                        padding:
                          msg.role === "user" ? "12px 16px" : "12px 0",
                        background:
                          msg.role === "user"
                            ? "rgba(236,227,213,0.06)"
                            : "transparent",
                        borderRadius:
                          msg.role === "user" ? 16 : 0,
                        color: "var(--text-primary)",
                        fontSize: 14,
                        lineHeight: 1.6,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {msg.content}

                      {/* PineScript code block */}
                      {msg.pinescriptResult && (
                        <div
                          style={{
                            marginTop: 12,
                            background: "rgba(236,227,213,0.04)",
                            borderRadius: 8,
                            border: "1px solid rgba(236,227,213,0.08)",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              padding: "8px 12px",
                              borderBottom: "1px solid rgba(236,227,213,0.06)",
                              fontSize: 11,
                              color: "var(--text-muted)",
                            }}
                          >
                            <span style={{ fontWeight: 600, color: "var(--accent)" }}>
                              PineScript v5 — {msg.pinescriptResult.name}
                            </span>
                            <span
                              className="chip chip-neutral"
                              style={{ fontSize: 10, padding: "2px 8px" }}
                            >
                              {msg.pinescriptResult.script_type}
                            </span>
                          </div>
                          <pre
                            style={{
                              margin: 0,
                              padding: "12px",
                              fontSize: 11,
                              lineHeight: 1.5,
                              fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
                              color: "rgba(236,227,213,0.8)",
                              overflowX: "auto",
                              maxHeight: 300,
                              overflowY: "auto",
                              whiteSpace: "pre",
                            }}
                          >
                            {msg.pinescriptResult.code}
                          </pre>
                          <div
                            style={{
                              padding: "6px 12px",
                              borderTop: "1px solid rgba(236,227,213,0.06)",
                              fontSize: 10,
                              color: "var(--text-muted)",
                            }}
                          >
                            Paste into TradingView Pine Editor to backtest on any chart
                          </div>
                        </div>
                      )}

                      {/* Strategy result chip */}
                      {msg.strategyResult && (
                        <div
                          style={{
                            marginTop: 8,
                            paddingTop: 8,
                            borderTop: "1px solid rgba(236,227,213,0.08)",
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            fontSize: 12,
                          }}
                        >
                          <span className="chip chip-neutral">
                            {msg.strategyResult.metrics.totalTrades} trades
                          </span>
                          <span
                            className="tabular-nums"
                            style={{
                              fontWeight: 600,
                              color:
                                msg.strategyResult.metrics.totalReturn >= 0
                                  ? "var(--buy)"
                                  : "var(--sell)",
                            }}
                          >
                            {msg.strategyResult.metrics.totalReturn >= 0
                              ? "+"
                              : ""}
                            ${msg.strategyResult.metrics.totalReturn.toFixed(0)}
                          </span>
                          <span
                            className="tabular-nums"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {(
                              msg.strategyResult.metrics.winRate * 100
                            ).toFixed(0)}
                            % WR
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Loading indicator */}
                {isLoading && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-start",
                      marginBottom: 12,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "12px 0",
                      }}
                    >
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: "var(--text-muted)",
                          }}
                          animate={{
                            opacity: [0.3, 1, 0.3],
                            scale: [0.85, 1, 0.85],
                          }}
                          transition={{
                            duration: 1,
                            repeat: Infinity,
                            delay: i * 0.2,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* ─── Input Area ─── */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              marginBottom: 40,
              flexShrink: 0,
            }}
          >
            <div style={{ position: "relative" }}>
              {/* Plus icon (left) */}
              <div
                style={{
                  position: "absolute",
                  left: 20,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-muted)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  pointerEvents: "none",
                }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v8M8 12h8" />
                </svg>
              </div>

              <textarea
                ref={textareaRef}
                className="copilot-input"
                placeholder="Ask Alphy anything..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                rows={1}
                style={{
                  display: "flex",
                  alignItems: "center",
                  lineHeight: "55px",
                  overflow: "hidden",
                }}
              />

              {/* Send button (right) */}
              <button
                onClick={handleSubmit}
                disabled={isLoading || !input.trim()}
                style={{
                  position: "absolute",
                  right: 14,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  border: "none",
                  background:
                    input.trim() && !isLoading
                      ? "var(--link)"
                      : "rgba(236,227,213,0.06)",
                  color: "var(--text-primary)",
                  cursor:
                    input.trim() && !isLoading ? "pointer" : "default",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "background 150ms ease",
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
              </button>
            </div>

            {/* Helper text */}
            <p
              style={{
                color: "var(--text-muted)",
                fontSize: 12,
                marginTop: 12,
                textAlign: "center",
              }}
            >
              Alphy has access to your trading data and can help with analysis
            </p>
          </div>

          {/* ─── Watermark ─── */}
          <div
            className="copilot-watermark"
            style={{
              position: "absolute",
              bottom: 20,
              left: "50%",
              transform: "translateX(-50%)",
            }}
          >
            Alphy
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
