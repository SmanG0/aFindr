"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { ISeriesApi } from "lightweight-charts";

// ─── Types ───

interface PriceScalePlusButtonProps {
  chartContainerRef: React.RefObject<HTMLDivElement | null>;
  seriesApi: ISeriesApi<"Candlestick"> | null;
  theme: "dark" | "light";
  onBuyLimit: (price: number) => void;
  onSellLimit: (price: number) => void;
  onAddAlert?: (price: number) => void;
}

interface DropdownState {
  visible: boolean;
  x: number;
  y: number;
  price: number;
}

// ─── Constants ───

const PRICE_SCALE_WIDTH = 65;
const BUTTON_SIZE = 20;
const DROPDOWN_WIDTH = 180;

// ─── Component ───

export default function PriceScalePlusButton({
  chartContainerRef,
  seriesApi,
  theme,
  onBuyLimit,
  onSellLimit,
  onAddAlert,
}: PriceScalePlusButtonProps) {
  const isLight = theme === "light";

  const [cursorY, setCursorY] = useState<number | null>(null);
  const [isInPriceScale, setIsInPriceScale] = useState(false);
  const [dropdown, setDropdown] = useState<DropdownState>({
    visible: false,
    x: 0,
    y: 0,
    price: 0,
  });

  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);

  // ─── Convert Y pixel to price ───

  const yToPrice = useCallback(
    (localY: number): number => {
      if (!seriesApi) return 0;
      try {
        const price = seriesApi.coordinateToPrice(localY);
        return typeof price === "number" && isFinite(price) ? price : 0;
      } catch {
        return 0;
      }
    },
    [seriesApi]
  );

  // ─── Mouse tracking on chart container ───

  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const localX = e.clientX - rect.left;
      const localY = e.clientY - rect.top;
      const containerWidth = rect.width;

      const inPriceScale = localX >= containerWidth - PRICE_SCALE_WIDTH;

      setIsInPriceScale(inPriceScale);

      if (inPriceScale) {
        setCursorY(localY);
      }
    };

    const handleMouseLeave = () => {
      setIsInPriceScale(false);
      setCursorY(null);
    };

    container.addEventListener("mousemove", handleMouseMove);
    container.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [chartContainerRef]);

  // ─── Close dropdown on outside click or Escape ───

  useEffect(() => {
    if (!dropdown.visible) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setDropdown((prev) => ({ ...prev, visible: false }));
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDropdown((prev) => ({ ...prev, visible: false }));
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [dropdown.visible]);

  // ─── Handle + button click ───

  const handlePlusClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      if (cursorY === null) return;

      const price = yToPrice(cursorY);

      setDropdown({
        visible: true,
        x: -(DROPDOWN_WIDTH + 8),
        y: -BUTTON_SIZE / 2,
        price,
      });
    },
    [cursorY, yToPrice]
  );

  // ─── Menu item handlers ───

  const handleBuyLimit = useCallback(() => {
    onBuyLimit(dropdown.price);
    setDropdown((prev) => ({ ...prev, visible: false }));
  }, [dropdown.price, onBuyLimit]);

  const handleSellLimit = useCallback(() => {
    onSellLimit(dropdown.price);
    setDropdown((prev) => ({ ...prev, visible: false }));
  }, [dropdown.price, onSellLimit]);

  const handleAddAlert = useCallback(() => {
    if (onAddAlert) {
      onAddAlert(dropdown.price);
    }
    setDropdown((prev) => ({ ...prev, visible: false }));
  }, [dropdown.price, onAddAlert]);

  // ─── Don't render if not hovering price scale ───

  const showButton = isInPriceScale && cursorY !== null;

  if (!showButton && !dropdown.visible) return null;

  return (
    <>
      {/* ─── Floating "+" Button ─── */}
      {showButton && (
        <div
          ref={buttonRef}
          onClick={handlePlusClick}
          style={{
            position: "absolute",
            right: PRICE_SCALE_WIDTH - BUTTON_SIZE / 2,
            top: cursorY - BUTTON_SIZE / 2,
            width: BUTTON_SIZE,
            height: BUTTON_SIZE,
            borderRadius: "50%",
            background: isLight
              ? "rgba(0,0,0,0.08)"
              : "rgba(236,227,213,0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            zIndex: 100,
            boxShadow: isLight
              ? "0 1px 4px rgba(0,0,0,0.12)"
              : "0 1px 4px rgba(0,0,0,0.4)",
            animation: "priceScalePlusFadeIn 0.15s ease-out",
            transition: "top 0.05s linear",
            pointerEvents: "auto",
            userSelect: "none",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = isLight
              ? "rgba(0,0,0,0.14)"
              : "rgba(236,227,213,0.2)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = isLight
              ? "rgba(0,0,0,0.08)"
              : "rgba(236,227,213,0.12)";
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              lineHeight: 1,
              color: isLight ? "rgba(0,0,0,0.55)" : "rgba(236,227,213,0.7)",
              fontFamily: "'Inter', system-ui, sans-serif",
            }}
          >
            +
          </span>
        </div>
      )}

      {/* ─── Dropdown Menu ─── */}
      {dropdown.visible && (
        <div
          ref={dropdownRef}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            right: PRICE_SCALE_WIDTH + BUTTON_SIZE / 2 + 8,
            top: Math.max(
              8,
              Math.min(
                (cursorY ?? dropdown.y) - 40,
                (chartContainerRef.current?.clientHeight ?? 400) - 120
              )
            ),
            width: DROPDOWN_WIDTH,
            background: isLight ? "#ffffff" : "rgba(30,30,34,0.98)",
            border: `1px solid ${
              isLight ? "rgba(0,0,0,0.12)" : "rgba(236,227,213,0.1)"
            }`,
            borderRadius: 6,
            boxShadow: isLight
              ? "0 6px 24px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.08)"
              : "0 6px 24px rgba(0,0,0,0.5), 0 2px 6px rgba(0,0,0,0.3)",
            padding: "3px 0",
            zIndex: 200,
            backdropFilter: "blur(16px)",
            animation: "priceScalePlusFadeIn 0.12s ease-out",
          }}
        >
          {/* Price header */}
          <div
            style={{
              padding: "5px 10px 4px",
              fontSize: 9,
              color: isLight ? "rgba(0,0,0,0.35)" : "rgba(236,227,213,0.35)",
              fontFamily: "var(--font-mono), monospace",
              borderBottom: `1px solid ${
                isLight ? "rgba(0,0,0,0.06)" : "rgba(236,227,213,0.06)"
              }`,
              marginBottom: 2,
              letterSpacing: "0.03em",
              textTransform: "uppercase",
            }}
          >
            Quick Actions
          </div>

          {/* Buy Limit */}
          <MenuItem
            label={`Buy Limit @ ${dropdown.price.toFixed(2)}`}
            color="#22c55e"
            icon="▲"
            isLight={isLight}
            onClick={handleBuyLimit}
          />

          {/* Sell Limit */}
          <MenuItem
            label={`Sell Limit @ ${dropdown.price.toFixed(2)}`}
            color="#ef4444"
            icon="▼"
            isLight={isLight}
            onClick={handleSellLimit}
          />

          {/* Add Alert */}
          {onAddAlert && (
            <MenuItem
              label={`Add Alert @ ${dropdown.price.toFixed(2)}`}
              color="#c47b3a"
              icon="◆"
              isLight={isLight}
              onClick={handleAddAlert}
            />
          )}
        </div>
      )}

      {/* ─── Inline keyframe animation ─── */}
      <style>{`
        @keyframes priceScalePlusFadeIn {
          from {
            opacity: 0;
            transform: scale(0.92);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </>
  );
}

// ─── Menu Item ───

function MenuItem({
  label,
  color,
  icon,
  isLight,
  onClick,
}: {
  label: string;
  color: string;
  icon: string;
  isLight: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 7,
        width: "100%",
        padding: "5px 10px",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        fontSize: 11,
        color,
        fontFamily: "'Inter', system-ui, sans-serif",
        textAlign: "left",
        lineHeight: 1.3,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = isLight
          ? "rgba(0,0,0,0.04)"
          : "rgba(236,227,213,0.06)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <span
        style={{
          fontSize: 8,
          width: 14,
          textAlign: "center",
          flexShrink: 0,
          fontWeight: 700,
        }}
      >
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}
