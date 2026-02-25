/**
 * AgentControlOverlay — frosted glass overlay with animated cursor
 * that appears when Alphy takes control of the UI.
 */

"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface AgentControlOverlayProps {
  isActive: boolean;
  cursorPosition: { x: number; y: number };
  highlightedTarget: string | null;
  statusLabel: string;
  progress: { current: number; total: number };
  onCancel: () => void;
}

export default function AgentControlOverlay({
  isActive,
  cursorPosition,
  highlightedTarget,
  statusLabel,
  progress,
  onCancel,
}: AgentControlOverlayProps) {
  const highlightRef = useRef<{ top: number; left: number; width: number; height: number } | null>(null);

  // Track highlighted element position
  useEffect(() => {
    if (!highlightedTarget) {
      highlightRef.current = null;
      return;
    }
    const el = document.querySelector(`[data-agent-target="${highlightedTarget}"]`);
    if (el) {
      const rect = el.getBoundingClientRect();
      highlightRef.current = {
        top: rect.top - 4,
        left: rect.left - 4,
        width: rect.width + 8,
        height: rect.height + 8,
      };
    }
  }, [highlightedTarget]);

  const highlightRect = highlightRef.current;

  return (
    <AnimatePresence>
      {isActive && (
        <>
          {/* Glass overlay */}
          <motion.div
            key="agent-glass"
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{ opacity: 1, backdropFilter: "blur(6px) saturate(120%)" }}
            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            onClick={onCancel}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9998,
              background: "rgba(10, 14, 30, 0.35)",
              pointerEvents: "auto",
              cursor: "default",
            }}
          />

          {/* Element highlight */}
          <AnimatePresence>
            {highlightRect && (
              <motion.div
                key="agent-highlight"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                style={{
                  position: "fixed",
                  top: highlightRect.top,
                  left: highlightRect.left,
                  width: highlightRect.width,
                  height: highlightRect.height,
                  borderRadius: 8,
                  border: "2px solid rgba(0, 200, 255, 0.6)",
                  boxShadow: "0 0 20px rgba(0, 200, 255, 0.15), 0 0 40px rgba(0, 200, 255, 0.08)",
                  zIndex: 10001,
                  pointerEvents: "none",
                }}
              />
            )}
          </AnimatePresence>

          {/* Agent cursor */}
          <motion.div
            key="agent-cursor"
            animate={{
              x: cursorPosition.x - 6,
              y: cursorPosition.y - 6,
            }}
            transition={{
              type: "spring",
              stiffness: 120,
              damping: 20,
              mass: 0.8,
            }}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: "#00C2FF",
              boxShadow: "0 0 12px rgba(0, 194, 255, 0.6), 0 0 30px rgba(0, 194, 255, 0.2)",
              zIndex: 10002,
              pointerEvents: "none",
            }}
          >
            {/* Pulsing ring */}
            <motion.div
              animate={{ scale: [1, 2.5], opacity: [0.6, 0] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
              style={{
                position: "absolute",
                inset: -2,
                borderRadius: "50%",
                border: "1.5px solid rgba(0, 194, 255, 0.5)",
              }}
            />
          </motion.div>

          {/* Status pill */}
          <motion.div
            key="agent-status"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            style={{
              position: "fixed",
              top: 16,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 10003,
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 16px",
              borderRadius: 20,
              background: "rgba(20, 24, 40, 0.75)",
              backdropFilter: "blur(12px) saturate(150%)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              boxShadow: "0 4px 24px rgba(0, 0, 0, 0.3)",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "rgba(255, 255, 255, 0.9)",
              pointerEvents: "auto",
            }}
          >
            {/* Pulsing dot */}
            <span style={{ position: "relative", width: 8, height: 8, flexShrink: 0 }}>
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  background: "#00C2FF",
                }}
              />
              <motion.span
                animate={{ scale: [1, 2], opacity: [0.8, 0] }}
                transition={{ duration: 1, repeat: Infinity }}
                style={{
                  position: "absolute",
                  inset: -2,
                  borderRadius: "50%",
                  background: "rgba(0, 194, 255, 0.4)",
                }}
              />
            </span>

            <span>{statusLabel}</span>

            {progress.total > 1 && (
              <span style={{ opacity: 0.5 }}>
                {progress.current}/{progress.total}
              </span>
            )}

            <button
              onClick={onCancel}
              style={{
                marginLeft: 4,
                padding: "2px 8px",
                borderRadius: 10,
                border: "1px solid rgba(255, 100, 100, 0.3)",
                background: "rgba(255, 80, 80, 0.15)",
                color: "rgba(255, 150, 150, 0.9)",
                fontSize: 10,
                fontFamily: "var(--font-mono)",
                cursor: "pointer",
              }}
            >
              Stop
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
