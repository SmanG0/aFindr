"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { AccountState } from "@/lib/types";

interface Navbar1Props {
  onOpenCopilot: () => void;
  onOpenRiskMgmt: () => void;
  onOpenSymbols: () => void;
  onOpenSettings: () => void;
  onToggleNewsFeed: () => void;
  showNewsFeed: boolean;
  accountState: AccountState;
  currentPrice: number;
  onCloseAll: () => void;
  onCloseAllProfitable: () => void;
  onCloseAllLosing: () => void;
  onResetAccount: () => void;
}

function formatPnl(value: number): string {
  const prefix = value >= 0 ? "+$" : "-$";
  return `${prefix}${Math.abs(value).toFixed(2)}`;
}

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

export default function Navbar1({
  onOpenCopilot,
  onOpenRiskMgmt,
  onOpenSymbols,
  onOpenSettings,
  onToggleNewsFeed,
  showNewsFeed,
  accountState,
  currentPrice,
  onCloseAll,
  onCloseAllProfitable,
  onCloseAllLosing,
  onResetAccount,
}: Navbar1Props) {
  const [showMonitoring, setShowMonitoring] = useState(false);
  const [showKillSwitch, setShowKillSwitch] = useState(false);
  const [showAIAnalysis, setShowAIAnalysis] = useState(false);
  const [showSession, setShowSession] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications] = useState([
    { id: 1, type: "trade" as const, message: "Trading engine initialized", time: Date.now() - 60000 },
    { id: 2, type: "system" as const, message: "Connected to data feed", time: Date.now() - 30000 },
  ]);

  // Session timer
  const [sessionStart] = useState(Date.now());

  return (
    <>
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          height: 82,
          padding: "0 16px",
          gap: 8,
          background: "var(--bg)",
          borderBottom: "0.667px solid rgba(236,227,213,0.15)",
        }}
      >
        {/* ─── Left Side Buttons ─── */}

        {/* AI Copilot */}
        <motion.button
          className="nav-pill"
          onClick={onOpenCopilot}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M8 1l1.5 4.5L14 8l-4.5 1.5L8 14l-1.5-4.5L2 8l4.5-1.5z" />
          </svg>
          Alphy
        </motion.button>

        {/* Risk Management */}
        <motion.button
          className="nav-pill"
          onClick={onOpenRiskMgmt}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          Risk Management
        </motion.button>

        {/* Monitoring */}
        <motion.button
          className="nav-pill"
          onClick={() => setShowMonitoring(!showMonitoring)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          style={{
            background: showMonitoring ? "rgba(236,227,213,0.08)" : undefined,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          Monitoring
        </motion.button>

        {/* Kill Switch */}
        <motion.button
          className="nav-pill"
          style={{ color: "#f23645" }}
          onClick={() => setShowKillSwitch(true)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
            <line x1="12" y1="2" x2="12" y2="12" />
          </svg>
          Kill Switch
        </motion.button>

        {/* AI Analysis */}
        <motion.button
          className="nav-pill"
          onClick={() => setShowAIAnalysis(!showAIAnalysis)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          style={{
            background: showAIAnalysis ? "rgba(236,227,213,0.08)" : undefined,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 2a7 7 0 0 1 7 7c0 2.5-1.5 4.5-3 6-1 1-1 2-1 3h-6c0-1 0-2-1-3-1.5-1.5-3-3.5-3-6a7 7 0 0 1 7-7z" />
            <path d="M9 18h6" />
            <path d="M10 22h4" />
          </svg>
          AI Analysis
        </motion.button>

        {/* News Feed */}
        <motion.button
          className="nav-pill"
          onClick={onToggleNewsFeed}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          style={{
            background: showNewsFeed ? "rgba(236,227,213,0.08)" : undefined,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="3" width="20" height="18" rx="2" />
            <line x1="8" y1="7" x2="16" y2="7" />
            <line x1="8" y1="11" x2="16" y2="11" />
            <line x1="8" y1="15" x2="12" y2="15" />
          </svg>
          News
        </motion.button>

        {/* ─── Spacer ─── */}
        <div style={{ flex: 1 }} />

        {/* ─── Right Side Buttons ─── */}

        {/* Session */}
        <motion.button
          className="nav-pill"
          onClick={() => setShowSession(!showSession)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          style={{
            background: showSession ? "rgba(236,227,213,0.08)" : undefined,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          Session
        </motion.button>

        {/* Symbols */}
        <motion.button
          className="nav-pill"
          onClick={onOpenSymbols}
          style={{
            background: "rgba(15,12,8,0.5)",
            backdropFilter: "blur(10px)",
            border: "0.667px solid rgba(236,227,213,0.1)",
          }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          Symbols
          <span style={{ color: "var(--text-muted)", fontSize: 11, marginLeft: 4 }}>Ctrl+S</span>
        </motion.button>

        {/* Dashboard */}
        <motion.button
          className="nav-pill"
          onClick={() => setShowDashboard(!showDashboard)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          style={{
            background: showDashboard ? "rgba(236,227,213,0.08)" : undefined,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
          </svg>
          Dashboard
        </motion.button>

        {/* Bell icon button */}
        <motion.button
          className="nav-pill"
          style={{ padding: "0 10px", position: "relative" }}
          onClick={() => setShowNotifications(!showNotifications)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {notifications.length > 0 && (
            <div
              style={{
                position: "absolute",
                top: 4,
                right: 6,
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--accent)",
              }}
            />
          )}
        </motion.button>

        {/* Settings gear */}
        <motion.button
          className="nav-pill"
          style={{ padding: "0 10px" }}
          onClick={onOpenSettings}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </motion.button>
      </nav>

      {/* ═══ DROPDOWN PANELS ═══ */}

      {/* Monitoring Panel */}
      <AnimatePresence>
        {showMonitoring && (
          <MonitoringPanel
            accountState={accountState}
            onClose={() => setShowMonitoring(false)}
          />
        )}
      </AnimatePresence>

      {/* Kill Switch Confirmation */}
      <AnimatePresence>
        {showKillSwitch && (
          <KillSwitchModal
            accountState={accountState}
            onCloseAll={onCloseAll}
            onCloseAllProfitable={onCloseAllProfitable}
            onCloseAllLosing={onCloseAllLosing}
            onResetAccount={onResetAccount}
            onClose={() => setShowKillSwitch(false)}
          />
        )}
      </AnimatePresence>

      {/* AI Analysis Panel */}
      <AnimatePresence>
        {showAIAnalysis && (
          <AIAnalysisPanel
            accountState={accountState}
            currentPrice={currentPrice}
            onClose={() => setShowAIAnalysis(false)}
          />
        )}
      </AnimatePresence>

      {/* Session Panel */}
      <AnimatePresence>
        {showSession && (
          <SessionPanel
            accountState={accountState}
            sessionStart={sessionStart}
            onClose={() => setShowSession(false)}
          />
        )}
      </AnimatePresence>

      {/* Dashboard Panel */}
      <AnimatePresence>
        {showDashboard && (
          <DashboardPanel
            accountState={accountState}
            onClose={() => setShowDashboard(false)}
          />
        )}
      </AnimatePresence>

      {/* Notifications Dropdown */}
      <AnimatePresence>
        {showNotifications && (
          <NotificationsDropdown
            notifications={notifications}
            onClose={() => setShowNotifications(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Monitoring Panel ───
function MonitoringPanel({
  accountState,
  onClose,
}: {
  accountState: AccountState;
  onClose: () => void;
}) {
  const totalTrades = accountState.tradeHistory.length;
  const winningTrades = accountState.tradeHistory.filter((t) => t.pnl > 0).length;
  const losingTrades = accountState.tradeHistory.filter((t) => t.pnl < 0).length;
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
  const totalPnl = accountState.tradeHistory.reduce((sum, t) => sum + t.pnl, 0);
  const totalCommission = accountState.tradeHistory.reduce((sum, t) => sum + t.commission, 0);
  const avgWin = winningTrades > 0
    ? accountState.tradeHistory.filter((t) => t.pnl > 0).reduce((s, t) => s + t.pnl, 0) / winningTrades
    : 0;
  const avgLoss = losingTrades > 0
    ? accountState.tradeHistory.filter((t) => t.pnl < 0).reduce((s, t) => s + t.pnl, 0) / losingTrades
    : 0;
  const profitFactor = avgLoss !== 0 ? Math.abs(avgWin * winningTrades) / Math.abs(avgLoss * losingTrades) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.15 }}
      style={{
        position: "fixed",
        top: 82,
        left: 16,
        zIndex: 1000,
        background: "rgba(33,30,26,0.98)",
        border: "1px solid rgba(236,227,213,0.1)",
        borderRadius: 12,
        padding: 20,
        minWidth: 360,
        backdropFilter: "blur(20px)",
        boxShadow: "0 16px 48px rgba(15,12,8,0.6)",
      }}
    >
      <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
          Performance Monitor
        </span>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <MetricCard label="Open Positions" value={String(accountState.positions.length)} />
        <MetricCard label="Total Trades" value={String(totalTrades)} />
        <MetricCard label="Win Rate" value={`${winRate.toFixed(1)}%`} color={winRate >= 50 ? "var(--buy)" : "var(--sell)"} />
        <MetricCard label="Profit Factor" value={profitFactor > 0 ? profitFactor.toFixed(2) : "--"} color={profitFactor >= 1 ? "var(--buy)" : "var(--sell)"} />
        <MetricCard label="Net P&L" value={formatPnl(totalPnl)} color={totalPnl >= 0 ? "var(--buy)" : "var(--sell)"} />
        <MetricCard label="Unrealized P&L" value={formatPnl(accountState.unrealizedPnl)} color={accountState.unrealizedPnl >= 0 ? "var(--buy)" : "var(--sell)"} />
        <MetricCard label="Avg Win" value={avgWin > 0 ? formatPnl(avgWin) : "--"} color="var(--buy)" />
        <MetricCard label="Avg Loss" value={avgLoss < 0 ? formatPnl(avgLoss) : "--"} color="var(--sell)" />
        <MetricCard label="Total Commission" value={`$${totalCommission.toFixed(2)}`} />
        <MetricCard label="Balance" value={`$${accountState.balance.toFixed(2)}`} />
      </div>
    </motion.div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div
      style={{
        background: "rgba(236,227,213,0.04)",
        borderRadius: 8,
        padding: "10px 12px",
      }}
    >
      <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 4 }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: color || "var(--text-primary)",
          fontFamily: "var(--font-mono)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
    </div>
  );
}

// ─── Kill Switch Modal ───
function KillSwitchModal({
  accountState,
  onCloseAll,
  onCloseAllProfitable,
  onCloseAllLosing,
  onResetAccount,
  onClose,
}: {
  accountState: AccountState;
  onCloseAll: () => void;
  onCloseAllProfitable: () => void;
  onCloseAllLosing: () => void;
  onResetAccount: () => void;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(15,12,8,0.6)",
        backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "rgba(33,30,26,0.98)",
          border: "1px solid rgba(229,77,77,0.3)",
          borderRadius: 16,
          padding: 24,
          width: 400,
          backdropFilter: "blur(20px)",
          boxShadow: "0 24px 64px rgba(15,12,8,0.8)",
        }}
      >
        <div className="flex items-center gap-3" style={{ marginBottom: 20 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "rgba(242,54,69,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f23645" strokeWidth="2">
              <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
              <line x1="12" y1="2" x2="12" y2="12" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Kill Switch</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {accountState.positions.length} open position{accountState.positions.length !== 1 ? "s" : ""}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <KillButton
            label="Close All Positions"
            description={`Close ${accountState.positions.length} positions at market`}
            color="#f23645"
            onClick={() => { onCloseAll(); onClose(); }}
            disabled={accountState.positions.length === 0}
          />
          <KillButton
            label="Close Profitable Only"
            description="Close positions currently in profit"
            color="var(--buy)"
            onClick={() => { onCloseAllProfitable(); onClose(); }}
            disabled={accountState.positions.filter((p) => p.unrealizedPnl > 0).length === 0}
          />
          <KillButton
            label="Close Losing Only"
            description="Close positions currently at a loss"
            color="var(--sell)"
            onClick={() => { onCloseAllLosing(); onClose(); }}
            disabled={accountState.positions.filter((p) => p.unrealizedPnl < 0).length === 0}
          />
          <div style={{ height: 1, background: "rgba(236,227,213,0.06)", margin: "4px 0" }} />
          <KillButton
            label="Reset Account"
            description="Clear all positions, history, and reset balance to $25,000"
            color="#ff6b00"
            onClick={() => { onResetAccount(); onClose(); }}
          />
        </div>

        <button
          onClick={onClose}
          style={{
            marginTop: 12,
            width: "100%",
            padding: "10px 0",
            borderRadius: 8,
            background: "rgba(236,227,213,0.04)",
            color: "var(--text-secondary)",
            border: "1px solid rgba(236,227,213,0.06)",
            cursor: "pointer",
            fontSize: 12,
            fontFamily: "var(--font-mono)",
          }}
        >
          Cancel
        </button>
      </motion.div>
    </motion.div>
  );
}

function KillButton({
  label,
  description,
  color,
  onClick,
  disabled,
}: {
  label: string;
  description: string;
  color: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        padding: "12px 14px",
        borderRadius: 8,
        background: `${color}10`,
        border: `1px solid ${color}30`,
        color: disabled ? "var(--text-disabled)" : color,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.4 : 1,
        textAlign: "left",
        transition: "all 100ms ease",
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.background = `${color}20`;
      }}
      onMouseLeave={(e) => {
        if (!disabled) e.currentTarget.style.background = `${color}10`;
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, fontFamily: "var(--font-mono)" }}>{label}</div>
      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{description}</div>
    </button>
  );
}

// ─── AI Analysis Panel ───
function AIAnalysisPanel({
  accountState,
  currentPrice,
  onClose,
}: {
  accountState: AccountState;
  currentPrice: number;
  onClose: () => void;
}) {
  const totalTrades = accountState.tradeHistory.length;
  const wins = accountState.tradeHistory.filter((t) => t.pnl > 0);
  const losses = accountState.tradeHistory.filter((t) => t.pnl < 0);
  const winRate = totalTrades > 0 ? (wins.length / totalTrades) * 100 : 0;
  const totalPnl = accountState.tradeHistory.reduce((sum, t) => sum + t.pnl, 0);
  const maxWin = wins.length > 0 ? Math.max(...wins.map((t) => t.pnl)) : 0;
  const maxLoss = losses.length > 0 ? Math.min(...losses.map((t) => t.pnl)) : 0;

  // Consecutive wins/losses
  let maxConsecWins = 0, maxConsecLosses = 0, curWins = 0, curLosses = 0;
  for (const t of accountState.tradeHistory) {
    if (t.pnl > 0) { curWins++; curLosses = 0; maxConsecWins = Math.max(maxConsecWins, curWins); }
    else if (t.pnl < 0) { curLosses++; curWins = 0; maxConsecLosses = Math.max(maxConsecLosses, curLosses); }
  }

  const analysis = totalTrades === 0
    ? "No trades yet. Place some trades to see AI analysis."
    : winRate >= 60
      ? `Strong performance with ${winRate.toFixed(0)}% win rate. Continue with current strategy. Consider tightening stop losses to protect gains.`
      : winRate >= 40
        ? `Mixed results at ${winRate.toFixed(0)}% win rate. Review recent losing trades for pattern. Consider reducing position size.`
        : `Below target at ${winRate.toFixed(0)}% win rate. Recommend pausing to review strategy. ${maxConsecLosses >= 3 ? "Extended losing streak detected - take a break." : ""}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.15 }}
      style={{
        position: "fixed",
        top: 82,
        left: 16,
        zIndex: 1000,
        background: "rgba(33,30,26,0.98)",
        border: "1px solid rgba(236,227,213,0.1)",
        borderRadius: 12,
        padding: 20,
        width: 380,
        backdropFilter: "blur(20px)",
        boxShadow: "0 16px 48px rgba(15,12,8,0.6)",
      }}
    >
      <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>AI Analysis</span>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* AI Insight */}
      <div style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: "var(--accent)", fontFamily: "var(--font-mono)", marginBottom: 6, fontWeight: 600 }}>INSIGHT</div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>{analysis}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <MetricCard label="Current Price" value={`$${currentPrice.toFixed(2)}`} />
        <MetricCard label="Net P&L" value={formatPnl(totalPnl)} color={totalPnl >= 0 ? "var(--buy)" : "var(--sell)"} />
        <MetricCard label="Best Trade" value={maxWin > 0 ? formatPnl(maxWin) : "--"} color="var(--buy)" />
        <MetricCard label="Worst Trade" value={maxLoss < 0 ? formatPnl(maxLoss) : "--"} color="var(--sell)" />
        <MetricCard label="Max Consec. Wins" value={String(maxConsecWins)} />
        <MetricCard label="Max Consec. Losses" value={String(maxConsecLosses)} />
      </div>
    </motion.div>
  );
}

// ─── Session Panel ───
function SessionPanel({
  accountState,
  sessionStart,
  onClose,
}: {
  accountState: AccountState;
  sessionStart: number;
  onClose: () => void;
}) {
  const elapsed = Date.now() - sessionStart;
  const hours = Math.floor(elapsed / 3600000);
  const minutes = Math.floor((elapsed % 3600000) / 60000);
  const seconds = Math.floor((elapsed % 60000) / 1000);
  const sessionPnl = accountState.tradeHistory.reduce((sum, t) => sum + t.pnl, 0) + accountState.unrealizedPnl;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.15 }}
      style={{
        position: "fixed",
        top: 82,
        right: 200,
        zIndex: 1000,
        background: "rgba(33,30,26,0.98)",
        border: "1px solid rgba(236,227,213,0.1)",
        borderRadius: 12,
        padding: 20,
        width: 280,
        backdropFilter: "blur(20px)",
        boxShadow: "0 16px 48px rgba(15,12,8,0.6)",
      }}
    >
      <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Session Info</span>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <MetricCard label="Session Duration" value={`${hours}h ${minutes}m ${seconds}s`} />
        <MetricCard label="Session P&L" value={formatPnl(sessionPnl)} color={sessionPnl >= 0 ? "var(--buy)" : "var(--sell)"} />
        <MetricCard label="Trades This Session" value={String(accountState.tradeHistory.length)} />
        <MetricCard label="Open Positions" value={String(accountState.positions.length)} />
        <MetricCard label="Started At" value={new Date(sessionStart).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" })} />
      </div>
    </motion.div>
  );
}

// ─── Dashboard Panel ───
function DashboardPanel({
  accountState,
  onClose,
}: {
  accountState: AccountState;
  onClose: () => void;
}) {
  const totalPnl = accountState.tradeHistory.reduce((sum, t) => sum + t.pnl, 0);
  const totalTrades = accountState.tradeHistory.length;
  const wins = accountState.tradeHistory.filter((t) => t.pnl > 0).length;

  // Equity curve data from trade history
  let runningBalance = 25000;
  const equityPoints = accountState.tradeHistory.map((t) => {
    runningBalance += t.pnl;
    return { time: t.exitTime, value: runningBalance };
  });

  // By-symbol breakdown
  const symbolBreakdown: Record<string, { trades: number; pnl: number }> = {};
  for (const t of accountState.tradeHistory) {
    if (!symbolBreakdown[t.symbol]) symbolBreakdown[t.symbol] = { trades: 0, pnl: 0 };
    symbolBreakdown[t.symbol].trades++;
    symbolBreakdown[t.symbol].pnl += t.pnl;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.15 }}
      style={{
        position: "fixed",
        top: 82,
        right: 80,
        zIndex: 1000,
        background: "rgba(33,30,26,0.98)",
        border: "1px solid rgba(236,227,213,0.1)",
        borderRadius: 12,
        padding: 20,
        width: 400,
        maxHeight: "calc(100vh - 120px)",
        overflow: "auto",
        backdropFilter: "blur(20px)",
        boxShadow: "0 16px 48px rgba(15,12,8,0.6)",
      }}
    >
      <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Dashboard</span>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Account Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
        <MetricCard label="Balance" value={`$${accountState.balance.toFixed(2)}`} />
        <MetricCard label="Equity" value={`$${accountState.equity.toFixed(2)}`} />
        <MetricCard label="Net P&L" value={formatPnl(totalPnl)} color={totalPnl >= 0 ? "var(--buy)" : "var(--sell)"} />
      </div>

      {/* Mini Equity Chart */}
      {equityPoints.length > 1 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 8 }}>EQUITY CURVE</div>
          <div style={{ height: 60, background: "rgba(236,227,213,0.03)", borderRadius: 8, position: "relative", overflow: "hidden", padding: "4px 0" }}>
            <svg width="100%" height="100%" viewBox={`0 0 ${equityPoints.length} 100`} preserveAspectRatio="none">
              {(() => {
                const min = Math.min(...equityPoints.map((p) => p.value));
                const max = Math.max(...equityPoints.map((p) => p.value));
                const range = max - min || 1;
                const points = equityPoints.map((p, i) => `${i},${100 - ((p.value - min) / range) * 100}`).join(" ");
                return <polyline points={points} fill="none" stroke="var(--accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" />;
              })()}
            </svg>
          </div>
        </div>
      )}

      {/* Trade Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
        <MetricCard label="Total Trades" value={String(totalTrades)} />
        <MetricCard label="Win Rate" value={totalTrades > 0 ? `${((wins / totalTrades) * 100).toFixed(1)}%` : "--"} color={wins / totalTrades >= 0.5 ? "var(--buy)" : "var(--sell)"} />
      </div>

      {/* Symbol Breakdown */}
      {Object.keys(symbolBreakdown).length > 0 && (
        <>
          <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 8 }}>BY SYMBOL</div>
          {Object.entries(symbolBreakdown).map(([sym, data]) => (
            <div
              key={sym}
              className="flex items-center justify-between"
              style={{
                padding: "8px 12px",
                background: "rgba(236,227,213,0.04)",
                borderRadius: 8,
                marginBottom: 4,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>{sym}</span>
              <div className="flex items-center gap-4">
                <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{data.trades} trades</span>
                <span style={{ fontSize: 11, fontWeight: 600, fontFamily: "var(--font-mono)", color: data.pnl >= 0 ? "var(--buy)" : "var(--sell)" }}>
                  {formatPnl(data.pnl)}
                </span>
              </div>
            </div>
          ))}
        </>
      )}
    </motion.div>
  );
}

// ─── Notifications Dropdown ───
function NotificationsDropdown({
  notifications,
  onClose,
}: {
  notifications: { id: number; type: string; message: string; time: number }[];
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.15 }}
      style={{
        position: "fixed",
        top: 82,
        right: 50,
        zIndex: 1000,
        background: "rgba(33,30,26,0.98)",
        border: "1px solid rgba(236,227,213,0.1)",
        borderRadius: 12,
        padding: 16,
        width: 300,
        backdropFilter: "blur(20px)",
        boxShadow: "0 16px 48px rgba(15,12,8,0.6)",
      }}
    >
      <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Notifications</span>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      {notifications.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: 20 }}>No notifications</div>
      ) : (
        notifications.map((n) => (
          <div
            key={n.id}
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              background: "rgba(236,227,213,0.04)",
              marginBottom: 4,
            }}
          >
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{n.message}</div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4, fontFamily: "var(--font-mono)" }}>
              {formatTime(n.time)}
            </div>
          </div>
        ))
      )}
    </motion.div>
  );
}
