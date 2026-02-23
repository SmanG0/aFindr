"use client";

import React from "react";
import { motion } from "framer-motion";

export type AppPage = "trade" | "dashboard" | "portfolio" | "news" | "settings";

interface PageNavProps {
  activePage: AppPage;
  onPageChange: (page: AppPage) => void;
}

const pages: { id: AppPage; label: string; icon: React.ReactNode }[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    id: "trade",
    label: "Trade",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
        <polyline points="16 7 22 7 22 13" />
      </svg>
    ),
  },
  {
    id: "portfolio",
    label: "Portfolio",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
        <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
        <path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z" />
      </svg>
    ),
  },
];

export default function PageNav({ activePage, onPageChange }: PageNavProps) {
  return (
    <div
      className="flex items-center gap-1 px-4 flex-shrink-0"
      style={{
        height: 36,
        background: "var(--bg)",
        borderBottom: "0.667px solid rgba(236,227,213,0.1)",
      }}
    >
      {pages.map((page) => {
        const isActive = activePage === page.id;
        return (
          <motion.button
            key={page.id}
            onClick={() => onPageChange(page.id)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium transition-colors"
            style={{
              background: isActive ? "rgba(196,123,58,0.15)" : "transparent",
              color: isActive ? "var(--accent-bright)" : "var(--text-muted)",
              border: isActive ? "1px solid rgba(196,123,58,0.25)" : "1px solid transparent",
              fontFamily: "var(--font-mono)",
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
          >
            {page.icon}
            {page.label}
          </motion.button>
        );
      })}
    </div>
  );
}
