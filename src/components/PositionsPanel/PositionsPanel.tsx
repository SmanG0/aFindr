"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type {
  AccountState,
  ReplayState,
  Position,
  Order,
  ClosedTrade,
} from "@/lib/types";

type Tab = "positions" | "orders" | "history" | "balance";

interface PositionsPanelProps {
  accountState: AccountState;
  onClosePosition: (id: string) => void;
  onCloseAll: () => void;
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
}

const SPEED_OPTIONS = [0.25, 0.5, 1, 2, 5, 10];

// ─── Inline Calendar Picker ───
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
        borderRadius: 12,
        width: 240,
        background: "rgba(33,30,26,0.98)",
        border: "1px solid rgba(236,227,213,0.1)",
        boxShadow: "0 8px 32px rgba(15,12,8,0.6), 0 2px 8px rgba(15,12,8,0.4)",
        backdropFilter: "blur(16px)",
      }}
    >
      {/* Month/Year header */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={prevMonth}
          className="w-6 h-6 flex items-center justify-center rounded-md transition-colors"
          style={{ color: "var(--text-muted)", background: "transparent", border: "none", cursor: "pointer" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(236,227,213,0.06)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <span className="text-[11px] font-semibold font-mono" style={{ color: "var(--text-primary)" }}>
          {monthName} {viewYear}
        </span>
        <button
          onClick={nextMonth}
          className="w-6 h-6 flex items-center justify-center rounded-md transition-colors"
          style={{ color: "var(--text-muted)", background: "transparent", border: "none", cursor: "pointer" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(236,227,213,0.06)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-0.5">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, idx) => (
          <div key={`${d}-${idx}`} className="h-5 flex items-center justify-center text-[8px] font-mono" style={{ color: "var(--text-muted)" }}>{d}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7">
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} className="h-7" />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const selected = isSelected(day);
          const today = isToday(day);
          return (
            <button
              key={day}
              onClick={() => {
                onSelect(new Date(viewYear, viewMonth, day));
                onClose();
              }}
              className="h-7 flex items-center justify-center text-[10px] font-mono rounded transition-all"
              style={{
                color: selected ? "#fff" : today ? "rgba(59,130,246,0.9)" : "var(--text-secondary)",
                background: selected ? "rgba(59,130,246,0.9)" : "transparent",
                fontWeight: selected || today ? 600 : 400,
                border: "none",
                cursor: "pointer",
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

function formatTime(timestamp: number): string {
  // Handle both seconds-based timestamps (backtest data) and milliseconds (Date.now())
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

export default function PositionsPanel({
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
}: PositionsPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>("positions");
  const [showSpeedDropdown, setShowSpeedDropdown] = useState(false);
  const [showSelectDropdown, setShowSelectDropdown] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const speedBtnRef = useRef<HTMLButtonElement>(null);
  const selectBtnRef = useRef<HTMLButtonElement>(null);
  const [calendarPos, setCalendarPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  // Derive current date from current bar for calendar
  const currentTimestamp = candles && candles[Math.min(replayState.currentBarIndex, candles.length - 1)]?.time;
  const currentDate = useMemo(() => currentTimestamp ? new Date(currentTimestamp * 1000) : new Date(), [currentTimestamp]);

  // When "Select date" is chosen, show the calendar
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

  // When user picks a date from calendar, seek to nearest bar
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

  const tabs: { id: Tab; label: string; count?: number }[] = [
    {
      id: "positions",
      label: "Positions",
      count: accountState.positions.length,
    },
    { id: "orders", label: "Orders", count: accountState.orders.length },
    { id: "history", label: "History" },
    { id: "balance", label: "Balance" },
  ];

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!progressBarRef.current) return;
      const rect = progressBarRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pct = Math.max(0, Math.min(1, x / rect.width));
      const index = Math.round(pct * (replayState.totalBars - 1));
      onSeek(index);
    },
    [replayState.totalBars, onSeek]
  );

  const handleSpeedSelect = useCallback(
    (speed: number) => {
      onSpeedChange(speed);
      setShowSpeedDropdown(false);
    },
    [onSpeedChange]
  );

  return (
    <div
      style={{
        background: "var(--bg)",
        borderTop: "0.667px solid rgba(236,227,213,0.15)",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ─── Header Row ─── */}
      <div
        className="flex items-center"
        style={{
          height: 36,
          padding: "0 12px",
          gap: 4,
          background: "rgba(236,227,213,0.03)",
          flexShrink: 0,
        }}
      >
        {/* Left side: Tabs */}
        <div className="flex items-center" style={{ gap: 4 }}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="text-xs"
                style={{
                  padding: "4px 12px",
                  borderRadius: 4,
                  background: isActive
                    ? "rgba(236,227,213,0.08)"
                    : "transparent",
                  color: isActive
                    ? "var(--text-primary)"
                    : "var(--text-muted)",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "var(--font-mono)",
                  transition: "all 100ms ease",
                }}
                onMouseEnter={(e) => {
                  if (!isActive)
                    e.currentTarget.style.color = "var(--text-secondary)";
                }}
                onMouseLeave={(e) => {
                  if (!isActive)
                    e.currentTarget.style.color = "var(--text-muted)";
                }}
              >
                {tab.label}
                {tab.count !== undefined ? ` (${tab.count})` : ""}
              </button>
            );
          })}
        </div>

        {/* Center divider */}
        <div
          style={{
            width: 1,
            height: 20,
            background: "rgba(236,227,213,0.1)",
            marginLeft: 8,
            marginRight: 8,
            flexShrink: 0,
          }}
        />

        {/* Playback controls */}
        <div
          className="flex items-center"
          style={{ gap: 6, flex: 1 }}
        >
          {/* Play / Pause */}
          <button
            onClick={replayState.isPlaying ? onPause : onPlay}
            style={{
              width: 28,
              height: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 6,
              background: replayState.isPlaying
                ? "var(--accent)"
                : "rgba(236,227,213,0.06)",
              color: replayState.isPlaying
                ? "#fff"
                : "var(--text-primary)",
              border: "none",
              cursor: "pointer",
              transition: "all 100ms ease",
            }}
            title={replayState.isPlaying ? "Pause" : "Play"}
          >
            {replayState.isPlaying ? (
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <polygon points="6 3 20 12 6 21 6 3" />
              </svg>
            )}
          </button>

          {/* Step */}
          <button
            onClick={onStep}
            disabled={replayState.isPlaying}
            style={{
              width: 28,
              height: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
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
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <polygon points="4 3 14 12 4 21 4 3" />
              <rect x="16" y="3" width="3" height="18" rx="1" />
            </svg>
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
                transition: "all 100ms ease",
                display: "flex",
                alignItems: "center",
                gap: 4,
                whiteSpace: "nowrap",
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="6" cy="6" r="3" />
                <circle cx="6" cy="18" r="3" />
                <line x1="20" y1="4" x2="8.12" y2="15.88" />
                <line x1="14.47" y1="14.48" x2="20" y2="20" />
                <line x1="8.12" y1="8.12" x2="12" y2="12" />
              </svg>
              {selectMode === "date" ? "Select date" : selectMode === "random" ? "Random" : selectMode === "bar" ? "Select bar" : "Replay"}
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {showSelectDropdown && (
              <div
                style={{
                  position: "absolute",
                  bottom: "calc(100% + 4px)",
                  left: 0,
                  background: "rgba(20,20,20,0.98)",
                  border: "1px solid rgba(236,227,213,0.1)",
                  borderRadius: 8,
                  padding: 4,
                  zIndex: 100,
                  boxShadow: "0 8px 32px rgba(15,12,8,0.6)",
                  backdropFilter: "blur(16px)",
                  minWidth: 140,
                }}
              >
                <button
                  onClick={() => { onSelectModeChange?.("date"); setShowSelectDropdown(false); }}
                  className="text-xs font-mono"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    width: "100%",
                    padding: "6px 10px",
                    borderRadius: 4,
                    background: selectMode === "date" ? "rgba(59,130,246,0.1)" : "transparent",
                    color: selectMode === "date" ? "rgba(59,130,246,0.9)" : "var(--text-secondary)",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 80ms ease",
                  }}
                  onMouseEnter={(e) => { if (selectMode !== "date") e.currentTarget.style.background = "rgba(236,227,213,0.06)"; }}
                  onMouseLeave={(e) => { if (selectMode !== "date") e.currentTarget.style.background = "transparent"; }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  Select date
                </button>
                <button
                  onClick={() => { onRandomDate?.(); onSelectModeChange?.(null); setShowSelectDropdown(false); }}
                  className="text-xs font-mono"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    width: "100%",
                    padding: "6px 10px",
                    borderRadius: 4,
                    background: "transparent",
                    color: "var(--text-secondary)",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 80ms ease",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(236,227,213,0.06)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M2 18L8 12L12 16L22 6" />
                    <polyline points="15 6 22 6 22 13" />
                  </svg>
                  Random date
                </button>
                <button
                  onClick={() => { onSelectModeChange?.(selectMode === "bar" ? null : "bar"); setShowSelectDropdown(false); }}
                  className="text-xs font-mono"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    width: "100%",
                    padding: "6px 10px",
                    borderRadius: 4,
                    background: selectMode === "bar" ? "rgba(59,130,246,0.1)" : "transparent",
                    color: selectMode === "bar" ? "rgba(59,130,246,0.9)" : "var(--text-secondary)",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 80ms ease",
                  }}
                  onMouseEnter={(e) => { if (selectMode !== "bar") e.currentTarget.style.background = "rgba(236,227,213,0.06)"; }}
                  onMouseLeave={(e) => { if (selectMode !== "bar") e.currentTarget.style.background = "transparent"; }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <line x1="12" y1="2" x2="12" y2="22" />
                    <polyline points="8 6 12 2 16 6" />
                    <polyline points="8 18 12 22 16 18" />
                  </svg>
                  Select bar
                </button>
              </div>
            )}
          </div>

          {/* Calendar popup — fixed position portal */}
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
              flex: 1,
              maxWidth: 200,
              height: 4,
              borderRadius: 2,
              background: "rgba(236,227,213,0.06)",
              cursor: "pointer",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                height: "100%",
                width: `${replayState.progress}%`,
                borderRadius: 2,
                background: "var(--accent)",
                transition: "width 100ms ease",
              }}
            />
          </div>

          {/* Speed dropdown */}
          <div style={{ position: "relative" }}>
            <button
              ref={speedBtnRef}
              onClick={() => setShowSpeedDropdown(!showSpeedDropdown)}
              className="text-xs font-mono tabular-nums"
              style={{
                padding: "4px 8px",
                borderRadius: 4,
                background: "rgba(236,227,213,0.04)",
                color: "var(--text-secondary)",
                border: "1px solid rgba(236,227,213,0.06)",
                cursor: "pointer",
                transition: "all 100ms ease",
              }}
            >
              {replayState.speed}X
            </button>
            {showSpeedDropdown && (
              <div
                style={{
                  position: "absolute",
                  bottom: "calc(100% + 4px)",
                  left: 0,
                  background: "rgba(20,20,20,0.98)",
                  border: "1px solid rgba(236,227,213,0.1)",
                  borderRadius: 8,
                  padding: 4,
                  zIndex: 100,
                  boxShadow:
                    "0 8px 32px rgba(15,12,8,0.6)",
                  backdropFilter: "blur(16px)",
                  minWidth: 60,
                }}
              >
                {SPEED_OPTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSpeedSelect(s)}
                    className="text-xs font-mono tabular-nums"
                    style={{
                      display: "block",
                      width: "100%",
                      padding: "4px 10px",
                      borderRadius: 4,
                      background:
                        replayState.speed === s
                          ? "var(--accent-muted)"
                          : "transparent",
                      color:
                        replayState.speed === s
                          ? "var(--accent-bright)"
                          : "var(--text-secondary)",
                      border: "none",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 80ms ease",
                    }}
                    onMouseEnter={(e) => {
                      if (replayState.speed !== s)
                        e.currentTarget.style.background =
                          "rgba(236,227,213,0.06)";
                    }}
                    onMouseLeave={(e) => {
                      if (replayState.speed !== s)
                        e.currentTarget.style.background = "transparent";
                    }}
                  >
                    {s}X
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Far right: Close All */}
        <button
          onClick={onCloseAll}
          className="text-xs font-mono"
          style={{
            padding: "4px 10px",
            borderRadius: 4,
            background: "transparent",
            color: "var(--sell)",
            border: "none",
            cursor: "pointer",
            transition: "all 100ms ease",
            marginLeft: 8,
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(242,54,69,0.1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          Close All
        </button>
      </div>

      {/* ─── Tab Content ─── */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {/* Positions Tab */}
        {activeTab === "positions" && (
          <PositionsTab
            positions={accountState.positions}
            onClosePosition={onClosePosition}
          />
        )}

        {/* Orders Tab */}
        {activeTab === "orders" && (
          <OrdersTab orders={accountState.orders} />
        )}

        {/* History Tab */}
        {activeTab === "history" && (
          <HistoryTab trades={accountState.tradeHistory} />
        )}

        {/* Balance Tab */}
        {activeTab === "balance" && (
          <BalanceTab accountState={accountState} />
        )}
      </div>
    </div>
  );
}

// ─── Positions Tab ───
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
        className="flex items-center justify-center"
        style={{
          height: "100%",
          color: "var(--text-muted)",
          fontSize: 12,
          fontFamily: "var(--font-mono)",
        }}
      >
        No open positions
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
          <th style={{ textAlign: "right" }}>Entry Price</th>
          <th>Created At</th>
          <th style={{ textAlign: "right" }}>Stop Loss</th>
          <th style={{ textAlign: "right" }}>Take Profit</th>
          <th style={{ textAlign: "right" }}>Commission</th>
          <th style={{ textAlign: "right" }}>P/L</th>
          <th style={{ textAlign: "center" }}>Action</th>
        </tr>
      </thead>
      <tbody>
        {positions.map((pos) => (
          <tr key={pos.id}>
            <td style={{ color: "var(--text-primary)", fontWeight: 500 }}>
              {pos.symbol}
            </td>
            <td>
              <span
                className={
                  pos.side === "long" ? "chip chip-buy" : "chip chip-sell"
                }
              >
                {pos.side === "long" ? "LONG" : "SHORT"}
              </span>
            </td>
            <td className="tabular-nums" style={{ textAlign: "right" }}>
              {pos.size}
            </td>
            <td className="tabular-nums" style={{ textAlign: "right" }}>
              {pos.entryPrice.toFixed(2)}
            </td>
            <td className="tabular-nums">{formatTime(pos.entryTime)}</td>
            <td
              className="tabular-nums"
              style={{ textAlign: "right", color: "var(--text-muted)" }}
            >
              {pos.stopLoss !== null ? pos.stopLoss.toFixed(2) : "--"}
            </td>
            <td
              className="tabular-nums"
              style={{ textAlign: "right", color: "var(--text-muted)" }}
            >
              {pos.takeProfit !== null ? pos.takeProfit.toFixed(2) : "--"}
            </td>
            <td
              className="tabular-nums"
              style={{ textAlign: "right", color: "var(--text-muted)" }}
            >
              ${pos.commission.toFixed(2)}
            </td>
            <td
              className="tabular-nums font-semibold"
              style={{
                textAlign: "right",
                color:
                  pos.unrealizedPnl >= 0 ? "var(--buy)" : "var(--sell)",
              }}
            >
              {formatPnl(pos.unrealizedPnl)}
            </td>
            <td style={{ textAlign: "center" }}>
              <button
                onClick={() => onClosePosition(pos.id)}
                style={{
                  width: 22,
                  height: 22,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 4,
                  background: "transparent",
                  color: "var(--sell)",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 100ms ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(242,54,69,0.15)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
                title="Close position"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Orders Tab ───
function OrdersTab({ orders }: { orders: Order[] }) {
  if (orders.length === 0) {
    return (
      <div
        className="flex items-center justify-center"
        style={{
          height: "100%",
          color: "var(--text-muted)",
          fontSize: 12,
          fontFamily: "var(--font-mono)",
        }}
      >
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
          <th style={{ textAlign: "center" }}>Action</th>
        </tr>
      </thead>
      <tbody>
        {orders.map((order) => (
          <tr key={order.id}>
            <td style={{ color: "var(--text-primary)", fontWeight: 500 }}>
              {order.symbol}
            </td>
            <td>
              <span
                className={
                  order.side === "long"
                    ? "chip chip-buy"
                    : "chip chip-sell"
                }
              >
                {order.side === "long" ? "LONG" : "SHORT"}
              </span>
            </td>
            <td className="tabular-nums" style={{ textAlign: "right" }}>
              {order.size}
            </td>
            <td>
              <span
                className="chip chip-neutral"
                style={{ textTransform: "uppercase" }}
              >
                {order.type}
              </span>
            </td>
            <td className="tabular-nums" style={{ textAlign: "right" }}>
              {order.price !== null ? order.price.toFixed(2) : "MKT"}
            </td>
            <td>
              <span
                className="chip chip-neutral"
                style={{ textTransform: "uppercase" }}
              >
                {order.status}
              </span>
            </td>
            <td className="tabular-nums">{formatTime(order.createdAt)}</td>
            <td style={{ textAlign: "center" }}>
              <span
                style={{
                  color: "var(--text-muted)",
                  fontSize: 10,
                  fontFamily: "var(--font-mono)",
                }}
              >
                --
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── History Tab ───
function HistoryTab({ trades }: { trades: ClosedTrade[] }) {
  if (trades.length === 0) {
    return (
      <div
        className="flex items-center justify-center"
        style={{
          height: "100%",
          color: "var(--text-muted)",
          fontSize: 12,
          fontFamily: "var(--font-mono)",
        }}
      >
        No trade history
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
            <td style={{ color: "var(--text-primary)", fontWeight: 500 }}>
              {trade.symbol}
            </td>
            <td>
              <span
                className={
                  trade.side === "long"
                    ? "chip chip-buy"
                    : "chip chip-sell"
                }
              >
                {trade.side === "long" ? "LONG" : "SHORT"}
              </span>
            </td>
            <td className="tabular-nums" style={{ textAlign: "right" }}>
              {trade.size}
            </td>
            <td className="tabular-nums" style={{ textAlign: "right" }}>
              {trade.entryPrice.toFixed(2)}
            </td>
            <td className="tabular-nums" style={{ textAlign: "right" }}>
              {trade.exitPrice.toFixed(2)}
            </td>
            <td
              className="tabular-nums"
              style={{
                textAlign: "right",
                color:
                  trade.pnlPoints >= 0 ? "var(--buy)" : "var(--sell)",
              }}
            >
              {trade.pnlPoints >= 0 ? "+" : ""}
              {trade.pnlPoints.toFixed(2)}
            </td>
            <td
              className="tabular-nums font-semibold"
              style={{
                textAlign: "right",
                color: trade.pnl >= 0 ? "var(--buy)" : "var(--sell)",
              }}
            >
              {formatPnl(trade.pnl)}
            </td>
            <td
              className="tabular-nums"
              style={{ textAlign: "right", color: "var(--text-muted)" }}
            >
              ${trade.commission.toFixed(2)}
            </td>
            <td className="tabular-nums">
              {formatTime(trade.exitTime)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Balance Tab ───
function BalanceTab({ accountState }: { accountState: AccountState }) {
  return (
    <div
      className="flex items-center justify-center"
      style={{
        height: "100%",
        gap: 48,
        fontFamily: "var(--font-mono)",
      }}
    >
      <div className="metric-group" style={{ alignItems: "center" }}>
        <span className="metric-label">Balance</span>
        <span
          className="metric-value tabular-nums"
          style={{ fontSize: 18, fontWeight: 600 }}
        >
          ${accountState.balance.toFixed(2)}
        </span>
      </div>
      <div
        style={{
          width: 1,
          height: 40,
          background: "rgba(236,227,213,0.06)",
        }}
      />
      <div className="metric-group" style={{ alignItems: "center" }}>
        <span className="metric-label">Equity</span>
        <span
          className="metric-value tabular-nums"
          style={{ fontSize: 18, fontWeight: 600 }}
        >
          ${accountState.equity.toFixed(2)}
        </span>
      </div>
      <div
        style={{
          width: 1,
          height: 40,
          background: "rgba(236,227,213,0.06)",
        }}
      />
      <div className="metric-group" style={{ alignItems: "center" }}>
        <span className="metric-label">Unrealized P/L</span>
        <span
          className="metric-value tabular-nums"
          style={{
            fontSize: 18,
            fontWeight: 600,
            color:
              accountState.unrealizedPnl >= 0
                ? "var(--buy)"
                : "var(--sell)",
          }}
        >
          {formatPnl(accountState.unrealizedPnl)}
        </span>
      </div>
    </div>
  );
}
