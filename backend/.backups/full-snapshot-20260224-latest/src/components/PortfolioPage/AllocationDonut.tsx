"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { formatCurrency } from "@/lib/portfolio-utils";

export interface AllocationSegment {
  ticker: string;
  value: number;
  color: string;
}

interface AllocationDonutProps {
  allocations: AllocationSegment[];
  totalValue: number;
  size?: number;
}

export default function AllocationDonut({ allocations, totalValue, size = 200 }: AllocationDonutProps) {
  const r = size * 0.3;
  const strokeWidth = size * 0.14;
  const C = 2 * Math.PI * r;
  const gap = 3;
  const cx = size / 2;
  const cy = size / 2;

  // ─── Animate on mount / data change ───
  const [animProgress, setAnimProgress] = useState(0);
  const prevDataRef = useRef("");

  const dataKey = useMemo(
    () => allocations.map((a) => `${a.ticker}:${a.value.toFixed(0)}`).join(","),
    [allocations],
  );

  useEffect(() => {
    // Reset animation when data changes
    if (dataKey !== prevDataRef.current) {
      prevDataRef.current = dataKey;
      setAnimProgress(0);
      // Trigger animation after a frame
      const raf = requestAnimationFrame(() => setAnimProgress(1));
      return () => cancelAnimationFrame(raf);
    }
  }, [dataKey]);

  // Group small segments (<5%) into "Other", max 8 labeled
  const segments = useMemo(() => {
    const sorted = [...allocations].sort((a, b) => b.value - a.value);
    if (totalValue <= 0) return [];

    const labeled: AllocationSegment[] = [];
    let otherValue = 0;

    for (const seg of sorted) {
      const pct = (seg.value / totalValue) * 100;
      if (pct >= 5 && labeled.length < 8) {
        labeled.push(seg);
      } else {
        otherValue += seg.value;
      }
    }

    if (otherValue > 0) {
      labeled.push({ ticker: "Other", value: otherValue, color: "rgba(236,227,213,0.2)" });
    }

    return labeled;
  }, [allocations, totalValue]);

  // Calculate arc positions — correct gap accounting
  const arcs = useMemo(() => {
    if (segments.length === 0 || totalValue <= 0) return [];

    const totalGap = gap * segments.length;
    const usableC = Math.max(0, C - totalGap);

    let offset = 0;
    return segments.map((seg, i) => {
      const pct = seg.value / totalValue;
      const len = pct * usableC;
      const dashOffset = offset;
      // Midpoint angle: offset is cumulative (len + gap per segment)
      // Account for gaps: each segment i has i gaps before it
      const midAlongCircle = dashOffset + len / 2;
      const midAngle = (midAlongCircle / C) * 360 - 90; // -90 so 0 = top
      offset += len + gap;
      return { ...seg, len, dashOffset, midAngle, pct, index: i };
    });
  }, [segments, totalValue, C]);

  if (segments.length === 0) {
    return (
      <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "var(--text-muted)", fontSize: 12, fontFamily: "var(--font-mono)" }}>No holdings</span>
      </div>
    );
  }

  const pad = 60;
  const outerW = size + pad * 2;
  const outerH = size + pad * 2;
  const centerX = pad + cx;
  const centerY = pad + cy;

  return (
    <div style={{ position: "relative", width: outerW, height: outerH }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ position: "absolute", left: pad, top: pad }}
      >
        {/* Background track */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(236,227,213,0.06)" strokeWidth={strokeWidth} />

        {/* Segments — clockwise draw animation */}
        {arcs.map((arc) => {
          const animLen = arc.len * animProgress;
          return (
            <circle
              key={arc.ticker}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={arc.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${animLen} ${C - animLen}`}
              strokeDashoffset={-arc.dashOffset}
              strokeLinecap="round"
              style={{
                transition: "stroke-dasharray 800ms cubic-bezier(0.4, 0, 0.2, 1)",
                transitionDelay: `${arc.index * 60}ms`,
              }}
            />
          );
        })}

        {/* Center text — fade in */}
        <text
          x={cx}
          y={cy - size * 0.01}
          textAnchor="middle"
          fill="var(--text-primary)"
          style={{
            fontSize: size * 0.055,
            fontWeight: 700,
            fontFamily: "var(--font-mono)",
            opacity: animProgress,
            transition: "opacity 500ms ease 400ms",
          }}
        >
          {formatCurrency(totalValue)}
        </text>
        <text
          x={cx}
          y={cy + size * 0.05}
          textAnchor="middle"
          fill="var(--text-muted)"
          style={{
            fontSize: size * 0.032,
            fontFamily: "var(--font-mono)",
            opacity: animProgress,
            transition: "opacity 500ms ease 500ms",
          }}
        >
          Total Value
        </text>
      </svg>

      {/* External labels — fade in staggered */}
      {arcs.map((arc) => {
        if (arc.pct < 0.04 && arc.ticker !== "Other") return null;
        const labelR = r + strokeWidth / 2 + 24;
        const rad = (arc.midAngle * Math.PI) / 180;
        const lx = centerX + labelR * Math.cos(rad);
        const ly = centerY + labelR * Math.sin(rad);
        const isRight = lx >= centerX;

        return (
          <div
            key={arc.ticker}
            style={{
              position: "absolute",
              left: lx,
              top: ly,
              transform: `translate(${isRight ? "0" : "-100%"}, -50%)`,
              fontSize: 10,
              fontWeight: 700,
              fontFamily: "var(--font-mono)",
              color: "var(--text-secondary)",
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              gap: 4,
              opacity: animProgress,
              transition: `opacity 400ms ease ${300 + arc.index * 80}ms`,
            }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: arc.color,
                flexShrink: 0,
              }}
            />
            {arc.ticker} {(arc.pct * 100).toFixed(0)}%
          </div>
        );
      })}
    </div>
  );
}
