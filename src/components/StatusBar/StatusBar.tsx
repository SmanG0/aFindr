"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";

interface StatusBarProps {
  symbol: string;
  interval: string;
  candleCount: number;
  isConnected?: boolean;
  brokerName?: string;
  brokerConnected?: boolean;
  onOpenBrokerPanel?: () => void;
}

export default function StatusBar({
  symbol, interval, candleCount, isConnected = true,
  brokerName = "Paper Trading", brokerConnected = false, onOpenBrokerPanel,
}: StatusBarProps) {
  const [time, setTime] = useState("");
  const [latency, setLatency] = useState(3);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    updateTime();
    setLatency(Math.floor(Math.random() * 8) + 2);
    const timer = globalThis.setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.5 }}
      className="flex items-center h-6 px-3 gap-4 flex-shrink-0 select-none"
      style={{
        background: "var(--bg)",
        borderTop: "1px solid var(--divider)",
        fontSize: 10,
        fontFamily: "var(--font-mono)",
        color: "var(--text-muted)",
      }}
    >
      {/* Connection status */}
      <div className="flex items-center gap-1.5">
        <div
          className="w-1.5 h-1.5 rounded-full"
          style={{
            background: isConnected ? "var(--buy)" : "var(--sell)",
            boxShadow: isConnected ? "0 0 4px rgba(34,197,94,0.4)" : "0 0 4px rgba(239,68,68,0.4)",
          }}
        />
        <span>{isConnected ? "Connected" : "Disconnected"}</span>
      </div>

      {/* Latency */}
      <span>{latency}ms</span>

      {/* Data info */}
      <span>{symbol} · {interval} · {candleCount.toLocaleString()} bars</span>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Broker toggle button */}
      {onOpenBrokerPanel && (
        <button
          onClick={onOpenBrokerPanel}
          className="flex items-center gap-1.5"
          style={{
            background: "none",
            border: "none",
            padding: "1px 6px",
            borderRadius: 4,
            cursor: "pointer",
            color: brokerConnected ? "var(--buy)" : "var(--text-muted)",
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            transition: "background 100ms ease",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(236,227,213,0.06)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
        >
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: brokerConnected ? "var(--buy)" : "var(--text-disabled)",
              boxShadow: brokerConnected ? "0 0 4px rgba(34,197,94,0.4)" : "none",
            }}
          />
          <span>{brokerName}</span>
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="6 15 12 9 18 15" />
          </svg>
        </button>
      )}

      {/* Divider */}
      {onOpenBrokerPanel && <div className="w-px h-3" style={{ background: "var(--divider)" }} />}

      {/* Data provider badge */}
      <span style={{ color: "var(--text-disabled)" }}>
        Databento
      </span>

      {/* Divider */}
      <div className="w-px h-3" style={{ background: "var(--divider)" }} />

      {/* Clock */}
      <span className="tabular-nums">{time}</span>

      {/* Divider */}
      <div className="w-px h-3" style={{ background: "var(--divider)" }} />

      {/* Brand */}
      <span style={{ color: "var(--text-disabled)", letterSpacing: "0.08em" }}>
        αFindr
      </span>
    </motion.div>
  );
}
