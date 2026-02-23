export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatLargeNumber(value: number | null | undefined): string {
  if (value == null) return "-";
  if (value >= 1e12) return (value / 1e12).toFixed(2) + "T";
  if (value >= 1e9) return (value / 1e9).toFixed(2) + "B";
  if (value >= 1e6) return (value / 1e6).toFixed(2) + "M";
  if (value >= 1e3) return (value / 1e3).toFixed(2) + "K";
  return value.toString();
}

export function formatPercent(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return sign + value.toFixed(2) + "%";
}

export function formatPnl(value: number): string {
  const prefix = value >= 0 ? "+$" : "-$";
  return `${prefix}${Math.abs(value).toFixed(2)}`;
}

export function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const ts = timestamp > 1e12 ? timestamp : timestamp * 1000;
  const diff = now - ts;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return minutes + "m";
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + "h";
  const days = Math.floor(hours / 24);
  return days + "d";
}
