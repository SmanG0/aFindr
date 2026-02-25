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

// ─── Setup & Emotion Tags ───

export const SETUP_TAG_OPTIONS = [
  "AMD", "Turtle Soup", "Judas Swing", "Silver Bullet", "ICT OTE",
  "Breaker", "FVG", "Order Block", "Trend Follow", "Mean Reversion",
  "Scalp", "Swing",
] as const;

export const EMOTION_TAG_OPTIONS = [
  "Confident", "Fearful", "Greedy", "Patient", "Impulsive", "Disciplined",
  "Frustrated", "Calm", "FOMO", "Revenge", "Focused", "Distracted",
] as const;

export const EMOTION_TAG_COLORS: Record<string, { color: string; bg: string }> = {
  Confident:   { color: "var(--buy)",  bg: "var(--buy-muted)" },
  Patient:     { color: "var(--buy)",  bg: "var(--buy-muted)" },
  Disciplined: { color: "var(--buy)",  bg: "var(--buy-muted)" },
  Calm:        { color: "var(--buy)",  bg: "var(--buy-muted)" },
  Focused:     { color: "var(--buy)",  bg: "var(--buy-muted)" },
  Fearful:     { color: "var(--sell)", bg: "var(--sell-muted)" },
  Greedy:      { color: "var(--sell)", bg: "var(--sell-muted)" },
  Impulsive:   { color: "var(--sell)", bg: "var(--sell-muted)" },
  Frustrated:  { color: "var(--sell)", bg: "var(--sell-muted)" },
  FOMO:        { color: "var(--sell)", bg: "var(--sell-muted)" },
  Revenge:     { color: "var(--sell)", bg: "var(--sell-muted)" },
  Distracted:  { color: "var(--sell)", bg: "var(--sell-muted)" },
};

// ─── Stats Computation ───

export interface JournalStats {
  total: number;
  wins: number;
  losses: number;
  winRate: number;
  avgRR: number;
  totalPnl: number;
}

export function computeJournalStats(entries: { outcome?: string; risk?: number | null; returnVal?: number | null }[]): JournalStats {
  const wins = entries.filter((e) => e.outcome === "win").length;
  const losses = entries.filter((e) => e.outcome === "loss").length;
  const decided = wins + losses;
  const winRate = decided > 0 ? (wins / decided) * 100 : 0;

  const rrValues = entries
    .filter((e) => e.risk && e.risk > 0 && e.returnVal != null)
    .map((e) => (e.returnVal ?? 0) / (e.risk ?? 1));
  const avgRR = rrValues.length > 0 ? rrValues.reduce((a, b) => a + b, 0) / rrValues.length : 0;

  const totalPnl = entries.reduce((sum, e) => sum + (e.returnVal ?? 0) - (e.risk ?? 0), 0);

  return { total: entries.length, wins, losses, winRate, avgRR, totalPnl };
}
