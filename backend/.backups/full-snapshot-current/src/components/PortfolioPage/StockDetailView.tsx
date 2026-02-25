"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useConvexUserId } from "@/components/ConvexClientProvider";
import type { StockDetailFull, ChartDataPoint, NewsArticle } from "@/lib/api";
import { fetchStockDetailFull, fetchStockChart, fetchNewsFeed } from "@/lib/api";
import { formatCurrency, formatPercent } from "@/lib/portfolio-utils";
import { useHoldings } from "@/hooks/useHoldings";

interface StockThesis {
  ticker: string;
  sentiment: "bullish" | "bearish" | "neutral";
  thesis: string;
  targetPrice?: number;
  timeframe?: string;
  catalysts: string[];
  risks: string[];
  createdAt: number;
  updatedAt: number;
}

interface StockDetailViewProps {
  ticker: string;
  onBack: () => void;
  onSelectTicker: (ticker: string) => void;
  onNavigateToChart?: (ticker: string) => void;
}

type ChartType = "line" | "candle";

const CHART_PERIODS = ["1D", "1W", "1M", "3M", "YTD", "1Y", "5Y", "MAX"] as const;
type ChartPeriod = (typeof CHART_PERIODS)[number];

/* ─── SVG Donut Chart for Analyst Ratings ─── */
function DonutChart({ buyPct, holdPct, sellPct, label }: { buyPct: number; holdPct: number; sellPct: number; label: string }) {
  const r = 54, cx = 64, cy = 64, stroke = 10;
  const C = 2 * Math.PI * r;
  const buyLen = (buyPct / 100) * C;
  const holdLen = (holdPct / 100) * C;
  const sellLen = (sellPct / 100) * C;
  const gap = 2;

  return (
    <svg width="128" height="128" viewBox="0 0 128 128">
      {/* Background track */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(236,227,213,0.06)" strokeWidth={stroke} />
      {/* Buy arc */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--buy)" strokeWidth={stroke}
        strokeDasharray={`${Math.max(0, buyLen - gap)} ${C - Math.max(0, buyLen - gap)}`}
        strokeDashoffset={C * 0.25} strokeLinecap="round" />
      {/* Hold arc */}
      {holdPct > 0 && (
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--warning)" strokeWidth={stroke}
          strokeDasharray={`${Math.max(0, holdLen - gap)} ${C - Math.max(0, holdLen - gap)}`}
          strokeDashoffset={C * 0.25 - buyLen} strokeLinecap="round" />
      )}
      {/* Sell arc */}
      {sellPct > 0 && (
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--sell)" strokeWidth={stroke}
          strokeDasharray={`${Math.max(0, sellLen - gap)} ${C - Math.max(0, sellLen - gap)}`}
          strokeDashoffset={C * 0.25 - buyLen - holdLen} strokeLinecap="round" />
      )}
      {/* Center label */}
      <text x={cx} y={cy - 6} textAnchor="middle" fill="var(--text-primary)" fontSize="26" fontWeight="800" fontFamily="var(--font-mono)">
        {Math.round(buyPct)}%
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill="var(--text-muted)" fontSize="10" fontWeight="500">
        {label}
      </text>
    </svg>
  );
}

/* ─── SVG Bar Chart for EPS History ─── */
function EpsChart({ history }: { history: { quarter: string; actual: number | null; estimate: number | null }[] }) {
  if (history.length === 0) return null;
  const all = history.flatMap(h => [h.actual, h.estimate].filter((v): v is number => v != null));
  if (all.length === 0) return null;
  const maxVal = Math.max(...all.map(Math.abs));
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const barW = 100 / history.length;

  return (
    <div>
      <svg width="100%" height="160" viewBox={`0 0 ${history.length * 80} 140`} preserveAspectRatio="xMidYMid meet">
        {history.map((h, i) => {
          const x = i * 80 + 10;
          const barWidth = 22;
          const actualH = h.actual != null ? (Math.abs(h.actual) / maxVal) * 80 : 0;
          const estimateH = h.estimate != null ? (Math.abs(h.estimate) / maxVal) * 80 : 0;
          const beat = h.actual != null && h.estimate != null && h.actual >= h.estimate;

          return (
            <g key={h.quarter}>
              {/* Estimate bar (lighter) */}
              {h.estimate != null && (
                <rect x={x} y={95 - estimateH} width={barWidth} height={estimateH}
                  rx="3" fill="rgba(236,227,213,0.08)" />
              )}
              {/* Actual bar */}
              {h.actual != null && (
                <rect x={x + barWidth + 4} y={95 - actualH} width={barWidth} height={actualH}
                  rx="3" fill={beat ? "var(--buy)" : "var(--sell)"} opacity="0.85" />
              )}
              {/* Actual dot */}
              {h.actual != null && (
                <circle cx={x + barWidth + 4 + barWidth / 2} cy={95 - actualH - 6} r="3.5"
                  fill={beat ? "var(--buy)" : "var(--sell)"} />
              )}
              {/* Estimate dot */}
              {h.estimate != null && (
                <circle cx={x + barWidth / 2} cy={95 - estimateH - 6} r="3.5"
                  fill="none" stroke="rgba(236,227,213,0.3)" strokeWidth="1.5" />
              )}
              {/* Quarter label */}
              <text x={x + barWidth + 2} y={115} textAnchor="middle"
                fill="var(--text-muted)" fontSize="10" fontFamily="var(--font-mono)">
                {h.quarter}
              </text>
              {/* Actual value */}
              {h.actual != null && (
                <text x={x + barWidth + 2} y={128} textAnchor="middle"
                  fill="var(--text-secondary)" fontSize="9" fontFamily="var(--font-mono)">
                  ${h.actual.toFixed(2)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="flex items-center gap-4" style={{ marginTop: 8 }}>
        <div className="flex items-center gap-1">
          <div style={{ width: 8, height: 8, borderRadius: 2, background: "var(--buy)", opacity: 0.85 }} />
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Actual EPS</span>
        </div>
        <div className="flex items-center gap-1">
          <div style={{ width: 8, height: 8, borderRadius: 2, background: "rgba(236,227,213,0.08)", border: "1px solid rgba(236,227,213,0.2)" }} />
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Estimate</span>
        </div>
      </div>
    </div>
  );
}

/* ─── SVG Revenue Bar Chart ─── */
function RevenueChart({ data, label }: { data: { label: string; revenue: number | null; earnings: number | null }[]; label: string }) {
  const filtered = data.filter(d => d.revenue != null);
  if (filtered.length === 0) return null;
  const maxRev = Math.max(...filtered.map(d => Math.abs(d.revenue ?? 0)));

  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, marginBottom: 12, letterSpacing: "0.05em" }}>{label}</div>
      <div className="flex items-end" style={{ gap: 8, height: 100 }}>
        {filtered.map((d, i) => {
          const revH = d.revenue != null ? (Math.abs(d.revenue) / maxRev) * 80 : 0;
          const earnH = d.earnings != null ? (Math.abs(d.earnings) / maxRev) * 80 : 0;
          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 80 }}>
                <div style={{
                  width: 16, height: revH, borderRadius: "3px 3px 0 0",
                  background: "var(--accent)", opacity: 0.7,
                }} />
                <div style={{
                  width: 16, height: earnH, borderRadius: "3px 3px 0 0",
                  background: d.earnings != null && d.earnings >= 0 ? "var(--buy)" : "var(--sell)", opacity: 0.7,
                }} />
              </div>
              <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{d.label}</span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4" style={{ marginTop: 10 }}>
        <div className="flex items-center gap-1">
          <div style={{ width: 8, height: 8, borderRadius: 2, background: "var(--accent)", opacity: 0.7 }} />
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Revenue</span>
        </div>
        <div className="flex items-center gap-1">
          <div style={{ width: 8, height: 8, borderRadius: 2, background: "var(--buy)", opacity: 0.7 }} />
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Net Income</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Horizontal Percentage Bar ─── */
function PercentBar({ value, color, label }: { value: number; color: string; label: string }) {
  return (
    <div className="flex items-center" style={{ gap: 12, marginBottom: 10 }}>
      <span style={{ width: 40, fontSize: 12, color: "var(--text-secondary)", fontWeight: 500 }}>{label}</span>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: "rgba(236,227,213,0.06)", overflow: "hidden" }}>
        <div style={{ width: `${Math.min(100, value)}%`, height: "100%", borderRadius: 3, background: color, transition: "width 400ms ease" }} />
      </div>
      <span style={{ width: 44, textAlign: "right", fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-secondary)", fontWeight: 500 }}>
        {value.toFixed(1)}%
      </span>
    </div>
  );
}

/* ─── Section divider ─── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 48 }}>
      <div style={{ padding: "16px 0", borderBottom: "1px solid var(--glass-border)", marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{title}</h2>
      </div>
      {children}
    </section>
  );
}

export default function StockDetailView({ ticker, onBack, onSelectTicker, onNavigateToChart }: StockDetailViewProps) {
  const [detail, setDetail] = useState<StockDetailFull | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<ChartPeriod>("1D");
  const [chartType, setChartType] = useState<ChartType>("line");
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [news, setNews] = useState<NewsArticle[]>([]);

  // ─── Holdings (Convex-backed) ───
  const { holdings, addHolding, removeHolding } = useHoldings();
  const holding = holdings.find((h) => h.symbol === ticker);
  const [addSharesInput, setAddSharesInput] = useState("1");
  const [holdingActionPending, setHoldingActionPending] = useState(false);

  // ─── Thesis state ───
  const { userId } = useConvexUserId();
  const convexThesis = useQuery(api.theses.getByTicker, userId ? { userId, ticker } : "skip");
  const upsertThesisMut = useMutation(api.theses.upsert);
  const removeThesisMut = useMutation(api.theses.remove);

  const [thesis, setThesis] = useState<StockThesis | null>(null);
  const [thesisEditing, setThesisEditing] = useState(false);
  const [thesisDraft, setThesisDraft] = useState({ thesis: "", sentiment: "neutral" as StockThesis["sentiment"], targetPrice: "", timeframe: "", catalysts: "", risks: "" });
  const [thesisHydrated, setThesisHydrated] = useState(false);

  // Hydrate thesis from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`afindr_thesis_${ticker}`);
    if (saved) {
      try { setThesis(JSON.parse(saved)); } catch { /* ignore */ }
    } else {
      setThesis(null);
    }
    setThesisEditing(false);
    setThesisHydrated(true);
  }, [ticker]);

  // Convex reconciliation: Convex wins if present, else seed from localStorage
  const thesisReconciledRef = useRef<string | null>(null);
  useEffect(() => {
    if (!thesisHydrated || !userId || convexThesis === undefined || thesisReconciledRef.current === ticker) return;
    thesisReconciledRef.current = ticker;
    if (convexThesis) {
      // Convex has data → use it
      const mapped: StockThesis = {
        ticker: convexThesis.ticker,
        sentiment: convexThesis.sentiment,
        thesis: convexThesis.thesis,
        targetPrice: convexThesis.targetPrice,
        timeframe: convexThesis.timeframe,
        catalysts: convexThesis.catalysts,
        risks: convexThesis.risks,
        createdAt: convexThesis.createdAt,
        updatedAt: convexThesis.updatedAt,
      };
      setThesis(mapped);
      localStorage.setItem(`afindr_thesis_${ticker}`, JSON.stringify(mapped));
    } else if (thesis) {
      // Convex empty but localStorage has data → seed Convex
      upsertThesisMut({
        userId,
        ticker,
        sentiment: thesis.sentiment,
        thesis: thesis.thesis,
        targetPrice: thesis.targetPrice,
        timeframe: thesis.timeframe,
        catalysts: thesis.catalysts,
        risks: thesis.risks,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thesisHydrated, userId, convexThesis, ticker]);

  // Persist thesis to localStorage
  useEffect(() => {
    if (!thesisHydrated) return;
    if (thesis) {
      localStorage.setItem(`afindr_thesis_${ticker}`, JSON.stringify(thesis));
    } else {
      localStorage.removeItem(`afindr_thesis_${ticker}`);
    }
  }, [thesis, thesisHydrated, ticker]);

  const saveThesis = useCallback(() => {
    const now = Date.now();
    const catalysts = thesisDraft.catalysts.split(",").map(s => s.trim()).filter(Boolean);
    const risks = thesisDraft.risks.split(",").map(s => s.trim()).filter(Boolean);
    const targetPrice = thesisDraft.targetPrice ? parseFloat(thesisDraft.targetPrice) : undefined;
    const timeframe = thesisDraft.timeframe || undefined;

    setThesis({
      ticker,
      sentiment: thesisDraft.sentiment,
      thesis: thesisDraft.thesis,
      targetPrice,
      timeframe,
      catalysts,
      risks,
      createdAt: thesis?.createdAt || now,
      updatedAt: now,
    });

    // Dual-write to Convex
    if (userId) {
      upsertThesisMut({
        userId,
        ticker,
        sentiment: thesisDraft.sentiment,
        thesis: thesisDraft.thesis,
        targetPrice,
        timeframe,
        catalysts,
        risks,
      });
    }

    setThesisEditing(false);
  }, [ticker, thesisDraft, thesis, userId, upsertThesisMut]);

  const startEditThesis = useCallback(() => {
    if (thesis) {
      setThesisDraft({
        thesis: thesis.thesis,
        sentiment: thesis.sentiment,
        targetPrice: thesis.targetPrice?.toString() || "",
        timeframe: thesis.timeframe || "",
        catalysts: thesis.catalysts.join(", "),
        risks: thesis.risks.join(", "),
      });
    } else {
      setThesisDraft({ thesis: "", sentiment: "neutral", targetPrice: "", timeframe: "", catalysts: "", risks: "" });
    }
    setThesisEditing(true);
  }, [thesis]);

  // Hover state for interactive chart
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // ─── Fetch stock detail ───
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchStockDetailFull(ticker)
      .then((data) => { if (!cancelled) { setDetail(data); setLoading(false); } })
      .catch((err) => { if (!cancelled) { setError(String(err)); setLoading(false); } });
    return () => { cancelled = true; };
  }, [ticker]);

  // ─── Fetch chart data ───
  useEffect(() => {
    let cancelled = false;
    setChartLoading(true);
    fetchStockChart(ticker, selectedPeriod)
      .then((data) => { if (!cancelled) { setChartData(data.points); setChartLoading(false); } })
      .catch(() => { if (!cancelled) { setChartData([]); setChartLoading(false); } });
    return () => { cancelled = true; };
  }, [ticker, selectedPeriod]);

  // ─── Fetch news for this ticker ───
  useEffect(() => {
    let cancelled = false;
    fetchNewsFeed({ ticker, limit: 10 })
      .then((data) => { if (!cancelled) setNews(data.articles ?? []); })
      .catch(() => { if (!cancelled) setNews([]); });
    return () => { cancelled = true; };
  }, [ticker]);

  // ─── Chart hover ───
  const handleChartMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!chartContainerRef.current || chartData.length === 0) return;
    const rect = chartContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const idx = Math.round((x / rect.width) * (chartData.length - 1));
    setHoverIndex(Math.max(0, Math.min(idx, chartData.length - 1)));
  }, [chartData]);

  const handleChartMouseLeave = useCallback(() => { setHoverIndex(null); }, []);

  // ─── Chart computations ───
  const chartInfo = useMemo(() => {
    if (chartData.length < 2) return null;
    const closes = chartData.map((p) => p.close);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const range = max - min || 1;
    const first = closes[0];
    const last = closes[closes.length - 1];
    const isPositive = last >= first;
    return { closes, min, max, range, first, last, isPositive };
  }, [chartData]);

  const displayPrice = useMemo(() => {
    if (hoverIndex !== null && chartData[hoverIndex]) return chartData[hoverIndex].close;
    return detail?.price ?? 0;
  }, [hoverIndex, chartData, detail]);

  const displayChange = useMemo(() => {
    if (hoverIndex !== null && chartInfo) {
      const hoverPrice = chartData[hoverIndex].close;
      const chg = hoverPrice - chartInfo.first;
      const chgPct = chartInfo.first ? (chg / chartInfo.first) * 100 : 0;
      return { change: chg, changePct: chgPct };
    }
    return { change: detail?.change ?? 0, changePct: detail?.changePct ?? 0 };
  }, [hoverIndex, chartData, chartInfo, detail]);

  const hasVal = (v: string | undefined) => v && v !== "-" && v !== "0.00" && v !== "$0.00" && v !== "0.00%";
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const fmtBig = (n: number | null) => {
    if (n == null) return "-";
    if (Math.abs(n) >= 1e12) return "$" + (n / 1e12).toFixed(1) + "T";
    if (Math.abs(n) >= 1e9) return "$" + (n / 1e9).toFixed(1) + "B";
    if (Math.abs(n) >= 1e6) return "$" + (n / 1e6).toFixed(0) + "M";
    return "$" + n.toLocaleString();
  };

  // ─── Error State (only if detail failed AND no chart data) ───
  if (error && !loading && chartData.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto" style={{ padding: "32px 40px", scrollbarWidth: "none" }}>
        <button onClick={onBack} style={{ background: "transparent", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: 14, marginBottom: 24, display: "flex", alignItems: "center", gap: 6 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
          Back
        </button>
        <div style={{ padding: 60, textAlign: "center" }}>
          <div style={{ fontSize: 14, color: "var(--sell)", marginBottom: 12 }}>Failed to load stock data</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>{error}</div>
          <button
            onClick={() => { setError(null); setLoading(true); fetchStockDetailFull(ticker).then(setDetail).catch((e) => setError(String(e))).finally(() => setLoading(false)); }}
            style={{ padding: "8px 20px", borderRadius: 8, background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ─── Skeleton for fundamentals (shown inline while detail loads) ───
  const FundamentalsSkeleton = () => (
    <div style={{ display: "flex", flexWrap: "wrap" }}>
      {[...Array(12)].map((_, i) => (
        <div key={i} style={{ flex: "0 0 25%", height: 48, borderBottom: "1px solid var(--glass-border)" }}>
          <div style={{ height: 10, width: 80, background: "var(--bg-surface)", borderRadius: 4, margin: "8px 0 6px" }} />
          <div style={{ height: 14, width: 60, background: "var(--bg-surface)", borderRadius: 4 }} />
        </div>
      ))}
    </div>
  );

  const changeColor = displayChange.change >= 0 ? "var(--buy)" : "var(--sell)";
  const chartColor = chartInfo?.isPositive ? "var(--buy)" : "var(--sell)";
  const chartFillColor = chartInfo?.isPositive ? "rgba(34,171,148,0.08)" : "rgba(229,77,77,0.08)";

  // Price target bar (guarded for progressive loading)
  const targetRange = detail ? ((detail.targetHighPrice && detail.targetLowPrice) ? detail.targetHighPrice - detail.targetLowPrice : 0) : 0;
  const currentInRange = (detail && targetRange > 0)
    ? Math.max(0, Math.min(100, ((detail.price - (detail.targetLowPrice ?? 0)) / targetRange) * 100))
    : 50;

  // Build stats grid — Robinhood-style flat 4-column (guarded)
  const keyStats: { label: string; value: string }[] = detail ? [
    { label: "Market cap", value: detail.marketCap },
    { label: "P/E ratio", value: detail.peRatio },
    { label: "Dividend yield", value: detail.dividendYield },
    { label: "Average volume", value: detail.avgVolume },
    { label: "High today", value: detail.dayHigh ? formatCurrency(detail.dayHigh) : "-" },
    { label: "Low today", value: detail.dayLow ? formatCurrency(detail.dayLow) : "-" },
    { label: "Open price", value: detail.open ? formatCurrency(detail.open) : "-" },
    { label: "Volume", value: detail.volume },
    { label: "52 Week high", value: detail.week52High ? formatCurrency(detail.week52High) : "-" },
    { label: "52 Week low", value: detail.week52Low ? formatCurrency(detail.week52Low) : "-" },
    { label: "Beta", value: detail.beta },
    { label: "Short float", value: detail.shortFloat },
  ].filter(s => hasVal(s.value)) : [];

  return (
    <div className="flex-1 overflow-y-auto" style={{ padding: "32px 40px", scrollbarWidth: "none" }}>
      {/* ─── Header ─── */}
      <div style={{ marginBottom: 20 }}>
        <button
          onClick={onBack}
          style={{ background: "transparent", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: 14, marginBottom: 16, display: "flex", alignItems: "center", gap: 6, padding: 0 }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-primary)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
          Back
        </button>
        <h1 style={{ fontSize: 28, fontWeight: 500, color: "var(--text-primary)", margin: 0, lineHeight: 1.2 }}>
          {detail?.name ?? ticker}
        </h1>
      </div>

      {/* ─── Price ─── */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 36, fontWeight: 800, fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", color: "var(--text-primary)", lineHeight: 1.1 }}>
          {formatCurrency(displayPrice)}
        </div>
        <div className="flex items-center gap-2" style={{ marginTop: 6 }}>
          <span style={{ fontSize: 14, fontWeight: 600, fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", color: changeColor }}>
            {displayChange.change >= 0 ? "+" : ""}{formatCurrency(Math.abs(displayChange.change))} ({formatPercent(displayChange.changePct)})
          </span>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {hoverIndex !== null ? "" : "Today"}
          </span>
        </div>
      </div>

      {/* ─── Interactive Chart ─── */}
      <div
        ref={chartContainerRef}
        onMouseMove={handleChartMouseMove}
        onMouseLeave={handleChartMouseLeave}
        style={{ height: 220, position: "relative", marginBottom: 0, cursor: "crosshair", overflow: "visible" }}
      >
        {chartLoading ? (
          <div className="flex items-center justify-center" style={{ height: "100%", color: "var(--text-muted)", fontSize: 12, fontFamily: "var(--font-mono)" }}>
            Loading chart...
          </div>
        ) : chartInfo ? (
          <>
            {chartType === "line" ? (
              /* ─── Line Chart ─── */
              <svg width="100%" height="100%" viewBox={`0 0 ${chartData.length - 1} 100`} preserveAspectRatio="none" style={{ display: "block" }}>
                {(() => {
                  const { closes, min, range } = chartInfo;
                  const linePoints = closes.map((c, i) => `${i},${100 - ((c - min) / range) * 90 - 5}`).join(" ");
                  const fillPoints = `0,100 ${linePoints} ${closes.length - 1},100`;
                  const refY = 100 - ((closes[0] - min) / range) * 90 - 5;
                  return (
                    <>
                      <polygon points={fillPoints} fill={chartFillColor} />
                      <polyline points={linePoints} fill="none" stroke={chartColor} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                      <line x1="0" y1={refY} x2={closes.length - 1} y2={refY}
                        stroke="rgba(236,227,213,0.12)" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray="4,4" />
                    </>
                  );
                })()}
                {hoverIndex !== null && (
                  <line x1={hoverIndex} y1="0" x2={hoverIndex} y2="100"
                    stroke="rgba(236,227,213,0.3)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                )}
              </svg>
            ) : (
              /* ─── Candlestick Chart ─── */
              <svg width="100%" height="100%" viewBox={`0 0 ${chartData.length} 100`} preserveAspectRatio="none" style={{ display: "block" }}>
                {(() => {
                  const allHighs = chartData.map(p => p.high);
                  const allLows = chartData.map(p => p.low);
                  const candleMin = Math.min(...allLows);
                  const candleMax = Math.max(...allHighs);
                  const candleRange = candleMax - candleMin || 1;
                  const toY = (v: number) => 100 - ((v - candleMin) / candleRange) * 90 - 5;
                  const refY = toY(chartData[0].open);
                  const bodyWidth = Math.max(0.3, 0.6);

                  return (
                    <>
                      <line x1="0" y1={refY} x2={chartData.length} y2={refY}
                        stroke="rgba(236,227,213,0.12)" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray="4,4" />
                      {chartData.map((p, i) => {
                        const isUp = p.close >= p.open;
                        const color = isUp ? "var(--buy)" : "var(--sell)";
                        const bodyTop = toY(Math.max(p.open, p.close));
                        const bodyBot = toY(Math.min(p.open, p.close));
                        const bodyH = Math.max(bodyBot - bodyTop, 0.3);
                        const wickTop = toY(p.high);
                        const wickBot = toY(p.low);
                        const cx = i + 0.5;

                        return (
                          <g key={i}>
                            <line x1={cx} y1={wickTop} x2={cx} y2={wickBot}
                              stroke={color} strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
                            <rect
                              x={cx - bodyWidth / 2} y={bodyTop}
                              width={bodyWidth} height={bodyH}
                              fill={color}
                              stroke={color} strokeWidth="0.3" vectorEffect="non-scaling-stroke"
                              rx="0.05"
                            />
                          </g>
                        );
                      })}
                      {hoverIndex !== null && (
                        <line x1={hoverIndex + 0.5} y1="0" x2={hoverIndex + 0.5} y2="100"
                          stroke="rgba(236,227,213,0.3)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                      )}
                    </>
                  );
                })()}
              </svg>
            )}

            {/* HTML hover dot — avoids SVG stretch distortion */}
            {hoverIndex !== null && chartInfo && (() => {
              const price = chartData[hoverIndex].close;
              const yPct = 100 - ((price - chartInfo.min) / chartInfo.range) * 90 - 5;
              const total = chartType === "line" ? chartData.length - 1 : chartData.length;
              const xIdx = chartType === "line" ? hoverIndex : hoverIndex + 0.5;
              const xPct = (xIdx / total) * 100;
              return (
                <div style={{
                  position: "absolute",
                  left: `${xPct}%`,
                  top: `${yPct}%`,
                  width: 8, height: 8,
                  borderRadius: "50%",
                  background: chartColor,
                  border: "2px solid var(--bg)",
                  boxShadow: `0 0 0 1px ${chartColor}`,
                  transform: "translate(-50%, -50%)",
                  pointerEvents: "none",
                  zIndex: 5,
                }} />
              );
            })()}
          </>
        ) : (
          <div className="flex items-center justify-center" style={{ height: "100%", color: "var(--text-muted)", fontSize: 12, fontFamily: "var(--font-mono)" }}>
            No chart data available
          </div>
        )}
      </div>

      {/* ─── Date X-Axis ─── */}
      {chartData.length > 0 && (
        <div className="flex items-center justify-between" style={{ padding: "6px 0 0", marginBottom: 0 }}>
          {(() => {
            const labelCount = Math.min(6, chartData.length);
            const step = Math.max(1, Math.floor((chartData.length - 1) / (labelCount - 1)));
            const indices: number[] = [];
            for (let i = 0; i < chartData.length; i += step) indices.push(i);
            if (indices[indices.length - 1] !== chartData.length - 1) indices.push(chartData.length - 1);

            const isIntraday = selectedPeriod === "1D";
            return indices.map((idx) => {
              const p = chartData[idx];
              const d = new Date(p.timestamp > 1e12 ? p.timestamp : p.timestamp * 1000);
              const label = isIntraday
                ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
                : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
              return (
                <span key={idx} style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                  {label}
                </span>
              );
            });
          })()}
        </div>
      )}

      {/* ─── Chart Controls: Period Selector + Chart Type Toggle + Maximize ─── */}
      <div className="flex items-center" style={{ gap: 0, marginBottom: 40, borderBottom: "1px solid var(--glass-border)" }}>
        {CHART_PERIODS.map((period) => {
          const isActive = period === selectedPeriod;
          return (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              style={{
                padding: "8px 12px", fontSize: 12, fontFamily: "var(--font-mono)", fontWeight: 600,
                color: isActive ? changeColor : "var(--text-muted)",
                background: "transparent", border: "none",
                borderBottom: isActive ? `2px solid ${changeColor}` : "2px solid transparent",
                cursor: "pointer", transition: "color 120ms ease", marginBottom: -1,
              }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = "var(--text-secondary)"; }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = isActive ? changeColor : "var(--text-muted)"; }}
            >
              {period}
            </button>
          );
        })}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Chart type toggle */}
        <div className="flex items-center" style={{ gap: 2, padding: "4px", borderRadius: 8, background: "rgba(236,227,213,0.04)" }}>
          <button
            onClick={() => setChartType("line")}
            title="Line chart"
            style={{
              padding: "4px 8px", borderRadius: 6, border: "none", cursor: "pointer", display: "flex", alignItems: "center",
              background: chartType === "line" ? "rgba(236,227,213,0.1)" : "transparent",
              color: chartType === "line" ? "var(--text-primary)" : "var(--text-muted)",
              transition: "all 120ms ease",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 8 13 13 9 9 2 16" />
            </svg>
          </button>
          <button
            onClick={() => setChartType("candle")}
            title="Candlestick chart"
            style={{
              padding: "4px 8px", borderRadius: 6, border: "none", cursor: "pointer", display: "flex", alignItems: "center",
              background: chartType === "candle" ? "rgba(236,227,213,0.1)" : "transparent",
              color: chartType === "candle" ? "var(--text-primary)" : "var(--text-muted)",
              transition: "all 120ms ease",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="9" y1="2" x2="9" y2="6" /><rect x="6" y="6" width="6" height="8" rx="1" /><line x1="9" y1="14" x2="9" y2="22" />
              <line x1="17" y1="2" x2="17" y2="10" /><rect x="14" y="10" width="6" height="6" rx="1" /><line x1="17" y1="16" x2="17" y2="22" />
            </svg>
          </button>
        </div>

        {/* Maximize / open in trade page */}
        {onNavigateToChart && (
          <button
            onClick={() => onNavigateToChart(ticker)}
            title="Open in trade view"
            style={{
              padding: "4px 8px", marginLeft: 8, borderRadius: 6, border: "none", cursor: "pointer",
              display: "flex", alignItems: "center",
              background: "transparent", color: "var(--text-muted)",
              transition: "all 120ms ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-primary)"; e.currentTarget.style.background = "rgba(236,227,213,0.08)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.background = "transparent"; }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
              <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
            </svg>
          </button>
        )}
      </div>

      {/* ─── Open Position / Holdings Strip ─── */}
      {position && detail && (() => {
        const livePrice = detail.price || 0;
        const marketValue = livePrice * position.size;
        const costBasis = position.entryPrice * position.size;
        const unrealizedPnl = marketValue - costBasis;
        const unrealizedPct = costBasis > 0 ? (unrealizedPnl / costBasis) * 100 : 0;
        const isProfit = unrealizedPnl >= 0;
        const pnlColor = isProfit ? "var(--buy)" : "var(--sell)";
        const pnlBg = isProfit ? "rgba(34,171,148,0.08)" : "rgba(229,77,77,0.08)";

        return (
          <div style={{
            display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
            padding: "14px 16px", marginBottom: 24, borderRadius: 10,
            background: pnlBg,
            border: `1px solid ${isProfit ? "rgba(34,171,148,0.15)" : "rgba(229,77,77,0.15)"}`,
          }}>
            {/* Position badge */}
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              fontSize: 13, fontWeight: 700, fontFamily: "var(--font-mono)",
              color: "var(--text-primary)",
            }}>
              <span style={{
                fontSize: 9, fontWeight: 700, textTransform: "uppercase" as const,
                letterSpacing: "0.04em", padding: "2px 8px", borderRadius: 6,
                background: position.side === "long" ? "rgba(34,171,148,0.15)" : "rgba(229,77,77,0.15)",
                color: position.side === "long" ? "var(--buy)" : "var(--sell)",
              }}>
                {position.side}
              </span>
              {position.size} shares @ {formatCurrency(position.entryPrice)}
            </div>

            <div style={{ flex: 1 }} />

            {/* Metrics */}
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 9, fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.04em", textTransform: "uppercase" as const }}>Market Value</div>
                <div style={{ fontSize: 14, fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
                  {formatCurrency(marketValue)}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 9, fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.04em", textTransform: "uppercase" as const }}>Unrealized P&L</div>
                <div style={{ fontSize: 14, fontFamily: "var(--font-mono)", fontWeight: 700, color: pnlColor, fontVariantNumeric: "tabular-nums" }}>
                  {isProfit ? "+" : ""}{formatCurrency(unrealizedPnl)}
                  <span style={{ fontSize: 11, fontWeight: 600, marginLeft: 6, opacity: 0.8 }}>
                    ({isProfit ? "+" : ""}{unrealizedPct.toFixed(2)}%)
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ─── Fundamentals: progressive loading ─── */}
      {!detail ? <FundamentalsSkeleton /> : <>

      {/* ─── About ─── */}
      {detail.description && (
        <Section title="About">
          <p style={{
            fontSize: 14, lineHeight: 1.7, color: "var(--text-secondary)", margin: "0 0 20px",
            display: showFullDescription ? "block" : "-webkit-box",
            WebkitLineClamp: showFullDescription ? undefined : 3,
            WebkitBoxOrient: "vertical" as never,
            overflow: showFullDescription ? "visible" : "hidden",
          }}>
            {detail.description}
          </p>
          {detail.description.length > 200 && (
            <button
              onClick={() => setShowFullDescription(!showFullDescription)}
              style={{ background: "transparent", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 13, fontWeight: 600, padding: 0, marginBottom: 20 }}
            >
              {showFullDescription ? "Show less" : "Show more"}
            </button>
          )}
          <div className="flex" style={{ gap: 40, flexWrap: "wrap" }}>
            {[
              { label: "CEO", value: detail.ceo },
              { label: "Employees", value: detail.employees ? detail.employees.toLocaleString() : "-" },
              { label: "Headquarters", value: detail.headquarters },
              { label: "Founded", value: detail.founded },
              { label: "Industry", value: detail.industry },
            ].filter(m => m.value && m.value !== "-").map((m) => (
              <div key={m.label}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{m.value}</div>
              </div>
            ))}
            {detail.website && detail.website !== "-" && (
              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, marginBottom: 4 }}>Website</div>
                <a href={detail.website.startsWith("http") ? detail.website : `https://${detail.website}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 13, color: "var(--accent)", textDecoration: "none" }}>
                  {detail.website.replace(/^https?:\/\//, "")}
                </a>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* ─── My Thesis ─── */}
      <Section title="My Thesis">
        {thesisEditing ? (
          /* ── Edit Mode ── */
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Sentiment selector */}
            <div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, marginBottom: 8 }}>Sentiment</div>
              <div className="flex" style={{ gap: 8 }}>
                {(["bullish", "neutral", "bearish"] as const).map((s) => {
                  const isActive = thesisDraft.sentiment === s;
                  const colors = { bullish: "var(--buy)", neutral: "var(--warning)", bearish: "var(--sell)" };
                  return (
                    <button
                      key={s}
                      onClick={() => setThesisDraft(prev => ({ ...prev, sentiment: s }))}
                      style={{
                        padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                        textTransform: "capitalize", border: "1px solid",
                        borderColor: isActive ? colors[s] : "rgba(236,227,213,0.12)",
                        background: isActive ? `${colors[s]}18` : "transparent",
                        color: isActive ? colors[s] : "var(--text-muted)",
                      }}
                    >{s}</button>
                  );
                })}
              </div>
            </div>

            {/* Thesis narrative */}
            <div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, marginBottom: 6 }}>Thesis</div>
              <textarea
                value={thesisDraft.thesis}
                onChange={(e) => setThesisDraft(prev => ({ ...prev, thesis: e.target.value }))}
                placeholder={`Why are you ${thesisDraft.sentiment} on ${ticker}?`}
                rows={3}
                style={{
                  width: "100%", padding: 12, borderRadius: 10, fontSize: 13, lineHeight: 1.6,
                  background: "rgba(236,227,213,0.04)", border: "1px solid rgba(236,227,213,0.12)",
                  color: "var(--text-primary)", resize: "vertical", outline: "none",
                  fontFamily: "inherit",
                }}
              />
            </div>

            {/* Target Price + Timeframe row */}
            <div className="flex" style={{ gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, marginBottom: 6 }}>Target Price</div>
                <input
                  type="number" step="0.01"
                  value={thesisDraft.targetPrice}
                  onChange={(e) => setThesisDraft(prev => ({ ...prev, targetPrice: e.target.value }))}
                  placeholder="e.g. 200"
                  style={{
                    width: "100%", padding: "8px 12px", borderRadius: 8, fontSize: 13,
                    background: "rgba(236,227,213,0.04)", border: "1px solid rgba(236,227,213,0.12)",
                    color: "var(--text-primary)", outline: "none", fontFamily: "var(--font-mono)",
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, marginBottom: 6 }}>Timeframe</div>
                <input
                  type="text"
                  value={thesisDraft.timeframe}
                  onChange={(e) => setThesisDraft(prev => ({ ...prev, timeframe: e.target.value }))}
                  placeholder="e.g. 6 months"
                  style={{
                    width: "100%", padding: "8px 12px", borderRadius: 8, fontSize: 13,
                    background: "rgba(236,227,213,0.04)", border: "1px solid rgba(236,227,213,0.12)",
                    color: "var(--text-primary)", outline: "none",
                  }}
                />
              </div>
            </div>

            {/* Catalysts + Risks */}
            <div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, marginBottom: 6 }}>Catalysts (comma-separated)</div>
              <input
                type="text"
                value={thesisDraft.catalysts}
                onChange={(e) => setThesisDraft(prev => ({ ...prev, catalysts: e.target.value }))}
                placeholder="e.g. AI growth, new product launch, earnings beat"
                style={{
                  width: "100%", padding: "8px 12px", borderRadius: 8, fontSize: 13,
                  background: "rgba(236,227,213,0.04)", border: "1px solid rgba(236,227,213,0.12)",
                  color: "var(--text-primary)", outline: "none",
                }}
              />
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, marginBottom: 6 }}>Risks (comma-separated)</div>
              <input
                type="text"
                value={thesisDraft.risks}
                onChange={(e) => setThesisDraft(prev => ({ ...prev, risks: e.target.value }))}
                placeholder="e.g. Regulation, competition, valuation"
                style={{
                  width: "100%", padding: "8px 12px", borderRadius: 8, fontSize: 13,
                  background: "rgba(236,227,213,0.04)", border: "1px solid rgba(236,227,213,0.12)",
                  color: "var(--text-primary)", outline: "none",
                }}
              />
            </div>

            {/* Save / Cancel buttons */}
            <div className="flex" style={{ gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setThesisEditing(false)}
                style={{
                  padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                  background: "transparent", border: "1px solid rgba(236,227,213,0.12)",
                  color: "var(--text-muted)", cursor: "pointer",
                }}
              >Cancel</button>
              <button
                onClick={saveThesis}
                disabled={!thesisDraft.thesis.trim()}
                style={{
                  padding: "8px 20px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                  background: !thesisDraft.thesis.trim() ? "rgba(236,227,213,0.06)" : "var(--accent)",
                  border: "none", color: !thesisDraft.thesis.trim() ? "var(--text-muted)" : "#0d0c0a",
                  cursor: !thesisDraft.thesis.trim() ? "not-allowed" : "pointer",
                }}
              >Save Thesis</button>
            </div>
          </div>
        ) : thesis ? (
          /* ── View Mode ── */
          <div>
            {/* Sentiment badge + edit/delete */}
            <div className="flex items-center" style={{ justifyContent: "space-between", marginBottom: 14 }}>
              <span style={{
                padding: "4px 12px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                textTransform: "uppercase", letterSpacing: "0.04em",
                background: thesis.sentiment === "bullish" ? "rgba(0,200,83,0.12)" : thesis.sentiment === "bearish" ? "rgba(255,53,53,0.12)" : "rgba(255,171,0,0.12)",
                color: thesis.sentiment === "bullish" ? "var(--buy)" : thesis.sentiment === "bearish" ? "var(--sell)" : "var(--warning)",
              }}>{thesis.sentiment}</span>
              <div className="flex" style={{ gap: 6 }}>
                <button onClick={startEditThesis} style={{
                  background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4,
                }} title="Edit thesis">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                  </svg>
                </button>
                <button onClick={() => { setThesis(null); if (userId) removeThesisMut({ userId, ticker }); }} style={{
                  background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4,
                }} title="Delete thesis">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Thesis text */}
            <p style={{ fontSize: 14, lineHeight: 1.7, color: "var(--text-secondary)", margin: "0 0 16px" }}>
              {thesis.thesis}
            </p>

            {/* Target + Timeframe */}
            {(thesis.targetPrice || thesis.timeframe) && (
              <div className="flex" style={{ gap: 24, marginBottom: 14 }}>
                {thesis.targetPrice && (
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, marginBottom: 2 }}>Target Price</div>
                    <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--accent-bright)" }}>
                      ${thesis.targetPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                )}
                {thesis.timeframe && (
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, marginBottom: 2 }}>Timeframe</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{thesis.timeframe}</div>
                  </div>
                )}
              </div>
            )}

            {/* Catalysts */}
            {thesis.catalysts.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, marginBottom: 6 }}>Catalysts</div>
                <div className="flex" style={{ gap: 6, flexWrap: "wrap" }}>
                  {thesis.catalysts.map((c, i) => (
                    <span key={i} style={{
                      padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 500,
                      background: "rgba(0,200,83,0.08)", color: "var(--buy)",
                      border: "1px solid rgba(0,200,83,0.15)",
                    }}>{c}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Risks */}
            {thesis.risks.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, marginBottom: 6 }}>Risks</div>
                <div className="flex" style={{ gap: 6, flexWrap: "wrap" }}>
                  {thesis.risks.map((r, i) => (
                    <span key={i} style={{
                      padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 500,
                      background: "rgba(255,53,53,0.08)", color: "var(--sell)",
                      border: "1px solid rgba(255,53,53,0.15)",
                    }}>{r}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Updated timestamp */}
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 8 }}>
              Updated {new Date(thesis.updatedAt).toLocaleDateString()}
            </div>
          </div>
        ) : (
          /* ── Empty State ── */
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>
              No thesis for {ticker} yet
            </div>
            <button
              onClick={startEditThesis}
              style={{
                padding: "8px 20px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: "rgba(236,227,213,0.06)", border: "1px solid rgba(236,227,213,0.12)",
                color: "var(--accent)", cursor: "pointer",
              }}
            >Write Your Thesis</button>
          </div>
        )}
      </Section>

      {/* ─── Key Statistics (Robinhood flat 4-column grid) ─── */}
      <Section title="Key statistics">
        <div style={{ display: "flex", flexWrap: "wrap" }}>
          {keyStats.map((s) => (
            <div key={s.label} style={{
              flex: "0 0 25%", padding: "14px 0",
              borderBottom: "1px solid var(--glass-border)",
            }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 13, fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ─── Analyst Ratings (Donut + Bars) ─── */}
      {detail.analystRatings.total > 0 && (
        <Section title="Analyst ratings">
          <div className="flex items-center" style={{ gap: 40, marginBottom: 24 }}>
            {/* Donut */}
            <DonutChart
              buyPct={detail.analystRatings.buyPercent}
              holdPct={detail.analystRatings.holdPercent}
              sellPct={detail.analystRatings.sellPercent}
              label={`of ${detail.analystRatings.total} ratings`}
            />
            {/* Horizontal bars */}
            <div style={{ flex: 1 }}>
              <PercentBar value={detail.analystRatings.buyPercent} color="var(--buy)" label="Buy" />
              <PercentBar value={detail.analystRatings.holdPercent} color="var(--warning)" label="Hold" />
              <PercentBar value={detail.analystRatings.sellPercent} color="var(--sell)" label="Sell" />
            </div>
          </div>

          {/* Price targets inline */}
          {detail.targetMeanPrice != null && detail.numberOfAnalysts > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, marginBottom: 12, letterSpacing: "0.05em" }}>PRICE TARGET</div>
              <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: "var(--sell)", fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                  {detail.targetLowPrice != null ? formatCurrency(detail.targetLowPrice) : "-"}
                </span>
                <span style={{ fontSize: 14, color: "var(--accent)", fontFamily: "var(--font-mono)", fontWeight: 700 }}>
                  Avg {detail.targetMeanPrice != null ? formatCurrency(detail.targetMeanPrice) : "-"}
                </span>
                <span style={{ fontSize: 12, color: "var(--buy)", fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                  {detail.targetHighPrice != null ? formatCurrency(detail.targetHighPrice) : "-"}
                </span>
              </div>
              <div style={{ position: "relative", height: 6, borderRadius: 3, background: "rgba(236,227,213,0.06)", marginBottom: 6 }}>
                <div style={{
                  position: "absolute", left: 0, top: 0, bottom: 0, width: "100%", borderRadius: 3,
                  background: "linear-gradient(90deg, var(--sell) 0%, var(--warning) 50%, var(--buy) 100%)",
                  opacity: 0.3,
                }} />
                <div style={{
                  position: "absolute", top: -5, left: `${currentInRange}%`, transform: "translateX(-50%)",
                  width: 16, height: 16, borderRadius: "50%", background: "var(--text-primary)",
                  border: "3px solid var(--bg)", boxShadow: "0 0 0 1px rgba(236,227,213,0.2)",
                }} />
              </div>
              <div style={{ textAlign: "center", fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                Current {formatCurrency(detail.price)} &middot; {detail.numberOfAnalysts} analyst{detail.numberOfAnalysts !== 1 ? "s" : ""}
              </div>
            </div>
          )}

          {/* Recent Rating Changes */}
          {detail.recentRatings.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, marginBottom: 12, letterSpacing: "0.05em" }}>RECENT CHANGES</div>
              {detail.recentRatings.slice(0, 6).map((r, i) => (
                <div key={i} className="flex items-center" style={{
                  padding: "10px 0", borderBottom: i < detail.recentRatings.length - 1 ? "1px solid var(--glass-border)" : "none",
                }}>
                  <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{r.firm}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 600, marginRight: 12,
                    padding: "2px 8px", borderRadius: 100,
                    background: r.action === "up" ? "var(--buy-muted)" : r.action === "down" ? "var(--sell-muted)" : "rgba(236,227,213,0.06)",
                    color: r.action === "up" ? "var(--buy)" : r.action === "down" ? "var(--sell)" : "var(--text-secondary)",
                  }}>
                    {r.action === "up" ? "Upgrade" : r.action === "down" ? "Downgrade" : r.action === "main" ? "Maintained" : r.action === "init" ? "Initiated" : r.action}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text-secondary)", minWidth: 100 }}>
                    {r.fromGrade !== "-" && r.fromGrade !== r.toGrade ? `${r.fromGrade} \u2192 ${r.toGrade}` : r.toGrade}
                  </span>
                  <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginLeft: 12 }}>{r.date}</span>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* ─── Earnings (Visual Chart) ─── */}
      {(detail.earningsHistory.length > 0 || detail.nextEarningsDate !== "-") && (
        <Section title="Earnings">
          {/* Next earnings date badge */}
          {detail.nextEarningsDate !== "-" && (
            <div className="flex items-center gap-3" style={{ marginBottom: 24 }}>
              <div className="flex items-center gap-2" style={{
                padding: "8px 14px", borderRadius: 100,
                background: "var(--accent-muted)", border: "1px solid rgba(196,123,58,0.2)",
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)" }}>
                  Next earnings: {detail.nextEarningsDate}
                </span>
              </div>
              {detail.currentQuarterEstimate != null && (
                <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                  Est. EPS: ${detail.currentQuarterEstimate.toFixed(2)}
                </span>
              )}
            </div>
          )}

          {/* EPS Bar Chart */}
          {detail.earningsHistory.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, marginBottom: 16, letterSpacing: "0.05em" }}>EPS — ACTUAL vs ESTIMATE</div>
              <EpsChart history={detail.earningsHistory.slice(0, 8)} />
            </div>
          )}

          {/* Revenue & Earnings Bar Charts */}
          <div className="flex" style={{ gap: 32 }}>
            {detail.yearlyFinancials.length > 0 && (
              <div style={{ flex: 1 }}>
                <RevenueChart
                  data={detail.yearlyFinancials.map(y => ({ label: y.year, revenue: y.revenue, earnings: y.earnings }))}
                  label="ANNUAL REVENUE & EARNINGS"
                />
              </div>
            )}
            {detail.quarterlyFinancials.length > 0 && (
              <div style={{ flex: 1 }}>
                <RevenueChart
                  data={detail.quarterlyFinancials.map(q => ({ label: q.quarter, revenue: q.revenue, earnings: q.earnings }))}
                  label="QUARTERLY REVENUE & EARNINGS"
                />
              </div>
            )}
          </div>
        </Section>
      )}

      {/* ─── Fundamentals (consolidated — no more boxes) ─── */}
      {(hasVal(detail.profitMargin) || hasVal(detail.totalRevenue) || hasVal(detail.priceToBook)) && (
        <Section title="Fundamentals">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 40px" }}>
            {[
              { label: "Forward P/E", value: detail.forwardPE },
              { label: "PEG Ratio", value: detail.pegRatio },
              { label: "Price/Book", value: detail.priceToBook },
              { label: "Price/Sales", value: detail.priceToSales },
              { label: "Enterprise Value", value: detail.enterpriseValue },
              { label: "EV/Revenue", value: detail.evToRevenue },
              { label: "EV/EBITDA", value: detail.evToEBITDA },
              { label: "Book Value", value: detail.bookValue },
              { label: "Gross Margin", value: detail.grossMargin },
              { label: "Operating Margin", value: detail.operatingMargin },
              { label: "Profit Margin", value: detail.profitMargin },
              { label: "Return on Equity", value: detail.returnOnEquity },
              { label: "Return on Assets", value: detail.returnOnAssets },
              { label: "Revenue/Share", value: detail.revenuePerShare },
              { label: "Total Revenue", value: detail.totalRevenue },
              { label: "Net Income", value: detail.netIncome },
              { label: "Free Cash Flow", value: detail.freeCashFlow },
              { label: "Operating Cash Flow", value: detail.operatingCashFlow },
              { label: "Total Cash", value: detail.totalCash },
              { label: "Total Debt", value: detail.totalDebt },
              { label: "Debt/Equity", value: detail.debtToEquity },
              { label: "Current Ratio", value: detail.currentRatio },
              { label: "EPS (TTM)", value: detail.trailingEPS },
              { label: "Forward EPS", value: detail.forwardEPS },
            ].filter(s => hasVal(s.value)).map((s) => (
              <div key={s.label} className="flex items-center justify-between" style={{
                padding: "10px 0", borderBottom: "1px solid var(--glass-border)",
              }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{s.label}</span>
                <span style={{ fontSize: 12, fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{s.value}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ─── Ownership (visual bars instead of boxes) ─── */}
      {(hasVal(detail.insiderPercent) || hasVal(detail.institutionalPercent) || hasVal(detail.sharesOutstanding)) && (
        <Section title="Ownership & shares">
          <div className="flex" style={{ gap: 48 }}>
            {/* Ownership bars */}
            {(hasVal(detail.insiderPercent) || hasVal(detail.institutionalPercent)) && (
              <div style={{ flex: 1 }}>
                {hasVal(detail.institutionalPercent) && (() => {
                  const pct = parseFloat(detail.institutionalPercent);
                  return <PercentBar value={isNaN(pct) ? 0 : pct} color="var(--accent)" label="Inst." />;
                })()}
                {hasVal(detail.insiderPercent) && (() => {
                  const pct = parseFloat(detail.insiderPercent);
                  return <PercentBar value={isNaN(pct) ? 0 : pct} color="var(--buy)" label="Insider" />;
                })()}
              </div>
            )}
            {/* Share stats */}
            <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" }}>
              {[
                { label: "Shares Out", value: detail.sharesOutstanding },
                { label: "Float", value: detail.floatShares },
                { label: "Short % Float", value: detail.shortFloat },
                { label: "Shares Short", value: detail.sharesShort },
                { label: "Short Ratio", value: detail.shortRatio },
              ].filter(s => hasVal(s.value)).map(s => (
                <div key={s.label} className="flex items-center justify-between" style={{ padding: "8px 0", borderBottom: "1px solid var(--glass-border)" }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{s.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </Section>
      )}

      {/* ─── Dividends (inline, not boxes) ─── */}
      {detail.dividendYield !== "-" && hasVal(detail.dividendYield) && (
        <Section title="Dividends">
          <div className="flex" style={{ gap: 48 }}>
            {[
              { label: "Dividend Yield", value: detail.dividendYield },
              { label: "Ex-Dividend Date", value: detail.exDividendDate },
              { label: "Dividend Date", value: detail.dividendDate },
            ].filter(s => s.value && s.value !== "-").map(s => (
              <div key={s.label}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 14, fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>{s.value}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ─── People Also Own ─── */}
      {detail.peers.length > 0 && (
        <Section title="People also own">
          <div className="flex" style={{ gap: 12, overflowX: "auto", paddingBottom: 8 }}>
            {detail.peers.map((peer) => {
              const peerPositive = peer.changePct >= 0;
              return (
                <div
                  key={peer.ticker}
                  onClick={() => onSelectTicker(peer.ticker)}
                  style={{
                    minWidth: 130, flexShrink: 0, padding: "16px",
                    border: "1px solid var(--glass-border)", borderRadius: 12,
                    cursor: "pointer", transition: "all 120ms ease",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(236,227,213,0.15)"; e.currentTarget.style.background = "rgba(255,245,230,0.03)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = ""; e.currentTarget.style.background = ""; }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 2 }}>
                    {peer.ticker}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {peer.name}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "var(--font-mono)", color: peerPositive ? "var(--buy)" : "var(--sell)", fontVariantNumeric: "tabular-nums" }}>
                    {formatPercent(peer.changePct)}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* ─── Related News ─── */}
      {news.length > 0 && (
        <Section title="News">
          {news.slice(0, 8).map((article) => (
            <a
              key={article.id}
              href={article.url || "#"}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex", gap: 16, padding: "16px 0",
                borderBottom: "1px solid var(--glass-border)",
                textDecoration: "none", color: "inherit",
                transition: "opacity 120ms ease",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.8"; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
            >
              <div style={{ flex: 1 }}>
                <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{article.source}</span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{article.time}</span>
                  {article.sentiment && (
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 100,
                      background: article.sentiment === "bullish" ? "var(--buy-muted)" : article.sentiment === "bearish" ? "var(--sell-muted)" : "rgba(236,227,213,0.06)",
                      color: article.sentiment === "bullish" ? "var(--buy)" : article.sentiment === "bearish" ? "var(--sell)" : "var(--text-muted)",
                    }}>
                      {article.sentiment}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.4, marginBottom: 4 }}>
                  {article.title}
                </div>
                {article.summary && (
                  <div style={{
                    fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5,
                    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as never, overflow: "hidden",
                  }}>
                    {article.summary}
                  </div>
                )}
              </div>
            </a>
          ))}
        </Section>
      )}
      </>}
    </div>
  );
}
