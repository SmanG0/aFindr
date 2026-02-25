"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";

interface ChartPoint {
  time: number;
  value: number;
}

interface PerformanceChartProps {
  portfolioPoints: ChartPoint[];
  benchmarkPoints: ChartPoint[];
  height?: number;
  accentColor?: string;
}

export default function PerformanceChart({
  portfolioPoints,
  benchmarkPoints,
  height = 200,
  accentColor = "var(--buy)",
}: PerformanceChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<{
    x: number;
    portfolioPct: number;
    benchmarkPct: number | null;
    date: string;
  } | null>(null);

  // Normalize both series to % change from start
  const { portNorm, benchNorm, minPct, maxPct } = useMemo(() => {
    const pNorm = portfolioPoints.length >= 2
      ? portfolioPoints.map((p) => ({
          time: p.time,
          pct: ((p.value - portfolioPoints[0].value) / portfolioPoints[0].value) * 100,
        }))
      : [];

    const bNorm = benchmarkPoints.length >= 2
      ? benchmarkPoints.map((p) => ({
          time: p.time,
          pct: ((p.value - benchmarkPoints[0].value) / benchmarkPoints[0].value) * 100,
        }))
      : [];

    const allPcts = [...pNorm.map((p) => p.pct), ...bNorm.map((p) => p.pct)];
    const min = allPcts.length > 0 ? Math.min(...allPcts) : 0;
    const max = allPcts.length > 0 ? Math.max(...allPcts) : 0;

    return { portNorm: pNorm, benchNorm: bNorm, minPct: min, maxPct: max };
  }, [portfolioPoints, benchmarkPoints]);

  const W = 600; // viewBox width
  const H = height;
  const padTop = 16;
  const padBot = 24;
  const chartH = H - padTop - padBot;
  const range = maxPct - minPct || 1;

  const toY = useCallback((pct: number) => {
    return padTop + (1 - (pct - minPct) / range) * chartH;
  }, [minPct, range, chartH]);

  const portLine = useMemo(() => {
    if (portNorm.length < 2) return "";
    return portNorm
      .map((p, i) => `${(i / (portNorm.length - 1)) * W},${toY(p.pct)}`)
      .join(" ");
  }, [portNorm, toY, W]);

  const portFill = useMemo(() => {
    if (portNorm.length < 2) return "";
    return `0,${toY(0)} ${portLine} ${W},${toY(0)}`;
  }, [portNorm, portLine, toY, W]);

  const benchLine = useMemo(() => {
    if (benchNorm.length < 2) return "";
    return benchNorm
      .map((p, i) => `${(i / (benchNorm.length - 1)) * W},${toY(p.pct)}`)
      .join(" ");
  }, [benchNorm, toY, W]);

  const isPositive = portNorm.length >= 2 && portNorm[portNorm.length - 1].pct >= 0;
  const lineColor = isPositive ? accentColor : "var(--sell)";
  const fillColor = isPositive ? "rgba(34,171,148,0.08)" : "rgba(229,77,77,0.08)";
  const benchColor = "rgba(236,227,213,0.25)";

  // ─── Line-draw animation ───
  const [chartMounted, setChartMounted] = useState(false);
  const dataKey = useMemo(() => portNorm.length + ":" + (portNorm[0]?.pct ?? 0).toFixed(2), [portNorm]);
  useEffect(() => {
    setChartMounted(false);
    const raf = requestAnimationFrame(() => setChartMounted(true));
    return () => cancelAnimationFrame(raf);
  }, [dataKey]);

  // Approximate path length for stroke-dasharray animation
  const approxLineLen = useMemo(() => {
    if (portNorm.length < 2) return 0;
    let len = 0;
    for (let i = 1; i < portNorm.length; i++) {
      const dx = W / (portNorm.length - 1);
      const dy = toY(portNorm[i].pct) - toY(portNorm[i - 1].pct);
      len += Math.sqrt(dx * dx + dy * dy);
    }
    return len;
  }, [portNorm, toY, W]);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg || portNorm.length < 2) return;

    const rect = svg.getBoundingClientRect();
    const xFrac = (e.clientX - rect.left) / rect.width;
    const idx = Math.round(xFrac * (portNorm.length - 1));
    const clampedIdx = Math.max(0, Math.min(idx, portNorm.length - 1));

    const portPct = portNorm[clampedIdx].pct;
    const portTime = portNorm[clampedIdx].time;

    // Find nearest benchmark point
    let benchPct: number | null = null;
    if (benchNorm.length >= 2) {
      const bIdx = Math.round(xFrac * (benchNorm.length - 1));
      const clampedBIdx = Math.max(0, Math.min(bIdx, benchNorm.length - 1));
      benchPct = benchNorm[clampedBIdx].pct;
    }

    const date = new Date(portTime).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    setHover({ x: xFrac * W, portfolioPct: portPct, benchmarkPct: benchPct, date });
  }, [portNorm, benchNorm, W]);

  if (portNorm.length < 2) {
    return (
      <div
        style={{
          height, display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--text-muted)", fontSize: 12, fontFamily: "var(--font-mono)",
        }}
      >
        Not enough data to display chart
      </div>
    );
  }

  // End-of-line badges
  const portEndPct = portNorm[portNorm.length - 1].pct;
  const benchEndPct = benchNorm.length >= 2 ? benchNorm[benchNorm.length - 1].pct : null;

  return (
    <div style={{ position: "relative" }}>
      <svg
        ref={svgRef}
        width="100%" height={height}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ display: "block", cursor: "crosshair" }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHover(null)}
      >
        {/* Zero line */}
        <line x1={0} y1={toY(0)} x2={W} y2={toY(0)} stroke="rgba(236,227,213,0.08)" strokeWidth="1" vectorEffect="non-scaling-stroke" />

        {/* Benchmark area (dashed) */}
        {benchLine && (
          <polyline
            points={benchLine} fill="none"
            stroke={benchColor} strokeWidth="1.5"
            strokeDasharray="6 4"
            vectorEffect="non-scaling-stroke"
          />
        )}

        {/* Portfolio fill */}
        {portFill && (
          <polygon
            points={portFill}
            fill={fillColor}
            style={{
              opacity: chartMounted ? 1 : 0,
              transition: "opacity 600ms ease 300ms",
            }}
          />
        )}

        {/* Portfolio line — draw animation */}
        <polyline
          points={portLine} fill="none"
          stroke={lineColor} strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          strokeDasharray={approxLineLen || 2000}
          strokeDashoffset={chartMounted ? 0 : approxLineLen || 2000}
          style={{
            transition: `stroke-dashoffset 800ms cubic-bezier(0.4,0,0.2,1)`,
          }}
        />

        {/* Hover crosshair */}
        {hover && (
          <line x1={hover.x} y1={padTop} x2={hover.x} y2={H - padBot}
            stroke="rgba(236,227,213,0.2)" strokeWidth="1" vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>

      {/* End-of-line badges */}
      <div style={{
        position: "absolute", right: 0, top: toY(portEndPct) - 10, transform: "translateX(4px)",
        opacity: chartMounted ? 1 : 0, transition: "opacity 400ms ease 700ms",
      }}>
        <span style={{
          display: "inline-block", padding: "2px 8px", borderRadius: 10,
          background: lineColor, color: "#fff",
          fontSize: 10, fontWeight: 700, fontFamily: "var(--font-mono)",
        }}>
          {portEndPct >= 0 ? "+" : ""}{portEndPct.toFixed(1)}%
        </span>
      </div>
      {benchEndPct !== null && (
        <div style={{
          position: "absolute", right: 0, top: toY(benchEndPct) - 10, transform: "translateX(4px)",
          opacity: chartMounted ? 1 : 0, transition: "opacity 400ms ease 800ms",
        }}>
          <span style={{
            display: "inline-block", padding: "2px 8px", borderRadius: 10,
            background: "rgba(236,227,213,0.12)", color: "var(--text-muted)",
            fontSize: 10, fontWeight: 700, fontFamily: "var(--font-mono)",
          }}>
            {benchEndPct >= 0 ? "+" : ""}{benchEndPct.toFixed(1)}%
          </span>
        </div>
      )}

      {/* Hover tooltip */}
      {hover && (
        <div
          style={{
            position: "absolute",
            left: Math.min(hover.x * (100 / W), 80) + "%",
            top: 4,
            background: "rgba(24,22,18,0.95)", border: "1px solid var(--glass-border)",
            borderRadius: 8, padding: "8px 12px",
            backdropFilter: "blur(12px)", boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
            pointerEvents: "none", zIndex: 10,
            whiteSpace: "nowrap",
          }}
        >
          <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 4 }}>
            {hover.date}
          </div>
          <div className="flex items-center" style={{ gap: 8, fontSize: 11, fontFamily: "var(--font-mono)" }}>
            <span style={{ width: 8, height: 3, borderRadius: 2, background: lineColor, display: "inline-block" }} />
            <span style={{ color: "var(--text-secondary)" }}>Portfolio</span>
            <span style={{ fontWeight: 700, color: hover.portfolioPct >= 0 ? "var(--buy)" : "var(--sell)" }}>
              {hover.portfolioPct >= 0 ? "+" : ""}{hover.portfolioPct.toFixed(2)}%
            </span>
          </div>
          {hover.benchmarkPct !== null && (
            <div className="flex items-center" style={{ gap: 8, fontSize: 11, fontFamily: "var(--font-mono)", marginTop: 2 }}>
              <span style={{ width: 8, height: 3, borderRadius: 2, background: benchColor, display: "inline-block", borderTop: "1px dashed var(--text-muted)" }} />
              <span style={{ color: "var(--text-secondary)" }}>S&P 500</span>
              <span style={{ fontWeight: 700, color: hover.benchmarkPct >= 0 ? "var(--buy)" : "var(--sell)" }}>
                {hover.benchmarkPct >= 0 ? "+" : ""}{hover.benchmarkPct.toFixed(2)}%
              </span>
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center" style={{ gap: 16, marginTop: 6 }}>
        <div className="flex items-center" style={{ gap: 6, fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
          <span style={{ width: 12, height: 2, borderRadius: 1, background: lineColor, display: "inline-block" }} />
          Portfolio
        </div>
        {benchNorm.length >= 2 && (
          <div className="flex items-center" style={{ gap: 6, fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            <span style={{ width: 12, height: 2, borderRadius: 1, background: benchColor, display: "inline-block", borderTop: "1px dashed rgba(236,227,213,0.4)" }} />
            S&P 500
          </div>
        )}
      </div>
    </div>
  );
}
