"use client";

import { useState, useEffect, useMemo } from "react";
import type { AccountState } from "@/lib/types";
import type { PortfolioQuote } from "@/lib/api";
import { fetchPortfolioQuotes, fetchBenchmarkChart } from "@/lib/api";
import { formatCurrency, formatPercent, formatPnl, ALLOCATION_COLORS, getStockMeta, SECTOR_COLORS, COUNTRY_NAMES, COUNTRY_CENTER } from "@/lib/portfolio-utils";
import { useHoldings } from "@/hooks/useHoldings";
import { DEMO_HOLDINGS } from "@/lib/demo-data";
import SectionWrapper from "./shared/SectionWrapper";
import PromoBanner from "./PromoBanner";
import HoldingsTable from "./HoldingsTable";
import AllocationDonut from "./AllocationDonut";
import PerformanceChart, { type ChartHoverData } from "./PerformanceChart";
import AddHoldingForm from "./AddHoldingForm";
import type { AppPage } from "@/components/PageNav/PageNav";

const INITIAL_BALANCE = 25000;


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

  // ─── Convex Holdings ───
  const { holdings, addHolding, removeHolding } = useHoldings();
  const [showAddForm, setShowAddForm] = useState(false);

  // Dev toggle — lets you preview the dashboard fully populated
  const [demoMode, setDemoMode] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("afindr_demo_mode") === "true";
    }
    return false;
  });
  const displayHoldings = demoMode ? DEMO_HOLDINGS : holdings;
  const hasHoldings = displayHoldings.length > 0;

  // ─── Chart hover → hero value update (Robinhood-style) ───
  const [chartHover, setChartHover] = useState<ChartHoverData | null>(null);

  // ─── Staggered entrance ───
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // ─── Holdings Quotes (live prices for Convex holdings) ───
  const [holdingsQuotes, setHoldingsQuotes] = useState<Record<string, PortfolioQuote>>({});

  // Track whether quotes have arrived (prevents flash of $0 / empty)
  const quotesLoaded = Object.keys(holdingsQuotes).length > 0 || !hasHoldings;

  const holdingSymbols = useMemo(
    () => displayHoldings.map((h) => h.symbol),
    [displayHoldings]
  );

  useEffect(() => {
    if (holdingSymbols.length === 0) return;
    let cancelled = false;

    const fetch = () => {
      fetchPortfolioQuotes(holdingSymbols)
        .then((data) => { if (!cancelled) setHoldingsQuotes(data); })
        .catch(() => {});
    };

    fetch();
    const interval = globalThis.setInterval(fetch, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [holdingSymbols]);

  // ─── Benchmark (S&P 500) data ───
  const [benchmarkPoints, setBenchmarkPoints] = useState<EquityPoint[]>([]);

  // ─── Deterministic seeded random ───
  const rand = (seed: number) => {
    const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };

  // ─── Demo-mode: compute portfolio value from holdings quotes ───
  const demoPortfolioValue = useMemo(() => {
    if (!demoMode) return 0;
    const currentTotal = DEMO_HOLDINGS.reduce((s, h) => {
      const price = holdingsQuotes[h.symbol]?.price ?? h.avgCostBasis;
      return s + price * h.shares;
    }, 0);
    const costTotal = DEMO_HOLDINGS.reduce((s, h) => s + h.avgCostBasis * h.shares, 0);
    return INITIAL_BALANCE + (currentTotal - costTotal);
  }, [demoMode, holdingsQuotes]);

  const displayEquity = demoMode ? demoPortfolioValue : accountState.equity;
  const displayBalance = demoMode ? Math.max(0, INITIAL_BALANCE - DEMO_HOLDINGS.reduce((s, h) => s + h.avgCostBasis * h.shares, 0) + 8000) : accountState.balance;

  // ─── Equity Curve (Brownian bridge) ───
  const equityPoints = useMemo<EquityPoint[]>(() => {
    const DAY = 86400000;
    const now = Date.now();

    // Helper to build Brownian bridge paths
    const buildPaths = (
      entries: { entryTime: number; target: number; seedBase: number }[],
      totalDays: number,
      startDay: number,
    ) => {
      type PnlPath = { startIdx: number; values: number[] };
      const paths: PnlPath[] = [];
      for (let i = 0; i < entries.length; i++) {
        const { entryTime, target, seedBase } = entries[i];
        const sIdx = Math.max(0, Math.floor((entryTime - startDay) / DAY));
        const numDays = totalDays - sIdx;
        if (numDays <= 1) { paths.push({ startIdx: sIdx, values: [target] }); continue; }
        const vol = Math.abs(target) * 0.25 / Math.sqrt(numDays);
        const values: number[] = [0];
        let v = 0;
        for (let d = 1; d < numDays; d++) {
          const pull = (target - v) / (numDays - d);
          const noise = (rand(seedBase + d * 7.3) - 0.5) * 2 * vol;
          v += pull + noise;
          values.push(v);
        }
        values.push(target);
        paths.push({ startIdx: sIdx, values });
      }
      return paths;
    };

    if (demoMode) {
      // Build from demo holdings
      const allTimes = DEMO_HOLDINGS.map((h) => h.purchaseDate ?? h.addedAt);
      const earliest = Math.min(...allTimes);
      const startDay = earliest - DAY;
      const totalDays = Math.ceil((now - startDay) / DAY) + 1;

      const entries = DEMO_HOLDINGS.map((h, i) => ({
        entryTime: h.purchaseDate ?? h.addedAt,
        target: ((holdingsQuotes[h.symbol]?.price ?? h.avgCostBasis) - h.avgCostBasis) * h.shares,
        seedBase: i * 1000,
      }));

      const paths = buildPaths(entries, totalDays, startDay);
      const points: EquityPoint[] = [];
      for (let d = 0; d < totalDays; d++) {
        let value = INITIAL_BALANCE;
        for (const path of paths) {
          const pi = d - path.startIdx;
          if (pi >= 0 && pi < path.values.length) value += path.values[pi];
          else if (pi >= path.values.length && path.values.length > 0) value += path.values[path.values.length - 1];
        }
        points.push({ time: startDay + d * DAY, value });
      }
      points[points.length - 1] = { time: now, value: demoPortfolioValue };
      return points;
    }

    // Real data from accountState
    const positions = accountState.positions;
    const closedTrades = accountState.tradeHistory;

    if (positions.length === 0 && closedTrades.length === 0) {
      return [
        { time: now - DAY, value: INITIAL_BALANCE },
        { time: now, value: INITIAL_BALANCE },
      ];
    }

    const allTimes = [
      ...positions.map((p) => p.entryTime),
      ...closedTrades.map((t) => t.entryTime),
    ];
    const earliest = Math.min(...allTimes);
    const startDay = earliest - DAY;
    const totalDays = Math.ceil((now - startDay) / DAY) + 1;

    const posEntries = positions.map((pos, i) => ({
      entryTime: pos.entryTime,
      target: pos.unrealizedPnl,
      seedBase: i * 1000,
    }));

    const paths = buildPaths(posEntries, totalDays, startDay);

    // Closed trades
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
      const remaining = totalDays - exitIdx;
      for (let d = 0; d < remaining; d++) values.push(target);
      paths.push({ startIdx: sIdx, values });
    }

    const points: EquityPoint[] = [];
    for (let d = 0; d < totalDays; d++) {
      let value = INITIAL_BALANCE;
      for (const path of paths) {
        const pi = d - path.startIdx;
        if (pi >= 0 && pi < path.values.length) value += path.values[pi];
        else if (pi >= path.values.length && path.values.length > 0) value += path.values[path.values.length - 1];
      }
      points.push({ time: startDay + d * DAY, value });
    }
    points[points.length - 1] = { time: now, value: accountState.equity };
    return points;
  }, [accountState, demoMode, holdingsQuotes, demoPortfolioValue]);

  // ─── Benchmark fetch — after equityPoints so we can match span ───
  const benchmarkPeriod = useMemo(() => {
    if (activePeriod !== "ALL") return activePeriod;
    if (equityPoints.length < 2) return "1Y";
    const spanDays = (equityPoints[equityPoints.length - 1].time - equityPoints[0].time) / 86400000;
    if (spanDays <= 7) return "1W";
    if (spanDays <= 35) return "1M";
    if (spanDays <= 100) return "3M";
    if (spanDays <= 400) return "1Y";
    return "5Y";
  }, [activePeriod, equityPoints]);

  useEffect(() => {
    let cancelled = false;
    fetchBenchmarkChart(benchmarkPeriod)
      .then((pts) => { if (!cancelled) setBenchmarkPoints(pts); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [benchmarkPeriod]);

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
      "YTD": Date.UTC(new Date().getUTCFullYear(), 0, 1),
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

  // ─── Allocation data for donut ───
  const { allocations, totalHoldingsValue } = useMemo(() => {
    const allocs = displayHoldings.map((h, i) => {
      const quote = holdingsQuotes[h.symbol];
      const price = quote?.price ?? 0;
      const value = price > 0 ? price * h.shares : h.avgCostBasis * h.shares;
      return { ticker: h.symbol, value, color: ALLOCATION_COLORS[i % ALLOCATION_COLORS.length] };
    });
    const total = allocs.reduce((s, a) => s + a.value, 0);
    return { allocations: allocs, totalHoldingsValue: total };
  }, [displayHoldings, holdingsQuotes]);

  // ─── Sector / Industry / Geographic breakdowns ───
  const { sectorBreakdown, industryBreakdown, geoBreakdown, geoCountryPoints } = useMemo(() => {
    const sectors: Record<string, number> = {};
    const industries: Record<string, number> = {};
    const countries: Record<string, number> = {};
    const countryTickers: Record<string, string[]> = {};

    for (const h of displayHoldings) {
      const meta = getStockMeta(h.symbol);
      const quote = holdingsQuotes[h.symbol];
      const value = (quote?.price ?? h.avgCostBasis) * h.shares;
      if (!meta) continue;

      sectors[meta.sector] = (sectors[meta.sector] || 0) + value;
      industries[meta.industry] = (industries[meta.industry] || 0) + value;
      const countryCode = meta.country;
      const countryLabel = COUNTRY_NAMES[countryCode] || countryCode;
      countries[countryLabel] = (countries[countryLabel] || 0) + value;
      if (!countryTickers[countryCode]) countryTickers[countryCode] = [];
      countryTickers[countryCode].push(h.symbol);
    }

    // Build one point per country using center coordinates
    const countryPoints: { lat: number; lng: number; country: string; countryCode: string; value: number; tickers: string[] }[] = [];
    for (const [code, tickers] of Object.entries(countryTickers)) {
      const center = COUNTRY_CENTER[code];
      if (!center) continue;
      const label = COUNTRY_NAMES[code] || code;
      countryPoints.push({ lat: center.lat, lng: center.lng, country: label, countryCode: code, value: countries[label] || 0, tickers });
    }

    const sortDesc = (obj: Record<string, number>) =>
      Object.entries(obj).sort((a, b) => b[1] - a[1]);

    return {
      sectorBreakdown: sortDesc(sectors),
      industryBreakdown: sortDesc(industries),
      geoBreakdown: sortDesc(countries),
      geoCountryPoints: countryPoints,
    };
  }, [displayHoldings, holdingsQuotes]);

  /** Stagger entrance style for a given section index (0-based) */
  const stagger = (i: number): React.CSSProperties => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? "translateY(0)" : "translateY(16px)",
    transition: `opacity 500ms ease ${i * 80}ms, transform 500ms ease ${i * 80}ms`,
  });

  return (
    <div className="flex-1 overflow-y-auto" style={{ padding: "32px 24px 32px 40px", scrollbarWidth: "none" }}>
      {/* ─── 1. Portfolio Hero ─── */}
      {(() => {
        const heroValue = chartHover ? chartHover.value : displayEquity;
        const heroChange = chartHover ? chartHover.dollarChange : periodStats.change;
        const heroPct = chartHover ? chartHover.pctChange : periodStats.changePct;
        const heroDate = chartHover
          ? new Date(chartHover.time).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
          : null;
        return (
          <section style={{ marginBottom: 8, ...stagger(0) }}>
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
              {formatCurrency(heroValue)}
            </div>
            <div className="flex items-center gap-3" style={{ marginTop: 10 }}>
              <span
                style={{
                  fontSize: 16, fontWeight: 600,
                  color: heroChange >= 0 ? "var(--buy)" : "var(--sell)",
                  fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums",
                }}
              >
                {formatPnl(heroChange)} ({formatPercent(heroPct)})
              </span>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {heroDate ?? periodLabel}
              </span>
            </div>
          </section>
        );
      })()}

      {/* ─── 2. Performance Chart (Portfolio vs S&P 500) ─── */}
      <div style={{ marginBottom: 0, ...stagger(1) }}>
        <PerformanceChart
          portfolioPoints={filteredPoints}
          benchmarkPoints={benchmarkPoints}
          height={200}
          accentColor={chartColor}
          onHover={setChartHover}
        />
      </div>

      {/* ─── 3. Time Period Selector ─── */}
      <div className="flex items-center" style={{ gap: 0, marginBottom: 32, borderBottom: "1px solid var(--glass-border)", ...stagger(2) }}>
        {TIME_PERIODS.map((period) => {
          const isActive = period === activePeriod;
          return (
            <button
              key={period}
              onClick={() => setActivePeriod(period)}
              style={{
                padding: "8px 12px", fontSize: 12, fontFamily: "var(--font-mono)", fontWeight: 600,
                color: isActive ? "var(--accent)" : "var(--text-muted)",
                background: "transparent", borderTop: "none", borderRight: "none", borderLeft: "none",
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
      <div style={stagger(3)}>
        <PromoBanner onPageChange={onPageChange} onOpenSettings={onOpenSettings} />
      </div>

      {/* ─── Dev Toggle: Demo Data ─── */}
      <div
        className="flex items-center justify-between"
        style={{
          padding: "6px 12px",
          ...stagger(3),
          borderRadius: 8,
          background: demoMode ? "rgba(91,141,239,0.06)" : "rgba(236,227,213,0.02)",
          border: `1px solid ${demoMode ? "rgba(91,141,239,0.15)" : "rgba(236,227,213,0.06)"}`,
          marginBottom: 16,
        }}
      >
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.04em" }}>
            DEV
          </span>
          <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 500, color: demoMode ? "var(--text-secondary)" : "var(--text-muted)" }}>
            Demo data {demoMode ? "ON" : "OFF"}
          </span>
        </div>
        <button
          onClick={() => setDemoMode((v) => { const next = !v; localStorage.setItem("afindr_demo_mode", String(next)); window.dispatchEvent(new Event("afindr_demo_toggle")); return next; })}
          style={{
            position: "relative",
            width: 32, height: 18, borderRadius: 9,
            background: demoMode ? "var(--accent)" : "rgba(236,227,213,0.12)",
            border: "none", cursor: "pointer",
            transition: "background 150ms ease",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 2, left: demoMode ? 16 : 2,
              width: 14, height: 14, borderRadius: "50%",
              background: demoMode ? "#fff" : "var(--text-muted)",
              transition: "left 150ms ease",
            }}
          />
        </button>
      </div>

      {/* ─── 4. Buying Power ─── */}
      <div
        className="flex items-center justify-between"
        style={{
          background: "var(--glass)", borderRadius: 12,
          border: "1px solid var(--glass-border)", padding: "14px 18px",
          backdropFilter: "blur(12px)", marginBottom: 32,
          ...stagger(4),
        }}
      >
        <div>
          <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontWeight: 500, marginBottom: 4 }}>
            Buying Power
          </div>
          <div
            style={{
              fontSize: 18, fontWeight: 700, color: "var(--accent-bright)",
              fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums",
              letterSpacing: "-0.01em",
            }}
          >
            {formatCurrency(displayBalance)}
          </div>
        </div>
        <button
          style={{
            padding: "6px 14px", borderRadius: 8, background: "transparent",
            border: "1px solid var(--glass-border)", color: "var(--text-secondary)",
            fontSize: 11, fontWeight: 600, fontFamily: "var(--font-mono)",
            cursor: "pointer", transition: "all 120ms ease",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--glass-border)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
        >
          Deposit
        </button>
      </div>

      {/* ─── 5. Holdings Table ─── */}
      <div style={stagger(5)}>
      <SectionWrapper
        title="Holdings"
        rightAction={
          <button
            onClick={() => setShowAddForm((v) => !v)}
            style={{
              width: 28, height: 28, borderRadius: 8,
              background: showAddForm ? "var(--accent)" : "transparent",
              border: showAddForm ? "none" : "1px solid var(--glass-border)",
              color: showAddForm ? "var(--bg)" : "var(--text-muted)",
              cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center",
              transition: "all 120ms ease",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        }
      >
        <AddHoldingForm
          isOpen={showAddForm}
          onAdd={addHolding}
          onClose={() => setShowAddForm(false)}
        />
        {hasHoldings && !quotesLoaded ? (
          <div style={{ padding: "12px 0" }}>
            {[...Array(Math.min(displayHoldings.length, 5))].map((_, i) => (
              <div key={i} className="flex items-center gap-3" style={{ padding: "10px 0", borderBottom: "1px solid rgba(236,227,213,0.04)" }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(236,227,213,0.06)", animation: "pulse 1.5s ease-in-out infinite" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ width: 60, height: 10, borderRadius: 4, background: "rgba(236,227,213,0.08)", marginBottom: 6, animation: "pulse 1.5s ease-in-out infinite" }} />
                  <div style={{ width: 100, height: 8, borderRadius: 4, background: "rgba(236,227,213,0.04)", animation: "pulse 1.5s ease-in-out infinite" }} />
                </div>
                <div style={{ width: 60, height: 10, borderRadius: 4, background: "rgba(236,227,213,0.06)", animation: "pulse 1.5s ease-in-out infinite" }} />
              </div>
            ))}
          </div>
        ) : hasHoldings ? (
          <HoldingsTable
            holdings={displayHoldings}
            quotes={holdingsQuotes}
            onSelectTicker={onSelectTicker}
            isDemo={demoMode}
            onRemoveHolding={removeHolding}
          />
        ) : (
          <div style={{
            padding: "24px 0", textAlign: "center",
            fontSize: 11, fontFamily: "var(--font-mono)",
            color: "var(--text-muted)",
          }}>
            No holdings yet — add one above or use the agent
          </div>
        )}
      </SectionWrapper>
      </div>

      {/* ─── 6. Allocation Donut ─── */}
      {hasHoldings && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginTop: 32, ...stagger(6) }}>
          <AllocationDonut allocations={allocations} totalValue={quotesLoaded ? totalHoldingsValue : 0} size={280} />
        </div>
      )}

      {/* ─── 7. Sector Distribution ─── */}
      {sectorBreakdown.length > 0 && (
        <div style={{ marginTop: 40, ...stagger(7) }}>
          <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontWeight: 600, letterSpacing: "0.06em", marginBottom: 14 }}>
            SECTOR DISTRIBUTION
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sectorBreakdown.map(([sector, value], idx) => {
              const pct = totalHoldingsValue > 0 ? (value / totalHoldingsValue) * 100 : 0;
              const barPct = mounted && quotesLoaded ? pct : 0;
              const color = SECTOR_COLORS[sector] || "var(--text-muted)";
              return (
                <div key={sector}>
                  <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
                    <div className="flex items-center gap-2">
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>{sector}</span>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: "rgba(236,227,213,0.06)", overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: 3, background: color,
                      width: `${barPct}%`,
                      transition: `width 600ms cubic-bezier(0.4,0,0.2,1) ${idx * 80}ms`,
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── 8. Industry Breakdown ─── */}
      {industryBreakdown.length > 0 && (
        <div style={{ marginTop: 36, ...stagger(8) }}>
          <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontWeight: 600, letterSpacing: "0.06em", marginBottom: 14 }}>
            INDUSTRY BREAKDOWN
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {industryBreakdown.map(([industry, value]) => {
              const pct = totalHoldingsValue > 0 ? (value / totalHoldingsValue) * 100 : 0;
              return (
                <div
                  key={industry}
                  className="flex items-center justify-between"
                  style={{
                    padding: "8px 12px", borderRadius: 8,
                    background: "rgba(236,227,213,0.03)",
                    border: "1px solid rgba(236,227,213,0.05)",
                  }}
                >
                  <span style={{ fontSize: 10, color: "var(--text-secondary)", fontFamily: "var(--font-mono)", fontWeight: 500 }}>{industry}</span>
                  <span style={{ fontSize: 11, color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontWeight: 700, fontVariantNumeric: "tabular-nums", marginLeft: 8 }}>
                    {pct.toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── 9. Geographic Concentration ─── */}
      {geoCountryPoints.length > 0 && (
        <div style={{ marginTop: 36, ...stagger(9) }}>
          <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontWeight: 600, letterSpacing: "0.06em", marginBottom: 14 }}>
            GEOGRAPHIC CONCENTRATION
          </div>
          <div style={{
            position: "relative", borderRadius: 12, overflow: "hidden",
            background: "rgba(236,227,213,0.02)", border: "1px solid rgba(236,227,213,0.06)",
            padding: "20px 16px 16px",
          }}>
            {/* World map with country-level highlights */}
            <div style={{ position: "relative", width: "100%" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/world-map.png"
                alt=""
                aria-hidden="true"
                draggable={false}
                style={{ width: "100%", height: "auto", opacity: 0.18, display: "block" }}
              />
              {/* SVG overlay — one highlight per country */}
              <svg
                viewBox="0 0 1000 500"
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
                preserveAspectRatio="xMidYMid meet"
              >
                <defs>
                  {geoCountryPoints.map((pt) => (
                    <radialGradient key={`grad-${pt.countryCode}`} id={`geo-grad-${pt.countryCode}`}>
                      <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.35" />
                      <stop offset="70%" stopColor="var(--accent)" stopOpacity="0.10" />
                      <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                    </radialGradient>
                  ))}
                </defs>
                {geoCountryPoints.map((pt) => {
                  const x = ((pt.lng + 180) / 360) * 1000;
                  const y = ((90 - pt.lat) / 180) * 500;
                  const maxVal = Math.max(...geoCountryPoints.map((p) => p.value));
                  const pct = pt.value / maxVal;
                  // Country-scale glow — larger radius covers the region
                  const glowR = 40 + pct * 60;
                  return (
                    <g key={pt.countryCode}>
                      {/* Broad country glow */}
                      <ellipse cx={x} cy={y} rx={glowR * 1.3} ry={glowR} fill={`url(#geo-grad-${pt.countryCode})`} />
                      {/* Core marker */}
                      <circle cx={x} cy={y} r={6 + pct * 8} fill="var(--accent)" opacity={0.55} />
                      <circle cx={x} cy={y} r={3 + pct * 4} fill="var(--accent)" opacity={0.85} />
                      {/* Country label */}
                      <text x={x} y={y - glowR * 0.55} textAnchor="middle" fill="var(--text-secondary)"
                        style={{ fontSize: 10, fontWeight: 700, fontFamily: "var(--font-mono)" }}>
                        {pt.country}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Country breakdown row */}
            <div className="flex items-center" style={{ gap: 16, marginTop: 14, flexWrap: "wrap" }}>
              {geoBreakdown.map(([country, value]) => {
                const pct = totalHoldingsValue > 0 ? (value / totalHoldingsValue) * 100 : 0;
                return (
                  <div key={country} className="flex items-center gap-2">
                    <div style={{
                      width: 10, height: 10, borderRadius: 2,
                      background: "var(--accent)", opacity: 0.6 + (pct / 100) * 0.4,
                    }} />
                    <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--text-secondary)" }}>
                      {country}
                    </span>
                    <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
