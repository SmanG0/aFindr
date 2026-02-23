"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface FloatingTradeWidgetProps {
  currentPrice: number;
  spread: number;
  symbol: string;
  onBuy: (price: number) => void;
  onSell: (price: number) => void;
  visible?: boolean;
}

function formatPrice(price: number, symbol: string): string {
  if (symbol === "GC=F") return price.toFixed(1);
  return price.toFixed(2);
}

export default function FloatingTradeWidget({
  currentPrice,
  spread,
  symbol,
  onBuy,
  onSell,
  visible = true,
}: FloatingTradeWidgetProps) {
  const [isVisible, setIsVisible] = useState(visible);
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [hovered, setHovered] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    setIsVisible(visible);
  }, [visible]);

  const bidPrice = currentPrice - spread / 2;
  const askPrice = currentPrice + spread / 2;

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest("button")) return;
      setIsDragging(true);
      dragOffset.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      };
    },
    [position],
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{
        position: "absolute",
        top: position.y,
        left: position.x,
        zIndex: 100,
        cursor: isDragging ? "grabbing" : "grab",
        userSelect: "none",
      }}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <AnimatePresence>
        {!isVisible ? (
          <motion.button
            key="collapsed"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => setIsVisible(true)}
            style={{
              background: "rgba(15,12,8,0.85)",
              border: "0.667px solid rgba(236,227,213,0.12)",
              borderRadius: 10,
              padding: "6px 10px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              backdropFilter: "blur(16px)",
            }}
          >
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth={2}>
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx={12} cy={12} r={3} />
            </svg>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-mono)" }}>Trade</span>
          </motion.button>
        ) : (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="trade-widget"
            style={{ position: "relative" }}
          >
            {/* Bid (Sell) button */}
            <button className="bid-btn" onClick={() => onSell(bidPrice)}>
              <span style={{ fontSize: 9, fontWeight: 700, opacity: 0.7, letterSpacing: "0.08em", display: "block", lineHeight: 1 }}>SELL</span>
              <span style={{ display: "block", lineHeight: 1, marginTop: 2 }}>{formatPrice(bidPrice, symbol)}</span>
            </button>

            {/* Spread */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 32, flexShrink: 0 }}>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", fontVariantNumeric: "tabular-nums", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>
                {spread.toFixed(2)}
              </span>
              <span style={{ fontSize: 7, color: "rgba(255,255,255,0.15)", fontFamily: "var(--font-mono)", marginTop: 1, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                spread
              </span>
            </div>

            {/* Ask (Buy) button */}
            <button className="ask-btn" onClick={() => onBuy(askPrice)}>
              <span style={{ fontSize: 9, fontWeight: 700, opacity: 0.7, letterSpacing: "0.08em", display: "block", lineHeight: 1 }}>BUY</span>
              <span style={{ display: "block", lineHeight: 1, marginTop: 2 }}>{formatPrice(askPrice, symbol)}</span>
            </button>

            {/* Hide button - only visible on hover */}
            <AnimatePresence>
              {hovered && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  onClick={() => setIsVisible(false)}
                  style={{
                    position: "absolute",
                    top: -8,
                    right: -8,
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    background: "rgba(15,12,8,0.95)",
                    border: "0.667px solid rgba(236,227,213,0.2)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 0,
                  }}
                >
                  <svg width={8} height={8} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth={3}>
                    <line x1={6} y1={6} x2={18} y2={18} />
                    <line x1={18} y1={6} x2={6} y2={18} />
                  </svg>
                </motion.button>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
