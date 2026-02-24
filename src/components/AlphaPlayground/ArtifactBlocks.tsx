"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Shared Styles ───

const BLOCK_CONTAINER: React.CSSProperties = {
  marginTop: 12,
  background: "rgba(236,227,213,0.03)",
  borderRadius: 10,
  border: "1px solid rgba(236,227,213,0.08)",
  overflow: "hidden",
};

const BLOCK_HEADER: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "10px 14px",
  borderBottom: "1px solid rgba(236,227,213,0.06)",
};

const BLOCK_TITLE: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  fontFamily: "var(--font-mono)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.04em",
  color: "var(--accent-bright)",
};

const METRIC_LABEL: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 500,
  fontFamily: "var(--font-mono)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.04em",
  color: "var(--text-muted)",
  marginBottom: 2,
};

const METRIC_VALUE: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  fontFamily: "var(--font-mono)",
  fontVariantNumeric: "tabular-nums",
  color: "var(--text-primary)",
};

const TABLE_CELL: React.CSSProperties = {
  padding: "6px 8px",
  fontSize: 11,
  fontFamily: "var(--font-mono)",
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap" as const,
  borderBottom: "1px solid rgba(236,227,213,0.04)",
};

const TABLE_HEADER: React.CSSProperties = {
  ...TABLE_CELL,
  fontSize: 10,
  fontWeight: 600,
  color: "var(--text-muted)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.03em",
  borderBottom: "1px solid rgba(236,227,213,0.08)",
  position: "sticky" as const,
  top: 0,
  background: "rgba(26,23,20,0.98)",
  zIndex: 1,
};

const BADGE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "2px 8px",
  borderRadius: 12,
  fontSize: 10,
  fontWeight: 600,
  fontFamily: "var(--font-mono)",
};

// ─── Utilities ───

function fmt(n: number | null | undefined, decimals = 2): string {
  if (n == null || isNaN(n)) return "-";
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtCompact(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "-";
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(2);
}

function fmtPct(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "-";
  return `${(n * 100).toFixed(1)}%`;
}

function BlockCollapse({ label, count, children }: { label: string; count?: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={BLOCK_CONTAINER}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          ...BLOCK_HEADER,
          cursor: "pointer",
          background: "transparent",
          border: "none",
          width: "100%",
          borderBottom: open ? "1px solid rgba(236,227,213,0.06)" : "none",
        }}
      >
        <span style={BLOCK_TITLE}>{label}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {count != null && (
            <span style={{ ...BADGE, background: "rgba(196,123,58,0.12)", color: "var(--accent-bright)" }}>
              {count}
            </span>
          )}
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"
            style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 150ms ease" }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            style={{ overflow: "hidden" }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MiniSparkline({ data, positive }: { data: number[]; positive?: boolean }) {
  if (!data || data.length < 2) return null;
  const w = 80, h = 28;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - 2 - ((v - min) / range) * (h - 4)}`).join(" ");
  const color = positive ? "var(--buy)" : "var(--sell)";
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      <defs>
        <linearGradient id={`sp-${positive ? "g" : "r"}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${h} ${points} ${w},${h}`}
        fill={`url(#sp-${positive ? "g" : "r"})`}
      />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ─── Options Chain Block ───

interface OptionsChainData {
  ticker?: string;
  currentPrice?: number;
  expirations?: string[];
  chains?: Array<{
    expiration: string;
    calls: OptionRow[];
    puts: OptionRow[];
  }>;
  // Greeks mode
  expiration?: string;
  daysToExpiry?: number;
  calls?: OptionRow[];
  puts?: OptionRow[];
}

interface OptionRow {
  strike: number;
  bid: number;
  ask: number;
  last: number;
  volume: number;
  openInterest: number;
  impliedVolatility?: number;
  iv?: number;
  inTheMoney?: boolean;
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
}

function OptionsChainBlock({ data }: { data: OptionsChainData }) {
  const hasChains = data.chains && data.chains.length > 0;
  const hasGreeks = data.calls && data.puts;
  const [selectedExp, setSelectedExp] = useState(0);
  const [tab, setTab] = useState<"calls" | "puts">("calls");

  const currentChain = hasChains ? data.chains![selectedExp] : null;
  const calls = hasGreeks ? data.calls! : currentChain?.calls || [];
  const puts = hasGreeks ? data.puts! : currentChain?.puts || [];
  const rows = tab === "calls" ? calls : puts;
  const showGreeks = rows.length > 0 && rows[0].delta !== undefined;

  const expLabel = hasGreeks
    ? data.expiration
    : currentChain?.expiration;

  return (
    <BlockCollapse label={`Options Chain — ${data.ticker || "?"}`} count={rows.length}>
      {/* Header metrics */}
      <div style={{ display: "flex", gap: 24, padding: "10px 14px", borderBottom: "1px solid rgba(236,227,213,0.06)" }}>
        <div>
          <div style={METRIC_LABEL}>Spot</div>
          <div style={METRIC_VALUE}>${fmt(data.currentPrice)}</div>
        </div>
        <div>
          <div style={METRIC_LABEL}>Expiry</div>
          <div style={{ ...METRIC_VALUE, fontSize: 13 }}>{expLabel || "-"}</div>
        </div>
        {data.daysToExpiry != null && (
          <div>
            <div style={METRIC_LABEL}>DTE</div>
            <div style={METRIC_VALUE}>{data.daysToExpiry}d</div>
          </div>
        )}
      </div>

      {/* Expiration tabs (chain mode) */}
      {hasChains && data.chains!.length > 1 && (
        <div style={{ display: "flex", gap: 4, padding: "8px 14px", borderBottom: "1px solid rgba(236,227,213,0.04)", overflowX: "auto" }}>
          {data.chains!.map((c, i) => (
            <button
              key={c.expiration}
              onClick={() => setSelectedExp(i)}
              style={{
                padding: "4px 10px", borderRadius: 6, fontSize: 10, fontFamily: "var(--font-mono)",
                fontWeight: 600, cursor: "pointer", border: "none",
                background: i === selectedExp ? "rgba(196,123,58,0.15)" : "rgba(236,227,213,0.04)",
                color: i === selectedExp ? "var(--accent-bright)" : "var(--text-muted)",
              }}
            >
              {c.expiration}
            </button>
          ))}
        </div>
      )}

      {/* Calls/Puts toggle */}
      <div style={{ display: "flex", borderBottom: "1px solid rgba(236,227,213,0.06)" }}>
        {(["calls", "puts"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: "8px 0", border: "none", cursor: "pointer",
              fontSize: 11, fontWeight: 600, fontFamily: "var(--font-mono)",
              textTransform: "uppercase",
              background: tab === t ? "rgba(236,227,213,0.04)" : "transparent",
              color: tab === t ? (t === "calls" ? "var(--buy)" : "var(--sell)") : "var(--text-muted)",
              borderBottom: tab === t ? `2px solid ${t === "calls" ? "var(--buy)" : "var(--sell)"}` : "2px solid transparent",
            }}
          >
            {t} ({(t === "calls" ? calls : puts).length})
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ maxHeight: 320, overflowY: "auto", overflowX: "auto", scrollbarWidth: "thin" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...TABLE_HEADER, textAlign: "right" }}>Strike</th>
              <th style={{ ...TABLE_HEADER, textAlign: "right" }}>Bid</th>
              <th style={{ ...TABLE_HEADER, textAlign: "right" }}>Ask</th>
              <th style={{ ...TABLE_HEADER, textAlign: "right" }}>Last</th>
              <th style={{ ...TABLE_HEADER, textAlign: "right" }}>Vol</th>
              <th style={{ ...TABLE_HEADER, textAlign: "right" }}>OI</th>
              <th style={{ ...TABLE_HEADER, textAlign: "right" }}>IV</th>
              {showGreeks && <th style={{ ...TABLE_HEADER, textAlign: "right" }}>Delta</th>}
              {showGreeks && <th style={{ ...TABLE_HEADER, textAlign: "right" }}>Gamma</th>}
              {showGreeks && <th style={{ ...TABLE_HEADER, textAlign: "right" }}>Theta</th>}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 40).map((row, i) => {
              const iv = row.iv ?? row.impliedVolatility ?? 0;
              const itm = row.inTheMoney;
              return (
                <tr
                  key={i}
                  style={{
                    background: itm ? "rgba(196,123,58,0.04)" : "transparent",
                  }}
                >
                  <td style={{ ...TABLE_CELL, textAlign: "right", fontWeight: 600, color: itm ? "var(--accent-bright)" : "var(--text-primary)" }}>
                    {fmt(row.strike)}
                  </td>
                  <td style={{ ...TABLE_CELL, textAlign: "right", color: "var(--text-secondary)" }}>{fmt(row.bid)}</td>
                  <td style={{ ...TABLE_CELL, textAlign: "right", color: "var(--text-secondary)" }}>{fmt(row.ask)}</td>
                  <td style={{ ...TABLE_CELL, textAlign: "right", color: "var(--text-primary)" }}>{fmt(row.last)}</td>
                  <td style={{ ...TABLE_CELL, textAlign: "right", color: "var(--text-secondary)" }}>{fmtCompact(row.volume)}</td>
                  <td style={{ ...TABLE_CELL, textAlign: "right", color: "var(--text-secondary)" }}>{fmtCompact(row.openInterest)}</td>
                  <td style={{ ...TABLE_CELL, textAlign: "right", color: iv > 0.5 ? "var(--warning)" : "var(--text-secondary)" }}>
                    {fmtPct(iv)}
                  </td>
                  {showGreeks && (
                    <td style={{ ...TABLE_CELL, textAlign: "right", color: (row.delta ?? 0) > 0 ? "var(--buy)" : "var(--sell)" }}>
                      {fmt(row.delta, 3)}
                    </td>
                  )}
                  {showGreeks && (
                    <td style={{ ...TABLE_CELL, textAlign: "right", color: "var(--text-muted)" }}>
                      {fmt(row.gamma, 4)}
                    </td>
                  )}
                  {showGreeks && (
                    <td style={{ ...TABLE_CELL, textAlign: "right", color: "var(--sell)" }}>
                      {fmt(row.theta, 3)}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </BlockCollapse>
  );
}

// ─── Economic Data Block ───

interface EconomicDataPayload {
  seriesId?: string;
  info?: {
    id?: string;
    title?: string;
    frequency?: string;
    units?: string;
    lastUpdated?: string;
  };
  latest?: { date?: string; value?: number | null };
  observations?: Array<{ date?: string; value?: number | null }>;
  count?: number;
}

function EconomicDataBlock({ data }: { data: EconomicDataPayload }) {
  const obs = data.observations || [];
  const values = obs.map((o) => o.value).filter((v): v is number => v != null);
  const latest = data.latest;
  const prev = obs.length >= 2 ? obs[obs.length - 2]?.value : null;
  const change = latest?.value != null && prev != null ? latest.value - prev : null;
  const changePct = change != null && prev != null && prev !== 0 ? (change / Math.abs(prev)) : null;
  const isPositive = change != null ? change >= 0 : true;

  return (
    <BlockCollapse label={data.info?.title || data.seriesId || "Economic Data"}>
      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Main metric */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 16 }}>
          <div>
            <div style={METRIC_LABEL}>{data.info?.units || "Value"}</div>
            <div style={{ ...METRIC_VALUE, fontSize: 22 }}>
              {latest?.value != null ? fmt(latest.value, latest.value < 10 ? 2 : 1) : "-"}
            </div>
          </div>
          {change != null && (
            <div style={{ paddingBottom: 2 }}>
              <span style={{
                ...BADGE,
                background: isPositive ? "rgba(34,171,148,0.12)" : "rgba(229,77,77,0.12)",
                color: isPositive ? "var(--buy)" : "var(--sell)",
              }}>
                {isPositive ? "+" : ""}{fmt(change, 2)}
                {changePct != null && ` (${isPositive ? "+" : ""}${(changePct * 100).toFixed(1)}%)`}
              </span>
            </div>
          )}
        </div>

        {/* Sparkline */}
        {values.length >= 3 && (
          <MiniSparkline data={values} positive={isPositive} />
        )}

        {/* Info bar */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {data.info?.frequency && (
            <div>
              <div style={METRIC_LABEL}>Frequency</div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>{data.info.frequency}</div>
            </div>
          )}
          {latest?.date && (
            <div>
              <div style={METRIC_LABEL}>As of</div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>{latest.date}</div>
            </div>
          )}
          {data.info?.lastUpdated && (
            <div>
              <div style={METRIC_LABEL}>Updated</div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>{data.info.lastUpdated}</div>
            </div>
          )}
        </div>

        {/* Data table (last N observations) */}
        {obs.length > 2 && (
          <div style={{ maxHeight: 200, overflowY: "auto", scrollbarWidth: "thin", marginTop: 4 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ ...TABLE_HEADER, textAlign: "left" }}>Date</th>
                  <th style={{ ...TABLE_HEADER, textAlign: "right" }}>Value</th>
                  <th style={{ ...TABLE_HEADER, textAlign: "right" }}>Change</th>
                </tr>
              </thead>
              <tbody>
                {[...obs].reverse().slice(0, 20).map((o, i, arr) => {
                  const prev = i < arr.length - 1 ? arr[i + 1]?.value : null;
                  const chg = o.value != null && prev != null ? o.value - prev : null;
                  return (
                    <tr key={i}>
                      <td style={{ ...TABLE_CELL, color: "var(--text-secondary)" }}>{o.date}</td>
                      <td style={{ ...TABLE_CELL, textAlign: "right", color: "var(--text-primary)", fontWeight: 600 }}>
                        {o.value != null ? fmt(o.value, o.value < 10 ? 2 : 1) : "-"}
                      </td>
                      <td style={{
                        ...TABLE_CELL, textAlign: "right",
                        color: chg == null ? "var(--text-muted)" : chg >= 0 ? "var(--buy)" : "var(--sell)",
                      }}>
                        {chg != null ? `${chg >= 0 ? "+" : ""}${fmt(chg, 2)}` : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </BlockCollapse>
  );
}

// ─── Yield Curve Block ───

interface YieldCurveData {
  yields?: Record<string, number | null>;
  spread_10y_2y?: number | null;
  inverted?: boolean;
  asOfDate?: string;
}

function YieldCurveBlock({ data }: { data: YieldCurveData }) {
  const maturities = ["3m", "6m", "1y", "2y", "5y", "7y", "10y", "20y", "30y"];
  const yields = data.yields || {};

  const points = useMemo(() => {
    const pts: { label: string; value: number; x: number }[] = [];
    maturities.forEach((m, i) => {
      const v = yields[m];
      if (v != null) pts.push({ label: m, value: v, x: i });
    });
    return pts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yields]);

  // All derived values computed unconditionally (hooks can't be after early return)
  const { minVal, maxVal, steepness } = useMemo(() => {
    if (points.length < 2) return { minVal: 0, maxVal: 0, steepness: null as number | null };
    const min = Math.min(...points.map((p) => p.value));
    const max = Math.max(...points.map((p) => p.value));
    const se = points.find(p => p.label === "2y")?.value ?? points[0]?.value;
    const le = points.find(p => p.label === "10y")?.value ?? points[points.length - 1]?.value;
    const st = le != null && se != null ? le - se : null;
    return { minVal: min, maxVal: max, steepness: st };
  }, [points]);

  const w = 480, h = 180, padL = 42, padR = 16, padT = 28, padB = 32;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;
  const minY = minVal - 0.15;
  const maxY = maxVal + 0.25;
  const rangeY = maxY - minY || 1;

  // Smooth curve using Catmull-Rom to cubic bezier
  const { smoothPath, areaPath } = useMemo(() => {
    if (points.length < 2) return { smoothPath: "", areaPath: "" };
    const toSvg = (i: number, v: number) => ({
      x: padL + (i / (points.length - 1)) * chartW,
      y: padT + (1 - (v - minY) / rangeY) * chartH,
    });
    const svgPts = points.map((p, i) => toSvg(i, p.value));
    let d = `M ${svgPts[0].x} ${svgPts[0].y}`;
    for (let i = 0; i < svgPts.length - 1; i++) {
      const p0 = svgPts[Math.max(0, i - 1)];
      const p1 = svgPts[i];
      const p2 = svgPts[i + 1];
      const p3 = svgPts[Math.min(svgPts.length - 1, i + 2)];
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    const lastPt = toSvg(points.length - 1, points[points.length - 1].value);
    const area = d + ` L ${lastPt.x} ${padT + chartH} L ${padL} ${padT + chartH} Z`;
    return { smoothPath: d, areaPath: area };
  }, [points, padL, chartW, padT, minY, rangeY, chartH]);

  // Y-axis tick values
  const yTicks = useMemo(() => {
    const step = rangeY > 1.5 ? 0.5 : rangeY > 0.8 ? 0.25 : 0.1;
    const ticks: number[] = [];
    let v = Math.ceil(minY / step) * step;
    while (v <= maxY) {
      ticks.push(v);
      v += step;
    }
    return ticks;
  }, [minY, maxY, rangeY]);

  // Early return AFTER all hooks
  if (points.length < 2) return null;

  const toSvg = (i: number, v: number) => ({
    x: padL + (i / (points.length - 1)) * chartW,
    y: padT + (1 - (v - minY) / rangeY) * chartH,
  });

  const lineColor = data.inverted ? "var(--sell)" : "var(--buy)";
  const gradId = `yc-grad-${data.inverted ? "inv" : "norm"}`;

  return (
    <BlockCollapse label="Treasury Yield Curve">
      <div style={{ padding: "14px 14px 10px" }}>
        {/* Header metrics row */}
        <div style={{ display: "flex", gap: 24, marginBottom: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <div style={METRIC_LABEL}>10Y-2Y Spread</div>
            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", color: lineColor, lineHeight: 1.2 }}>
              {data.spread_10y_2y != null ? `${data.spread_10y_2y > 0 ? "+" : ""}${data.spread_10y_2y.toFixed(2)}%` : "-"}
            </div>
          </div>
          {steepness != null && (
            <div>
              <div style={METRIC_LABEL}>Steepness</div>
              <div style={{ ...METRIC_VALUE, color: steepness >= 0 ? "var(--buy)" : "var(--sell)" }}>
                {steepness >= 0 ? "+" : ""}{steepness.toFixed(2)}%
              </div>
            </div>
          )}
          <div>
            <div style={METRIC_LABEL}>Range</div>
            <div style={METRIC_VALUE}>{minVal.toFixed(2)}% — {maxVal.toFixed(2)}%</div>
          </div>
          {data.inverted && (
            <span style={{ ...BADGE, background: "rgba(229,77,77,0.12)", color: "var(--sell)", fontSize: 9, padding: "3px 10px" }}>
              INVERTED
            </span>
          )}
          <div style={{ marginLeft: "auto" }}>
            {data.asOfDate && (
              <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{data.asOfDate}</div>
            )}
          </div>
        </div>

        {/* SVG Curve */}
        <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto", display: "block" }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity="0.18" />
              <stop offset="60%" stopColor={lineColor} stopOpacity="0.06" />
              <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
            </linearGradient>
            <filter id="yc-glow">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* Y-axis grid lines + labels */}
          {yTicks.map((val) => {
            const y = padT + (1 - (val - minY) / rangeY) * chartH;
            return (
              <g key={val}>
                <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="rgba(236,227,213,0.05)" strokeWidth="0.5" />
                <text x={padL - 6} y={y + 3.5} textAnchor="end" fontSize="9" fill="var(--text-muted)" fontFamily="var(--font-mono)" opacity="0.7">
                  {val.toFixed(1)}%
                </text>
              </g>
            );
          })}

          {/* Area fill */}
          <path d={areaPath} fill={`url(#${gradId})`} />

          {/* Glow line (behind main line) */}
          <path d={smoothPath} fill="none" stroke={lineColor} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity="0.15" />
          {/* Main curve line */}
          <path d={smoothPath} fill="none" stroke={lineColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

          {/* Data points + labels */}
          {points.map((p, i) => {
            const { x, y } = toSvg(i, p.value);
            // Stagger labels up/down to prevent overlap
            const isLabelAbove = i === 0 || p.value >= (points[i - 1]?.value ?? 0);
            const labelY = isLabelAbove ? y - 10 : y + 14;
            return (
              <g key={p.label}>
                {/* Outer ring */}
                <circle cx={x} cy={y} r="5" fill="none" stroke={lineColor} strokeWidth="1" opacity="0.3" />
                {/* Inner dot */}
                <circle cx={x} cy={y} r="2.5" fill={lineColor} />
                {/* Value label */}
                <text x={x} y={labelY} textAnchor="middle" fontSize="9" fill="var(--text-primary)" fontFamily="var(--font-mono)" fontWeight="600">
                  {p.value.toFixed(2)}%
                </text>
                {/* Maturity label on x-axis */}
                <text x={x} y={padT + chartH + 16} textAnchor="middle" fontSize="9" fill="var(--text-muted)" fontFamily="var(--font-mono)" fontWeight="500">
                  {p.label.toUpperCase()}
                </text>
              </g>
            );
          })}

          {/* Baseline */}
          <line x1={padL} y1={padT + chartH} x2={w - padR} y2={padT + chartH} stroke="rgba(236,227,213,0.08)" strokeWidth="1" />
        </svg>
      </div>
    </BlockCollapse>
  );
}

// ─── Earnings Calendar Block ───

interface EarningsData {
  ticker?: string;
  earningsCount?: number;
  earnings?: Array<{
    date?: string;
    epsEstimate?: number | null;
    epsActual?: number | null;
    revenueEstimate?: number | null;
    revenueActual?: number | null;
    quarter?: number;
    year?: number;
    hour?: string;
    symbol?: string;
  }>;
}

function EarningsCalendarBlock({ data }: { data: EarningsData }) {
  const earnings = data.earnings || [];
  if (earnings.length === 0) return null;

  const now = new Date().toISOString().slice(0, 10);

  return (
    <BlockCollapse label={`Earnings — ${data.ticker || "?"}`} count={earnings.length}>
      <div style={{ maxHeight: 300, overflowY: "auto", scrollbarWidth: "thin" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...TABLE_HEADER, textAlign: "left" }}>Date</th>
              <th style={{ ...TABLE_HEADER, textAlign: "center" }}>Qtr</th>
              <th style={{ ...TABLE_HEADER, textAlign: "right" }}>EPS Est</th>
              <th style={{ ...TABLE_HEADER, textAlign: "right" }}>EPS Act</th>
              <th style={{ ...TABLE_HEADER, textAlign: "right" }}>Rev Est</th>
              <th style={{ ...TABLE_HEADER, textAlign: "right" }}>Rev Act</th>
            </tr>
          </thead>
          <tbody>
            {earnings.map((e, i) => {
              const isFuture = e.date && e.date >= now;
              const beat = e.epsActual != null && e.epsEstimate != null && e.epsActual > e.epsEstimate;
              const miss = e.epsActual != null && e.epsEstimate != null && e.epsActual < e.epsEstimate;
              return (
                <tr key={i} style={{ background: isFuture ? "rgba(196,123,58,0.04)" : "transparent" }}>
                  <td style={{ ...TABLE_CELL, color: isFuture ? "var(--accent-bright)" : "var(--text-secondary)", fontWeight: isFuture ? 600 : 400 }}>
                    {e.date || "-"}
                    {e.hour && <span style={{ fontSize: 9, color: "var(--text-muted)", marginLeft: 4 }}>{e.hour.toUpperCase()}</span>}
                    {isFuture && <span style={{ ...BADGE, background: "rgba(196,123,58,0.15)", color: "var(--accent-bright)", marginLeft: 6, fontSize: 8 }}>UPCOMING</span>}
                  </td>
                  <td style={{ ...TABLE_CELL, textAlign: "center", color: "var(--text-muted)" }}>
                    {e.quarter && e.year ? `Q${e.quarter} '${String(e.year).slice(2)}` : "-"}
                  </td>
                  <td style={{ ...TABLE_CELL, textAlign: "right", color: "var(--text-secondary)" }}>
                    {e.epsEstimate != null ? `$${fmt(e.epsEstimate)}` : "-"}
                  </td>
                  <td style={{
                    ...TABLE_CELL, textAlign: "right", fontWeight: 600,
                    color: beat ? "var(--buy)" : miss ? "var(--sell)" : "var(--text-primary)",
                  }}>
                    {e.epsActual != null ? `$${fmt(e.epsActual)}` : "-"}
                  </td>
                  <td style={{ ...TABLE_CELL, textAlign: "right", color: "var(--text-secondary)" }}>
                    {e.revenueEstimate != null ? `$${fmtCompact(e.revenueEstimate)}` : "-"}
                  </td>
                  <td style={{ ...TABLE_CELL, textAlign: "right", color: "var(--text-primary)" }}>
                    {e.revenueActual != null ? `$${fmtCompact(e.revenueActual)}` : "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </BlockCollapse>
  );
}

// ─── Insider Activity Block ───

interface InsiderActivityData {
  ticker?: string;
  edgar?: {
    ticker?: string;
    companyName?: string;
    form4Count?: number;
    trades?: Array<{
      form?: string;
      filingDate?: string;
      description?: string;
      accession?: string;
    }>;
    error?: string;
  };
  sentiment?: {
    ticker?: string;
    sentimentCount?: number;
    sentiment?: Array<{
      year?: number;
      month?: number;
      change?: number;
      mspr?: number;
    }>;
    error?: string;
  };
}

function InsiderActivityBlock({ data }: { data: InsiderActivityData }) {
  const edgar = data.edgar;
  const sentiment = data.sentiment;
  const trades = edgar?.trades || [];
  const sentimentData = sentiment?.sentiment || [];

  // Overall sentiment signal
  const recentMspr = sentimentData.length > 0 ? sentimentData[sentimentData.length - 1]?.mspr : null;
  const signalLabel = recentMspr == null ? null : recentMspr > 0.1 ? "Buying" : recentMspr < -0.1 ? "Selling" : "Neutral";
  const signalColor = recentMspr == null ? "var(--text-muted)" : recentMspr > 0.1 ? "var(--buy)" : recentMspr < -0.1 ? "var(--sell)" : "var(--warning)";

  return (
    <BlockCollapse label={`Insider Activity — ${data.ticker || "?"}`} count={trades.length}>
      <div style={{ padding: 14 }}>
        {/* Sentiment summary */}
        <div style={{ display: "flex", gap: 20, marginBottom: 12, flexWrap: "wrap" }}>
          {edgar?.companyName && (
            <div>
              <div style={METRIC_LABEL}>Company</div>
              <div style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 600 }}>{edgar.companyName}</div>
            </div>
          )}
          {signalLabel && (
            <div>
              <div style={METRIC_LABEL}>Signal</div>
              <span style={{ ...BADGE, background: `${signalColor}20`, color: signalColor }}>
                {signalLabel}
              </span>
            </div>
          )}
          {recentMspr != null && (
            <div>
              <div style={METRIC_LABEL}>MSPR</div>
              <div style={{ ...METRIC_VALUE, fontSize: 13, color: signalColor }}>{fmt(recentMspr, 4)}</div>
            </div>
          )}
        </div>

        {/* Sentiment bar chart */}
        {sentimentData.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ ...METRIC_LABEL, marginBottom: 6 }}>Monthly Insider Sentiment</div>
            <div style={{ display: "flex", alignItems: "end", gap: 2, height: 40 }}>
              {sentimentData.map((s, i) => {
                const mspr = s.mspr || 0;
                const maxMspr = Math.max(...sentimentData.map((d) => Math.abs(d.mspr || 0)), 0.01);
                const barH = Math.max(2, (Math.abs(mspr) / maxMspr) * 36);
                return (
                  <div
                    key={i}
                    title={`${s.year}-${String(s.month).padStart(2, "0")}: MSPR ${fmt(mspr, 4)}`}
                    style={{
                      flex: 1,
                      height: barH,
                      borderRadius: 2,
                      background: mspr >= 0 ? "var(--buy)" : "var(--sell)",
                      opacity: 0.7,
                      alignSelf: "flex-end",
                    }}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* EDGAR filings table */}
        {trades.length > 0 && (
          <div style={{ maxHeight: 200, overflowY: "auto", scrollbarWidth: "thin" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ ...TABLE_HEADER, textAlign: "left" }}>Date</th>
                  <th style={{ ...TABLE_HEADER, textAlign: "left" }}>Filing</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t, i) => (
                  <tr key={i}>
                    <td style={{ ...TABLE_CELL, color: "var(--text-secondary)" }}>{t.filingDate || "-"}</td>
                    <td style={{ ...TABLE_CELL, color: "var(--text-primary)" }}>
                      {t.description || `Form ${t.form}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Errors */}
        {edgar?.error && (
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic", marginTop: 8 }}>
            EDGAR: {edgar.error}
          </div>
        )}
        {sentiment?.error && (
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic", marginTop: 4 }}>
            Finnhub: {sentiment.error}
          </div>
        )}
      </div>
    </BlockCollapse>
  );
}

// ─── Company News Block ───

interface CompanyNewsData {
  ticker?: string;
  newsCount?: number;
  news?: Array<{
    headline?: string;
    source?: string;
    summary?: string;
    url?: string;
    datetime?: number;
    category?: string;
  }>;
}

function CompanyNewsBlock({ data }: { data: CompanyNewsData }) {
  const articles = data.news || [];
  if (articles.length === 0) return null;

  return (
    <BlockCollapse label={`News — ${data.ticker || "?"}`} count={articles.length}>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {articles.slice(0, 10).map((article, i) => {
          const date = article.datetime
            ? new Date(article.datetime * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" })
            : null;
          return (
            <div
              key={i}
              style={{
                padding: "10px 14px",
                borderBottom: i < articles.length - 1 ? "1px solid rgba(236,227,213,0.04)" : "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 12, fontWeight: 600, color: "var(--text-primary)",
                    lineHeight: 1.4, marginBottom: 3,
                  }}>
                    {article.url ? (
                      <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "inherit", textDecoration: "none" }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = "var(--link)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-primary)"; }}
                      >
                        {article.headline}
                      </a>
                    ) : (
                      article.headline
                    )}
                  </div>
                  {article.summary && (
                    <div style={{
                      fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5,
                      overflow: "hidden", textOverflow: "ellipsis",
                      display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const,
                    }}>
                      {article.summary}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                    {article.source && (
                      <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                        {article.source}
                      </span>
                    )}
                    {date && (
                      <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                        {date}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </BlockCollapse>
  );
}

// ─── Stock Info Block ───

interface StockInfoData {
  ticker?: string;
  name?: string;
  price?: number;
  change?: number;
  changePct?: number;
  marketCap?: number;
  pe?: number;
  eps?: number;
  dividend?: number;
  dividendYield?: number;
  high52?: number;
  low52?: number;
  volume?: number;
  avgVolume?: number;
  sector?: string;
  industry?: string;
  description?: string;
  analystRating?: string;
  targetPrice?: number;
}

function StockInfoBlock({ data }: { data: StockInfoData }) {
  const isPos = (data.changePct ?? 0) >= 0;

  return (
    <BlockCollapse label={`${data.ticker || "?"} — ${data.name || "Stock"}`}>
      <div style={{ padding: 14 }}>
        {/* Price header */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12, marginBottom: 12 }}>
          <div style={{ ...METRIC_VALUE, fontSize: 24 }}>${fmt(data.price)}</div>
          <div style={{
            ...BADGE, marginBottom: 3,
            background: isPos ? "rgba(34,171,148,0.12)" : "rgba(229,77,77,0.12)",
            color: isPos ? "var(--buy)" : "var(--sell)",
          }}>
            {data.change != null ? `${isPos ? "+" : ""}${fmt(data.change)}` : ""}
            {data.changePct != null ? ` (${isPos ? "+" : ""}${(data.changePct).toFixed(2)}%)` : ""}
          </div>
        </div>

        {/* Metrics grid */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 20px" }}>
          {data.marketCap != null && (
            <div><div style={METRIC_LABEL}>Mkt Cap</div><div style={{ ...METRIC_VALUE, fontSize: 12 }}>${fmtCompact(data.marketCap)}</div></div>
          )}
          {data.pe != null && (
            <div><div style={METRIC_LABEL}>P/E</div><div style={{ ...METRIC_VALUE, fontSize: 12 }}>{fmt(data.pe, 1)}</div></div>
          )}
          {data.eps != null && (
            <div><div style={METRIC_LABEL}>EPS</div><div style={{ ...METRIC_VALUE, fontSize: 12 }}>${fmt(data.eps)}</div></div>
          )}
          {data.dividendYield != null && data.dividendYield > 0 && (
            <div><div style={METRIC_LABEL}>Div Yield</div><div style={{ ...METRIC_VALUE, fontSize: 12 }}>{(data.dividendYield * 100).toFixed(2)}%</div></div>
          )}
          {data.high52 != null && (
            <div><div style={METRIC_LABEL}>52W High</div><div style={{ ...METRIC_VALUE, fontSize: 12 }}>${fmt(data.high52)}</div></div>
          )}
          {data.low52 != null && (
            <div><div style={METRIC_LABEL}>52W Low</div><div style={{ ...METRIC_VALUE, fontSize: 12 }}>${fmt(data.low52)}</div></div>
          )}
          {data.volume != null && (
            <div><div style={METRIC_LABEL}>Volume</div><div style={{ ...METRIC_VALUE, fontSize: 12 }}>{fmtCompact(data.volume)}</div></div>
          )}
          {data.sector && (
            <div><div style={METRIC_LABEL}>Sector</div><div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{data.sector}</div></div>
          )}
        </div>

        {data.description && (
          <div style={{
            fontSize: 11, color: "var(--text-muted)", lineHeight: 1.6, marginTop: 12,
            overflow: "hidden", textOverflow: "ellipsis",
            display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" as const,
          }}>
            {data.description}
          </div>
        )}
      </div>
    </BlockCollapse>
  );
}

// ─── Market Data Block (candles summary) ───

interface MarketDataPayload {
  symbol?: string;
  period?: string;
  interval?: string;
  count?: number;
  latest?: { date?: string; open?: number; high?: number; low?: number; close?: number; volume?: number };
  candles?: Array<{ close?: number }>;
}

function MarketDataBlock({ data }: { data: MarketDataPayload }) {
  const latest = data.latest;
  const closes = (data.candles || []).map((c) => c.close).filter((v): v is number => v != null);
  const isPos = closes.length >= 2 ? closes[closes.length - 1] >= closes[0] : true;

  return (
    <BlockCollapse label={`Market Data — ${data.symbol || "?"}`}>
      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          {latest?.close != null && (
            <div><div style={METRIC_LABEL}>Close</div><div style={METRIC_VALUE}>${fmt(latest.close)}</div></div>
          )}
          {latest?.high != null && (
            <div><div style={METRIC_LABEL}>High</div><div style={{ ...METRIC_VALUE, fontSize: 13 }}>${fmt(latest.high)}</div></div>
          )}
          {latest?.low != null && (
            <div><div style={METRIC_LABEL}>Low</div><div style={{ ...METRIC_VALUE, fontSize: 13 }}>${fmt(latest.low)}</div></div>
          )}
          {latest?.volume != null && (
            <div><div style={METRIC_LABEL}>Volume</div><div style={{ ...METRIC_VALUE, fontSize: 13 }}>{fmtCompact(latest.volume)}</div></div>
          )}
          {data.count != null && (
            <div><div style={METRIC_LABEL}>Bars</div><div style={{ ...METRIC_VALUE, fontSize: 13 }}>{data.count}</div></div>
          )}
        </div>
        {closes.length >= 3 && <MiniSparkline data={closes} positive={isPos} />}
      </div>
    </BlockCollapse>
  );
}

// ─── Prediction Markets Block ───

interface PredictionMarket {
  title?: string;
  outcomes?: Array<{ name?: string; price?: number | null }>;
  yesPrice?: number | null;
  noPrice?: number | null;
  volume?: number;
  liquidity?: number;
  openInterest?: number;
  endDate?: string;
  closeTime?: string;
  ticker?: string;
  url?: string | null;
  source?: string;
}

interface PredictionMarketsData {
  query?: string;
  markets?: PredictionMarket[];
  totalCount?: number;
}

function ProbabilityBar({ label, value }: { label: string; value: number | null | undefined }) {
  if (value == null) return null;
  const pct = Math.max(0, Math.min(100, value * 100));
  const isHigh = pct >= 50;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
      <div style={{ width: 60, fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-secondary)", flexShrink: 0 }}>
        {label}
      </div>
      <div style={{ flex: 1, height: 16, background: "rgba(236,227,213,0.06)", borderRadius: 4, overflow: "hidden", position: "relative" as const }}>
        <div style={{
          width: `${pct}%`,
          height: "100%",
          background: isHigh ? "rgba(34,171,148,0.35)" : "rgba(229,77,77,0.25)",
          borderRadius: 4,
          transition: "width 300ms ease",
        }} />
        <span style={{
          position: "absolute" as const,
          right: 6,
          top: "50%",
          transform: "translateY(-50%)",
          fontSize: 10,
          fontWeight: 700,
          fontFamily: "var(--font-mono)",
          color: isHigh ? "var(--buy)" : "var(--sell)",
        }}>
          {pct.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

function PredictionMarketsBlock({ data }: { data: PredictionMarketsData }) {
  const markets = data.markets || [];
  if (markets.length === 0) return null;

  return (
    <BlockCollapse label="Prediction Markets" count={markets.length}>
      <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
        {markets.map((m, i) => (
          <div key={i} style={{
            padding: "10px 12px",
            background: "rgba(236,227,213,0.03)",
            borderRadius: 8,
            border: "1px solid rgba(236,227,213,0.06)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.3, flex: 1, paddingRight: 8 }}>
                {m.url ? (
                  <a href={m.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--text-primary)", textDecoration: "none" }}>
                    {m.title}
                  </a>
                ) : m.title}
              </div>
              <span style={{
                ...BADGE,
                background: m.source === "polymarket" ? "rgba(116,92,245,0.15)" : "rgba(59,130,246,0.15)",
                color: m.source === "polymarket" ? "#7c5cf5" : "#3b82f6",
                flexShrink: 0,
              }}>
                {m.source === "polymarket" ? "Poly" : "Kalshi"}
              </span>
            </div>

            {/* Polymarket-style outcomes */}
            {m.outcomes && m.outcomes.length > 0 && (
              <div>
                {m.outcomes.map((o, j) => (
                  <ProbabilityBar key={j} label={o.name || `#${j + 1}`} value={o.price} />
                ))}
              </div>
            )}

            {/* Kalshi-style yes/no */}
            {!m.outcomes?.length && m.yesPrice != null && (
              <div>
                <ProbabilityBar label="Yes" value={m.yesPrice} />
                <ProbabilityBar label="No" value={m.noPrice} />
              </div>
            )}

            {/* Volume row */}
            <div style={{ display: "flex", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
              {m.volume != null && m.volume > 0 && (
                <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                  Vol: ${fmtCompact(m.volume)}
                </div>
              )}
              {m.liquidity != null && m.liquidity > 0 && (
                <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                  Liq: ${fmtCompact(m.liquidity)}
                </div>
              )}
              {m.openInterest != null && m.openInterest > 0 && (
                <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                  OI: {fmtCompact(m.openInterest)}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </BlockCollapse>
  );
}

// ─── Labor Data Block (BLS) ───

interface LaborDataPayload {
  seriesId?: string;
  info?: {
    id?: string;
    title?: string;
    frequency?: string;
    units?: string;
  };
  latest?: { date?: string; value?: number | null };
  observations?: Array<{ date?: string; value?: number | null }>;
  count?: number;
  error?: string;
}

function LaborDataBlock({ data }: { data: LaborDataPayload }) {
  const obs = data.observations || [];
  const values = obs.map((o) => o.value).filter((v): v is number => v != null);
  const latest = data.latest;
  const prev = obs.length >= 2 ? obs[obs.length - 2]?.value : null;
  const change = latest?.value != null && prev != null ? latest.value - prev : null;
  const changePct = change != null && prev != null && prev !== 0 ? (change / Math.abs(prev)) : null;
  const isPositive = change != null ? change >= 0 : true;

  return (
    <BlockCollapse label={data.info?.title || data.seriesId || "BLS Labor Data"}>
      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Main metric */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 16 }}>
          <div>
            <div style={METRIC_LABEL}>{data.info?.units || "Value"}</div>
            <div style={{ ...METRIC_VALUE, fontSize: 22 }}>
              {latest?.value != null ? fmt(latest.value, latest.value < 10 ? 2 : 1) : "-"}
            </div>
          </div>
          {change != null && (
            <div style={{ paddingBottom: 2 }}>
              <span style={{
                ...BADGE,
                background: isPositive ? "rgba(34,171,148,0.12)" : "rgba(229,77,77,0.12)",
                color: isPositive ? "var(--buy)" : "var(--sell)",
              }}>
                {isPositive ? "+" : ""}{fmt(change, 2)}
                {changePct != null && ` (${isPositive ? "+" : ""}${(changePct * 100).toFixed(1)}%)`}
              </span>
            </div>
          )}
        </div>

        {/* Sparkline */}
        {values.length >= 3 && <MiniSparkline data={values} positive={isPositive} />}

        {/* Info bar */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {data.info?.frequency && (
            <div>
              <div style={METRIC_LABEL}>Frequency</div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>{data.info.frequency}</div>
            </div>
          )}
          {latest?.date && (
            <div>
              <div style={METRIC_LABEL}>As of</div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>{latest.date}</div>
            </div>
          )}
          <div>
            <div style={METRIC_LABEL}>Source</div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>BLS</div>
          </div>
        </div>

        {/* Data table */}
        {obs.length > 2 && (
          <div style={{ maxHeight: 200, overflowY: "auto", scrollbarWidth: "thin", marginTop: 4 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ ...TABLE_HEADER, textAlign: "left" }}>Date</th>
                  <th style={{ ...TABLE_HEADER, textAlign: "right" }}>Value</th>
                  <th style={{ ...TABLE_HEADER, textAlign: "right" }}>Change</th>
                </tr>
              </thead>
              <tbody>
                {[...obs].reverse().slice(0, 20).map((o, i, arr) => {
                  const prevVal = i < arr.length - 1 ? arr[i + 1]?.value : null;
                  const chg = o.value != null && prevVal != null ? o.value - prevVal : null;
                  return (
                    <tr key={i}>
                      <td style={{ ...TABLE_CELL, color: "var(--text-secondary)" }}>{o.date}</td>
                      <td style={{ ...TABLE_CELL, textAlign: "right", color: "var(--text-primary)", fontWeight: 600 }}>
                        {o.value != null ? fmt(o.value, o.value < 10 ? 2 : 1) : "-"}
                      </td>
                      <td style={{
                        ...TABLE_CELL, textAlign: "right",
                        color: chg == null ? "var(--text-muted)" : chg >= 0 ? "var(--buy)" : "var(--sell)",
                      }}>
                        {chg != null ? `${chg >= 0 ? "+" : ""}${fmt(chg, 2)}` : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </BlockCollapse>
  );
}

// ─── Tool Data Renderer (Dispatcher) ───

interface ToolDataEntry {
  tool: string;
  input: Record<string, unknown>;
  data: Record<string, unknown>;
}

export function ToolDataRenderer({ toolData }: { toolData: ToolDataEntry[] }) {
  if (!toolData || toolData.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
      {toolData.map((entry, i) => {
        // Skip entries with errors
        if (entry.data?.error) return null;

        switch (entry.tool) {
          case "fetch_options_chain":
            return <OptionsChainBlock key={i} data={entry.data as unknown as OptionsChainData} />;

          case "fetch_economic_data": {
            // Yield curve has a different shape
            if (entry.data?.yields) {
              return <YieldCurveBlock key={i} data={entry.data as unknown as YieldCurveData} />;
            }
            return <EconomicDataBlock key={i} data={entry.data as unknown as EconomicDataPayload} />;
          }

          case "fetch_earnings_calendar":
            return <EarningsCalendarBlock key={i} data={entry.data as unknown as EarningsData} />;

          case "fetch_insider_activity":
            return <InsiderActivityBlock key={i} data={entry.data as unknown as InsiderActivityData} />;

          case "fetch_company_news_feed":
            return <CompanyNewsBlock key={i} data={entry.data as unknown as CompanyNewsData} />;

          case "get_stock_info":
            return <StockInfoBlock key={i} data={entry.data as unknown as StockInfoData} />;

          case "fetch_market_data":
            return <MarketDataBlock key={i} data={entry.data as unknown as MarketDataPayload} />;

          case "query_prediction_markets":
            return <PredictionMarketsBlock key={i} data={entry.data as unknown as PredictionMarketsData} />;

          case "fetch_labor_data":
            return <LaborDataBlock key={i} data={entry.data as unknown as LaborDataPayload} />;

          default:
            return null;
        }
      })}
    </div>
  );
}
