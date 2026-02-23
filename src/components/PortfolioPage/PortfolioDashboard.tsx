"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import type { AccountState } from "@/lib/types";
import type { MarketIndicator } from "@/lib/api";
import { fetchMarketIndicators } from "@/lib/api";
import { formatCurrency, formatPercent, formatPnl } from "@/lib/portfolio-utils";
import SectionWrapper from "./shared/SectionWrapper";

const INITIAL_BALANCE = 25000;
const TIME_PERIODS = ["1D", "1W", "1M", "3M", "YTD", "1Y", "ALL"] as const;
type TimePeriod = (typeof TIME_PERIODS)[number];

const INDEX_TO_ETF: Record<string, string> = {
  "^GSPC": "SPY",
  "^IXIC": "QQQ",
  "^DJI": "DIA",
};

interface PortfolioDashboardProps {
  accountState: AccountState;
  onSelectTicker: (ticker: string) => void;
}

interface EquityPoint {
  time: number;
  value: number;
}

export default function PortfolioDashboard({
  accountState,
  onSelectTicker,
}: PortfolioDashboardProps) {
  const [activePeriod, setActivePeriod] = useState<TimePeriod>("ALL");
  const [marketIndicators, setMarketIndicators] = useState<MarketIndicator[]>([]);
  const [marketLoading, setMarketLoading] = useState(true);

  // ─── Fetch Market Indicators ───
  useEffect(() => {
    let cancelled = false;
    setMarketLoading(true);
    fetchMarketIndicators()
      .then((res) => {
        if (!cancelled) {
          setMarketIndicators(res.indicators);
          setMarketLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setMarketLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // ─── Portfolio Stats ───
  const portfolioStats = useMemo(() => {
    const totalChange = accountState.equity - INITIAL_BALANCE;
    const totalChangePct = INITIAL_BALANCE > 0 ? (totalChange / INITIAL_BALANCE) * 100 : 0;

    const todayStr = new Date().toDateString();
    const todayClosedPnl = accountState.tradeHistory.reduce((sum, t) => {
      const exitMs = t.exitTime > 1e12 ? t.exitTime : t.exitTime * 1000;
      const tradeDate = new Date(exitMs).toDateString();
      return tradeDate === todayStr ? sum + t.pnl : sum;
    }, 0);
    const dayPnl = accountState.unrealizedPnl + todayClosedPnl;
    const dayPnlPct = INITIAL_BALANCE > 0 ? (dayPnl / INITIAL_BALANCE) * 100 : 0;

    return { totalChange, totalChangePct, dayPnl, dayPnlPct };
  }, [accountState]);

  // ─── Equity Curve ───
  const equityPoints = useMemo<EquityPoint[]>(() => {
    let balance = INITIAL_BALANCE;
    const points: EquityPoint[] = [{ time: 0, value: balance }];
    for (const trade of accountState.tradeHistory) {
      balance += trade.pnl;
      points.push({ time: trade.exitTime, value: balance });
    }
    points.push({ time: Date.now(), value: accountState.equity });
    return points;
  }, [accountState]);

  // ─── Recent Trades ───
  const recentTrades = useMemo(
    () => [...accountState.tradeHistory].reverse().slice(0, 5),
    [accountState.tradeHistory]
  );

  const handleIndicatorClick = useCallback(
    (indicator: MarketIndicator) => {
      const etfTicker = INDEX_TO_ETF[indicator.symbol];
      if (etfTicker) onSelectTicker(etfTicker);
    },
    [onSelectTicker]
  );

  const chartColor = portfolioStats.totalChange >= 0 ? "var(--buy)" : "var(--sell)";
  const chartFill = portfolioStats.totalChange >= 0 ? "rgba(34,171,148,0.1)" : "rgba(229,77,77,0.1)";

  return (
    <div className="flex-1 overflow-y-auto" style={{ padding: "32px 24px 32px 40px" }}>
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
              color: portfolioStats.totalChange >= 0 ? "var(--buy)" : "var(--sell)",
              fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatPnl(portfolioStats.totalChange)} ({formatPercent(portfolioStats.totalChangePct)})
          </span>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>All time</span>
        </div>
        <div style={{ marginTop: 4 }}>
          <span
            style={{
              fontSize: 13,
              color: portfolioStats.dayPnl >= 0 ? "var(--buy)" : "var(--sell)",
              fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatPnl(portfolioStats.dayPnl)} ({formatPercent(portfolioStats.dayPnlPct)})
          </span>
          <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 8 }}>Today</span>
        </div>
      </section>

      {/* ─── 2. Equity Chart ─── */}
      <div style={{ height: 120, marginBottom: 0, position: "relative", overflow: "hidden" }}>
        {equityPoints.length >= 3 ? (
          <svg
            width="100%" height="100%"
            viewBox={`0 0 ${equityPoints.length - 1} 100`}
            preserveAspectRatio="none"
            style={{ display: "block" }}
          >
            {(() => {
              const values = equityPoints.map((p) => p.value);
              const min = Math.min(...values);
              const max = Math.max(...values);
              const range = max - min || 1;
              const linePoints = equityPoints
                .map((p, i) => `${i},${100 - ((p.value - min) / range) * 90 - 5}`)
                .join(" ");
              const fillPoints = `0,100 ${linePoints} ${equityPoints.length - 1},100`;
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

      {/* ─── 5. Market Indicators ─── */}
      <SectionWrapper title="Market Indicators">
        {marketLoading ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  background: "var(--bg-raised)", borderRadius: 12,
                  border: "1px solid var(--glass-border)", padding: 16, height: 80,
                }}
              />
            ))}
          </div>
        ) : marketIndicators.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 12, fontFamily: "var(--font-mono)" }}>
            Unable to load market data
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            {marketIndicators.slice(0, 3).map((indicator) => {
              const isPositive = indicator.change >= 0;
              const hasEtf = !!INDEX_TO_ETF[indicator.symbol];
              return (
                <div
                  key={indicator.symbol}
                  onClick={() => handleIndicatorClick(indicator)}
                  style={{
                    background: "var(--bg-raised)", borderRadius: 12,
                    border: "1px solid var(--glass-border)", padding: 16,
                    cursor: hasEtf ? "pointer" : "default", transition: "all 120ms ease",
                  }}
                  onMouseEnter={(e) => { if (hasEtf) { e.currentTarget.style.borderColor = "rgba(236,227,213,0.12)"; e.currentTarget.style.background = "var(--glass-hover)"; } }}
                  onMouseLeave={(e) => { if (hasEtf) { e.currentTarget.style.borderColor = ""; e.currentTarget.style.background = "var(--bg-raised)"; } }}
                >
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8, fontWeight: 500 }}>
                    {indicator.name}
                  </div>
                  <div
                    style={{
                      fontSize: 18, fontFamily: "var(--font-mono)", fontWeight: 700,
                      fontVariantNumeric: "tabular-nums", color: "var(--text-primary)", marginBottom: 6,
                    }}
                  >
                    {indicator.value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <span
                    style={{
                      display: "inline-block", fontSize: 11, fontWeight: 600,
                      fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums",
                      padding: "2px 8px", borderRadius: 6,
                      background: isPositive ? "rgba(34,171,148,0.12)" : "rgba(229,77,77,0.12)",
                      color: isPositive ? "var(--buy)" : "var(--sell)",
                    }}
                  >
                    {formatPercent(indicator.changePct)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </SectionWrapper>

      {/* ─── 6. Recent Activity ─── */}
      <SectionWrapper title="Recent Activity">
        {recentTrades.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: "var(--text-muted)", fontSize: 12, fontFamily: "var(--font-mono)" }}>
            No recent trades
          </div>
        ) : (
          <div style={{ background: "var(--bg-raised)", borderRadius: 12, border: "1px solid var(--glass-border)", overflow: "hidden" }}>
            {recentTrades.map((trade, idx) => {
              const isProfit = trade.pnl >= 0;
              const exitMs = trade.exitTime > 1e12 ? trade.exitTime : trade.exitTime * 1000;
              const dateStr = new Date(exitMs).toLocaleDateString("en-US", { month: "short", day: "numeric" });
              return (
                <div
                  key={trade.id}
                  className="flex items-center justify-between"
                  style={{
                    padding: "14px 20px",
                    borderBottom: idx < recentTrades.length - 1 ? "1px solid rgba(236,227,213,0.04)" : "none",
                    transition: "background 80ms ease",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(236,227,213,0.02)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      style={{
                        width: 34, height: 34, borderRadius: "50%",
                        background: isProfit ? "rgba(34,171,148,0.12)" : "rgba(229,77,77,0.12)",
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isProfit ? "var(--buy)" : "var(--sell)"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        {trade.side === "long" ? (
                          <><polyline points="17 11 12 6 7 11" /><line x1="12" y1="6" x2="12" y2="18" /></>
                        ) : (
                          <><polyline points="7 13 12 18 17 13" /><line x1="12" y1="18" x2="12" y2="6" /></>
                        )}
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
                        {trade.side === "long" ? "Bought" : "Sold"} {trade.symbol}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: 2 }}>
                        {trade.size} @ ${trade.entryPrice.toFixed(2)} &rarr; ${trade.exitPrice.toFixed(2)}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", color: isProfit ? "var(--buy)" : "var(--sell)" }}>
                      {formatPnl(trade.pnl)}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: 2 }}>
                      {dateStr}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionWrapper>
    </div>
  );
}
