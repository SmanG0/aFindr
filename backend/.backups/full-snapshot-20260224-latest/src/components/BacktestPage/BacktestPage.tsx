"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import type { ChatMessage, Trade, BacktestMetrics, BacktestResult, PineScriptResult } from "@/lib/types";
import TradingPanel from "@/components/TradingPanel/TradingPanel";
import { sendChatMessage } from "@/lib/api";

interface BacktestPageProps {
  symbol: string;
  interval: string;
}

export default function BacktestPage({ symbol, interval }: BacktestPageProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [metrics, setMetrics] = useState<BacktestMetrics | null>(null);
  const [equityCurve, setEquityCurve] = useState<{ time: number; value: number }[]>([]);
  const [strategyName, setStrategyName] = useState("");
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(async () => {
    const message = inputValue.trim();
    if (!message || isLoading) return;

    setInputValue("");
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(), role: "user", content: message, timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const conversationHistory = messages.map((m) => ({ role: m.role, content: m.content }));
      const response = await sendChatMessage({ message, symbol, timeframe: interval, conversationHistory });

      let backtestResult: BacktestResult | undefined;
      if (response.backtestResult) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const br = response.backtestResult as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawMetrics = (br.metrics || {}) as any;
        const mappedMetrics: BacktestMetrics = {
          totalTrades: (rawMetrics.total_trades ?? rawMetrics.totalTrades ?? 0) as number,
          winRate: (rawMetrics.win_rate ?? rawMetrics.winRate ?? 0) as number,
          lossRate: (rawMetrics.loss_rate ?? rawMetrics.lossRate ?? 0) as number,
          totalReturn: (rawMetrics.total_return ?? rawMetrics.totalReturn ?? 0) as number,
          totalReturnPct: (rawMetrics.total_return_pct ?? rawMetrics.totalReturnPct ?? 0) as number,
          maxDrawdown: (rawMetrics.max_drawdown ?? rawMetrics.maxDrawdown ?? 0) as number,
          maxDrawdownPct: (rawMetrics.max_drawdown_pct ?? rawMetrics.maxDrawdownPct ?? 0) as number,
          maxConsecutiveLosses: (rawMetrics.max_consecutive_losses ?? rawMetrics.maxConsecutiveLosses ?? 0) as number,
          maxConsecutiveWins: (rawMetrics.max_consecutive_wins ?? rawMetrics.maxConsecutiveWins ?? 0) as number,
          profitFactor: (rawMetrics.profit_factor ?? rawMetrics.profitFactor ?? 0) as number,
          sharpeRatio: (rawMetrics.sharpe_ratio ?? rawMetrics.sharpeRatio ?? 0) as number,
          avgWin: (rawMetrics.avg_win ?? rawMetrics.avgWin ?? 0) as number,
          avgLoss: (rawMetrics.avg_loss ?? rawMetrics.avgLoss ?? 0) as number,
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawTrades = ((br.trades || []) as any[]).map((t: any) => ({
          id: (t.id ?? 0) as number, instrument: (t.instrument ?? "N/A") as string,
          side: (t.side ?? "long") as "long" | "short", size: (t.size ?? 1) as number,
          entryPrice: (t.entry_price ?? t.entryPrice ?? 0) as number,
          exitPrice: (t.exit_price ?? t.exitPrice ?? 0) as number,
          entryTime: (t.entry_time ?? t.entryTime ?? 0) as number,
          exitTime: (t.exit_time ?? t.exitTime ?? 0) as number,
          stopLoss: (t.stop_loss ?? t.stopLoss ?? null) as number | null,
          takeProfit: (t.take_profit ?? t.takeProfit ?? null) as number | null,
          pnl: (t.pnl ?? 0) as number, pnlPoints: (t.pnl_points ?? t.pnlPoints ?? 0) as number,
          commission: (t.commission ?? 0) as number,
        }));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawEquity = ((br.equity_curve || br.equityCurve || []) as any[]).map((e: any) => ({
          time: (e.time ?? 0) as number, value: (e.value ?? 0) as number,
        }));
        backtestResult = {
          trades: rawTrades, equityCurve: rawEquity, metrics: mappedMetrics,
          strategyName: (br.strategy_name ?? br.strategyName ?? "") as string,
          strategyDescription: (br.strategy_description ?? br.strategyDescription ?? "") as string,
        };
        setTrades(rawTrades);
        setMetrics(mappedMetrics);
        setEquityCurve(rawEquity);
        setStrategyName(backtestResult.strategyName);
      }

      let pinescriptResult: PineScriptResult | undefined;
      if (response.pinescript) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ps = response.pinescript as any;
        pinescriptResult = {
          name: (ps.name ?? "Custom Strategy") as string,
          description: (ps.description ?? "") as string,
          parameters: (ps.parameters ?? {}) as Record<string, string>,
          code: (ps.code ?? "") as string,
          script_type: (ps.script_type ?? "strategy") as "strategy" | "indicator",
        };
      }

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(), role: "assistant", content: response.message,
        timestamp: Date.now(), strategyResult: backtestResult, pinescriptResult,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(), role: "assistant",
        content: `Error: ${err instanceof Error ? err.message : "Something went wrong"}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading, messages, symbol, interval]);

  return (
    <div className="flex flex-1 min-h-0" style={{ background: "var(--bg)" }}>
      {/* Left: Chat Panel */}
      <div className="flex flex-col" style={{ width: 480, borderRight: "1px solid rgba(236,227,213,0.1)", background: "var(--bg-raised)" }}>
        {/* Header */}
        <div className="flex items-center gap-3 px-5 flex-shrink-0" style={{ height: 56, borderBottom: "1px solid rgba(236,227,213,0.06)" }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(196,123,58,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--accent)" strokeWidth="1.5">
              <path d="M8 1l1.5 4.5L14 8l-4.5 1.5L8 14l-1.5-4.5L2 8l4.5-1.5z" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Alphy - Strategy Builder</div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
              {symbol} · {interval}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-auto p-4" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {messages.length === 0 && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(196,123,58,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="24" height="24" viewBox="0 0 16 16" fill="none" stroke="var(--accent)" strokeWidth="1.5">
                  <path d="M8 1l1.5 4.5L14 8l-4.5 1.5L8 14l-1.5-4.5L2 8l4.5-1.5z" />
                </svg>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>Strategy Builder</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", maxWidth: 280, lineHeight: 1.5 }}>
                  Describe a trading strategy and I&apos;ll generate, backtest, and analyze it for you.
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", maxWidth: 360 }}>
                {[
                  "Create a mean reversion strategy",
                  "Build a momentum crossover system",
                  "Generate a breakout strategy with ATR stops",
                  "Make a PineScript RSI divergence indicator",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => { setInputValue(suggestion); inputRef.current?.focus(); }}
                    style={{
                      fontSize: 11,
                      padding: "6px 12px",
                      borderRadius: 20,
                      background: "rgba(236,227,213,0.04)",
                      border: "1px solid rgba(236,227,213,0.08)",
                      color: "var(--text-secondary)",
                      cursor: "pointer",
                    }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "85%",
                padding: "10px 14px",
                borderRadius: 12,
                background: msg.role === "user" ? "rgba(196,123,58,0.15)" : "rgba(236,227,213,0.04)",
                border: msg.role === "user" ? "1px solid rgba(196,123,58,0.2)" : "1px solid rgba(236,227,213,0.06)",
              }}
            >
              <div style={{ fontSize: 12, color: "var(--text-primary)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                {msg.content}
              </div>
              {msg.pinescriptResult && (
                <div style={{ marginTop: 8, padding: 10, borderRadius: 8, background: "rgba(15,12,8,0.4)", border: "1px solid rgba(236,227,213,0.06)" }}>
                  <div style={{ fontSize: 10, color: "var(--accent)", fontFamily: "var(--font-mono)", marginBottom: 4, fontWeight: 600 }}>PINESCRIPT</div>
                  <pre style={{ fontSize: 10, color: "var(--text-secondary)", fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap", maxHeight: 200, overflow: "auto" }}>
                    {msg.pinescriptResult.code}
                  </pre>
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div style={{ alignSelf: "flex-start", padding: "10px 14px", borderRadius: 12, background: "rgba(236,227,213,0.04)", border: "1px solid rgba(236,227,213,0.06)" }}>
              <div className="flex items-center gap-2">
                <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.5, repeat: Infinity }} style={{ width: 6, height: 6, borderRadius: 3, background: "var(--accent)" }} />
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Alphy is thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(236,227,213,0.06)" }}>
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Describe a strategy to backtest..."
              rows={1}
              style={{
                flex: 1,
                resize: "none",
                background: "rgba(236,227,213,0.04)",
                border: "1px solid rgba(236,227,213,0.08)",
                borderRadius: 10,
                padding: "10px 14px",
                fontSize: 12,
                color: "var(--text-primary)",
                outline: "none",
                fontFamily: "inherit",
              }}
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || isLoading}
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: inputValue.trim() ? "var(--accent)" : "rgba(236,227,213,0.06)",
                border: "none",
                color: inputValue.trim() ? "white" : "var(--text-muted)",
                cursor: inputValue.trim() ? "pointer" : "default",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Right: Results Panel */}
      <div className="flex-1 flex flex-col min-w-0" style={{ background: "var(--bg)" }}>
        {trades.length > 0 ? (
          <TradingPanel trades={trades} metrics={metrics} equityCurve={equityCurve} strategyName={strategyName} />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div style={{ textAlign: "center" }}>
              <div style={{ width: 64, height: 64, borderRadius: 16, background: "rgba(236,227,213,0.04)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>No Backtest Results</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", maxWidth: 280, lineHeight: 1.5 }}>
                Use Alphy to generate and backtest a strategy. Results will appear here.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
