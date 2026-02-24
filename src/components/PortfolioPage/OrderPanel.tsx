"use client";

import { useState, useMemo } from "react";
import { formatCurrency } from "@/lib/portfolio-utils";

interface OrderPanelProps {
  ticker: string;
  name: string;
  price: number;
  balance: number;
}

type OrderSide = "buy" | "sell";
type OrderType = "market" | "limit";

export default function OrderPanel({ ticker, name, price, balance }: OrderPanelProps) {
  const [side, setSide] = useState<OrderSide>("buy");
  const [orderType, setOrderType] = useState<OrderType>("market");
  const [shares, setShares] = useState<number | string>(1);
  const [limitPrice, setLimitPrice] = useState<number | string>(price);

  const parsedShares = typeof shares === "string" ? parseFloat(shares) || 0 : shares;
  const parsedLimitPrice = typeof limitPrice === "string" ? parseFloat(limitPrice) || 0 : limitPrice;

  const estimatedTotal = useMemo(() => {
    const effectivePrice = orderType === "market" ? price : parsedLimitPrice;
    return parsedShares * effectivePrice;
  }, [parsedShares, parsedLimitPrice, price, orderType]);

  const isDisabled = parsedShares <= 0;

  const handleSubmit = () => {
    if (isDisabled) return;
    // Simulated order panel -- no-op
  };

  return (
    <div
      style={{
        width: 280,
        borderRadius: 16,
        background: "rgba(24,22,18,0.92)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(236,227,213,0.12)",
        boxShadow: "0 16px 48px rgba(0,0,0,0.4), 0 0 0 1px rgba(236,227,213,0.06)",
        display: "flex",
        flexDirection: "column",
        gap: 20,
        padding: 20,
        overflowY: "auto",
        alignSelf: "flex-start",
      }}
    >
      {/* Ticker Header */}
      <div style={{ textAlign: "center", paddingBottom: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
          {ticker}
        </div>
        {name && name !== ticker && (
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {name}
          </div>
        )}
      </div>

      {/* Tab Selector -- Buy / Sell */}
      <div
        style={{
          display: "flex",
          borderRadius: 10,
          padding: 3,
          background: "var(--bg-surface)",
        }}
      >
        <button
          onClick={() => setSide("buy")}
          style={{
            flex: 1,
            padding: "8px 0",
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 700,
            transition: "all 120ms ease",
            background: side === "buy" ? "var(--buy)" : "transparent",
            color: side === "buy" ? "#fff" : "var(--text-muted)",
          }}
        >
          Buy
        </button>
        <button
          onClick={() => setSide("sell")}
          style={{
            flex: 1,
            padding: "8px 0",
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 700,
            transition: "all 120ms ease",
            background: side === "sell" ? "var(--sell)" : "transparent",
            color: side === "sell" ? "#fff" : "var(--text-muted)",
          }}
        >
          Sell
        </button>
      </div>

      {/* Order Type Selector */}
      <div>
        <label
          style={{
            display: "block",
            fontSize: 11,
            color: "var(--text-muted)",
            marginBottom: 6,
            fontWeight: 500,
          }}
        >
          Order Type
        </label>
        <div style={{ position: "relative" }}>
          <select
            value={orderType}
            onChange={(e) => setOrderType(e.target.value as OrderType)}
            style={{
              width: "100%",
              padding: "8px 12px",
              paddingRight: 32,
              borderRadius: 8,
              border: "1px solid var(--glass-border)",
              background: "var(--bg-surface)",
              color: "var(--text-primary)",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              outline: "none",
              appearance: "none",
              WebkitAppearance: "none",
            }}
          >
            <option value="market">Market Order</option>
            <option value="limit">Limit Order</option>
          </select>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-muted)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              position: "absolute",
              right: 10,
              top: "50%",
              transform: "translateY(-50%)",
              pointerEvents: "none",
            }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      {/* Shares Input */}
      <div>
        <label
          style={{
            display: "block",
            fontSize: 11,
            color: "var(--text-muted)",
            marginBottom: 6,
            fontWeight: 500,
          }}
        >
          Shares
        </label>
        <input
          type="number"
          min={0}
          step={1}
          value={shares}
          onChange={(e) => setShares(e.target.value === "" ? "" : Number(e.target.value))}
          style={{
            width: "100%",
            padding: "8px 0",
            background: "transparent",
            border: "none",
            borderBottom: "1px solid var(--glass-border)",
            color: "var(--text-primary)",
            fontFamily: "var(--font-mono)",
            fontSize: 16,
            fontWeight: 600,
            textAlign: "right",
            outline: "none",
            fontVariantNumeric: "tabular-nums",
            MozAppearance: "textfield" as never,
          }}
        />
      </div>

      {/* Limit Price Input -- only for limit orders */}
      {orderType === "limit" && (
        <div>
          <label
            style={{
              display: "block",
              fontSize: 11,
              color: "var(--text-muted)",
              marginBottom: 6,
              fontWeight: 500,
            }}
          >
            Limit Price
          </label>
          <input
            type="number"
            min={0}
            step={0.01}
            value={limitPrice}
            onChange={(e) =>
              setLimitPrice(e.target.value === "" ? "" : Number(e.target.value))
            }
            style={{
              width: "100%",
              padding: "8px 0",
              background: "transparent",
              border: "none",
              borderBottom: "1px solid var(--glass-border)",
              color: "var(--text-primary)",
              fontFamily: "var(--font-mono)",
              fontSize: 16,
              fontWeight: 600,
              textAlign: "right",
              outline: "none",
              fontVariantNumeric: "tabular-nums",
              MozAppearance: "textfield" as never,
            }}
          />
        </div>
      )}

      {/* Estimated Cost / Credit Section */}
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        <div
          className="flex items-center justify-between"
          style={{ padding: "10px 0" }}
        >
          <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>
            {orderType === "market" ? "Market Price" : "Limit Price"}
          </span>
          <span
            style={{
              fontSize: 13,
              color: "var(--text-primary)",
              fontFamily: "var(--font-mono)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatCurrency(orderType === "market" ? price : parsedLimitPrice)}
          </span>
        </div>

        <div style={{ height: 1, background: "var(--divider)" }} />

        <div
          className="flex items-center justify-between"
          style={{ padding: "10px 0" }}
        >
          <span style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 700 }}>
            Estimated {side === "buy" ? "Cost" : "Credit"}
          </span>
          <span
            style={{
              fontSize: 13,
              color: "var(--text-primary)",
              fontFamily: "var(--font-mono)",
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatCurrency(estimatedTotal)}
          </span>
        </div>
      </div>

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={isDisabled}
        style={{
          width: "100%",
          height: 44,
          borderRadius: 10,
          border: "none",
          cursor: isDisabled ? "not-allowed" : "pointer",
          background: side === "buy" ? "var(--buy)" : "var(--sell)",
          color: "#fff",
          fontSize: 14,
          fontWeight: 700,
          opacity: isDisabled ? 0.5 : 1,
          transition: "opacity 120ms ease",
        }}
        onMouseEnter={(e) => {
          if (!isDisabled) e.currentTarget.style.opacity = "0.9";
        }}
        onMouseLeave={(e) => {
          if (!isDisabled) e.currentTarget.style.opacity = "1";
        }}
      >
        {side === "buy" ? "Buy" : "Sell"} {ticker}
      </button>

      {/* Buying Power / Shares Available Footer */}
      <div style={{ textAlign: "center", fontSize: 12, color: "var(--text-muted)" }}>
        {side === "buy" ? (
          <span>
            Buying Power:{" "}
            <span style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>
              {formatCurrency(balance)}
            </span>
          </span>
        ) : (
          <span>
            Shares Available:{" "}
            <span style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>
              0
            </span>
          </span>
        )}
      </div>
    </div>
  );
}
