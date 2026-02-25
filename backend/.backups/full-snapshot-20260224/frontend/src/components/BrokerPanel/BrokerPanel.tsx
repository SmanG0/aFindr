"use client";

import { useState, useRef, useEffect } from "react";

export interface BrokerInfo {
  id: string;
  name: string;
  shortName: string;
  connected: boolean;
}

const BROKERS: BrokerInfo[] = [
  { id: "paper", name: "Paper Trading", shortName: "Paper", connected: true },
  { id: "egm", name: "EGM Securities", shortName: "EGM", connected: false },
  { id: "dyer-blair", name: "Dyer & Blair", shortName: "D&B", connected: false },
  { id: "faida", name: "Faida Investment", shortName: "Faida", connected: false },
  { id: "genghis", name: "Genghis Capital", shortName: "Genghis", connected: false },
  { id: "sbg", name: "SBG Securities", shortName: "SBG", connected: false },
];

interface BrokerStripProps {
  isExpanded: boolean;
  onToggle: () => void;
  activeBrokerId: string;
  onSelectBroker: (id: string) => void;
  theme?: "dark" | "light";
}

export default function BrokerStrip({
  isExpanded,
  onToggle,
  activeBrokerId,
  onSelectBroker,
}: BrokerStripProps) {
  const [loginDropdownId, setLoginDropdownId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeBroker = BROKERS.find(b => b.id === activeBrokerId) || BROKERS[0];

  useEffect(() => {
    if (!loginDropdownId) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setLoginDropdownId(null);
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [loginDropdownId]);

  // Minimized state — single bar
  if (!isExpanded) {
    return (
      <div
        onClick={onToggle}
        className="flex items-center"
        style={{
          height: 28,
          padding: "0 12px",
          gap: 8,
          background: "rgba(236,227,213,0.02)",
          borderTop: "0.667px solid rgba(236,227,213,0.08)",
          cursor: "pointer",
          flexShrink: 0,
          transition: "background 100ms ease",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(236,227,213,0.04)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(236,227,213,0.02)"; }}
      >
        {/* Status dot */}
        <div style={{
          width: 6, height: 6, borderRadius: "50%",
          background: activeBroker.connected ? "var(--buy)" : "var(--text-muted)",
        }} />
        <span style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
          {activeBroker.name}
        </span>
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" style={{ marginLeft: "auto" }}>
          <polyline points="6 15 12 9 18 15" />
        </svg>
      </div>
    );
  }

  // Expanded state — broker tiles
  return (
    <div
      style={{
        height: 80,
        padding: "8px 12px",
        background: "rgba(236,227,213,0.02)",
        borderTop: "0.667px solid rgba(236,227,213,0.08)",
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Broker Connection
        </span>
        <button
          onClick={onToggle}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex", alignItems: "center" }}
        >
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      {/* Broker tiles */}
      <div className="flex items-center" style={{ gap: 8, overflow: "auto" }}>
        {BROKERS.map((broker) => {
          const isActive = activeBrokerId === broker.id;
          return (
            <div
              key={broker.id}
              style={{ position: "relative" }}
            >
              <button
                onClick={() => {
                  if (isActive) return;
                  if (broker.id === "paper") {
                    onSelectBroker(broker.id);
                  } else {
                    setLoginDropdownId(loginDropdownId === broker.id ? null : broker.id);
                  }
                }}
                className="flex items-center"
                style={{
                  gap: 8,
                  padding: "6px 12px",
                  borderRadius: 8,
                  background: isActive ? "rgba(236,227,213,0.08)" : "rgba(236,227,213,0.03)",
                  border: isActive ? "1px solid var(--accent)" : "1px solid rgba(236,227,213,0.06)",
                  cursor: isActive ? "default" : "pointer",
                  transition: "all 100ms ease",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "rgba(236,227,213,0.06)"; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = isActive ? "rgba(236,227,213,0.08)" : "rgba(236,227,213,0.03)"; }}
              >
                {/* Icon circle */}
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: isActive ? "var(--accent-muted)" : "rgba(236,227,213,0.06)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700, color: isActive ? "var(--accent-bright)" : "var(--text-muted)",
                  fontFamily: "var(--font-mono)",
                }}>
                  {broker.shortName.slice(0, 2).toUpperCase()}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  <span style={{ fontSize: 11, fontWeight: 500, color: isActive ? "var(--text-primary)" : "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                    {broker.shortName}
                  </span>
                  <span style={{ fontSize: 9, color: isActive ? "var(--buy)" : "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                    {isActive ? "Connected" : "Disconnected"}
                  </span>
                </div>
              </button>

              {/* Login dropdown */}
              {loginDropdownId === broker.id && (
                <div
                  ref={dropdownRef}
                  style={{
                    position: "absolute",
                    bottom: "calc(100% + 4px)",
                    left: 0,
                    background: "rgba(20,20,20,0.98)",
                    border: "1px solid rgba(236,227,213,0.1)",
                    borderRadius: 8,
                    padding: 8,
                    zIndex: 100,
                    boxShadow: "0 8px 32px rgba(15,12,8,0.6)",
                    backdropFilter: "blur(16px)",
                    minWidth: 160,
                  }}
                >
                  <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", padding: "4px 8px", textTransform: "uppercase" }}>
                    Connect to {broker.name}
                  </div>
                  <button
                    onClick={() => {
                      onSelectBroker(broker.id);
                      setLoginDropdownId(null);
                    }}
                    className="text-xs font-mono"
                    style={{
                      display: "block", width: "100%", padding: "6px 8px", borderRadius: 4,
                      background: "transparent", color: "var(--accent-bright)", border: "none",
                      cursor: "pointer", textAlign: "left", transition: "all 80ms ease",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(236,227,213,0.06)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    Connect (Demo)
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
