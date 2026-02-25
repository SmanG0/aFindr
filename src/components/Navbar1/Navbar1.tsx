"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { AppPage } from "@/components/PageNav/PageNav";
import NotificationBell from "@/components/Notifications/NotificationBell";
import AlertsPanel from "@/components/Alerts/AlertsPanel";
import type { Id } from "../../../convex/_generated/dataModel";

function AlphyMascot({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      {/* Body */}
      <ellipse cx="32" cy="36" rx="18" ry="20" fill="var(--accent)" />
      {/* Belly glow */}
      <ellipse cx="32" cy="40" rx="12" ry="13" fill="var(--accent-bright)" opacity="0.25" />
      {/* Left eye */}
      <ellipse cx="25" cy="29" rx="4" ry="4.5" fill="var(--text-primary)" />
      <ellipse cx="26" cy="29.5" rx="2" ry="2.5" fill="var(--bg)" />
      <circle cx="24.5" cy="28" r="1.2" fill="var(--text-primary)" />
      {/* Right eye */}
      <ellipse cx="39" cy="29" rx="4" ry="4.5" fill="var(--text-primary)" />
      <ellipse cx="40" cy="29.5" rx="2" ry="2.5" fill="var(--bg)" />
      <circle cx="38.5" cy="28" r="1.2" fill="var(--text-primary)" />
      {/* Eyebrows */}
      <path d="M20 24 Q25 21 29 24" stroke="var(--bg)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M35 24 Q39 21 44 24" stroke="var(--bg)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      {/* Smile */}
      <path d="M26 38 Q32 43 38 38" stroke="var(--text-primary)" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      {/* Cheek blush */}
      <circle cx="21" cy="34" r="3" fill="var(--accent-bright)" opacity="0.35" />
      <circle cx="43" cy="34" r="3" fill="var(--accent-bright)" opacity="0.35" />
      {/* Alpha crown */}
      <text x="32" y="21" textAnchor="middle" fontSize="10" fontWeight="bold" fill="var(--text-primary)" fontFamily="Georgia, serif" opacity="0.7">&#x3B1;</text>
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
  userName?: string;
  userId?: Id<"users"> | null;
}

// Main nav tabs — Settings is NOT a tab, only accessible via gear icon
const NAV_TABS: { id: AppPage; label: string; premium?: boolean }[] = ([
  { id: "dashboard", label: "Dashboard" },
  { id: "portfolio", label: "Portfolio" },
  { id: "trade", label: "Trade" },
  { id: "news", label: "News" },
  { id: "journal", label: "Journal" },
  { id: "alpha", label: "Alpha Lab", premium: true },
] as { id: AppPage; label: string; premium?: boolean }[]).filter((t) => t.id !== "settings");

export default function Navbar1({
  activePage,
  onPageChange,
  onOpenCopilot,
  onOpenRiskMgmt: _onOpenRiskMgmt,
  onOpenSymbols,
  onOpenSettings,
  userName,
  userId: _userId,
}: Navbar1Props) {
  void _onOpenRiskMgmt;
  void _userId;
  const [showAlerts, setShowAlerts] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [logoHovered, setLogoHovered] = useState(false);
  const isAlphaLab = activePage === "alpha";

  const displayName = userName || "User";
  const initials = displayName.charAt(0).toUpperCase();

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
        {/* ─── Alphy Mascot (left corner) — disabled on Alpha Lab ─── */}
        <motion.button
          onClick={isAlphaLab ? undefined : onOpenCopilot}
          data-agent-target="panel-alphySidePanel"
          onMouseEnter={() => !isAlphaLab && setLogoHovered(true)}
          onMouseLeave={() => setLogoHovered(false)}
          whileTap={isAlphaLab ? undefined : { scale: 0.92 }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            marginRight: 16,
            background: "transparent",
            border: "none",
            cursor: isAlphaLab ? "default" : "pointer",
            flexShrink: 0,
            opacity: isAlphaLab ? 0.35 : 1,
            transition: "opacity 150ms ease",
          }}
          title={isAlphaLab ? "Alphy is in the playground" : "Open Alphy"}
        >
          <motion.div
            animate={logoHovered && !isAlphaLab ? { scale: 1.12, rotate: 3 } : { scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
          >
            <AlphyMascot size={36} />
          </motion.div>
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
                {tab.premium && (
                  <span style={{
                    fontSize: 8, fontWeight: 800, fontFamily: "var(--font-mono)",
                    padding: "1px 5px", borderRadius: 4, marginLeft: 5,
                    background: "linear-gradient(135deg, rgba(196,123,58,0.25), rgba(212,175,55,0.25))",
                    color: "#d4af37", letterSpacing: "0.06em", lineHeight: 1.4,
                    border: "1px solid rgba(212,175,55,0.2)",
                  }}>
                    PRO
                  </span>
                )}
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

          {/* Alerts */}
          <IconButton
            onClick={() => setShowAlerts((v) => !v)}
            title="Alerts"
            isActive={showAlerts}
            icon={
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            }
          />

          {/* Notifications Bell (Convex-powered) */}
          <NotificationBell />

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

          {/* Divider */}
          <div style={{ width: 1, height: 20, background: "rgba(236,227,213,0.08)", flexShrink: 0, margin: "0 4px" }} />

          {/* Profile Avatar */}
          <div style={{ position: "relative" }}>
            <motion.button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "linear-gradient(135deg, var(--accent), var(--accent-bright))",
                border: showProfileMenu ? "2px solid var(--accent-bright)" : "2px solid transparent",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 700,
                color: "#fff",
                transition: "border-color 150ms ease",
              }}
              title={displayName}
            >
              {initials}
            </motion.button>
          </div>
        </div>
      </nav>

      {/* ═══ Alerts Panel ═══ */}
      <AnimatePresence>
        <AlertsPanel
          isOpen={showAlerts}
          onClose={() => setShowAlerts(false)}
        />
      </AnimatePresence>

      {/* ═══ Profile Dropdown ═══ */}
      <AnimatePresence>
        {showProfileMenu && (
          <ProfileDropdown
            name={displayName}
            onClose={() => setShowProfileMenu(false)}
            onSettings={() => { setShowProfileMenu(false); onOpenSettings(); }}
            onLogout={() => {
              localStorage.removeItem("afindr_onboarding");
              localStorage.removeItem("afindr_onboarding_welcomed");
              localStorage.removeItem("afindr_current_page");
              window.location.replace("/landing");
            }}
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

// ─── Profile Dropdown ───
function ProfileDropdown({
  name,
  onClose,
  onSettings,
  onLogout,
}: {
  name: string;
  onClose: () => void;
  onSettings: () => void;
  onLogout: () => void;
}) {
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 999 }}
      />
      <motion.div
        initial={{ opacity: 0, y: -8, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        style={{
          position: "fixed",
          top: 52,
          right: 16,
          zIndex: 1000,
          background: "rgba(33,30,26,0.98)",
          border: "1px solid rgba(236,227,213,0.1)",
          borderRadius: 12,
          padding: 8,
          width: 220,
          backdropFilter: "blur(20px)",
          boxShadow: "0 16px 48px rgba(15,12,8,0.6)",
        }}
      >
        {/* User info */}
        <div style={{ padding: "8px 12px 12px", borderBottom: "1px solid rgba(236,227,213,0.06)" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{name}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Free Plan</div>
        </div>

        {/* Menu items */}
        <div style={{ padding: "4px 0" }}>
          <ProfileMenuItem
            icon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            }
            label="Settings"
            onClick={onSettings}
          />
          <ProfileMenuItem
            icon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            }
            label="Sign Out"
            onClick={onLogout}
            danger
          />
        </div>
      </motion.div>
    </>
  );
}

function ProfileMenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        padding: "8px 12px",
        borderRadius: 8,
        background: "transparent",
        border: "none",
        color: danger ? "var(--sell)" : "var(--text-secondary)",
        fontSize: 13,
        cursor: "pointer",
        transition: "background 100ms ease",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(236,227,213,0.06)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      {icon}
      {label}
    </button>
  );
}
