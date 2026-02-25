"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";
import type { AppPage } from "@/components/PageNav/PageNav";

interface PromoAd {
  id: string;
  headline: string;
  cta: string;
  action: () => void;
}

interface PromoBannerProps {
  onPageChange: (page: AppPage) => void;
  onOpenSettings: () => void;
}

const SWIPE_THRESHOLD = 100;
const AUTO_ADVANCE_MS = 8000;

export default function PromoBanner({ onPageChange, onOpenSettings }: PromoBannerProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const isDragging = useRef(false);

  const ads: PromoAd[] = [
    {
      id: "mpesa-deposit",
      headline: "Deposit instantly via M-Pesa \u2014 zero fees",
      cta: "Fund account",
      action: () => onOpenSettings(),
    },
    {
      id: "nse-watchlist",
      headline: "Track NSE blue chips \u2014 Safaricom, Equity, KCB",
      cta: "Build watchlist",
      action: () => onPageChange("portfolio"),
    },
    {
      id: "t-bills",
      headline: "Kenya T-Bills yielding 16.8% \u2014 invest from KES 100",
      cta: "See rates",
      action: () => onPageChange("trade"),
    },
    {
      id: "refer-friend",
      headline: "Refer a friend, both earn KES 500 trading credit",
      cta: "Invite now",
      action: () => onOpenSettings(),
    },
  ];

  const visibleAds = ads.filter((ad) => !dismissed.has(ad.id));

  // Keep activeIndex in bounds when ads are dismissed
  useEffect(() => {
    if (visibleAds.length > 0 && activeIndex >= visibleAds.length) {
      setActiveIndex(visibleAds.length - 1);
    }
  }, [visibleAds.length, activeIndex]);

  // Auto-advance
  useEffect(() => {
    if (paused || visibleAds.length <= 1) return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % visibleAds.length);
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(interval);
  }, [paused, visibleAds.length]);

  const dismissCurrent = useCallback(() => {
    const ad = visibleAds[activeIndex];
    if (!ad) return;
    setDismissed((prev) => new Set(prev).add(ad.id));
  }, [visibleAds, activeIndex]);

  const handleDragStart = useCallback(() => {
    isDragging.current = true;
  }, []);

  const handleDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      if (Math.abs(info.offset.x) > SWIPE_THRESHOLD) {
        dismissCurrent();
      }
      // Reset drag flag after a tick so the click handler can check it
      requestAnimationFrame(() => {
        isDragging.current = false;
      });
    },
    [dismissCurrent]
  );

  const handleCardClick = useCallback(
    (ad: PromoAd) => {
      // Don't navigate if the user was swiping
      if (isDragging.current) return;
      ad.action();
    },
    []
  );

  if (visibleAds.length === 0) return null;

  const currentAd = visibleAds[activeIndex];

  return (
    <div
      style={{ marginBottom: 32, position: "relative" }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        style={{
          borderRadius: 12,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentAd.id}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onClick={() => handleCardClick(currentAd)}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -120 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            style={{
              background: "rgba(236,227,213,0.06)",
              borderRadius: 12,
              border: "1px solid var(--glass-border)",
              padding: "18px 24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: "pointer",
              userSelect: "none",
              position: "relative",
            }}
          >
            {/* Text content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  fontFamily: "var(--font-mono)",
                  lineHeight: 1.3,
                }}
              >
                {currentAd.headline}
              </div>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--buy)",
                  fontFamily: "var(--font-mono)",
                  marginTop: 4,
                  display: "inline-block",
                }}
              >
                {currentAd.cta}
              </span>
            </div>

            {/* Dismiss X button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                dismissCurrent();
              }}
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                width: 20,
                height: 20,
                borderRadius: "50%",
                border: "1px solid var(--glass-border)",
                background: "rgba(30,28,24,0.6)",
                color: "var(--text-muted)",
                fontSize: 12,
                lineHeight: "18px",
                textAlign: "center",
                cursor: "pointer",
                padding: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "color 100ms ease, border-color 100ms ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--text-secondary)";
                e.currentTarget.style.borderColor = "var(--text-muted)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--text-muted)";
                e.currentTarget.style.borderColor = "var(--glass-border)";
              }}
            >
              &times;
            </button>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Dot indicators */}
      {visibleAds.length > 1 && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 6,
            marginTop: 10,
          }}
        >
          {visibleAds.map((ad, i) => (
            <button
              key={ad.id}
              onClick={() => setActiveIndex(i)}
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                border: "none",
                padding: 0,
                cursor: "pointer",
                background:
                  i === activeIndex
                    ? "var(--accent)"
                    : "rgba(236,227,213,0.15)",
                transition: "background 150ms ease",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
