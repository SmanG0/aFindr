"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type {
  AccountState,
  ReplayState,
  Position,
  Order,
  ClosedTrade,
  BacktestMetrics,
  Trade,
  MonteCarloResult,
  WalkForwardResult,
  TradeAnalysisResult,
} from "@/lib/types";
import OverviewTab from "@/components/StrategyTester/OverviewTab";
import MonteCarloTab from "@/components/StrategyTester/MonteCarloTab";
import WalkForwardTab from "@/components/StrategyTester/WalkForwardTab";
import AnalysisTab from "@/components/StrategyTester/AnalysisTab";
import StrategiesTab from "@/components/StrategyTester/StrategiesTab";
import HeatmapTab from "@/components/StrategyTester/HeatmapTab";
import RunLog from "@/components/RunLog/RunLog";

// ═══════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════
type TopTab = "strategy-report" | "broker" | "trade";
type BrokerSubTab = "positions" | "orders" | "account-summary" | "notifications";
type StrategySubTab = "overview" | "trades" | "montecarlo" | "walkforward" | "analysis" | "heatmap" | "runlog" | "strategies";

// ═══════════════════════════════════════════════
// BROKER DATA (exported for use in BrokerSelectionModal)
// ═══════════════════════════════════════════════
export interface BrokerData {
  id: string;
  name: string;
  shortName: string;
  iconLetters: string;
  color: string;
  rating?: number;
  featured?: boolean;
}

export const BROKER_LIST: BrokerData[] = [
  { id: "paper", name: "Paper Trading", shortName: "Paper", iconLetters: "PT", color: "#6b7280", featured: true },
  { id: "egm", name: "EGM Securities", shortName: "EGM", iconLetters: "EG", color: "#2563eb", rating: 4.5, featured: true },
  { id: "sbg", name: "SBG Securities", shortName: "SBG", iconLetters: "SB", color: "#8b5cf6", rating: 4.4 },
  { id: "genghis", name: "Genghis Capital", shortName: "Genghis", iconLetters: "GC", color: "#c47b3a", rating: 4.3 },
  { id: "faida", name: "Faida Investment Bank", shortName: "Faida", iconLetters: "FI", color: "#16a34a", rating: 4.2 },
  { id: "kcb", name: "KCB Capital", shortName: "KCB", iconLetters: "KC", color: "#06b6d4", rating: 4.4 },
  { id: "equity", name: "Equity Securities", shortName: "Equity", iconLetters: "EQ", color: "#dc2626", rating: 4.3 },
  { id: "abc", name: "ABC Capital", shortName: "ABC", iconLetters: "AB", color: "#f97316", rating: 4.1 },
  { id: "sib", name: "Standard Investment Bank", shortName: "SIB", iconLetters: "SI", color: "#3b82f6", rating: 4.0 },
  { id: "dyer", name: "Dyer & Blair", shortName: "D&B", iconLetters: "DB", color: "#22c55e", rating: 4.1 },
];

function getBrokerAccountId(brokerId: string): string {
  const ids: Record<string, string> = {
    paper: "SIM-001",
    egm: "EGM-2847593",
    sbg: "SBG-7392841",
    genghis: "GC-4829371",
    faida: "FI-9283741",
    kcb: "KCB-3847291",
    equity: "EQ-5728394",
    abc: "ABC-8293741",
    sib: "SIB-4729381",
    dyer: "DB-6382941",
  };
  return ids[brokerId] || "DEMO-001";
}

export function getBrokerDisplayName(brokerId: string): string {
  return BROKER_LIST.find(b => b.id === brokerId)?.name || "Paper Trading";
}

// ═══════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════
const SPEED_OPTIONS = [0.25, 0.5, 1, 2, 5, 10];

// ═══════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════
function formatTime(timestamp: number): string {
  const ms = timestamp > 1e12 ? timestamp : timestamp * 1000;
  const d = new Date(ms);
  return d.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatPnl(value: number): string {
  const prefix = value >= 0 ? "+$" : "-$";
  return `${prefix}${Math.abs(value).toFixed(2)}`;
}

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ═══════════════════════════════════════════════
// BACKTEST CONFIG STRIP (for Trade tab)
// ═══════════════════════════════════════════════
function BacktestConfigStrip() {
  const [balance, setBalance] = useState("25000");
  const [period, setPeriod] = useState("1y");
  const [commission, setCommission] = useState("5.00");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("afindr_backtest_config");
      if (saved) {
        const cfg = JSON.parse(saved);
        if (cfg.balance) setBalance(cfg.balance);
        if (cfg.period) setPeriod(cfg.period);
        if (cfg.commission) setCommission(cfg.commission);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    localStorage.setItem("afindr_backtest_config", JSON.stringify({ balance, period, commission }));
  }, [balance, period, commission]);

  const inputStyle: React.CSSProperties = {
    background: "var(--bg-primary)",
    border: "1px solid var(--divider)",
    borderRadius: 3,
    padding: "2px 6px",
    color: "var(--text-primary)",
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    width: 70,
    textAlign: "right" as const,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 9,
    color: "var(--text-muted)",
    fontFamily: "var(--font-mono)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    width: 52,
    textAlign: "left" as const,
    cursor: "pointer",
    appearance: "none" as const,
    paddingRight: 14,
    backgroundImage: `url("data:image/svg+xml,%3Csvg width='8' height='4' viewBox='0 0 8 4' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0l4 4 4-4' stroke='%239a8c7a' stroke-width='1'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 4px center",
  };

  return (
    <div
      className="flex items-center gap-4"
      style={{
        height: 28,
        padding: "0 12px",
        background: "rgba(236,227,213,0.03)",
        borderBottom: "1px solid var(--divider)",
        flexShrink: 0,
      }}
    >
      <span style={{ ...labelStyle, fontSize: 10, color: "var(--text-secondary)", fontWeight: 600 }}>
        Backtest Config
      </span>
      <div className="flex items-center gap-1.5">
        <span style={labelStyle}>Balance</span>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 4, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>$</span>
          <input
            type="text"
            value={balance}
            onChange={(e) => setBalance(e.target.value.replace(/[^0-9.]/g, ""))}
            style={{ ...inputStyle, paddingLeft: 14, width: 80 }}
          />
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <span style={labelStyle}>Period</span>
        <select value={period} onChange={(e) => setPeriod(e.target.value)} style={selectStyle}>
          <option value="1mo">1M</option>
          <option value="3mo">3M</option>
          <option value="6mo">6M</option>
          <option value="1y">1Y</option>
          <option value="2y">2Y</option>
          <option value="max">Max</option>
        </select>
      </div>
      <div className="flex items-center gap-1.5">
        <span style={labelStyle}>Commission</span>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 4, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>$</span>
          <input
            type="text"
            value={commission}
            onChange={(e) => setCommission(e.target.value.replace(/[^0-9.]/g, ""))}
            style={{ ...inputStyle, paddingLeft: 14, width: 55 }}
          />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// CALENDAR PICKER (for Trade tab replay)
// ═══════════════════════════════════════════════
function CalendarPicker({
  selectedDate,
  onSelect,
  onClose,
}: {
  selectedDate: Date;
  onSelect: (date: Date) => void;
  onClose: () => void;
}) {
  const [viewYear, setViewYear] = useState(selectedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(selectedDate.getMonth());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
  const monthName = new Date(viewYear, viewMonth).toLocaleString("en-US", { month: "short" });

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  const isSelected = (day: number) =>
    selectedDate.getFullYear() === viewYear &&
    selectedDate.getMonth() === viewMonth &&
    selectedDate.getDate() === day;

  const isToday = (day: number) => {
    const now = new Date();
    return now.getFullYear() === viewYear && now.getMonth() === viewMonth && now.getDate() === day;
  };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 6, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.96 }}
      transition={{ duration: 0.12 }}
      className="z-50 p-2.5"
      style={{
        borderRadius: 12, width: 240,
        background: "rgba(33,30,26,0.98)",
        border: "1px solid rgba(236,227,213,0.1)",
        boxShadow: "0 8px 32px rgba(15,12,8,0.6), 0 2px 8px rgba(15,12,8,0.4)",
        backdropFilter: "blur(16px)",
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <button onClick={prevMonth} className="w-6 h-6 flex items-center justify-center rounded-md" style={{ color: "var(--text-muted)", background: "transparent", border: "none", cursor: "pointer" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <span className="text-[11px] font-semibold font-mono" style={{ color: "var(--text-primary)" }}>{monthName} {viewYear}</span>
        <button onClick={nextMonth} className="w-6 h-6 flex items-center justify-center rounded-md" style={{ color: "var(--text-muted)", background: "transparent", border: "none", cursor: "pointer" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
        </button>
      </div>
      <div className="grid grid-cols-7 mb-0.5">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, idx) => (
          <div key={`${d}-${idx}`} className="h-5 flex items-center justify-center text-[8px] font-mono" style={{ color: "var(--text-muted)" }}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (<div key={`empty-${i}`} className="h-7" />))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const selected = isSelected(day);
          const today = isToday(day);
          return (
            <button
              key={day}
              onClick={() => { onSelect(new Date(viewYear, viewMonth, day)); onClose(); }}
              className="h-7 flex items-center justify-center text-[10px] font-mono rounded transition-all"
              style={{
                color: selected ? "#fff" : today ? "rgba(59,130,246,0.9)" : "var(--text-secondary)",
                background: selected ? "rgba(59,130,246,0.9)" : "transparent",
                fontWeight: selected || today ? 600 : 400,
                border: "none", cursor: "pointer",
              }}
              onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = "rgba(236,227,213,0.06)"; }}
              onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = "transparent"; }}
            >
              {day}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════
// PROPS
// ═══════════════════════════════════════════════
interface PositionsPanelProps {
  // Panel layout
  isExpanded: boolean;
  onToggle: () => void;
  expandedHeight: number;
  onDragStart: (e: React.MouseEvent) => void;

  // Broker
  activeBrokerId: string;
  onShowBrokerSelector: () => void;

  // Trading
  accountState: AccountState;
  onClosePosition: (id: string) => void;
  onCloseAll: () => void;

  // Replay (shown in Trade tab)
  replayState: ReplayState;
  onPlay: () => void;
  onPause: () => void;
  onStep: () => void;
  onReset: () => void;
  onSpeedChange: (speed: number) => void;
  onSeek: (index: number) => void;
  candles: { time: number }[];
  selectMode?: "date" | "random" | "bar" | null;
  onSelectModeChange?: (mode: "date" | "random" | "bar" | null) => void;
  onRandomDate?: () => void;

  // Strategy Tester
  backtestMetrics?: BacktestMetrics | null;
  backtestTrades?: Trade[];
  equityCurve?: { time: number; value: number }[];
  strategyName?: string;
  monteCarloResult?: MonteCarloResult | null;
  walkForwardResult?: WalkForwardResult | null;
  tradeAnalysisResult?: TradeAnalysisResult | null;
  showStrategyTester?: boolean;
  onToggleStrategyTester?: () => void;
  onLoadStrategy?: (data: Record<string, unknown>) => void;
  onSetBalance?: (balance: number) => void;
  onResetAccount?: () => void;
  onLogoutTrading?: () => void;
}

// ═══════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════
export default function PositionsPanel({
  isExpanded,
  onToggle,
  expandedHeight,
  onDragStart,
  activeBrokerId,
  onShowBrokerSelector,
  accountState,
  onClosePosition,
  onCloseAll,
  replayState,
  onPlay,
  onPause,
  onStep,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onReset,
  onSpeedChange,
  onSeek,
  candles,
  selectMode,
  onSelectModeChange,
  onRandomDate,
  backtestMetrics,
  backtestTrades,
  equityCurve,
  strategyName,
  monteCarloResult,
  walkForwardResult,
  tradeAnalysisResult,
  showStrategyTester,
  onToggleStrategyTester,
  onLoadStrategy,
  onSetBalance,
  onResetAccount,
  onLogoutTrading,
}: PositionsPanelProps) {
  // ─── State ───
  const [topTab, setTopTab] = useState<TopTab>("broker");
  const [brokerSubTab, setBrokerSubTab] = useState<BrokerSubTab>("positions");
  const [strategySubTab, setStrategySubTab] = useState<StrategySubTab>("overview");
  const [isMaximized, setIsMaximized] = useState(false);

  // Replay controls state (for Trade tab)
  const [showSpeedDropdown, setShowSpeedDropdown] = useState(false);
  const [showSelectDropdown, setShowSelectDropdown] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const speedBtnRef = useRef<HTMLButtonElement>(null);
  const selectBtnRef = useRef<HTMLButtonElement>(null);
  const [calendarPos, setCalendarPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  // Derived values
  const broker = BROKER_LIST.find(b => b.id === activeBrokerId) || BROKER_LIST[0];
  const brokerAccountId = getBrokerAccountId(activeBrokerId);

  const currentTimestamp = candles && candles[Math.min(replayState.currentBarIndex, candles.length - 1)]?.time;
  const currentDate = useMemo(() => currentTimestamp ? new Date(currentTimestamp * 1000) : new Date(), [currentTimestamp]);

  const dateRange = useMemo(() => {
    if (!equityCurve || equityCurve.length < 2) return null;
    const start = new Date(equityCurve[0].time * 1000);
    const end = new Date(equityCurve[equityCurve.length - 1].time * 1000);
    const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    return `${fmt(start)} \u2014 ${fmt(end)}`;
  }, [equityCurve]);

  // Auto-switch to strategy-report when backtest results arrive
  useEffect(() => {
    if (showStrategyTester) {
      setTopTab("strategy-report");
    }
  }, [showStrategyTester]);

  // Calendar popup positioning
  useEffect(() => {
    if (selectMode === "date") {
      if (selectBtnRef.current) {
        const rect = selectBtnRef.current.getBoundingClientRect();
        setCalendarPos({ top: rect.top - 8, left: rect.left });
      }
      setShowCalendar(true);
    } else {
      setShowCalendar(false);
    }
  }, [selectMode]);

  // ─── Handlers ───
  const handleTopTabClick = useCallback((tab: TopTab) => {
    if (tab === topTab && isExpanded) {
      onToggle(); // collapse
    } else {
      if (!isExpanded) onToggle(); // expand
      setTopTab(tab);
    }
  }, [topTab, isExpanded, onToggle]);

  const handleDateSelect = useCallback((date: Date) => {
    if (!candles || candles.length === 0) return;
    const targetTimestamp = Math.floor(date.getTime() / 1000);
    let closest = 0;
    let minDiff = Infinity;
    for (let i = 0; i < candles.length; i++) {
      const diff = Math.abs(candles[i].time - targetTimestamp);
      if (diff < minDiff) { minDiff = diff; closest = i; }
    }
    onSeek(closest);
    onSelectModeChange?.(null);
  }, [candles, onSeek, onSelectModeChange]);

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    const index = Math.round(pct * (replayState.totalBars - 1));
    onSeek(index);
  }, [replayState.totalBars, onSeek]);

  const handleSpeedSelect = useCallback((speed: number) => {
    onSpeedChange(speed);
    setShowSpeedDropdown(false);
  }, [onSpeedChange]);

  const contentHeight = isMaximized ? "100%" : expandedHeight - 32;

  // ─── Render ───
  return (
    <div style={{
      flexShrink: 0,
      background: "var(--bg)",
      ...(isMaximized ? {
        position: "fixed" as const,
        top: 44,
        left: 52,
        right: 0,
        bottom: 0,
        zIndex: 500,
        display: "flex",
        flexDirection: "column" as const,
      } : {}),
    }}>
      {/* ═══ TAB STRIP (always visible, 32px) ═══ */}
      <div
        className="flex items-center"
        style={{
          height: 32,
          padding: "0 8px",
          background: "rgba(236,227,213,0.025)",
          borderTop: "1px solid rgba(236,227,213,0.12)",
          position: "relative",
          userSelect: "none",
        }}
      >
        {/* Drag zone — top 3px of the tab strip */}
        {isExpanded && (
          <div
            onMouseDown={onDragStart}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 3,
              cursor: "row-resize",
              zIndex: 2,
            }}
          />
        )}

        {/* Left: Top-level tabs */}
        <div className="flex items-center" style={{ gap: 2 }}>
          {/* Strategy Report tab */}
          <button
            onClick={() => handleTopTabClick("strategy-report")}
            className="flex items-center"
            style={{
              gap: 5,
              padding: "0 10px",
              height: 32,
              background: "transparent",
              borderTop: "none", borderRight: "none", borderLeft: "none",
              borderBottom: topTab === "strategy-report" && isExpanded ? "2px solid var(--accent)" : "2px solid transparent",
              cursor: "pointer",
              transition: "all 100ms ease",
              color: topTab === "strategy-report" && isExpanded ? "var(--text-primary)" : "var(--text-muted)",
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              fontWeight: topTab === "strategy-report" && isExpanded ? 600 : 400,
            }}
            onMouseEnter={(e) => { if (!(topTab === "strategy-report" && isExpanded)) e.currentTarget.style.color = "var(--text-secondary)"; }}
            onMouseLeave={(e) => { if (!(topTab === "strategy-report" && isExpanded)) e.currentTarget.style.color = "var(--text-muted)"; }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
            Strategy Report
            <span style={{
              fontSize: 7, fontWeight: 800, fontFamily: "var(--font-mono)",
              padding: "1px 4px", borderRadius: 3,
              background: "linear-gradient(135deg, rgba(196,123,58,0.2), rgba(212,175,55,0.2))",
              color: "#d4af37", letterSpacing: "0.06em", lineHeight: 1.3,
              border: "1px solid rgba(212,175,55,0.15)",
            }}>
              PRO
            </span>
          </button>

          {/* Broker tab */}
          <button
            onClick={() => handleTopTabClick("broker")}
            className="flex items-center"
            style={{
              gap: 5,
              padding: "0 10px",
              height: 32,
              background: "transparent",
              borderTop: "none", borderRight: "none", borderLeft: "none",
              borderBottom: topTab === "broker" && isExpanded ? "2px solid #2563eb" : "2px solid transparent",
              cursor: "pointer",
              transition: "all 100ms ease",
              color: topTab === "broker" && isExpanded ? "var(--text-primary)" : "var(--text-muted)",
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              fontWeight: topTab === "broker" && isExpanded ? 600 : 400,
            }}
            onMouseEnter={(e) => { if (!(topTab === "broker" && isExpanded)) e.currentTarget.style.color = "var(--text-secondary)"; }}
            onMouseLeave={(e) => { if (!(topTab === "broker" && isExpanded)) e.currentTarget.style.color = "var(--text-muted)"; }}
          >
            {/* Broker color dot */}
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: broker.color, flexShrink: 0 }} />
            {broker.name}
          </button>

          {/* Trade tab */}
          <button
            onClick={() => handleTopTabClick("trade")}
            style={{
              padding: "0 10px",
              height: 32,
              background: "transparent",
              borderTop: "none", borderRight: "none", borderLeft: "none",
              borderBottom: topTab === "trade" && isExpanded ? "2px solid var(--accent)" : "2px solid transparent",
              cursor: "pointer",
              transition: "all 100ms ease",
              color: topTab === "trade" && isExpanded ? "var(--text-primary)" : "var(--text-muted)",
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              fontWeight: topTab === "trade" && isExpanded ? 600 : 400,
            }}
            onMouseEnter={(e) => { if (!(topTab === "trade" && isExpanded)) e.currentTarget.style.color = "var(--text-secondary)"; }}
            onMouseLeave={(e) => { if (!(topTab === "trade" && isExpanded)) e.currentTarget.style.color = "var(--text-muted)"; }}
          >
            Trade
          </button>
        </div>

        {/* Right: expand/collapse + maximize */}
        <div className="flex items-center" style={{ marginLeft: "auto", gap: 4 }}>
          {/* Expand/Collapse chevron */}
          <button
            onClick={onToggle}
            style={{
              width: 22, height: 22,
              display: "flex", alignItems: "center", justifyContent: "center",
              borderRadius: 4,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
              transition: "all 100ms ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(236,227,213,0.08)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-muted)"; }}
            title={isExpanded ? "Collapse panel" : "Expand panel"}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              {isExpanded ? <polyline points="6 9 12 15 18 9" /> : <polyline points="6 15 12 9 18 15" />}
            </svg>
          </button>

          {/* Maximize toggle */}
          <button
            onClick={() => {
              const willMaximize = !isMaximized;
              setIsMaximized(willMaximize);
              if (willMaximize && !isExpanded) onToggle(); // auto-expand when maximizing
            }}
            style={{
              width: 22, height: 22,
              display: "flex", alignItems: "center", justifyContent: "center",
              borderRadius: 4,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
              transition: "all 100ms ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(236,227,213,0.08)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-muted)"; }}
            title={isMaximized ? "Restore panel size" : "Maximize panel"}
          >
            {isMaximized ? (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="4 14 10 14 10 20" />
                <polyline points="20 10 14 10 14 4" />
                <line x1="14" y1="10" x2="21" y2="3" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* ═══ EXPANDED CONTENT ═══ */}
      {isExpanded && (
        <div
          style={{
            ...(isMaximized ? { flex: 1 } : { height: contentHeight }),
            display: "flex",
            flexDirection: "column",
            borderTop: "1px solid rgba(236,227,213,0.08)",
            overflow: "hidden",
          }}
        >
          {/* ─── STRATEGY REPORT TAB ─── */}
          {topTab === "strategy-report" && (
            <>
              {/* Strategy Info Row */}
              <div
                className="flex items-center justify-between"
                style={{
                  height: 32,
                  padding: "0 12px",
                  background: "rgba(236,227,213,0.02)",
                  borderBottom: "1px solid var(--divider)",
                  flexShrink: 0,
                }}
              >
                <button
                  className="flex items-center"
                  style={{
                    gap: 4,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text-primary)",
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                    fontWeight: 600,
                  }}
                  onClick={onToggleStrategyTester}
                >
                  {strategyName || "No strategy loaded"}
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {dateRange && (
                  <span
                    className="flex items-center"
                    style={{ gap: 4, fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    {dateRange}
                  </span>
                )}
              </div>

              {/* Strategy Sub-tabs */}
              <div
                className="flex items-center"
                style={{
                  height: 28,
                  padding: "0 12px",
                  gap: 2,
                  background: "rgba(236,227,213,0.015)",
                  borderBottom: "1px solid var(--divider)",
                  flexShrink: 0,
                }}
              >
                {([
                  { id: "overview" as const, label: "Metrics", premium: false },
                  { id: "trades" as const, label: `List of trades${backtestTrades?.length ? ` (${backtestTrades.length})` : ""}`, premium: false },
                  { id: "montecarlo" as const, label: "Monte Carlo", premium: true },
                  { id: "walkforward" as const, label: "Walk-Forward", premium: true },
                  { id: "analysis" as const, label: "Analysis", premium: true },
                  { id: "heatmap" as const, label: "Heatmap", premium: true },
                  { id: "runlog" as const, label: "Run Log", premium: false },
                  { id: "strategies" as const, label: "Strategies", premium: false },
                ]).map((tab) => {
                  const isActive = strategySubTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setStrategySubTab(tab.id)}
                      style={{
                        padding: "3px 10px",
                        height: 28,
                        background: "transparent",
                        borderTop: "none", borderRight: "none", borderLeft: "none",
                        borderBottom: isActive ? "2px solid var(--accent)" : "2px solid transparent",
                        cursor: "pointer",
                        color: isActive ? "var(--text-primary)" : "var(--text-muted)",
                        fontSize: 11,
                        fontFamily: "var(--font-mono)",
                        transition: "all 100ms ease",
                        display: "flex", alignItems: "center", gap: 4,
                      }}
                      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = "var(--text-secondary)"; }}
                      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = isActive ? "var(--text-primary)" : "var(--text-muted)"; }}
                    >
                      {tab.label}
                      {tab.premium && (
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="#d4af37" style={{ flexShrink: 0, opacity: 0.65 }}>
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Strategy Content */}
              <div style={{ flex: 1, overflow: "auto" }}>
                {strategySubTab === "overview" && <OverviewTab metrics={backtestMetrics ?? null} equityCurve={equityCurve ?? []} strategyName={strategyName ?? ""} />}
                {strategySubTab === "trades" && <TradesTab trades={backtestTrades ?? []} />}
                {strategySubTab === "montecarlo" && <MonteCarloTab result={monteCarloResult ?? null} />}
                {strategySubTab === "walkforward" && <WalkForwardTab result={walkForwardResult ?? null} />}
                {strategySubTab === "analysis" && <AnalysisTab result={tradeAnalysisResult ?? null} />}
                {strategySubTab === "heatmap" && <HeatmapTab data={{ xParam: "", yParam: "", xValues: [], yValues: [], metric: "", cells: [] }} />}
                {strategySubTab === "runlog" && <RunLog iterations={[]} />}
                {strategySubTab === "strategies" && <StrategiesTab onLoadStrategy={onLoadStrategy ?? (() => {})} />}
              </div>
            </>
          )}

          {/* ─── BROKER TAB ─── */}
          {topTab === "broker" && (
            <>
              {/* Broker Info Row */}
              <div
                className="flex items-center justify-between"
                style={{
                  height: 36,
                  padding: "0 12px",
                  background: "rgba(236,227,213,0.02)",
                  borderBottom: "1px solid var(--divider)",
                  flexShrink: 0,
                }}
              >
                {/* Left: broker name + account ID */}
                <div className="flex items-center" style={{ gap: 12 }}>
                  <button
                    className="flex items-center"
                    onClick={onShowBrokerSelector}
                    style={{
                      gap: 4,
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--text-primary)",
                      fontSize: 11,
                      fontFamily: "var(--font-mono)",
                      fontWeight: 600,
                    }}
                  >
                    {broker.name}
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                  <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                    {brokerAccountId} USD
                  </span>
                </div>

                {/* Right: Account metrics */}
                <div className="flex items-center" style={{ gap: 20 }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.03em" }}>Account Balance</div>
                    <div className="tabular-nums" style={{ fontSize: 12, color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontWeight: 600 }}>{formatMoney(accountState.balance)}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.03em" }}>Equity</div>
                    <div className="tabular-nums" style={{ fontSize: 12, color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontWeight: 600 }}>{formatMoney(accountState.equity)}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.03em" }}>Profit</div>
                    <div className="tabular-nums" style={{ fontSize: 12, color: accountState.unrealizedPnl >= 0 ? "var(--buy)" : "var(--sell)", fontFamily: "var(--font-mono)", fontWeight: 600 }}>{formatMoney(accountState.unrealizedPnl)}</div>
                  </div>
                  {/* Close All */}
                  {accountState.positions.length > 0 && (
                    <button
                      onClick={onCloseAll}
                      className="text-xs font-mono"
                      style={{
                        padding: "3px 8px",
                        borderRadius: 4,
                        background: "transparent",
                        color: "var(--sell)",
                        border: "1px solid rgba(242,54,69,0.2)",
                        cursor: "pointer",
                        fontSize: 10,
                        transition: "all 100ms ease",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(242,54,69,0.1)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      Close All
                    </button>
                  )}
                </div>
              </div>

              {/* Broker Sub-tabs */}
              <div
                className="flex items-center"
                style={{
                  height: 28,
                  padding: "0 12px",
                  gap: 2,
                  background: "rgba(236,227,213,0.015)",
                  borderBottom: "1px solid var(--divider)",
                  flexShrink: 0,
                }}
              >
                {([
                  { id: "positions" as const, label: "Positions", count: accountState.positions.length },
                  { id: "orders" as const, label: "Orders", count: accountState.orders.length },
                  { id: "account-summary" as const, label: "Account Summary" },
                  { id: "notifications" as const, label: "Notifications log" },
                ] as const).map((tab) => {
                  const isActive = brokerSubTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setBrokerSubTab(tab.id)}
                      style={{
                        padding: "3px 10px",
                        height: 28,
                        background: "transparent",
                        borderTop: "none", borderRight: "none", borderLeft: "none",
                        borderBottom: isActive ? "2px solid #2563eb" : "2px solid transparent",
                        cursor: "pointer",
                        color: isActive ? "var(--text-primary)" : "var(--text-muted)",
                        fontSize: 11,
                        fontFamily: "var(--font-mono)",
                        transition: "all 100ms ease",
                      }}
                      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = "var(--text-secondary)"; }}
                      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = isActive ? "var(--text-primary)" : "var(--text-muted)"; }}
                    >
                      {tab.label}{"count" in tab && tab.count !== undefined ? ` (${tab.count})` : ""}
                    </button>
                  );
                })}

                {/* Column settings icon (far right) */}
                <div style={{ marginLeft: "auto" }}>
                  <button
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--text-muted)",
                      display: "flex",
                      alignItems: "center",
                      padding: 4,
                    }}
                    title="Column settings"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="4" y1="6" x2="20" y2="6" />
                      <line x1="4" y1="12" x2="20" y2="12" />
                      <line x1="4" y1="18" x2="20" y2="18" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Broker Content */}
              <div style={{ flex: 1, overflow: "auto" }}>
                {brokerSubTab === "positions" && <PositionsTab positions={accountState.positions} onClosePosition={onClosePosition} />}
                {brokerSubTab === "orders" && <OrdersTab orders={accountState.orders} />}
                {brokerSubTab === "account-summary" && <AccountSummaryTab accountState={accountState} tradeHistory={accountState.tradeHistory} isPaper={activeBrokerId === "paper"} onSetBalance={onSetBalance} onResetAccount={onResetAccount} onLogoutTrading={onLogoutTrading} />}
                {brokerSubTab === "notifications" && <NotificationsTab />}
              </div>
            </>
          )}

          {/* ─── TRADE TAB ─── */}
          {topTab === "trade" && (
            <>
              <BacktestConfigStrip />

              {/* Playback Controls Row */}
              <div
                className="flex items-center"
                style={{
                  height: 36,
                  padding: "0 12px",
                  gap: 6,
                  background: "rgba(236,227,213,0.02)",
                  borderBottom: "1px solid var(--divider)",
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.04em", marginRight: 8 }}>
                  Replay
                </span>

                {/* Play / Pause */}
                <button
                  onClick={replayState.isPlaying ? onPause : onPlay}
                  style={{
                    width: 28, height: 28,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    borderRadius: 6,
                    background: replayState.isPlaying ? "var(--accent)" : "rgba(236,227,213,0.06)",
                    color: replayState.isPlaying ? "#fff" : "var(--text-primary)",
                    border: "none", cursor: "pointer",
                    transition: "all 100ms ease",
                  }}
                  title={replayState.isPlaying ? "Pause" : "Play"}
                >
                  {replayState.isPlaying ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3" /></svg>
                  )}
                </button>

                {/* Step */}
                <button
                  onClick={onStep}
                  disabled={replayState.isPlaying}
                  style={{
                    width: 28, height: 28,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    borderRadius: 6,
                    background: "rgba(236,227,213,0.04)",
                    color: "var(--text-secondary)",
                    border: "none",
                    cursor: replayState.isPlaying ? "default" : "pointer",
                    opacity: replayState.isPlaying ? 0.3 : 1,
                    transition: "all 100ms ease",
                  }}
                  title="Step forward"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="4 3 14 12 4 21 4 3" /><rect x="16" y="3" width="3" height="18" rx="1" /></svg>
                </button>

                {/* Select bar dropdown */}
                <div style={{ position: "relative" }}>
                  <button
                    ref={selectBtnRef}
                    onClick={() => setShowSelectDropdown(!showSelectDropdown)}
                    className="text-xs font-mono"
                    style={{
                      padding: "4px 8px",
                      borderRadius: 4,
                      background: selectMode ? "rgba(59, 130, 246, 0.1)" : "rgba(236,227,213,0.04)",
                      color: selectMode ? "rgba(59, 130, 246, 0.9)" : "var(--text-secondary)",
                      border: selectMode ? "1px solid rgba(59, 130, 246, 0.3)" : "1px solid rgba(236,227,213,0.06)",
                      cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 4,
                      whiteSpace: "nowrap",
                      transition: "all 100ms ease",
                    }}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" />
                      <line x1="20" y1="4" x2="8.12" y2="15.88" /><line x1="14.47" y1="14.48" x2="20" y2="20" />
                      <line x1="8.12" y1="8.12" x2="12" y2="12" />
                    </svg>
                    {selectMode === "date" ? "Select date" : selectMode === "random" ? "Random" : selectMode === "bar" ? "Select bar" : "Replay"}
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
                  </button>
                  {showSelectDropdown && (
                    <div style={{
                      position: "absolute", bottom: "calc(100% + 4px)", left: 0,
                      background: "rgba(20,20,20,0.98)", border: "1px solid rgba(236,227,213,0.1)",
                      borderRadius: 8, padding: 4, zIndex: 100,
                      boxShadow: "0 8px 32px rgba(15,12,8,0.6)", backdropFilter: "blur(16px)",
                      minWidth: 140,
                    }}>
                      {[
                        { mode: "date" as const, label: "Select date", icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg> },
                        { mode: "random" as const, label: "Random date", icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 18L8 12L12 16L22 6" /><polyline points="15 6 22 6 22 13" /></svg>, isAction: true },
                        { mode: "bar" as const, label: "Select bar", icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="12" y1="2" x2="12" y2="22" /><polyline points="8 6 12 2 16 6" /><polyline points="8 18 12 22 16 18" /></svg> },
                      ].map(({ mode, label, icon, isAction }) => (
                        <button
                          key={mode}
                          onClick={() => {
                            if (isAction) { onRandomDate?.(); onSelectModeChange?.(null); }
                            else { onSelectModeChange?.(selectMode === mode ? null : mode); }
                            setShowSelectDropdown(false);
                          }}
                          className="text-xs font-mono"
                          style={{
                            display: "flex", alignItems: "center", gap: 8,
                            width: "100%", padding: "6px 10px", borderRadius: 4,
                            background: selectMode === mode ? "rgba(59,130,246,0.1)" : "transparent",
                            color: selectMode === mode ? "rgba(59,130,246,0.9)" : "var(--text-secondary)",
                            border: "none", cursor: "pointer", textAlign: "left",
                            transition: "all 80ms ease",
                          }}
                          onMouseEnter={(e) => { if (selectMode !== mode) e.currentTarget.style.background = "rgba(236,227,213,0.06)"; }}
                          onMouseLeave={(e) => { if (selectMode !== mode) e.currentTarget.style.background = "transparent"; }}
                        >
                          {icon}
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Calendar popup */}
                <AnimatePresence>
                  {showCalendar && (
                    <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 9999, pointerEvents: "none" }}>
                      <div style={{ position: "absolute", bottom: `calc(100vh - ${calendarPos.top}px)`, left: calendarPos.left, pointerEvents: "auto" }}>
                        <CalendarPicker
                          selectedDate={currentDate}
                          onSelect={handleDateSelect}
                          onClose={() => { setShowCalendar(false); onSelectModeChange?.(null); }}
                        />
                      </div>
                    </div>
                  )}
                </AnimatePresence>

                {/* Progress bar */}
                <div
                  ref={progressBarRef}
                  onClick={handleProgressClick}
                  style={{
                    flex: 1, maxWidth: 200, height: 4, borderRadius: 2,
                    background: "rgba(236,227,213,0.06)",
                    cursor: "pointer", position: "relative", overflow: "hidden",
                  }}
                >
                  <div style={{
                    position: "absolute", left: 0, top: 0, height: "100%",
                    width: `${replayState.progress}%`, borderRadius: 2,
                    background: "var(--accent)", transition: "width 100ms ease",
                  }} />
                </div>

                {/* Speed dropdown */}
                <div style={{ position: "relative" }}>
                  <button
                    ref={speedBtnRef}
                    onClick={() => setShowSpeedDropdown(!showSpeedDropdown)}
                    className="text-xs font-mono tabular-nums"
                    style={{
                      padding: "4px 8px", borderRadius: 4,
                      background: "rgba(236,227,213,0.04)", color: "var(--text-secondary)",
                      border: "1px solid rgba(236,227,213,0.06)", cursor: "pointer",
                      transition: "all 100ms ease",
                    }}
                  >
                    {replayState.speed}X
                  </button>
                  {showSpeedDropdown && (
                    <div style={{
                      position: "absolute", bottom: "calc(100% + 4px)", left: 0,
                      background: "rgba(20,20,20,0.98)", border: "1px solid rgba(236,227,213,0.1)",
                      borderRadius: 8, padding: 4, zIndex: 100,
                      boxShadow: "0 8px 32px rgba(15,12,8,0.6)", backdropFilter: "blur(16px)",
                      minWidth: 60,
                    }}>
                      {SPEED_OPTIONS.map((s) => (
                        <button
                          key={s}
                          onClick={() => handleSpeedSelect(s)}
                          className="text-xs font-mono tabular-nums"
                          style={{
                            display: "block", width: "100%", padding: "4px 10px", borderRadius: 4,
                            background: replayState.speed === s ? "var(--accent-muted)" : "transparent",
                            color: replayState.speed === s ? "var(--accent-bright)" : "var(--text-secondary)",
                            border: "none", cursor: "pointer", textAlign: "left",
                            transition: "all 80ms ease",
                          }}
                          onMouseEnter={(e) => { if (replayState.speed !== s) e.currentTarget.style.background = "rgba(236,227,213,0.06)"; }}
                          onMouseLeave={(e) => { if (replayState.speed !== s) e.currentTarget.style.background = "transparent"; }}
                        >
                          {s}X
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Trade History */}
              <div style={{ flex: 1, overflow: "auto" }}>
                <HistoryTab trades={accountState.tradeHistory} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// POSITIONS TAB (updated columns to match TradingView)
// ═══════════════════════════════════════════════
function PositionsTab({
  positions,
  onClosePosition,
}: {
  positions: Position[];
  onClosePosition: (id: string) => void;
}) {
  if (positions.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center"
        style={{
          height: "100%",
          color: "var(--text-muted)",
          fontSize: 12,
          fontFamily: "var(--font-mono)",
          gap: 4,
        }}
      >
        <span>There are no open positions in your trading</span>
        <span>account yet</span>
      </div>
    );
  }

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Symbol</th>
          <th>Side</th>
          <th style={{ textAlign: "right" }}>Qty</th>
          <th style={{ textAlign: "right" }}>Avg Fill Price</th>
          <th style={{ textAlign: "right" }}>Profit</th>
          <th>Update Time</th>
          <th style={{ textAlign: "center" }}>Action</th>
        </tr>
      </thead>
      <tbody>
        {positions.map((pos) => (
          <tr key={pos.id}>
            <td style={{ color: "var(--text-primary)", fontWeight: 500 }}>{pos.symbol}</td>
            <td>
              <span className={pos.side === "long" ? "chip chip-buy" : "chip chip-sell"}>
                {pos.side === "long" ? "LONG" : "SHORT"}
              </span>
            </td>
            <td className="tabular-nums" style={{ textAlign: "right" }}>{pos.size}</td>
            <td className="tabular-nums" style={{ textAlign: "right" }}>{pos.entryPrice.toFixed(2)}</td>
            <td
              className="tabular-nums font-semibold"
              style={{
                textAlign: "right",
                color: pos.unrealizedPnl >= 0 ? "var(--buy)" : "var(--sell)",
              }}
            >
              {formatPnl(pos.unrealizedPnl)}
            </td>
            <td className="tabular-nums">{formatTime(pos.entryTime)}</td>
            <td style={{ textAlign: "center" }}>
              <button
                onClick={() => onClosePosition(pos.id)}
                style={{
                  width: 22, height: 22,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  borderRadius: 4, background: "transparent", color: "var(--sell)",
                  border: "none", cursor: "pointer", transition: "all 100ms ease",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(242,54,69,0.15)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                title="Close position"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ═══════════════════════════════════════════════
// ORDERS TAB
// ═══════════════════════════════════════════════
function OrdersTab({ orders }: { orders: Order[] }) {
  if (orders.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height: "100%", color: "var(--text-muted)", fontSize: 12, fontFamily: "var(--font-mono)" }}>
        No pending orders
      </div>
    );
  }

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Instrument</th>
          <th>Side</th>
          <th style={{ textAlign: "right" }}>Size</th>
          <th>Type</th>
          <th style={{ textAlign: "right" }}>Price</th>
          <th>Status</th>
          <th>Created At</th>
        </tr>
      </thead>
      <tbody>
        {orders.map((order) => (
          <tr key={order.id}>
            <td style={{ color: "var(--text-primary)", fontWeight: 500 }}>{order.symbol}</td>
            <td>
              <span className={order.side === "long" ? "chip chip-buy" : "chip chip-sell"}>
                {order.side === "long" ? "LONG" : "SHORT"}
              </span>
            </td>
            <td className="tabular-nums" style={{ textAlign: "right" }}>{order.size}</td>
            <td><span className="chip chip-neutral" style={{ textTransform: "uppercase" }}>{order.type}</span></td>
            <td className="tabular-nums" style={{ textAlign: "right" }}>{order.price !== null ? order.price.toFixed(2) : "MKT"}</td>
            <td><span className="chip chip-neutral" style={{ textTransform: "uppercase" }}>{order.status}</span></td>
            <td className="tabular-nums">{formatTime(order.createdAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ═══════════════════════════════════════════════
// ACCOUNT SUMMARY TAB (enhanced from BalanceTab)
// ═══════════════════════════════════════════════
function AccountSummaryTab({ accountState, tradeHistory, isPaper, onSetBalance, onResetAccount, onLogoutTrading }: {
  accountState: AccountState;
  tradeHistory: ClosedTrade[];
  isPaper?: boolean;
  onSetBalance?: (balance: number) => void;
  onResetAccount?: () => void;
  onLogoutTrading?: () => void;
}) {
  const [editingBalance, setEditingBalance] = useState(false);
  const [balanceInput, setBalanceInput] = useState("");
  const totalPnl = tradeHistory.reduce((sum, t) => sum + t.pnl, 0);
  const totalCommissions = tradeHistory.reduce((sum, t) => sum + t.commission, 0);

  const handleSetBalance = () => {
    const val = parseFloat(balanceInput);
    if (val > 0 && onSetBalance) {
      onSetBalance(val);
      setEditingBalance(false);
    }
  };

  const presets = [10000, 25000, 50000, 100000];

  // ─── Inactive state: show "Start Paper Trading" card ───
  if (!accountState.isActive && isPaper && onSetBalance) {
    return (
      <div style={{ padding: "24px 20px", fontFamily: "var(--font-mono)" }}>
        <div style={{
          padding: "20px 24px", borderRadius: 10,
          background: "rgba(236,227,213,0.03)", border: "1px solid rgba(236,227,213,0.1)",
          maxWidth: 480,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
            Start Paper Trading
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.5 }}>
            Choose a starting balance to activate your paper trading account.
          </div>

          <div className="flex items-center gap-2" style={{ flexWrap: "wrap" }}>
            {presets.map((p) => (
              <button
                key={p}
                onClick={() => onSetBalance(p)}
                style={{
                  padding: "6px 14px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                  background: "rgba(236,227,213,0.06)",
                  color: "var(--text-secondary)",
                  border: "1px solid rgba(236,227,213,0.1)", cursor: "pointer",
                  fontFamily: "var(--font-mono)", transition: "all 100ms ease",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(236,227,213,0.12)"; e.currentTarget.style.color = "var(--text-primary)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(236,227,213,0.06)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
              >
                ${(p / 1000).toFixed(0)}k
              </button>
            ))}
          </div>

          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "var(--text-muted)" }}>$</span>
              <input
                type="text"
                value={balanceInput}
                onChange={(e) => setBalanceInput(e.target.value.replace(/[^0-9.]/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && handleSetBalance()}
                placeholder="Custom"
                style={{
                  background: "var(--bg-primary)", border: "1px solid var(--divider)",
                  borderRadius: 6, padding: "6px 10px 6px 18px", color: "var(--text-primary)",
                  fontFamily: "var(--font-mono)", fontSize: 11, width: 110, textAlign: "right",
                }}
              />
            </div>
            <button
              onClick={handleSetBalance}
              style={{
                padding: "6px 14px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                background: "var(--buy)", color: "#000", border: "none", cursor: "pointer",
                fontFamily: "var(--font-mono)",
              }}
            >
              Start
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "16px 20px", fontFamily: "var(--font-mono)" }}>
      {/* Paper trading balance setter */}
      {isPaper && onSetBalance && (
        <div style={{
          marginBottom: 16, padding: "10px 14px", borderRadius: 8,
          background: "rgba(236,227,213,0.04)", border: "1px solid rgba(236,227,213,0.08)",
        }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)" }}>Paper Trading Balance</span>
            {!editingBalance && (
              <button
                onClick={() => { setBalanceInput(String(Math.round(accountState.balance))); setEditingBalance(true); }}
                style={{
                  padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600,
                  background: "var(--accent-muted)", color: "var(--accent-bright)",
                  border: "none", cursor: "pointer", fontFamily: "var(--font-mono)",
                }}
              >
                Change
              </button>
            )}
          </div>
          {editingBalance ? (
            <div className="flex items-center gap-2" style={{ flexWrap: "wrap" }}>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 6, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "var(--text-muted)" }}>$</span>
                <input
                  type="text"
                  value={balanceInput}
                  onChange={(e) => setBalanceInput(e.target.value.replace(/[^0-9.]/g, ""))}
                  onKeyDown={(e) => e.key === "Enter" && handleSetBalance()}
                  autoFocus
                  style={{
                    background: "var(--bg-primary)", border: "1px solid var(--divider)",
                    borderRadius: 4, padding: "4px 8px 4px 16px", color: "var(--text-primary)",
                    fontFamily: "var(--font-mono)", fontSize: 12, width: 110, textAlign: "right",
                  }}
                />
              </div>
              {presets.map((p) => (
                <button
                  key={p}
                  onClick={() => { onSetBalance(p); setEditingBalance(false); }}
                  style={{
                    padding: "3px 8px", borderRadius: 4, fontSize: 10, fontWeight: 500,
                    background: Math.round(accountState.balance) === p ? "var(--accent-muted)" : "rgba(236,227,213,0.06)",
                    color: Math.round(accountState.balance) === p ? "var(--accent-bright)" : "var(--text-muted)",
                    border: "1px solid rgba(236,227,213,0.08)", cursor: "pointer", fontFamily: "var(--font-mono)",
                  }}
                >
                  ${(p / 1000).toFixed(0)}k
                </button>
              ))}
              <button
                onClick={handleSetBalance}
                style={{
                  padding: "3px 10px", borderRadius: 4, fontSize: 10, fontWeight: 600,
                  background: "var(--buy)", color: "#000", border: "none", cursor: "pointer",
                  fontFamily: "var(--font-mono)",
                }}
              >
                Set
              </button>
              <button
                onClick={() => setEditingBalance(false)}
                style={{
                  padding: "3px 8px", borderRadius: 4, fontSize: 10, fontWeight: 500,
                  background: "transparent", color: "var(--text-muted)", border: "1px solid var(--divider)",
                  cursor: "pointer", fontFamily: "var(--font-mono)",
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="tabular-nums" style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
              ${formatMoney(accountState.balance)}
            </div>
          )}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, maxWidth: 600 }}>
        <div>
          <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Account Balance</div>
          <div className="tabular-nums" style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>${formatMoney(accountState.balance)}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Equity</div>
          <div className="tabular-nums" style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>${formatMoney(accountState.equity)}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Unrealized P&L</div>
          <div className="tabular-nums" style={{ fontSize: 16, fontWeight: 600, color: accountState.unrealizedPnl >= 0 ? "var(--buy)" : "var(--sell)" }}>
            {formatPnl(accountState.unrealizedPnl)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Realized P&L</div>
          <div className="tabular-nums" style={{ fontSize: 14, fontWeight: 600, color: totalPnl >= 0 ? "var(--buy)" : "var(--sell)" }}>
            {formatPnl(totalPnl)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Total Commissions</div>
          <div className="tabular-nums" style={{ fontSize: 14, fontWeight: 600, color: "var(--text-muted)" }}>
            ${formatMoney(totalCommissions)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Open Positions</div>
          <div className="tabular-nums" style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
            {accountState.positions.length}
          </div>
        </div>
      </div>

      {/* Reset & Logout actions */}
      {isPaper && (onResetAccount || onLogoutTrading) && (
        <div className="flex items-center gap-2" style={{ marginTop: 20 }}>
          {onResetAccount && (
            <button
              onClick={onResetAccount}
              style={{
                padding: "5px 12px", borderRadius: 6, fontSize: 10, fontWeight: 600,
                background: "rgba(236,227,213,0.06)", color: "var(--text-secondary)",
                border: "1px solid rgba(236,227,213,0.1)", cursor: "pointer",
                fontFamily: "var(--font-mono)", transition: "all 100ms ease",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(236,227,213,0.12)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(236,227,213,0.06)"; }}
            >
              Reset Account
            </button>
          )}
          {onLogoutTrading && (
            <button
              onClick={onLogoutTrading}
              style={{
                padding: "5px 12px", borderRadius: 6, fontSize: 10, fontWeight: 600,
                background: "rgba(239,68,68,0.08)", color: "var(--sell)",
                border: "1px solid rgba(239,68,68,0.15)", cursor: "pointer",
                fontFamily: "var(--font-mono)", transition: "all 100ms ease",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.15)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
            >
              Logout
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// NOTIFICATIONS TAB (empty state)
// ═══════════════════════════════════════════════
function NotificationsTab() {
  return (
    <div className="flex items-center justify-center" style={{ height: "100%", color: "var(--text-muted)", fontSize: 12, fontFamily: "var(--font-mono)" }}>
      No notifications
    </div>
  );
}

// ═══════════════════════════════════════════════
// HISTORY TAB
// ═══════════════════════════════════════════════
function HistoryTab({ trades }: { trades: ClosedTrade[] }) {
  const exportCSV = () => {
    const header = "Symbol,Side,Size,Entry Price,Exit Price,PnL Points,PnL $,Commission,Entry Time,Exit Time\n";
    const rows = trades.map(t =>
      `${t.symbol},${t.side},${t.size},${t.entryPrice.toFixed(2)},${t.exitPrice.toFixed(2)},${t.pnlPoints.toFixed(2)},${t.pnl.toFixed(2)},${t.commission.toFixed(2)},${new Date(t.entryTime).toISOString()},${new Date(t.exitTime).toISOString()}`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `trades_${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (trades.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height: "100%", color: "var(--text-muted)", fontSize: 12, fontFamily: "var(--font-mono)" }}>
        No trade history
      </div>
    );
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "4px 8px", borderBottom: "1px solid var(--divider)" }}>
        <button
          onClick={exportCSV}
          className="text-xs"
          style={{
            padding: "3px 10px", borderRadius: 4,
            background: "rgba(236,227,213,0.08)", color: "var(--text-secondary)",
            border: "1px solid var(--divider)", cursor: "pointer",
            fontFamily: "var(--font-mono)", fontSize: 10,
          }}
        >
          Export CSV
        </button>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Instrument</th>
            <th>Side</th>
            <th style={{ textAlign: "right" }}>Size</th>
            <th style={{ textAlign: "right" }}>Entry</th>
            <th style={{ textAlign: "right" }}>Exit</th>
            <th style={{ textAlign: "right" }}>P&L (pts)</th>
            <th style={{ textAlign: "right" }}>P&L ($)</th>
            <th style={{ textAlign: "right" }}>Commission</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((trade) => (
            <tr key={trade.id}>
              <td style={{ color: "var(--text-primary)", fontWeight: 500 }}>{trade.symbol}</td>
              <td>
                <span className={trade.side === "long" ? "chip chip-buy" : "chip chip-sell"}>
                  {trade.side === "long" ? "LONG" : "SHORT"}
                </span>
              </td>
              <td className="tabular-nums" style={{ textAlign: "right" }}>{trade.size}</td>
              <td className="tabular-nums" style={{ textAlign: "right" }}>{trade.entryPrice.toFixed(2)}</td>
              <td className="tabular-nums" style={{ textAlign: "right" }}>{trade.exitPrice.toFixed(2)}</td>
              <td className="tabular-nums" style={{ textAlign: "right", color: trade.pnlPoints >= 0 ? "var(--buy)" : "var(--sell)" }}>
                {trade.pnlPoints >= 0 ? "+" : ""}{trade.pnlPoints.toFixed(2)}
              </td>
              <td className="tabular-nums font-semibold" style={{ textAlign: "right", color: trade.pnl >= 0 ? "var(--buy)" : "var(--sell)" }}>
                {formatPnl(trade.pnl)}
              </td>
              <td className="tabular-nums" style={{ textAlign: "right", color: "var(--text-muted)" }}>${trade.commission.toFixed(2)}</td>
              <td className="tabular-nums">{formatTime(trade.exitTime)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════
// BACKTEST TRADES TAB
// ═══════════════════════════════════════════════
function TradesTab({ trades }: { trades: Trade[] }) {
  const exportCSV = () => {
    const header = "ID,Instrument,Side,Size,Entry Price,Exit Price,PnL Points,PnL $,Commission\n";
    const rows = trades.map(t =>
      `${t.id},${t.instrument},${t.side},${t.size},${t.entryPrice.toFixed(2)},${t.exitPrice.toFixed(2)},${t.pnlPoints.toFixed(2)},${t.pnl.toFixed(2)},${t.commission.toFixed(2)}`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `backtest_trades_${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(trades, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `backtest_trades_${new Date().toISOString().slice(0,10)}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  if (trades.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height: "100%", color: "var(--text-muted)", fontSize: 12, fontFamily: "var(--font-mono)" }}>
        No backtest trades
      </div>
    );
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "4px 8px", gap: 6, borderBottom: "1px solid var(--divider)" }}>
        <button onClick={exportCSV} className="text-xs" style={{ padding: "3px 10px", borderRadius: 4, background: "rgba(236,227,213,0.08)", color: "var(--text-secondary)", border: "1px solid var(--divider)", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 10 }}>Export CSV</button>
        <button onClick={exportJSON} className="text-xs" style={{ padding: "3px 10px", borderRadius: 4, background: "rgba(236,227,213,0.08)", color: "var(--text-secondary)", border: "1px solid var(--divider)", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 10 }}>Export JSON</button>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Instrument</th>
            <th>Side</th>
            <th style={{ textAlign: "right" }}>Size</th>
            <th style={{ textAlign: "right" }}>Entry</th>
            <th style={{ textAlign: "right" }}>Exit</th>
            <th style={{ textAlign: "right" }}>P&L (pts)</th>
            <th style={{ textAlign: "right" }}>P&L ($)</th>
            <th style={{ textAlign: "right" }}>Commission</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((trade) => (
            <tr key={trade.id}>
              <td className="tabular-nums" style={{ color: "var(--text-muted)" }}>{trade.id}</td>
              <td style={{ color: "var(--text-primary)", fontWeight: 500 }}>{trade.instrument}</td>
              <td><span className={trade.side === "long" ? "chip chip-buy" : "chip chip-sell"}>{trade.side === "long" ? "LONG" : "SHORT"}</span></td>
              <td className="tabular-nums" style={{ textAlign: "right" }}>{trade.size}</td>
              <td className="tabular-nums" style={{ textAlign: "right" }}>{trade.entryPrice.toFixed(2)}</td>
              <td className="tabular-nums" style={{ textAlign: "right" }}>{trade.exitPrice.toFixed(2)}</td>
              <td className="tabular-nums" style={{ textAlign: "right", color: trade.pnlPoints >= 0 ? "var(--buy)" : "var(--sell)" }}>{trade.pnlPoints >= 0 ? "+" : ""}{trade.pnlPoints.toFixed(2)}</td>
              <td className="tabular-nums font-semibold" style={{ textAlign: "right", color: trade.pnl >= 0 ? "var(--buy)" : "var(--sell)" }}>{trade.pnl >= 0 ? "+$" : "-$"}{Math.abs(trade.pnl).toFixed(2)}</td>
              <td className="tabular-nums" style={{ textAlign: "right", color: "var(--text-muted)" }}>${trade.commission.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
