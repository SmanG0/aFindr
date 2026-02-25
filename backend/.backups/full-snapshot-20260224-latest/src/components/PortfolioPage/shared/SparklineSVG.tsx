"use client";

interface SparklineSVGProps {
  data: number[];
  width?: number;
  height?: number;
  positive?: boolean; // true = buy color, false = sell color
}

export default function SparklineSVG({
  data,
  width = 60,
  height = 24,
  positive = true,
}: SparklineSVGProps) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 2;

  const points = data
    .map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = padding + ((max - val) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  const color = positive ? "var(--buy)" : "var(--sell)";

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
