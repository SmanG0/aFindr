"use client";

import { useState, useCallback, useEffect } from "react";
import {
  AccountState,
  Position,
  ClosedTrade,
  getContractConfig,
} from "@/lib/types";

const INITIAL_BALANCE = 25000;
const STORAGE_KEY = "afindr_trading_state";

function loadSavedState(): AccountState | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved) as AccountState;
    if (typeof parsed.balance !== "number" || !Array.isArray(parsed.positions)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getCommissionPerSide(symbol: string): number {
  const contract = getContractConfig(symbol);
  return Math.max(0.62, contract.pointValue * 0.205);
}

function calcUnrealizedPnl(position: Position, currentPrice: number): number {
  const contract = getContractConfig(position.symbol);
  const pointValue = contract.pointValue;
  if (position.side === "long") {
    return (currentPrice - position.entryPrice) * position.size * pointValue;
  }
  return (position.entryPrice - currentPrice) * position.size * pointValue;
}

const initialAccountState: AccountState = {
  balance: INITIAL_BALANCE,
  equity: INITIAL_BALANCE,
  unrealizedPnl: 0,
  positions: [],
  orders: [],
  tradeHistory: [],
};

function buildDemoState(): AccountState {
  const now = Date.now();
  const DAY = 86400000;

  const demoPositions: Position[] = [
    { id: "demo-pos-1", symbol: "AAPL", side: "long", size: 15, entryPrice: 178.50, entryTime: now - 5 * DAY, stopLoss: 170.00, takeProfit: 195.00, commission: 0.62, unrealizedPnl: 285.00 },
    { id: "demo-pos-2", symbol: "NVDA", side: "long", size: 8, entryPrice: 875.30, entryTime: now - 3 * DAY, stopLoss: 840.00, takeProfit: 950.00, commission: 0.62, unrealizedPnl: 520.00 },
    { id: "demo-pos-3", symbol: "MSFT", side: "long", size: 10, entryPrice: 412.80, entryTime: now - 7 * DAY, stopLoss: 395.00, takeProfit: 440.00, commission: 0.62, unrealizedPnl: -142.50 },
    { id: "demo-pos-4", symbol: "GOOGL", side: "long", size: 12, entryPrice: 152.60, entryTime: now - 2 * DAY, stopLoss: 145.00, takeProfit: 165.00, commission: 0.62, unrealizedPnl: 198.00 },
    { id: "demo-pos-5", symbol: "TSLA", side: "short", size: 5, entryPrice: 245.20, entryTime: now - 1 * DAY, stopLoss: 260.00, takeProfit: 220.00, commission: 0.62, unrealizedPnl: 87.50 },
  ];

  const demoHistory: ClosedTrade[] = [
    { id: "demo-t1", symbol: "AAPL", side: "long", size: 20, entryPrice: 168.30, exitPrice: 179.45, entryTime: now - 28 * DAY, exitTime: now - 25 * DAY, stopLoss: null, takeProfit: null, pnl: 222.38, pnlPoints: 11.15, commission: 1.24 },
    { id: "demo-t2", symbol: "META", side: "long", size: 8, entryPrice: 505.10, exitPrice: 522.80, entryTime: now - 24 * DAY, exitTime: now - 22 * DAY, stopLoss: 490.00, takeProfit: null, pnl: 140.36, pnlPoints: 17.70, commission: 1.24 },
    { id: "demo-t3", symbol: "AMZN", side: "long", size: 10, entryPrice: 186.40, exitPrice: 181.20, entryTime: now - 21 * DAY, exitTime: now - 19 * DAY, stopLoss: null, takeProfit: null, pnl: -53.24, pnlPoints: -5.20, commission: 1.24 },
    { id: "demo-t4", symbol: "NVDA", side: "long", size: 5, entryPrice: 842.00, exitPrice: 891.50, entryTime: now - 18 * DAY, exitTime: now - 16 * DAY, stopLoss: 820.00, takeProfit: null, pnl: 246.26, pnlPoints: 49.50, commission: 1.24 },
    { id: "demo-t5", symbol: "JPM", side: "long", size: 15, entryPrice: 195.80, exitPrice: 202.40, entryTime: now - 15 * DAY, exitTime: now - 13 * DAY, stopLoss: null, takeProfit: 205.00, pnl: 97.76, pnlPoints: 6.60, commission: 1.24 },
    { id: "demo-t6", symbol: "TSLA", side: "short", size: 8, entryPrice: 258.90, exitPrice: 242.10, entryTime: now - 14 * DAY, exitTime: now - 12 * DAY, stopLoss: 270.00, takeProfit: null, pnl: 133.16, pnlPoints: 16.80, commission: 1.24 },
    { id: "demo-t7", symbol: "GOOGL", side: "long", size: 18, entryPrice: 148.90, exitPrice: 146.20, entryTime: now - 11 * DAY, exitTime: now - 10 * DAY, stopLoss: null, takeProfit: null, pnl: -49.84, pnlPoints: -2.70, commission: 1.24 },
    { id: "demo-t8", symbol: "V", side: "long", size: 10, entryPrice: 278.50, exitPrice: 286.80, entryTime: now - 10 * DAY, exitTime: now - 8 * DAY, stopLoss: 270.00, takeProfit: null, pnl: 81.76, pnlPoints: 8.30, commission: 1.24 },
    { id: "demo-t9", symbol: "CRM", side: "long", size: 12, entryPrice: 312.40, exitPrice: 305.80, entryTime: now - 9 * DAY, exitTime: now - 7 * DAY, stopLoss: null, takeProfit: null, pnl: -80.44, pnlPoints: -6.60, commission: 1.24 },
    { id: "demo-t10", symbol: "MSFT", side: "long", size: 8, entryPrice: 405.20, exitPrice: 418.60, entryTime: now - 8 * DAY, exitTime: now - 6 * DAY, stopLoss: 395.00, takeProfit: null, pnl: 105.96, pnlPoints: 13.40, commission: 1.24 },
    { id: "demo-t11", symbol: "AMD", side: "long", size: 20, entryPrice: 162.30, exitPrice: 171.80, entryTime: now - 6 * DAY, exitTime: now - 5 * DAY, stopLoss: null, takeProfit: 175.00, pnl: 188.76, pnlPoints: 9.50, commission: 1.24 },
    { id: "demo-t12", symbol: "NFLX", side: "long", size: 6, entryPrice: 891.50, exitPrice: 878.30, entryTime: now - 4 * DAY, exitTime: now - 3 * DAY, stopLoss: null, takeProfit: null, pnl: -80.44, pnlPoints: -13.20, commission: 1.24 },
    { id: "demo-t13", symbol: "SPY", side: "long", size: 25, entryPrice: 535.60, exitPrice: 542.80, entryTime: now - 3 * DAY, exitTime: now - 2 * DAY, stopLoss: 528.00, takeProfit: null, pnl: 178.76, pnlPoints: 7.20, commission: 1.24 },
    { id: "demo-t14", symbol: "QQQ", side: "long", size: 15, entryPrice: 485.20, exitPrice: 492.50, entryTime: now - 2 * DAY, exitTime: now - 1 * DAY, stopLoss: null, takeProfit: null, pnl: 108.26, pnlPoints: 7.30, commission: 1.24 },
  ];

  const totalClosedPnl = demoHistory.reduce((sum, t) => sum + t.pnl, 0);
  const totalUnrealized = demoPositions.reduce((sum, p) => sum + p.unrealizedPnl, 0);
  const balance = INITIAL_BALANCE + totalClosedPnl;

  return {
    balance,
    equity: balance + totalUnrealized,
    unrealizedPnl: totalUnrealized,
    positions: demoPositions,
    orders: [],
    tradeHistory: demoHistory,
  };
}

export function useTradingEngine() {
  const [accountState, setAccountState] = useState<AccountState>(initialAccountState);
  const [stateHydrated, setStateHydrated] = useState(false);

  useEffect(() => {
    const saved = loadSavedState();
    if (saved) {
      setAccountState(saved);
    } else {
      setAccountState(buildDemoState());
    }
    setStateHydrated(true);
  }, []);

  useEffect(() => {
    if (!stateHydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(accountState));
    } catch {
      /* localStorage might be full */
    }
  }, [accountState]);

  const placeTrade = useCallback(
    (
      symbol: string,
      side: "long" | "short",
      size: number,
      currentPrice: number,
      sl?: number,
      tp?: number,
    ) => {
      const commission = getCommissionPerSide(symbol) * size;

      const position: Position = {
        id: generateId(),
        symbol,
        side,
        size,
        entryPrice: currentPrice,
        entryTime: Date.now(),
        stopLoss: sl ?? null,
        takeProfit: tp ?? null,
        commission,
        unrealizedPnl: 0,
      };

      setAccountState((prev) => ({
        ...prev,
        balance: prev.balance - commission,
        equity: prev.equity - commission,
        positions: [...prev.positions, position],
      }));
    },
    [],
  );

  const closePosition = useCallback(
    (id: string, currentPrice: number) => {
      setAccountState((prev) => {
        const position = prev.positions.find((p) => p.id === id);
        if (!position) return prev;

        const contract = getContractConfig(position.symbol);
        const pointValue = contract.pointValue;
        const pnlPoints =
          position.side === "long"
            ? currentPrice - position.entryPrice
            : position.entryPrice - currentPrice;
        const pnl = pnlPoints * position.size * pointValue;
        const exitCommission = getCommissionPerSide(position.symbol) * position.size;

        const closedTrade: ClosedTrade = {
          id: position.id,
          symbol: position.symbol,
          side: position.side,
          size: position.size,
          entryPrice: position.entryPrice,
          exitPrice: currentPrice,
          entryTime: position.entryTime,
          exitTime: Date.now(),
          stopLoss: position.stopLoss,
          takeProfit: position.takeProfit,
          pnl: pnl - exitCommission,
          pnlPoints,
          commission: position.commission + exitCommission,
        };

        const remainingPositions = prev.positions.filter((p) => p.id !== id);
        const newBalance = prev.balance + pnl - exitCommission;
        const totalUnrealized = remainingPositions.reduce(
          (sum, p) => sum + calcUnrealizedPnl(p, currentPrice),
          0,
        );

        return {
          ...prev,
          balance: newBalance,
          equity: newBalance + totalUnrealized,
          unrealizedPnl: totalUnrealized,
          positions: remainingPositions,
          tradeHistory: [...prev.tradeHistory, closedTrade],
        };
      });
    },
    [],
  );

  const closeAllPositions = useCallback(
    (currentPrice: number) => {
      setAccountState((prev) => {
        if (prev.positions.length === 0) return prev;

        let newBalance = prev.balance;
        const closedTrades: ClosedTrade[] = [];

        for (const position of prev.positions) {
          const contract = getContractConfig(position.symbol);

          const pointValue = contract.pointValue;
          const pnlPoints =
            position.side === "long"
              ? currentPrice - position.entryPrice
              : position.entryPrice - currentPrice;
          const pnl = pnlPoints * position.size * pointValue;
          const exitCommission =
            getCommissionPerSide(position.symbol) * position.size;

          newBalance += pnl - exitCommission;

          closedTrades.push({
            id: position.id,
            symbol: position.symbol,
            side: position.side,
            size: position.size,
            entryPrice: position.entryPrice,
            exitPrice: currentPrice,
            entryTime: position.entryTime,
            exitTime: Date.now(),
            stopLoss: position.stopLoss,
            takeProfit: position.takeProfit,
            pnl: pnl - exitCommission,
            pnlPoints,
            commission: position.commission + exitCommission,
          });
        }

        return {
          ...prev,
          balance: newBalance,
          equity: newBalance,
          unrealizedPnl: 0,
          positions: [],
          tradeHistory: [...prev.tradeHistory, ...closedTrades],
        };
      });
    },
    [],
  );

  const closeAllProfitable = useCallback(
    (currentPrice: number) => {
      setAccountState((prev) => {
        const profitable = prev.positions.filter(
          (p) => calcUnrealizedPnl(p, currentPrice) > 0,
        );
        if (profitable.length === 0) return prev;

        let newBalance = prev.balance;
        const closedTrades: ClosedTrade[] = [];
        const closedIds = new Set<string>();

        for (const position of profitable) {
          const contract = getContractConfig(position.symbol);

          const pointValue = contract.pointValue;
          const pnlPoints =
            position.side === "long"
              ? currentPrice - position.entryPrice
              : position.entryPrice - currentPrice;
          const pnl = pnlPoints * position.size * pointValue;
          const exitCommission =
            getCommissionPerSide(position.symbol) * position.size;

          newBalance += pnl - exitCommission;
          closedIds.add(position.id);

          closedTrades.push({
            id: position.id,
            symbol: position.symbol,
            side: position.side,
            size: position.size,
            entryPrice: position.entryPrice,
            exitPrice: currentPrice,
            entryTime: position.entryTime,
            exitTime: Date.now(),
            stopLoss: position.stopLoss,
            takeProfit: position.takeProfit,
            pnl: pnl - exitCommission,
            pnlPoints,
            commission: position.commission + exitCommission,
          });
        }

        const remainingPositions = prev.positions.filter(
          (p) => !closedIds.has(p.id),
        );
        const totalUnrealized = remainingPositions.reduce(
          (sum, p) => sum + calcUnrealizedPnl(p, currentPrice),
          0,
        );

        return {
          ...prev,
          balance: newBalance,
          equity: newBalance + totalUnrealized,
          unrealizedPnl: totalUnrealized,
          positions: remainingPositions,
          tradeHistory: [...prev.tradeHistory, ...closedTrades],
        };
      });
    },
    [],
  );

  const closeAllLosing = useCallback(
    (currentPrice: number) => {
      setAccountState((prev) => {
        const losing = prev.positions.filter(
          (p) => calcUnrealizedPnl(p, currentPrice) < 0,
        );
        if (losing.length === 0) return prev;

        let newBalance = prev.balance;
        const closedTrades: ClosedTrade[] = [];
        const closedIds = new Set<string>();

        for (const position of losing) {
          const contract = getContractConfig(position.symbol);

          const pointValue = contract.pointValue;
          const pnlPoints =
            position.side === "long"
              ? currentPrice - position.entryPrice
              : position.entryPrice - currentPrice;
          const pnl = pnlPoints * position.size * pointValue;
          const exitCommission =
            getCommissionPerSide(position.symbol) * position.size;

          newBalance += pnl - exitCommission;
          closedIds.add(position.id);

          closedTrades.push({
            id: position.id,
            symbol: position.symbol,
            side: position.side,
            size: position.size,
            entryPrice: position.entryPrice,
            exitPrice: currentPrice,
            entryTime: position.entryTime,
            exitTime: Date.now(),
            stopLoss: position.stopLoss,
            takeProfit: position.takeProfit,
            pnl: pnl - exitCommission,
            pnlPoints,
            commission: position.commission + exitCommission,
          });
        }

        const remainingPositions = prev.positions.filter(
          (p) => !closedIds.has(p.id),
        );
        const totalUnrealized = remainingPositions.reduce(
          (sum, p) => sum + calcUnrealizedPnl(p, currentPrice),
          0,
        );

        return {
          ...prev,
          balance: newBalance,
          equity: newBalance + totalUnrealized,
          unrealizedPnl: totalUnrealized,
          positions: remainingPositions,
          tradeHistory: [...prev.tradeHistory, ...closedTrades],
        };
      });
    },
    [],
  );

  const updatePrices = useCallback((currentPrice: number) => {
    setAccountState((prev) => {
      const updatedPositions = prev.positions.map((p) => ({
        ...p,
        unrealizedPnl: calcUnrealizedPnl(p, currentPrice),
      }));

      const totalUnrealized = updatedPositions.reduce(
        (sum, p) => sum + p.unrealizedPnl,
        0,
      );

      return {
        ...prev,
        positions: updatedPositions,
        unrealizedPnl: totalUnrealized,
        equity: prev.balance + totalUnrealized,
      };
    });
  }, []);

  const resetAccount = useCallback(() => {
    setAccountState(initialAccountState);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
  }, []);

  return {
    accountState,
    placeTrade,
    closePosition,
    closeAllPositions,
    closeAllProfitable,
    closeAllLosing,
    updatePrices,
    resetAccount,
  };
}
