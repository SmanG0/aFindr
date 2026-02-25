// Shared constants and helpers for Journal components (JournalPage + JournalPanel)

export const MARKET_COLORS: Record<string, string> = {
  SOL: "#9945FF",
  MNQ: "#3a3a4a",
  MGC: "#22ab94",
  NQ: "#22ab94",
  ES: "#5a9bd4",
  BTC: "#F7931A",
  ETH: "#627EEA",
  SPY: "#5a9bd4",
  AAPL: "#999",
  TSLA: "#e54d4d",
  GC: "#c47b3a",
  CL: "#8a6a3a",
};

export const OUTCOME_CONFIG = {
  win: { color: "var(--buy)", bg: "var(--buy-muted)", label: "Win" },
  loss: { color: "var(--sell)", bg: "var(--sell-muted)", label: "Loss" },
  breakeven: { color: "var(--text-muted)", bg: "rgba(236,227,213,0.06)", label: "Breakeven" },
} as const;

export const MMXM_OPTIONS = [
  "AMD",
  "Turtle Soup",
  "Judas Swing",
  "MMSM",
  "MMXM",
  "Silver Bullet",
  "ICT OTE",
  "Breaker",
  "FVG",
  "Order Block",
];

export function getMarketColor(market: string): string {
  return MARKET_COLORS[market.toUpperCase()] || "#666";
}

export function calcRR(risk: number | null | undefined, ret: number | null | undefined): string {
  if (!risk || !ret || risk === 0) return "0";
  return (ret / risk).toFixed(2);
}

export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatFullDate(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }) +
    " at " +
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
  );
}
