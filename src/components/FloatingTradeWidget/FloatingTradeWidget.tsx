"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { motion } from "framer-motion";

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
  const dragOffset = useRef({ x: 0, y: 0 });

  // Sync internal visibility with parent prop
  useEffect(() => {
    setIsVisible(visible);
  }, [visible]);

  const bidPrice = currentPrice - spread / 2;
  const askPrice = currentPrice + spread / 2;

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Don't start drag if clicking on a button
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
    >
      {!isVisible ? (
        <button
          onClick={() => setIsVisible(true)}
          style={{
            background: "var(--bg-overlay)",
            border: "none",
            borderRadius: 20,
            padding: "6px 8px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg
            width={14}
            height={14}
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(255,255,255,0.6)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx={12} cy={12} r={3} />
          </svg>
        </button>
      ) : (
        <div className="trade-widget">
          {/* Eye toggle */}
          <button
            onClick={() => setIsVisible(false)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 2,
              display: "flex",
              alignItems: "center",
            }}
          >
            <svg
              width={14}
              height={14}
              viewBox="0 0 24 24"
              fill="none"
              stroke="rgba(255,255,255,0.6)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx={12} cy={12} r={3} />
            </svg>
          </button>

          {/* Bid (Sell) button */}
          <button
            className="bid-btn"
            onClick={() => onSell(bidPrice)}
          >
            {formatPrice(bidPrice, symbol)}
          </button>

          {/* Spread */}
          <span
            style={{
              fontSize: 10,
              color: "rgba(255,255,255,0.35)",
              fontVariantNumeric: "tabular-nums",
              minWidth: 20,
              textAlign: "center",
            }}
          >
            {spread.toFixed(2)}
          </span>

          {/* Ask (Buy) button */}
          <button
            className="ask-btn"
            onClick={() => onBuy(askPrice)}
          >
            {formatPrice(askPrice, symbol)}
          </button>

          {/* Grid / settings icon */}
          <svg
            width={14}
            height={14}
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(255,255,255,0.35)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ flexShrink: 0 }}
          >
            <rect x={3} y={3} width={7} height={7} />
            <rect x={14} y={3} width={7} height={7} />
            <rect x={3} y={14} width={7} height={7} />
            <rect x={14} y={14} width={7} height={7} />
          </svg>
        </div>
      )}
    </motion.div>
  );
}
