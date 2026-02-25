"use client";

import { useState, useMemo } from "react";
import type { PortfolioQuote } from "@/lib/api";
import type { Holding } from "@/hooks/useHoldings";
import { getLogoUrl, formatCurrency, formatPercent } from "@/lib/portfolio-utils";

type SortKey = "symbol" | "price" | "change" | "shares" | "value" | "gain";
type SortDir = "asc" | "desc";

interface HoldingsTableProps {
  holdings: Holding[];
  quotes: Record<string, PortfolioQuote>;
  onSelectTicker: (ticker: string) => void;
  isDemo?: boolean;
  onRemoveHolding?: (symbol: string) => void;
}

export default function HoldingsTable({ holdings, quotes, onSelectTicker, isDemo, onRemoveHolding }: HoldingsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("value");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const rows = useMemo(() => {
    const mapped = holdings.map((h) => {
      const quote = quotes[h.symbol];
      const price = quote?.price ?? 0;
      const changePct = quote?.changePct ?? 0;
      const value = price > 0 ? price * h.shares : h.avgCostBasis * h.shares;
      const gainPct = h.avgCostBasis > 0 ? ((price - h.avgCostBasis) / h.avgCostBasis) * 100 : 0;
      const gainDollar = (price - h.avgCostBasis) * h.shares;
      return { ...h, price, changePct, value, gainPct, gainDollar, name: quote?.name ?? h.symbol };
    });

    mapped.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "symbol": cmp = a.symbol.localeCompare(b.symbol); break;
        case "price": cmp = a.price - b.price; break;
        case "change": cmp = a.changePct - b.changePct; break;
        case "shares": cmp = a.shares - b.shares; break;
        case "value": cmp = a.value - b.value; break;
        case "gain": cmp = a.gainPct - b.gainPct; break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return mapped;
  }, [holdings, quotes, sortKey, sortDir]);

  const columns: { key: SortKey; label: string; align: "left" | "right" }[] = [
    { key: "symbol", label: "Symbol", align: "left" },
    { key: "price", label: "Price", align: "right" },
    { key: "change", label: "Change", align: "right" },
    { key: "shares", label: "Shares", align: "right" },
    { key: "value", label: "Value", align: "right" },
    { key: "gain", label: "Gain/Loss", align: "right" },
  ];

  return (
    <div
      style={{
        background: "var(--glass)", borderRadius: 12,
        border: "1px solid var(--glass-border)",
        backdropFilter: "blur(12px)", overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isDemo ? "minmax(120px,1.5fr) repeat(5,1fr)" : "minmax(120px,1.5fr) repeat(5,1fr) 36px",
          padding: "10px 20px",
          borderBottom: "1px solid var(--glass-border)",
        }}
      >
        {columns.map((col) => (
          <button
            key={col.key}
            onClick={() => toggleSort(col.key)}
            style={{
              background: "transparent", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 4,
              justifyContent: col.align === "right" ? "flex-end" : "flex-start",
              fontSize: 11, fontWeight: 600, fontFamily: "var(--font-mono)",
              textTransform: "uppercase", letterSpacing: "0.04em",
              color: sortKey === col.key ? "var(--accent)" : "var(--text-muted)",
              padding: 0, transition: "color 100ms ease",
            }}
          >
            {col.label}
            {sortKey === col.key && (
              <svg width="8" height="8" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points={sortDir === "asc" ? "2,8 6,4 10,8" : "2,4 6,8 10,4"} />
              </svg>
            )}
          </button>
        ))}
        {!isDemo && <div />}
      </div>

      {/* Rows */}
      {rows.map((row) => {
        const logoUrl = getLogoUrl(row.symbol);
        const isProfit = row.gainPct >= 0;
        const isDayPositive = row.changePct >= 0;

        return (
          <div
            key={row._id}
            onClick={() => onSelectTicker(row.symbol)}
            style={{
              display: "grid",
              gridTemplateColumns: isDemo ? "minmax(120px,1.5fr) repeat(5,1fr)" : "minmax(120px,1.5fr) repeat(5,1fr) 36px",
              padding: "12px 20px",
              borderBottom: "1px solid rgba(236,227,213,0.04)",
              cursor: "pointer", transition: "background 80ms ease",
              alignItems: "center",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(236,227,213,0.02)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            {/* Symbol */}
            <div className="flex items-center" style={{ gap: 10, minWidth: 0 }}>
              {logoUrl ? (
                <img
                  src={logoUrl} alt="" width={24} height={24}
                  style={{ borderRadius: 6, flexShrink: 0, background: "rgba(255,255,255,0.06)" }}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <div
                  style={{
                    width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                    background: "rgba(236,227,213,0.06)", display: "flex",
                    alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 700, color: "var(--text-muted)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {row.symbol.charAt(0)}
                </div>
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
                  {row.symbol}
                </div>
                <div style={{
                  fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {row.name}
                </div>
              </div>
            </div>

            {/* Price */}
            <div style={{ textAlign: "right", fontSize: 13, fontWeight: 600, fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", color: "var(--text-primary)" }}>
              {row.price > 0 ? formatCurrency(row.price) : "-"}
            </div>

            {/* Change */}
            <div style={{
              textAlign: "right", fontSize: 12, fontWeight: 600, fontFamily: "var(--font-mono)",
              fontVariantNumeric: "tabular-nums",
              color: isDayPositive ? "var(--buy)" : "var(--sell)",
            }}>
              {formatPercent(row.changePct)}
            </div>

            {/* Shares */}
            <div style={{ textAlign: "right", fontSize: 13, fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", color: "var(--text-secondary)" }}>
              {row.shares}
            </div>

            {/* Value */}
            <div style={{ textAlign: "right", fontSize: 13, fontWeight: 600, fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", color: "var(--text-primary)" }}>
              {formatCurrency(row.value)}
            </div>

            {/* Gain/Loss */}
            <div style={{ textAlign: "right" }}>
              <div style={{
                fontSize: 12, fontWeight: 600, fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums",
                color: isProfit ? "var(--buy)" : "var(--sell)",
              }}>
                {formatPercent(row.gainPct)}
              </div>
              <div style={{
                fontSize: 10, fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums",
                color: isProfit ? "var(--buy)" : "var(--sell)", opacity: 0.7,
              }}>
                {isProfit ? "+" : ""}{formatCurrency(row.gainDollar)}
              </div>
            </div>

            {/* Remove */}
            {!isDemo && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                <button
                  onClick={(e) => { e.stopPropagation(); onRemoveHolding?.(row.symbol); }}
                  className="holdings-remove-btn"
                  style={{
                    width: 24, height: 24, borderRadius: 6,
                    background: "transparent", border: "none",
                    cursor: "pointer", display: "flex",
                    alignItems: "center", justifyContent: "center",
                    color: "var(--text-muted)", transition: "all 100ms ease",
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        );
      })}
      <style>{`
        .holdings-remove-btn:hover { color: var(--sell) !important; background: rgba(239,68,68,0.1) !important; }
      `}</style>
    </div>
  );
}
