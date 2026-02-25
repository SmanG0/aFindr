"use client";

import { useState, useMemo, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { AccountState } from "@/lib/types";
import StockDetailView from "@/components/PortfolioPage/StockDetailView";

interface DashboardPageProps {
  accountState: AccountState;
  onNavigateToChart?: (ticker: string) => void;
}

function formatPnl(value: number): string {
  const prefix = value >= 0 ? "+$" : "-$";
  return `${prefix}${Math.abs(value).toFixed(2)}`;
}

export default function DashboardPage({ accountState, onNavigateToChart }: DashboardPageProps) {
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  const handleSelectTicker = useCallback((ticker: string) => {
    setSelectedTicker(ticker);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedTicker(null);
  }, []);

  const stats = useMemo(() => {
    const history = accountState.tradeHistory;
    const totalTrades = history.length;
    const wins = history.filter((t) => t.pnl > 0);
    const losses = history.filter((t) => t.pnl < 0);
    const winRate = totalTrades > 0 ? (wins.length / totalTrades) * 100 : 0;
    const totalPnl = history.reduce((sum, t) => sum + t.pnl, 0);
    const totalCommission = history.reduce((sum, t) => sum + t.commission, 0);
    const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((s, t) => s + t.pnl, 0) / losses.length : 0;
    const profitFactor = avgLoss !== 0 ? Math.abs(avgWin * wins.length) / Math.abs(avgLoss * losses.length) : 0;
    const maxWin = wins.length > 0 ? Math.max(...wins.map((t) => t.pnl)) : 0;
    const maxLoss = losses.length > 0 ? Math.min(...losses.map((t) => t.pnl)) : 0;

    // Max drawdown
    let peak = 25000;
    let maxDrawdown = 0;
    let running = 25000;
    for (const t of history) {
      running += t.pnl;
      if (running > peak) peak = running;
      const dd = peak - running;
      if (dd > maxDrawdown) maxDrawdown = dd;
    }

    // Consecutive
    let maxConsecWins = 0, maxConsecLosses = 0, curWins = 0, curLosses = 0;
    for (const t of history) {
      if (t.pnl > 0) { curWins++; curLosses = 0; maxConsecWins = Math.max(maxConsecWins, curWins); }
      else if (t.pnl < 0) { curLosses++; curWins = 0; maxConsecLosses = Math.max(maxConsecLosses, curLosses); }
    }

    // Equity curve
    let bal = 25000;
    const equityPoints = history.map((t) => {
      bal += t.pnl;
      return { time: t.exitTime, value: bal };
    });

    // By-symbol
    const symbolBreakdown: Record<string, { trades: number; pnl: number; wins: number }> = {};
    for (const t of history) {
      if (!symbolBreakdown[t.symbol]) symbolBreakdown[t.symbol] = { trades: 0, pnl: 0, wins: 0 };
      symbolBreakdown[t.symbol].trades++;
      symbolBreakdown[t.symbol].pnl += t.pnl;
      if (t.pnl > 0) symbolBreakdown[t.symbol].wins++;
    }

    // Daily P&L for calendar
    const dailyPnl: Record<string, number> = {};
    for (const t of history) {
      const day = new Date(t.exitTime > 1e12 ? t.exitTime : t.exitTime * 1000).toISOString().split("T")[0];
      dailyPnl[day] = (dailyPnl[day] || 0) + t.pnl;
    }

    return {
      totalTrades, wins: wins.length, losses: losses.length, winRate, totalPnl,
      totalCommission, avgWin, avgLoss, profitFactor, maxWin, maxLoss,
      maxDrawdown, maxConsecWins, maxConsecLosses, equityPoints, symbolBreakdown, dailyPnl,
    };
  }, [accountState.tradeHistory]);

  return (
    <div className="flex-1 flex overflow-hidden" style={{ background: "var(--bg)" }}>
      <AnimatePresence mode="wait">
        {selectedTicker !== null ? (
          <motion.div
            key={`detail-${selectedTicker}`}
            className="flex-1 overflow-hidden"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
          >
            <StockDetailView
              ticker={selectedTicker}
              onBack={handleBack}
              onSelectTicker={handleSelectTicker}
              onNavigateToChart={onNavigateToChart}
            />
          </motion.div>
        ) : (
          <motion.div
            key="dashboard-main"
            className="flex-1 overflow-auto p-6"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
          >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Dashboard</h1>
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Performance analytics and trade history</p>
        </div>

        {/* Top Summary Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 24 }}>
          <SummaryCard label="Balance" value={`$${accountState.balance.toFixed(2)}`} />
          <SummaryCard label="Equity" value={`$${accountState.equity.toFixed(2)}`} />
          <SummaryCard label="Net P&L" value={formatPnl(stats.totalPnl)} color={stats.totalPnl >= 0 ? "var(--buy)" : "var(--sell)"} />
          <SummaryCard label="Win Rate" value={stats.totalTrades > 0 ? `${stats.winRate.toFixed(1)}%` : "--"} color={stats.winRate >= 50 ? "var(--buy)" : "var(--sell)"} />
          <SummaryCard label="Total Trades" value={String(stats.totalTrades)} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 24 }}>
          {/* Equity Curve */}
          <div style={{ background: "var(--bg-raised)", borderRadius: 12, padding: 20, border: "1px solid rgba(236,227,213,0.06)" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 12, fontWeight: 600 }}>EQUITY CURVE</div>
            {stats.equityPoints.length > 1 ? (
              <div style={{ height: 200, position: "relative", overflow: "hidden" }}>
                <svg width="100%" height="100%" viewBox={`0 0 ${stats.equityPoints.length} 100`} preserveAspectRatio="none">
                  {(() => {
                    const min = Math.min(...stats.equityPoints.map((p) => p.value));
                    const max = Math.max(...stats.equityPoints.map((p) => p.value));
                    const range = max - min || 1;
                    const points = stats.equityPoints.map((p, i) => `${i},${100 - ((p.value - min) / range) * 100}`).join(" ");
                    const fillPoints = `0,100 ${points} ${stats.equityPoints.length - 1},100`;
                    return (
                      <>
                        <polygon points={fillPoints} fill="rgba(196,123,58,0.1)" />
                        <polyline points={points} fill="none" stroke="var(--accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                      </>
                    );
                  })()}
                </svg>
              </div>
            ) : (
              <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 12 }}>
                No trade data yet. Complete some trades to see your equity curve.
              </div>
            )}
          </div>

          {/* Performance Metrics */}
          <div style={{ background: "var(--bg-raised)", borderRadius: 12, padding: 20, border: "1px solid rgba(236,227,213,0.06)" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 12, fontWeight: 600 }}>PERFORMANCE</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <MetricRow label="Profit Factor" value={stats.profitFactor > 0 ? stats.profitFactor.toFixed(2) : "--"} />
              <MetricRow label="Avg Win" value={stats.avgWin > 0 ? formatPnl(stats.avgWin) : "--"} color="var(--buy)" />
              <MetricRow label="Avg Loss" value={stats.avgLoss < 0 ? formatPnl(stats.avgLoss) : "--"} color="var(--sell)" />
              <MetricRow label="Best Trade" value={stats.maxWin > 0 ? formatPnl(stats.maxWin) : "--"} color="var(--buy)" />
              <MetricRow label="Worst Trade" value={stats.maxLoss < 0 ? formatPnl(stats.maxLoss) : "--"} color="var(--sell)" />
              <MetricRow label="Max Drawdown" value={stats.maxDrawdown > 0 ? `-$${stats.maxDrawdown.toFixed(2)}` : "--"} color="var(--sell)" />
              <MetricRow label="Max Consec. Wins" value={String(stats.maxConsecWins)} />
              <MetricRow label="Max Consec. Losses" value={String(stats.maxConsecLosses)} />
              <MetricRow label="Commission" value={`$${stats.totalCommission.toFixed(2)}`} />
            </div>
          </div>
        </div>

        {/* Calendar Heatmap */}
        {Object.keys(stats.dailyPnl).length > 0 && (
          <div style={{ background: "var(--bg-raised)", borderRadius: 12, padding: 20, border: "1px solid rgba(236,227,213,0.06)", marginBottom: 24 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 12, fontWeight: 600 }}>DAILY P&L</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {Object.entries(stats.dailyPnl).sort(([a], [b]) => a.localeCompare(b)).map(([day, pnl]) => (
                <div
                  key={day}
                  title={`${day}: ${formatPnl(pnl)}`}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 4,
                    background: pnl >= 0 ? `rgba(34,171,148,${Math.min(0.8, Math.abs(pnl) / 500)})` : `rgba(229,77,77,${Math.min(0.8, Math.abs(pnl) / 500)})`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 8,
                    color: "var(--text-primary)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {new Date(day).getDate()}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Symbol Breakdown */}
        {Object.keys(stats.symbolBreakdown).length > 0 && (
          <div style={{ background: "var(--bg-raised)", borderRadius: 12, padding: 20, border: "1px solid rgba(236,227,213,0.06)", marginBottom: 24 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 12, fontWeight: 600 }}>BY SYMBOL</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(236,227,213,0.06)" }}>
                  <th style={{ textAlign: "left", fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", padding: "6px 8px", fontWeight: 500 }}>Symbol</th>
                  <th style={{ textAlign: "right", fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", padding: "6px 8px", fontWeight: 500 }}>Trades</th>
                  <th style={{ textAlign: "right", fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", padding: "6px 8px", fontWeight: 500 }}>Win Rate</th>
                  <th style={{ textAlign: "right", fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", padding: "6px 8px", fontWeight: 500 }}>P&L</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(stats.symbolBreakdown).map(([sym, data]) => (
                  <tr key={sym} style={{ borderBottom: "1px solid rgba(236,227,213,0.03)" }}>
                    <td style={{ fontSize: 12, fontFamily: "var(--font-mono)", padding: "8px", fontWeight: 600 }}>
                      <TickerLink symbol={sym} onClick={handleSelectTicker} />
                    </td>
                    <td style={{ textAlign: "right", fontSize: 12, color: "var(--text-secondary)", fontFamily: "var(--font-mono)", padding: "8px" }}>{data.trades}</td>
                    <td style={{ textAlign: "right", fontSize: 12, color: "var(--text-secondary)", fontFamily: "var(--font-mono)", padding: "8px" }}>
                      {((data.wins / data.trades) * 100).toFixed(0)}%
                    </td>
                    <td style={{ textAlign: "right", fontSize: 12, fontWeight: 600, fontFamily: "var(--font-mono)", padding: "8px", color: data.pnl >= 0 ? "var(--buy)" : "var(--sell)" }}>
                      {formatPnl(data.pnl)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Trade History Table */}
        <div style={{ background: "var(--bg-raised)", borderRadius: 12, padding: 20, border: "1px solid rgba(236,227,213,0.06)" }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 12, fontWeight: 600 }}>TRADE HISTORY</div>
          {accountState.tradeHistory.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
              No completed trades yet
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(236,227,213,0.06)" }}>
                    {["Symbol", "Side", "Size", "Entry", "Exit", "P&L", "Commission", "Time"].map((h) => (
                      <th key={h} style={{ textAlign: h === "Symbol" || h === "Side" ? "left" : "right", fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", padding: "6px 8px", fontWeight: 500 }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...accountState.tradeHistory].reverse().slice(0, 50).map((trade) => (
                    <tr key={trade.id} style={{ borderBottom: "1px solid rgba(236,227,213,0.03)" }}>
                      <td style={{ fontSize: 11, fontFamily: "var(--font-mono)", padding: "6px 8px", fontWeight: 600 }}>
                        <TickerLink symbol={trade.symbol} onClick={handleSelectTicker} />
                      </td>
                      <td style={{ fontSize: 11, fontFamily: "var(--font-mono)", padding: "6px 8px", color: trade.side === "long" ? "var(--buy)" : "var(--sell)", fontWeight: 600 }}>
                        {trade.side.toUpperCase()}
                      </td>
                      <td style={{ textAlign: "right", fontSize: 11, color: "var(--text-secondary)", fontFamily: "var(--font-mono)", padding: "6px 8px" }}>{trade.size}</td>
                      <td style={{ textAlign: "right", fontSize: 11, color: "var(--text-secondary)", fontFamily: "var(--font-mono)", padding: "6px 8px" }}>${trade.entryPrice.toFixed(2)}</td>
                      <td style={{ textAlign: "right", fontSize: 11, color: "var(--text-secondary)", fontFamily: "var(--font-mono)", padding: "6px 8px" }}>${trade.exitPrice.toFixed(2)}</td>
                      <td style={{ textAlign: "right", fontSize: 11, fontWeight: 600, fontFamily: "var(--font-mono)", padding: "6px 8px", color: trade.pnl >= 0 ? "var(--buy)" : "var(--sell)" }}>
                        {formatPnl(trade.pnl)}
                      </td>
                      <td style={{ textAlign: "right", fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", padding: "6px 8px" }}>${trade.commission.toFixed(2)}</td>
                      <td style={{ textAlign: "right", fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", padding: "6px 8px" }}>
                        {new Date(trade.exitTime > 1e12 ? trade.exitTime : trade.exitTime * 1000).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TickerLink({ symbol, onClick }: { symbol: string; onClick: (s: string) => void }) {
  return (
    <span
      onClick={() => onClick(symbol)}
      style={{
        color: "var(--accent)",
        cursor: "pointer",
        transition: "opacity 120ms ease",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.7"; }}
      onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
    >
      {symbol}
    </span>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: "var(--bg-raised)", borderRadius: 12, padding: "16px 20px", border: "1px solid rgba(236,227,213,0.06)" }}>
      <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 6, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: color || "var(--text-primary)", fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}

function MetricRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between" style={{ padding: "6px 0", borderBottom: "1px solid rgba(236,227,213,0.03)" }}>
      <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: color || "var(--text-primary)", fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
}
