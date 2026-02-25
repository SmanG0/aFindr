import type { AccountState, ClosedTrade, Position } from "@/lib/types";
import type { Holding } from "@/hooks/useHoldings";

// ─── Fixed reference date for deterministic timestamps ───
const NOW = Date.now();
const DAY = 86_400_000;

// ─── DEMO HOLDINGS (7 — moved from PortfolioDashboard) ───
export const DEMO_HOLDINGS: Holding[] = [
  { _id: "demo-1", symbol: "AAPL",    shares: 15,   avgCostBasis: 178.50, addedAt: NOW - 120 * DAY, purchaseDate: NOW - 120 * DAY },
  { _id: "demo-2", symbol: "NVDA",    shares: 8,    avgCostBasis: 620.00, addedAt: NOW - 90  * DAY, purchaseDate: NOW - 90  * DAY },
  { _id: "demo-3", symbol: "MSFT",    shares: 12,   avgCostBasis: 355.00, addedAt: NOW - 200 * DAY, purchaseDate: NOW - 200 * DAY },
  { _id: "demo-4", symbol: "GOOGL",   shares: 10,   avgCostBasis: 140.00, addedAt: NOW - 60  * DAY, purchaseDate: NOW - 60  * DAY },
  { _id: "demo-5", symbol: "TSLA",    shares: 5,    avgCostBasis: 245.00, addedAt: NOW - 45  * DAY, purchaseDate: NOW - 45  * DAY },
  { _id: "demo-6", symbol: "BTC-USD", shares: 0.35, avgCostBasis: 42000,  addedAt: NOW - 150 * DAY, purchaseDate: NOW - 150 * DAY },
  { _id: "demo-7", symbol: "ETH-USD", shares: 4,    avgCostBasis: 2200,   addedAt: NOW - 100 * DAY, purchaseDate: NOW - 100 * DAY },
];

// ─── DEMO TRADE HISTORY (18 closed trades, Dec 2025–Feb 2026) ───
// 12 wins / 6 losses → 66.7% win rate, net P&L +$601.92, profit factor 2.15
function t(
  id: number, symbol: string, side: "long" | "short", size: number,
  entryPrice: number, exitPrice: number, daysAgoEntry: number, daysAgoExit: number,
): ClosedTrade {
  const pnlRaw = side === "long"
    ? (exitPrice - entryPrice) * size
    : (entryPrice - exitPrice) * size;
  const commission = 1.00;
  return {
    id: `demo-trade-${id}`,
    symbol, side, size,
    entryPrice, exitPrice,
    entryTime: NOW - daysAgoEntry * DAY,
    exitTime:  NOW - daysAgoExit * DAY,
    stopLoss: null, takeProfit: null,
    pnl: Math.round((pnlRaw - commission) * 100) / 100,
    pnlPoints: Math.round((exitPrice - entryPrice) * 100) / 100,
    commission,
  };
}

export const DEMO_TRADE_HISTORY: ClosedTrade[] = [
  // ── December 2025 (6 trades: 4W / 2L) ──
  t(1,  "AAPL",  "long",  10, 175.20, 181.80, 87, 85), // +$65.00
  t(2,  "NVDA",  "long",  3,  615.00, 642.50, 82, 79),  // +$81.50
  t(3,  "MSFT",  "short", 8,  362.00, 368.50, 77, 75),  // -$53.00
  t(4,  "GOOGL", "long",  15, 138.50, 143.20, 72, 70),  // +$69.50
  t(5,  "TSLA",  "long",  5,  252.00, 228.80, 68, 65),  // -$117.00
  t(6,  "AAPL",  "long",  12, 179.00, 185.50, 62, 60),  // +$77.00

  // ── January 2026 (7 trades: 5W / 2L) ──
  t(7,  "NVDA",  "long",  4,  638.00, 655.20, 55, 52),  // +$67.80
  t(8,  "MSFT",  "long",  10, 358.00, 365.40, 50, 48),  // +$73.00
  t(9,  "GOOGL", "short", 12, 145.00, 148.60, 45, 43),  // -$44.20
  t(10, "AAPL",  "long",  8,  182.00, 198.00, 40, 37),   // +$127.00 (best trade)
  t(11, "TSLA",  "short", 6,  240.00, 233.50, 35, 33),  // +$38.00
  t(12, "NVDA",  "long",  5,  648.00, 637.20, 30, 28),  // -$55.00
  t(13, "MSFT",  "long",  7,  361.00, 370.80, 25, 23),  // +$67.60

  // ── February 2026 (5 trades: 3W / 2L) ──
  t(14, "AAPL",  "long",  10, 190.00, 195.90, 18, 15),  // +$58.00
  t(15, "GOOGL", "long",  20, 142.00, 146.80, 14, 12),  // +$95.00
  t(16, "TSLA",  "long",  4,  235.00, 221.00, 10, 8),   // -$57.00
  t(17, "NVDA",  "long",  3,  652.00, 668.50, 7,  5),   // +$48.50
  t(18, "MSFT",  "short", 6,  368.00, 359.20, 4,  2),   // +$51.80
];

// ─── DEMO OPEN POSITIONS (2) ───
export const DEMO_POSITIONS: Position[] = [
  {
    id: "demo-pos-1",
    symbol: "AAPL",
    side: "long",
    size: 10,
    entryPrice: 192.50,
    entryTime: NOW - 3 * DAY,
    stopLoss: 188.00,
    takeProfit: 202.00,
    commission: 1.00,
    unrealizedPnl: 45.00,
  },
  {
    id: "demo-pos-2",
    symbol: "NVDA",
    side: "long",
    size: 2,
    entryPrice: 660.00,
    entryTime: NOW - 1 * DAY,
    stopLoss: 645.00,
    takeProfit: 690.00,
    commission: 1.00,
    unrealizedPnl: 22.00,
  },
];

// ─── getDemoAccountState() ───
export function getDemoAccountState(): AccountState {
  const netPnl = DEMO_TRADE_HISTORY.reduce((s, t) => s + t.pnl, 0);
  const unrealized = DEMO_POSITIONS.reduce((s, p) => s + p.unrealizedPnl, 0);
  const balance = 25000 + netPnl;
  return {
    balance: Math.round(balance * 100) / 100,
    equity: Math.round((balance + unrealized) * 100) / 100,
    unrealizedPnl: unrealized,
    positions: DEMO_POSITIONS,
    orders: [],
    tradeHistory: DEMO_TRADE_HISTORY,
    isActive: true,
  };
}
