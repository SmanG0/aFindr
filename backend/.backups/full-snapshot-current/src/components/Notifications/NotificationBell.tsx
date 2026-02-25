"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

interface NotificationBellProps {
  userId: Id<"users"> | null;
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const TYPE_ICONS: Record<string, { color: string; label: string }> = {
  price_alert: { color: "var(--buy)", label: "Price" },
  news_alert: { color: "#3b82f6", label: "News" },
  system: { color: "var(--text-muted)", label: "System" },
};

export default function NotificationBell({ userId }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const notifications = useQuery(
    api.notifications.list,
    userId ? { userId } : "skip",
  );
  const unreadCount = useQuery(
    api.notifications.unreadCount,
    userId ? { userId } : "skip",
  );
  const markRead = useMutation(api.notifications.markRead);
  const markAllRead = useMutation(api.notifications.markAllRead);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [isOpen]);

  const count = unreadCount ?? 0;

  return (
    <div style={{ position: "relative" }} ref={dropdownRef}>
      {/* Bell Button */}
      <motion.button
        onClick={() => setIsOpen((v) => !v)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 32, height: 32, borderRadius: 8,
          background: isOpen ? "rgba(236,227,213,0.08)" : "transparent",
          border: "none",
          color: isOpen ? "var(--text-primary)" : "var(--text-muted)",
          cursor: "pointer", transition: "all 100ms ease",
          position: "relative",
        }}
        title="Notifications"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {/* Unread badge */}
        {count > 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            style={{
              position: "absolute", top: 2, right: 2,
              minWidth: 14, height: 14, borderRadius: 7,
              background: "var(--accent)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 9, fontWeight: 700, color: "#fff",
              fontFamily: "var(--font-mono)",
              padding: "0 3px",
            }}
          >
            {count > 99 ? "99+" : count}
          </motion.div>
        )}
      </motion.button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            style={{
              position: "absolute", top: "calc(100% + 8px)", right: 0,
              zIndex: 1000, width: 340,
              background: "rgba(33,30,26,0.98)",
              border: "1px solid rgba(236,227,213,0.1)",
              borderRadius: 12,
              backdropFilter: "blur(20px)",
              boxShadow: "0 16px 48px rgba(15,12,8,0.6)",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 14px", borderBottom: "1px solid rgba(236,227,213,0.06)",
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                Notifications
                {count > 0 && (
                  <span style={{
                    marginLeft: 6, fontSize: 10, padding: "2px 6px", borderRadius: 4,
                    background: "rgba(196,123,58,0.15)", color: "var(--accent)",
                    fontFamily: "var(--font-mono)", fontWeight: 700,
                  }}>
                    {count} new
                  </span>
                )}
              </span>
              {count > 0 && userId && (
                <button
                  onClick={() => markAllRead({ userId })}
                  style={{
                    padding: "4px 8px", borderRadius: 4, fontSize: 10,
                    background: "rgba(236,227,213,0.06)",
                    border: "1px solid rgba(236,227,213,0.08)",
                    color: "var(--text-muted)", cursor: "pointer",
                  }}
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* List */}
            <div style={{ maxHeight: 400, overflowY: "auto" }}>
              {!notifications || notifications.length === 0 ? (
                <div style={{ padding: 32, textAlign: "center", fontSize: 12, color: "var(--text-muted)" }}>
                  No notifications yet
                </div>
              ) : (
                notifications.map((n) => {
                  const typeInfo = TYPE_ICONS[n.type] ?? TYPE_ICONS.system;
                  return (
                    <div
                      key={n._id}
                      onClick={() => { if (!n.read) markRead({ notificationId: n._id }); }}
                      style={{
                        padding: "10px 14px",
                        borderBottom: "1px solid rgba(236,227,213,0.04)",
                        cursor: n.read ? "default" : "pointer",
                        background: n.read ? "transparent" : "rgba(196,123,58,0.04)",
                        transition: "background 100ms ease",
                      }}
                      onMouseEnter={(e) => {
                        if (!n.read) e.currentTarget.style.background = "rgba(196,123,58,0.08)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = n.read ? "transparent" : "rgba(196,123,58,0.04)";
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                        {!n.read && (
                          <div style={{
                            width: 6, height: 6, borderRadius: "50%",
                            background: "var(--accent)", flexShrink: 0,
                          }} />
                        )}
                        <span style={{
                          fontSize: 9, padding: "1px 5px", borderRadius: 3,
                          background: `${typeInfo.color}15`, color: typeInfo.color,
                          fontWeight: 600, textTransform: "uppercase",
                          fontFamily: "var(--font-mono)",
                        }}>
                          {typeInfo.label}
                        </span>
                        <span style={{ flex: 1 }} />
                        <span style={{
                          fontSize: 10, color: "var(--text-disabled)",
                          fontFamily: "var(--font-mono)",
                        }}>
                          {relativeTime(n.createdAt)}
                        </span>
                      </div>
                      <div style={{
                        fontSize: 12, fontWeight: 600,
                        color: n.read ? "var(--text-secondary)" : "var(--text-primary)",
                      }}>
                        {n.title}
                      </div>
                      <div style={{
                        fontSize: 11, color: "var(--text-muted)", marginTop: 2,
                        lineHeight: 1.4,
                      }}>
                        {n.body}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
