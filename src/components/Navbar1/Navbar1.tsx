"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { AppPage } from "@/components/PageNav/PageNav";

function formatTime(timestamp: number): string {
  const ms = timestamp > 1e12 ? timestamp : timestamp * 1000;
  const d = new Date(ms);
  return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function AlphyMascotSmall({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <ellipse cx="32" cy="36" rx="18" ry="20" fill="var(--accent)" />
      <ellipse cx="32" cy="40" rx="12" ry="13" fill="var(--accent-bright)" opacity="0.3" />
      <ellipse cx="25" cy="29" rx="4" ry="4.5" fill="var(--text-primary)" />
      <ellipse cx="26" cy="29.5" rx="2" ry="2.5" fill="var(--bg)" />
      <circle cx="24.5" cy="28" r="1" fill="var(--text-primary)" />
      <ellipse cx="39" cy="29" rx="4" ry="4.5" fill="var(--text-primary)" />
      <ellipse cx="40" cy="29.5" rx="2" ry="2.5" fill="var(--bg)" />
      <circle cx="38.5" cy="28" r="1" fill="var(--text-primary)" />
      <path d="M20 24 Q25 21 29 24" stroke="var(--bg-overlay)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M35 24 Q39 21 44 24" stroke="var(--bg-overlay)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M26 38 Q32 43 38 38" stroke="var(--text-primary)" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <circle cx="21" cy="34" r="3" fill="var(--accent-bright)" opacity="0.35" />
      <circle cx="43" cy="34" r="3" fill="var(--accent-bright)" opacity="0.35" />
      <text x="32" y="21" textAnchor="middle" fontSize="10" fontWeight="bold" fill="var(--text-primary)" fontFamily="Georgia, serif" opacity="0.7">α</text>
    </svg>
  );
}

interface Navbar1Props {
  activePage: AppPage;
  onPageChange: (page: AppPage) => void;
  onOpenCopilot: () => void;
  onOpenRiskMgmt: () => void;
  onOpenSymbols: () => void;
  onOpenSettings: () => void;
}

// Main nav tabs — Settings is NOT a tab, only accessible via gear icon
const NAV_TABS: { id: AppPage; label: string }[] = ([
  { id: "dashboard", label: "Dashboard" },
  { id: "portfolio", label: "Portfolio" },
  { id: "trade", label: "Trade" },
  { id: "news", label: "News" },
] as { id: AppPage; label: string }[]).filter((t) => t.id !== "settings");

export default function Navbar1({
  activePage,
  onPageChange,
  onOpenCopilot,
  onOpenRiskMgmt,
  onOpenSymbols,
  onOpenSettings,
}: Navbar1Props) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [mascotHovered, setMascotHovered] = useState(false);
  const [notifications] = useState([
    { id: 1, type: "trade" as const, message: "Trading engine initialized", time: Date.now() - 60000 },
    { id: 2, type: "system" as const, message: "Connected to data feed", time: Date.now() - 30000 },
  ]);

  return (
    <>
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          height: 52,
          padding: "0 16px",
          gap: 0,
          background: "var(--bg)",
          borderBottom: "0.667px solid rgba(236,227,213,0.15)",
          flexShrink: 0,
        }}
      >
        {/* ─── Alphy Mascot Button (Clippy-inspired) ─── */}
        <motion.button
          onClick={onOpenCopilot}
          onMouseEnter={() => setMascotHovered(true)}
          onMouseLeave={() => setMascotHovered(false)}
          whileTap={{ scale: 0.92 }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginRight: 20,
            padding: "3px 10px 3px 3px",
            borderRadius: 20,
            background: mascotHovered ? "rgba(196,123,58,0.14)" : "transparent",
            border: mascotHovered ? "1px solid rgba(196,123,58,0.25)" : "1px solid transparent",
            cursor: "pointer",
            flexShrink: 0,
            transition: "background 150ms ease, border-color 150ms ease",
          }}
        >
          <motion.div
            animate={mascotHovered ? { rotate: [0, -6, 6, -3, 0], y: [0, -2, 0] } : { rotate: 0, y: 0 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          >
            <AlphyMascotSmall size={34} />
          </motion.div>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: mascotHovered ? "var(--accent-bright)" : "var(--text-secondary)",
              letterSpacing: "-0.01em",
              transition: "color 150ms ease",
            }}
          >
            Alphy
          </span>
        </motion.button>

        {/* ─── Main Navigation Tabs ─── */}
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          {NAV_TABS.map((tab) => {
            const isActive = activePage === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onPageChange(tab.id)}
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  height: 52,
                  padding: "0 14px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? "var(--text-primary)" : "var(--text-muted)",
                  transition: "color 120ms ease",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.color = "var(--text-secondary)";
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.color = "var(--text-muted)";
                }}
              >
                {tab.label}
                {isActive && (
                  <motion.div
                    layoutId="nav-underline"
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 14,
                      right: 14,
                      height: 2,
                      borderRadius: 1,
                      background: "var(--accent)",
                    }}
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* ─── Spacer ─── */}
        <div style={{ flex: 1 }} />

        {/* ─── Right Side Actions ─── */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {/* Symbols Search */}
          <motion.button
            className="nav-pill"
            onClick={onOpenSymbols}
            style={{
              height: 30,
              padding: "0 14px",
              fontSize: 12,
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            Search
            <span style={{ color: "var(--text-disabled)", fontSize: 10, fontFamily: "var(--font-mono)" }}>⌘S</span>
          </motion.button>

          {/* Divider */}
          <div style={{ width: 1, height: 20, background: "rgba(236,227,213,0.08)", flexShrink: 0, margin: "0 4px" }} />

          {/* Risk Management */}
          <IconButton
            onClick={onOpenRiskMgmt}
            title="Risk Management"
            icon={
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            }
          />

          {/* News */}
          <IconButton
            onClick={() => onPageChange("news")}
            title="News"
            isActive={activePage === "news"}
            icon={
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="3" width="20" height="18" rx="2" />
                <line x1="8" y1="7" x2="16" y2="7" />
                <line x1="8" y1="11" x2="16" y2="11" />
                <line x1="8" y1="15" x2="12" y2="15" />
              </svg>
            }
          />

          {/* Bell icon */}
          <div style={{ position: "relative" }}>
            <IconButton
              onClick={() => setShowNotifications(!showNotifications)}
              title="Notifications"
              isActive={showNotifications}
              icon={
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              }
            />
            {notifications.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: 4,
                  right: 4,
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "var(--accent)",
                }}
              />
            )}
          </div>

          {/* Settings gear */}
          <IconButton
            onClick={onOpenSettings}
            title="Settings"
            isActive={activePage === "settings"}
            icon={
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            }
          />
        </div>
      </nav>

      {/* ═══ Notifications Dropdown ═══ */}
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

// ─── Icon Button (compact) ───
function IconButton({
  onClick,
  title,
  icon,
  isActive,
}: {
  onClick: () => void;
  title: string;
  icon: React.ReactNode;
  isActive?: boolean;
}) {
  return (
    <motion.button
      onClick={onClick}
      title={title}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 32,
        height: 32,
        borderRadius: 8,
        background: isActive ? "rgba(236,227,213,0.08)" : "transparent",
        border: "none",
        color: isActive ? "var(--text-primary)" : "var(--text-muted)",
        cursor: "pointer",
        transition: "all 100ms ease",
      }}
    >
      {icon}
    </motion.button>
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
        top: 52,
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
