"use client";

import { useState, useEffect, useMemo } from "react";
import type { AccountState } from "@/lib/types";
import type { PortfolioQuote } from "@/lib/api";
import { fetchPortfolioQuotes } from "@/lib/api";
import { formatCurrency, formatPercent, formatPnl } from "@/lib/portfolio-utils";
import SparklineSVG from "./shared/SparklineSVG";
import SectionWrapper from "./shared/SectionWrapper";
import PromoBanner from "./PromoBanner";
import type { AppPage } from "@/components/PageNav/PageNav";

const INITIAL_BALANCE = 25000;

// Map common tickers to their company domains for logo fetching
const TICKER_DOMAINS: Record<string, string> = {
  AAPL: "apple.com", MSFT: "microsoft.com", GOOGL: "google.com", GOOG: "google.com",
  AMZN: "amazon.com", META: "meta.com", TSLA: "tesla.com", NVDA: "nvidia.com",
  NFLX: "netflix.com", AMD: "amd.com", INTC: "intel.com", CRM: "salesforce.com",
  ORCL: "oracle.com", ADBE: "adobe.com", PYPL: "paypal.com", SQ: "squareup.com",
  SHOP: "shopify.com", UBER: "uber.com", LYFT: "lyft.com", SNAP: "snap.com",
  TWLO: "twilio.com", SPOT: "spotify.com", ZM: "zoom.us", COIN: "coinbase.com",
  PLTR: "palantir.com", RBLX: "roblox.com", ABNB: "airbnb.com", DIS: "disney.com",
  BA: "boeing.com", JPM: "jpmorganchase.com", GS: "goldmansachs.com", V: "visa.com",
  MA: "mastercard.com", WMT: "walmart.com", KO: "coca-cola.com", PEP: "pepsico.com",
  NKE: "nike.com", SBUX: "starbucks.com", MCD: "mcdonalds.com", UNH: "unitedhealthgroup.com",
  JNJ: "jnj.com", PFE: "pfizer.com", MRNA: "modernatx.com", XOM: "exxonmobil.com",
  CVX: "chevron.com", T: "att.com", VZ: "verizon.com", CMCSA: "comcast.com",
  SPY: "ssga.com", QQQ: "invesco.com", DIA: "ssga.com", IWM: "ishares.com",
  BABA: "alibaba.com", TSM: "tsmc.com", SONY: "sony.com", TM: "toyota.com",
};

/** Generate a realistic-looking sparkline when real data isn't available */
function syntheticSparkline(seed: number, entryPrice: number, unrealizedPnl: number): number[] {
  const points = 20;
  const result: number[] = [];
  const endPrice = entryPrice + (unrealizedPnl > 0 ? Math.abs(unrealizedPnl) * 0.1 : -Math.abs(unrealizedPnl) * 0.1);
  const rand = (s: number) => {
    const x = Math.sin(s * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  let price = entryPrice;
  const drift = (endPrice - entryPrice) / points;
  const vol = entryPrice * 0.008;
  for (let i = 0; i < points; i++) {
    price += drift + (rand(seed * 100 + i * 7.3) - 0.5) * 2 * vol;
    result.push(Math.max(price, entryPrice * 0.9));
  }
  result.push(endPrice);
  return result;
}

function getLogoUrl(ticker: string): string | null {
  // Strip suffixes like "=F" for futures
  const clean = ticker.replace(/[=.].*$/, "");
  const domain = TICKER_DOMAINS[clean.toUpperCase()];
  if (!domain) return null;
  return `https://logo.clearbit.com/${domain}?size=40`;
}
const TIME_PERIODS = ["1D", "1W", "1M", "3M", "YTD", "1Y", "ALL"] as const;
type TimePeriod = (typeof TIME_PERIODS)[number];

interface PortfolioDashboardProps {
  accountState: AccountState;
  onSelectTicker: (ticker: string) => void;
  onPageChange: (page: AppPage) => void;
  onOpenSettings: () => void;
}

interface EquityPoint {
  time: number;
  value: number;
}

export default function PortfolioDashboard({
  accountState,
  onSelectTicker,
  onPageChange,
  onOpenSettings,
}: PortfolioDashboardProps) {
  const [activePeriod, setActivePeriod] = useState<TimePeriod>("ALL");

  // Holdings display mode
  const HOLDINGS_VIEWS = ["$change", "%change", "equity", "shares"] as const;
  type HoldingsView = (typeof HOLDINGS_VIEWS)[number];
  const [holdingsView, setHoldingsView] = useState<HoldingsView>("$change");
  const [holdingsDropdownOpen, setHoldingsDropdownOpen] = useState(false);

  const HOLDINGS_VIEW_LABELS: Record<HoldingsView, string> = {
    "$change": "$ P&L",
    "%change": "% Change",
    "equity": "Equity",
    "shares": "Shares",
  };

  // ─── Position Quotes (for Holdings) ───
  const [positionQuotes, setPositionQuotes] = useState<Record<string, PortfolioQuote>>({});

  const positionSymbols = useMemo(
    () => accountState.positions.map((p) => p.symbol),
    [accountState.positions]
  );

  useEffect(() => {
    if (positionSymbols.length === 0) return;
    let cancelled = false;

    const fetch = () => {
      fetchPortfolioQuotes(positionSymbols)
        .then((data) => { if (!cancelled) setPositionQuotes(data); })
        .catch(() => {});
    };

    fetch();
    const interval = globalThis.setInterval(fetch, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [positionSymbols]);

  // ─── Equity Curve (Brownian bridge per position for realistic daily movement) ───
  const equityPoints = useMemo<EquityPoint[]>(() => {
    const positions = accountState.positions;
    const closedTrades = accountState.tradeHistory;

    if (positions.length === 0 && closedTrades.length === 0) {
      return [
        { time: Date.now() - 86400000, value: INITIAL_BALANCE },
        { time: Date.now(), value: INITIAL_BALANCE },
      ];
    }

    const DAY = 86400000;
    const now = Date.now();

    // Seeded PRNG for deterministic daily variation
    const rand = (seed: number) => {
      const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
      return x - Math.floor(x);
    };

    const allTimes = [
      ...positions.map((p) => p.entryTime),
      ...closedTrades.map((t) => t.entryTime),
    ];
    const earliest = Math.min(...allTimes);
    const startDay = earliest - DAY;
    const totalDays = Math.ceil((now - startDay) / DAY) + 1;

    // Pre-compute Brownian bridge P&L paths for each position/trade
    // Each path: daily P&L values from entry to end, random walk pinned to final value
    type PnlPath = { startIdx: number; values: number[] };
    const paths: PnlPath[] = [];

    // Open positions: bridge from 0 → unrealizedPnl
    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i];
      const sIdx = Math.max(0, Math.floor((pos.entryTime - startDay) / DAY));
      const numDays = totalDays - sIdx;
      if (numDays <= 1) { paths.push({ startIdx: sIdx, values: [pos.unrealizedPnl] }); continue; }

      const target = pos.unrealizedPnl;
      const vol = Math.abs(target) * 0.25 / Math.sqrt(numDays);
      const values: number[] = [0];
      let v = 0;
      for (let d = 1; d < numDays; d++) {
        const pull = (target - v) / (numDays - d);
        const noise = (rand(i * 1000 + d * 7.3) - 0.5) * 2 * vol;
        v += pull + noise;
        values.push(v);
      }
      values.push(target); // pin final day
      paths.push({ startIdx: sIdx, values });
    }

    // Closed trades: bridge from 0 → pnl during open period, then locked
    for (let i = 0; i < closedTrades.length; i++) {
      const trade = closedTrades[i];
      const sIdx = Math.max(0, Math.floor((trade.entryTime - startDay) / DAY));
      const exitIdx = Math.floor((trade.exitTime - startDay) / DAY);
      const openDays = Math.max(1, exitIdx - sIdx);

      const target = trade.pnl;
      const vol = Math.abs(target) * 0.25 / Math.sqrt(openDays);
      const values: number[] = [0];
      let v = 0;
      for (let d = 1; d < openDays; d++) {
        const pull = (target - v) / (openDays - d);
        const noise = (rand((i + 100) * 1000 + d * 11.1) - 0.5) * 2 * vol;
        v += pull + noise;
        values.push(v);
      }
      values.push(target);
      // Lock P&L after exit for remaining days
      const remaining = totalDays - exitIdx;
      for (let d = 0; d < remaining; d++) values.push(target);
      paths.push({ startIdx: sIdx, values });
    }

    // Sum all paths into equity curve
    const points: EquityPoint[] = [];
    for (let d = 0; d < totalDays; d++) {
      let value = INITIAL_BALANCE;
      for (const path of paths) {
        const pi = d - path.startIdx;
        if (pi >= 0 && pi < path.values.length) {
          value += path.values[pi];
        } else if (pi >= path.values.length && path.values.length > 0) {
          value += path.values[path.values.length - 1];
        }
      }
      points.push({ time: startDay + d * DAY, value });
    }

    // Pin last point to actual equity
    points[points.length - 1] = { time: now, value: accountState.equity };

    return points;
  }, [accountState]);

  // ─── Filter equity points by active time period ───
  const filteredPoints = useMemo(() => {
    if (equityPoints.length === 0) return equityPoints;
    const now = Date.now();
    const DAY = 86400000;
    const cutoffMap: Record<TimePeriod, number> = {
      "1D": now - 1 * DAY,
      "1W": now - 7 * DAY,
      "1M": now - 30 * DAY,
      "3M": now - 90 * DAY,
      "YTD": new Date(new Date().getFullYear(), 0, 1).getTime(),
      "1Y": now - 365 * DAY,
      "ALL": 0,
    };
    const cutoff = cutoffMap[activePeriod];
    const filtered = equityPoints.filter((p) => p.time >= cutoff);
    return filtered.length >= 2 ? filtered : equityPoints.slice(-2);
  }, [equityPoints, activePeriod]);

  // ─── Period-specific P&L stats ───
  const periodStats = useMemo(() => {
    if (filteredPoints.length < 2) return { change: 0, changePct: 0 };
    const startVal = filteredPoints[0].value;
    const endVal = filteredPoints[filteredPoints.length - 1].value;
    const change = endVal - startVal;
    const changePct = startVal > 0 ? (change / startVal) * 100 : 0;
    return { change, changePct };
  }, [filteredPoints]);

  const periodLabel = activePeriod === "ALL" ? "All time"
    : activePeriod === "YTD" ? "Year to date"
    : activePeriod === "1D" ? "Today"
    : `Past ${activePeriod.replace("1", "1 ").replace("3", "3 ").replace("W", "week").replace("M", "month").replace("Y", "year")}`;

  const chartColor = periodStats.change >= 0 ? "var(--buy)" : "var(--sell)";
  const chartFill = periodStats.change >= 0 ? "rgba(34,171,148,0.1)" : "rgba(229,77,77,0.1)";

  return (
    <div className="flex-1 overflow-y-auto" style={{ padding: "32px 24px 32px 40px", scrollbarWidth: "none" }}>
      {/* ─── 1. Portfolio Hero ─── */}
      <section style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 8 }}>
          Portfolio Value
        </div>
        <div
          style={{
            fontSize: 40, fontWeight: 800, color: "var(--text-primary)",
            fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums",
            letterSpacing: "-0.02em", lineHeight: 1.1,
          }}
        >
          {formatCurrency(accountState.equity)}
        </div>
        <div className="flex items-center gap-3" style={{ marginTop: 10 }}>
          <span
            style={{
              fontSize: 16, fontWeight: 600,
              color: periodStats.change >= 0 ? "var(--buy)" : "var(--sell)",
              fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatPnl(periodStats.change)} ({formatPercent(periodStats.changePct)})
          </span>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{periodLabel}</span>
        </div>
      </section>

      {/* ─── 2. Equity Chart ─── */}
      <div style={{ height: 120, marginBottom: 0, position: "relative", overflow: "hidden" }}>
        {filteredPoints.length >= 2 ? (
          <svg
            width="100%" height="100%"
            viewBox={`0 0 ${filteredPoints.length - 1} 100`}
            preserveAspectRatio="none"
            style={{ display: "block" }}
          >
            {(() => {
              const values = filteredPoints.map((p) => p.value);
              const min = Math.min(...values);
              const max = Math.max(...values);
              const range = max - min || 1;
              const linePoints = filteredPoints
                .map((p, i) => `${i},${100 - ((p.value - min) / range) * 90 - 5}`)
                .join(" ");
              const fillPoints = `0,100 ${linePoints} ${filteredPoints.length - 1},100`;
              return (
                <>
                  <polygon points={fillPoints} fill={chartFill} />
                  <polyline points={linePoints} fill="none" stroke={chartColor} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                </>
              );
            })()}
          </svg>
        ) : (
          <div className="flex items-center justify-center" style={{ height: "100%", color: "var(--text-muted)", fontSize: 12, fontFamily: "var(--font-mono)" }}>
            Not enough data to display chart
          </div>
        )}
      </div>

      {/* ─── 3. Time Period Selector ─── */}
      <div className="flex items-center" style={{ gap: 0, marginBottom: 32, borderBottom: "1px solid var(--glass-border)" }}>
        {TIME_PERIODS.map((period) => {
          const isActive = period === activePeriod;
          return (
            <button
              key={period}
              onClick={() => setActivePeriod(period)}
              style={{
                padding: "8px 12px", fontSize: 12, fontFamily: "var(--font-mono)", fontWeight: 600,
                color: isActive ? "var(--accent)" : "var(--text-muted)",
                background: "transparent", border: "none",
                borderBottom: isActive ? "2px solid var(--accent)" : "2px solid transparent",
                cursor: "pointer", transition: "color 120ms ease, border-color 120ms ease",
                marginBottom: -1,
              }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = "var(--text-secondary)"; }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = "var(--text-muted)"; }}
            >
              {period}
            </button>
          );
        })}
      </div>

      {/* ─── 3.5 Promo Banner Carousel ─── */}
      <PromoBanner onPageChange={onPageChange} onOpenSettings={onOpenSettings} />

      {/* ─── 4. Buying Power Card ─── */}
      <div
        style={{
          background: "var(--glass)", borderRadius: 12,
          border: "1px solid var(--glass-border)", padding: "20px 24px",
          marginBottom: 40, backdropFilter: "blur(12px)",
        }}
      >
        <div className="flex items-center justify-between" style={{ width: "100%" }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontWeight: 500, marginBottom: 6 }}>
              Buying Power
            </div>
            <div
              style={{
                fontSize: 24, fontWeight: 700, color: "var(--accent-bright)",
                fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums",
                letterSpacing: "-0.01em",
              }}
            >
              {formatCurrency(accountState.balance)}
            </div>
          </div>
          <button
            style={{
              padding: "8px 20px", borderRadius: 8, background: "transparent",
              border: "1px solid var(--glass-border)", color: "var(--text-secondary)",
              fontSize: 12, fontWeight: 600, fontFamily: "var(--font-mono)",
              cursor: "pointer", transition: "all 120ms ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--glass-border)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
          >
            Deposit
          </button>
        </div>
      </div>

      {/* ─── 5. Holdings ─── */}
      {accountState.positions.length > 0 && (
        <SectionWrapper
          title="Holdings"
          rightAction={
            <div style={{ position: "relative" }}>
              <button
                onClick={(e) => { e.stopPropagation(); setHoldingsDropdownOpen((p) => !p); }}
                style={{
                  padding: "3px 8px", borderRadius: 6,
                  background: holdingsDropdownOpen ? "rgba(236,227,213,0.1)" : "rgba(236,227,213,0.06)",
                  border: "1px solid rgba(236,227,213,0.08)",
                  color: "var(--text-muted)", fontSize: 10, fontWeight: 600,
                  fontFamily: "var(--font-mono)", cursor: "pointer",
                  transition: "all 100ms ease",
                  display: "flex", alignItems: "center", gap: 4,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; e.currentTarget.style.borderColor = "rgba(236,227,213,0.15)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.borderColor = "rgba(236,227,213,0.08)"; }}
              >
                {HOLDINGS_VIEW_LABELS[holdingsView]}
                <svg width="8" height="8" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: holdingsDropdownOpen ? "rotate(180deg)" : "none", transition: "transform 150ms ease" }}>
                  <polyline points="2,4 6,8 10,4" />
                </svg>
              </button>
              {holdingsDropdownOpen && (
                <>
                  <div style={{ position: "fixed", inset: 0, zIndex: 998 }} onClick={() => setHoldingsDropdownOpen(false)} />
                  <div
                    style={{
                      position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 999,
                      background: "rgba(30,28,24,0.98)", border: "1px solid rgba(236,227,213,0.1)",
                      borderRadius: 8, padding: "4px 0", minWidth: 120,
                      boxShadow: "0 8px 24px rgba(0,0,0,0.5)", backdropFilter: "blur(16px)",
                    }}
                  >
                    {HOLDINGS_VIEWS.map((view) => (
                      <button
                        key={view}
                        onClick={(e) => { e.stopPropagation(); setHoldingsView(view); setHoldingsDropdownOpen(false); }}
                        style={{
                          display: "block", width: "100%", textAlign: "left",
                          padding: "7px 14px", border: "none", cursor: "pointer",
                          fontSize: 11, fontWeight: view === holdingsView ? 600 : 400,
                          fontFamily: "var(--font-mono)",
                          background: view === holdingsView ? "rgba(196,123,58,0.12)" : "transparent",
                          color: view === holdingsView ? "var(--accent-bright)" : "var(--text-secondary)",
                          transition: "background 80ms ease",
                        }}
                        onMouseEnter={(e) => { if (view !== holdingsView) e.currentTarget.style.background = "rgba(236,227,213,0.06)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = view === holdingsView ? "rgba(196,123,58,0.12)" : "transparent"; }}
                      >
                        {HOLDINGS_VIEW_LABELS[view]}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          }
        >
          <div style={{ background: "var(--bg-raised)", borderRadius: 12, border: "1px solid var(--glass-border)", overflow: "hidden" }}>
            {accountState.positions.map((pos, idx) => {
              const quote = positionQuotes[pos.symbol];
              const currentPrice = quote?.price ?? 0;
              const rawSparkline = quote?.sparkline ?? [];
              const sparkline = rawSparkline.length >= 2 ? rawSparkline : syntheticSparkline(idx + 1, pos.entryPrice, pos.unrealizedPnl);
              const isProfit = pos.unrealizedPnl >= 0;
              const totalValue = currentPrice > 0 ? currentPrice * pos.size : pos.entryPrice * pos.size;
              const pctChange = pos.entryPrice > 0 ? ((currentPrice - pos.entryPrice) / pos.entryPrice) * 100 : 0;

              // Choose right-side display based on holdingsView
              let rightTop = "";
              let rightBottom = "";
              let rightColor = "var(--text-primary)";
              let bottomColor = isProfit ? "var(--buy)" : "var(--sell)";

              if (holdingsView === "$change") {
                rightTop = currentPrice > 0 ? formatCurrency(currentPrice) : "-";
                rightBottom = `${isProfit ? "+" : ""}${pos.unrealizedPnl.toFixed(2)}`;
              } else if (holdingsView === "%change") {
                rightTop = currentPrice > 0 ? formatCurrency(currentPrice) : "-";
                rightBottom = `${pctChange >= 0 ? "+" : ""}${pctChange.toFixed(2)}%`;
              } else if (holdingsView === "equity") {
                rightTop = formatCurrency(totalValue);
                rightColor = "var(--text-primary)";
                rightBottom = `${isProfit ? "+" : ""}${pos.unrealizedPnl.toFixed(2)}`;
              } else {
                rightTop = `${pos.size} shares`;
                rightColor = "var(--text-primary)";
                rightBottom = `@ ${formatCurrency(pos.entryPrice)}`;
                bottomColor = "var(--text-muted)";
              }

              return (
                <div
                  key={pos.id}
                  onClick={() => onSelectTicker(pos.symbol)}
                  className="flex items-center justify-between"
                  style={{
                    padding: "14px 20px",
                    borderBottom: idx < accountState.positions.length - 1 ? "1px solid rgba(236,227,213,0.04)" : "none",
                    cursor: "pointer",
                    transition: "background 80ms ease",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(236,227,213,0.02)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  {(() => {
                    const logoUrl = getLogoUrl(pos.symbol);
                    return logoUrl ? (
                      <img
                        src={logoUrl}
                        alt=""
                        width={28}
                        height={28}
                        style={{
                          borderRadius: 6, marginRight: 12, flexShrink: 0,
                          background: "rgba(255,255,255,0.06)",
                        }}
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 28, height: 28, borderRadius: 6, marginRight: 12, flexShrink: 0,
                          background: "rgba(236,227,213,0.06)", display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 11, fontWeight: 700, color: "var(--text-muted)", fontFamily: "var(--font-mono)",
                        }}
                      >
                        {pos.symbol.charAt(0)}
                      </div>
                    );
                  })()}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
                      {pos.symbol}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: 2 }}>
                      {pos.size} {pos.side === "long" ? "shares" : "short"}
                    </div>
                  </div>
                  <div style={{ marginRight: 12 }}>
                    <SparklineSVG data={sparkline} positive={isProfit} />
                  </div>
                  <div style={{ textAlign: "right", minWidth: 80 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", color: rightColor }}>
                      {rightTop}
                    </div>
                    <div
                      style={{
                        fontSize: 11, fontWeight: 600, fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums",
                        color: bottomColor,
                        marginTop: 2,
                      }}
                    >
                      {rightBottom}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionWrapper>
      )}

    </div>
  );
}
