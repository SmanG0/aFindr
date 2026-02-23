"use client";

import { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ChatMessage } from "@/lib/types";

interface ChatPanelProps {
  messages: ChatMessage[];
  isLoading: boolean;
}

export default function ChatPanel({ messages, isLoading }: ChatPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "var(--bg-raised)", borderLeft: "1px solid var(--divider)" }}>
      {/* ─── Header ─── */}
      <div
        className="flex items-center gap-2.5 h-9 px-3 flex-shrink-0"
        style={{ borderBottom: "1px solid var(--divider)" }}
      >
        <div className="relative">
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: "var(--accent)", boxShadow: "0 0 6px rgba(196,123,58,0.5)" }}
          />
          <div
            className="absolute inset-0 w-1.5 h-1.5 rounded-full live-indicator"
            style={{ background: "var(--accent)" }}
          />
        </div>
        <span className="text-[11px] font-semibold" style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
          AI Agent
        </span>
        <div className="ml-auto">
          <span className="chip chip-accent" style={{ fontSize: 8 }}>GPT</span>
        </div>
      </div>

      {/* ─── Messages ─── */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
        <AnimatePresence mode="popLayout">
          {messages.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-12"
              style={{ color: "var(--text-muted)" }}
            >
              <div className="w-10 h-10 rounded-xl glass-inset flex items-center justify-center mb-3">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ color: "var(--accent)" }}>
                  <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" fill="currentColor" />
                </svg>
              </div>
              <p className="text-[11px] font-mono font-medium" style={{ color: "var(--text-secondary)" }}>
                Describe a trading strategy
              </p>
              <p className="text-[10px] font-mono mt-1.5" style={{ color: "var(--text-muted)" }}>
                &quot;Buy when RSI crosses above 30&quot;
              </p>
            </motion.div>
          )}

          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className="max-w-[92%] rounded-xl px-3 py-2 text-[11px] leading-relaxed"
                style={{
                  background: msg.role === "user"
                    ? "var(--accent)"
                    : "rgba(236,227,213,0.04)",
                  color: msg.role === "user" ? "var(--text-primary)" : "var(--text-primary)",
                  border: msg.role === "user"
                    ? "none"
                    : "1px solid var(--border-subtle)",
                  boxShadow: msg.role === "user"
                    ? "0 2px 12px rgba(196,123,58,0.25)"
                    : "none",
                  fontFamily: "var(--font-mono)",
                }}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>

                {/* Strategy result summary */}
                {msg.strategyResult && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mt-2 pt-2 flex items-center gap-2 text-[10px]"
                    style={{ borderTop: "1px solid rgba(236,227,213,0.08)" }}
                  >
                    <span className="chip chip-neutral">
                      {msg.strategyResult.metrics.totalTrades} trades
                    </span>
                    <span
                      className="font-semibold tabular-nums"
                      style={{
                        color: msg.strategyResult.metrics.totalReturn >= 0 ? "var(--buy)" : "var(--sell)",
                      }}
                    >
                      {msg.strategyResult.metrics.totalReturn >= 0 ? "+" : ""}${msg.strategyResult.metrics.totalReturn.toFixed(0)}
                    </span>
                    <span className="tabular-nums" style={{ color: "var(--text-muted)" }}>
                      {(msg.strategyResult.metrics.winRate * 100).toFixed(0)}% WR
                    </span>
                  </motion.div>
                )}
              </div>
            </motion.div>
          ))}

          {/* ─── Loading Indicator ─── */}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex justify-start"
            >
              <div
                className="rounded-xl px-3 py-2.5 flex items-center gap-2.5"
                style={{
                  background: "rgba(236,227,213,0.04)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-1 h-1 rounded-full"
                      style={{ background: "var(--accent)" }}
                      animate={{
                        opacity: [0.2, 1, 0.2],
                        y: [0, -3, 0],
                      }}
                      transition={{
                        duration: 0.8,
                        repeat: Infinity,
                        delay: i * 0.15,
                      }}
                    />
                  ))}
                </div>
                <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
                  Generating...
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
