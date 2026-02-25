"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ReplayState } from "@/lib/types";

interface ReplayControlsProps {
  replayState: ReplayState;
  onPlay: () => void;
  onPause: () => void;
  onStep: () => void;
  onReset: () => void;
  onSpeedChange: (speed: number) => void;
  onSeek: (barIndex: number) => void;
  candles?: { time: number }[];
}

// -1 = real-time (plays at actual tick/bar timestamps)
const SPEEDS = [
  { value: -1, label: "RT" },
  { value: 1, label: "1x" },
  { value: 2, label: "2x" },
  { value: 3, label: "3x" },
  { value: 5, label: "5x" },
  { value: 10, label: "10x" },
];

// ─── Calendar Picker Component ───
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

  const isSelected = (day: number) => {
    return selectedDate.getFullYear() === viewYear &&
           selectedDate.getMonth() === viewMonth &&
           selectedDate.getDate() === day;
  };

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
        position: "fixed",
        borderRadius: "var(--radius-lg)",
        width: 240,
        background: "rgba(20, 22, 30, 0.98)",
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.3)",
        backdropFilter: "blur(16px)",
      }}
    >
      {/* Month/Year header */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={prevMonth}
          className="w-6 h-6 flex items-center justify-center rounded-md transition-colors"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
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
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
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

      {/* Day grid — compact */}
      <div className="grid grid-cols-7">
        {/* Empty cells for offset */}
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} className="h-7" />
        ))}
        {/* Day cells */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const selected = isSelected(day);
          const today = isToday(day);
          return (
            <button
              key={day}
              onClick={() => {
                const newDate = new Date(viewYear, viewMonth, day);
                onSelect(newDate);
                onClose();
              }}
              className="h-7 flex items-center justify-center text-[10px] font-mono rounded transition-all"
              style={{
                color: selected ? "#fff" : today ? "var(--accent-bright)" : "var(--text-secondary)",
                background: selected ? "var(--accent)" : "transparent",
                fontWeight: selected || today ? 600 : 400,
              }}
              onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
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

// ─── Time Tumbler Component ───
function TimeTumbler({
  hour,
  minute,
  onHourChange,
  onMinuteChange,
}: {
  hour: number;
  minute: number;
  onHourChange: (h: number) => void;
  onMinuteChange: (m: number) => void;
}) {
  const scrollHour = (delta: number) => {
    const next = (hour + delta + 24) % 24;
    onHourChange(next);
  };
  const scrollMinute = (delta: number) => {
    const next = (minute + delta + 60) % 60;
    onMinuteChange(next);
  };

  return (
    <div className="flex items-center gap-1">
      {/* Hour tumbler */}
      <div className="flex flex-col items-center">
        <button onClick={() => scrollHour(1)} className="toolbar-btn" style={{ padding: 2 }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="2 7 5 3 8 7" /></svg>
        </button>
        <div
          className="w-8 h-7 flex items-center justify-center text-sm font-mono font-semibold tabular-nums rounded"
          style={{ background: "rgba(255,255,255,0.04)", color: "var(--text-primary)", border: "1px solid var(--divider)" }}
          onWheel={(e) => scrollHour(e.deltaY < 0 ? 1 : -1)}
        >
          {String(hour).padStart(2, "0")}
        </div>
        <button onClick={() => scrollHour(-1)} className="toolbar-btn" style={{ padding: 2 }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="2 3 5 7 8 3" /></svg>
        </button>
      </div>

      <span className="text-sm font-mono font-bold" style={{ color: "var(--text-muted)" }}>:</span>

      {/* Minute tumbler */}
      <div className="flex flex-col items-center">
        <button onClick={() => scrollMinute(5)} className="toolbar-btn" style={{ padding: 2 }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="2 7 5 3 8 7" /></svg>
        </button>
        <div
          className="w-8 h-7 flex items-center justify-center text-sm font-mono font-semibold tabular-nums rounded"
          style={{ background: "rgba(255,255,255,0.04)", color: "var(--text-primary)", border: "1px solid var(--divider)" }}
          onWheel={(e) => scrollMinute(e.deltaY < 0 ? 5 : -5)}
        >
          {String(minute).padStart(2, "0")}
        </div>
        <button onClick={() => scrollMinute(-5)} className="toolbar-btn" style={{ padding: 2 }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="2 3 5 7 8 3" /></svg>
        </button>
      </div>
    </div>
  );
}

// ─── Main ReplayControls ───
export default function ReplayControls({
  replayState,
  onPlay,
  onPause,
  onStep,
  onReset,
  onSpeedChange,
  onSeek,
  candles,
}: ReplayControlsProps) {
  const { isPlaying, currentBarIndex, totalBars, speed, tickMode, currentTickIndex, totalTicks } = replayState;
  const currentIdx = tickMode ? currentTickIndex : currentBarIndex;
  const totalIdx = tickMode ? totalTicks : totalBars;
  const progress = totalIdx > 0 ? (currentIdx / totalIdx) * 100 : 0;

  const [showCalendar, setShowCalendar] = useState(false);
  const calendarBtnRef = useRef<HTMLButtonElement>(null);
  const [calendarPos, setCalendarPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  // Derive current date/time from current bar
  const currentTimestamp = candles && candles[Math.min(currentBarIndex, candles.length - 1)]?.time;
  const currentDate = useMemo(() => currentTimestamp ? new Date(currentTimestamp * 1000) : new Date(), [currentTimestamp]);

  const [selectedHour, setSelectedHour] = useState(currentDate.getUTCHours());
  const [selectedMinute, setSelectedMinute] = useState(currentDate.getUTCMinutes());

  // Update time display when bar changes
  useEffect(() => {
    if (currentTimestamp) {
      const d = new Date(currentTimestamp * 1000);
      setSelectedHour(d.getUTCHours());
      setSelectedMinute(d.getUTCMinutes());
    }
  }, [currentTimestamp]);

  // When user picks a date from calendar, seek to nearest bar
  const handleDateSelect = useCallback((date: Date) => {
    if (!candles || candles.length === 0) return;
    const targetTimestamp = Math.floor(date.getTime() / 1000);
    // Find nearest bar
    let closest = 0;
    let minDiff = Infinity;
    for (let i = 0; i < candles.length; i++) {
      const diff = Math.abs(candles[i].time - targetTimestamp);
      if (diff < minDiff) { minDiff = diff; closest = i; }
    }
    onSeek(closest);
  }, [candles, onSeek]);

  // When user changes time via tumbler, seek to nearest bar
  const handleTimeChange = useCallback((h: number, m: number) => {
    if (!candles || candles.length === 0) return;
    const baseDate = new Date(currentDate);
    baseDate.setUTCHours(h, m, 0, 0);
    const targetTimestamp = Math.floor(baseDate.getTime() / 1000);
    let closest = 0;
    let minDiff = Infinity;
    for (let i = 0; i < candles.length; i++) {
      const diff = Math.abs(candles[i].time - targetTimestamp);
      if (diff < minDiff) { minDiff = diff; closest = i; }
    }
    onSeek(closest);
  }, [candles, currentDate, onSeek]);

  const formattedDate = currentDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

  // formattedTime used in time display (tumbler shows it directly)

  return (
    <motion.div
      initial={{ y: 10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.2 }}
      className="glass flex items-center gap-4 px-4 py-2.5 mx-3 mb-1 rounded-xl"
    >
      {/* ═══ BIG Play/Pause Button ═══ */}
      <motion.button
        onClick={isPlaying ? onPause : onPlay}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        className="flex items-center justify-center rounded-xl transition-all"
        style={{
          width: 44,
          height: 44,
          background: isPlaying
            ? "linear-gradient(135deg, var(--accent), var(--accent-bright))"
            : "rgba(255,255,255,0.06)",
          color: isPlaying ? "#fff" : "var(--text-primary)",
          boxShadow: isPlaying
            ? "0 4px 20px rgba(99,102,241,0.4), inset 0 1px 0 rgba(255,255,255,0.2)"
            : "inset 0 1px 0 rgba(255,255,255,0.04)",
          border: isPlaying ? "none" : "1px solid rgba(255,255,255,0.08)",
        }}
        title={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1.5" />
            <rect x="14" y="4" width="4" height="16" rx="1.5" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="6 3 20 12 6 21 6 3" />
          </svg>
        )}
      </motion.button>

      {/* ═══ Step + Reset ═══ */}
      <div className="flex flex-col gap-1">
        <motion.button
          onClick={onStep}
          disabled={isPlaying}
          whileHover={!isPlaying ? { scale: 1.08 } : {}}
          whileTap={!isPlaying ? { scale: 0.92 } : {}}
          className="flex items-center justify-center rounded-lg transition-all"
          style={{
            width: 32,
            height: 20,
            background: "rgba(255,255,255,0.04)",
            color: "var(--text-secondary)",
            opacity: isPlaying ? 0.3 : 1,
            border: "1px solid rgba(255,255,255,0.06)",
          }}
          title="Step forward"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 15 12 5 21 5 3" />
            <rect x="17" y="3" width="3" height="18" rx="1" />
          </svg>
        </motion.button>
        <motion.button
          onClick={onReset}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          className="flex items-center justify-center rounded-lg transition-all"
          style={{
            width: 32,
            height: 20,
            background: "rgba(255,255,255,0.04)",
            color: "var(--text-muted)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
          title="Reset"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
        </motion.button>
      </div>

      {/* Divider */}
      <div className="w-px h-10" style={{ background: "var(--glass-border)" }} />

      {/* ═══ Date & Time Selector ═══ */}
      <div className="flex items-center gap-3">
        {/* Calendar date button */}
        <button
          ref={calendarBtnRef}
          onClick={() => {
            if (!showCalendar && calendarBtnRef.current) {
              const rect = calendarBtnRef.current.getBoundingClientRect();
              setCalendarPos({ top: rect.top - 8, left: rect.left });
            }
            setShowCalendar(!showCalendar);
          }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all"
          style={{
            background: showCalendar ? "rgba(99,102,241,0.1)" : "rgba(255,255,255,0.04)",
            border: "1px solid",
            borderColor: showCalendar ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.06)",
            color: "var(--text-primary)",
          }}
          onMouseEnter={(e) => { if (!showCalendar) e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
          onMouseLeave={(e) => { if (!showCalendar) e.currentTarget.style.background = showCalendar ? "rgba(99,102,241,0.1)" : "rgba(255,255,255,0.04)"; }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: "var(--text-muted)" }}>
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span className="text-xs font-mono font-medium tabular-nums">{formattedDate}</span>
        </button>

        {/* Calendar popup — fixed position portal */}
        <AnimatePresence>
          {showCalendar && (
            <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 9999, pointerEvents: "none" }}>
              <div style={{ position: "absolute", bottom: `calc(100vh - ${calendarPos.top}px)`, left: calendarPos.left, pointerEvents: "auto" }}>
                <CalendarPicker
                  selectedDate={currentDate}
                  onSelect={handleDateSelect}
                  onClose={() => setShowCalendar(false)}
                />
              </div>
            </div>
          )}
        </AnimatePresence>

        {/* Time tumbler */}
        <TimeTumbler
          hour={selectedHour}
          minute={selectedMinute}
          onHourChange={(h) => { setSelectedHour(h); handleTimeChange(h, selectedMinute); }}
          onMinuteChange={(m) => { setSelectedMinute(m); handleTimeChange(selectedHour, m); }}
        />
      </div>

      {/* Divider */}
      <div className="w-px h-10" style={{ background: "var(--glass-border)" }} />

      {/* ═══ Progress Bar ═══ */}
      <div className="flex-1 flex items-center gap-3">
        {tickMode && (
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded" style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)" }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--accent-bright)" strokeWidth="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            <span className="text-[9px] font-mono font-semibold" style={{ color: "var(--accent-bright)" }}>TICK</span>
          </div>
        )}
        <div
          className="flex-1 relative h-1.5 rounded-full overflow-hidden cursor-pointer"
          style={{ background: "rgba(255,255,255,0.06)" }}
        >
          <motion.div
            className="absolute left-0 top-0 h-full rounded-full"
            style={{
              background: tickMode
                ? "var(--accent-bright)"
                : speed === -1
                  ? "var(--buy)"
                  : "var(--accent)",
              boxShadow: tickMode
                ? "0 0 8px rgba(99,102,241,0.5)"
                : speed === -1
                  ? "0 0 8px rgba(34,197,94,0.4)"
                  : "0 0 8px rgba(99,102,241,0.4)",
            }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.1 }}
          />
          <input
            type="range"
            min={0}
            max={Math.max(totalIdx - 1, 0)}
            value={currentIdx}
            onChange={(e) => onSeek(parseInt(e.target.value))}
            className="absolute inset-0 w-full opacity-0 cursor-pointer"
          />
        </div>
        <span
          className="text-xs font-mono min-w-[80px] text-right tabular-nums"
          style={{ color: "var(--text-muted)" }}
        >
          {tickMode ? `${currentTickIndex.toLocaleString()}/${totalTicks.toLocaleString()}` : `${currentBarIndex}/${totalBars}`}
        </span>
      </div>

      {/* Divider */}
      <div className="w-px h-10" style={{ background: "var(--glass-border)" }} />

      {/* ═══ Speed Selector ═══ */}
      <div className="flex items-center gap-1">
        <div className="flex rounded-lg overflow-hidden glass-subtle">
          {SPEEDS.map((s) => {
            const isActive = speed === s.value;
            return (
              <button
                key={s.value}
                onClick={() => onSpeedChange(s.value)}
                className="relative px-2.5 py-1.5 text-xs font-mono transition-colors z-10"
                style={{
                  color: isActive ? "#fff" : "var(--text-muted)",
                }}
              >
                {isActive && (
                  <motion.div
                    layoutId="speed-indicator"
                    className="absolute inset-0 rounded-md"
                    style={{
                      background: s.value === -1 ? "var(--buy)" : "var(--accent)",
                      boxShadow: s.value === -1
                        ? "0 0 8px rgba(34,197,94,0.3)"
                        : "0 0 8px rgba(99,102,241,0.3)",
                    }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
