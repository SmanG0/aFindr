"use client";

import { useState, useCallback, useEffect } from "react";
import {
  AccountState,
  Position,
  ClosedTrade,
  getContractConfig,
} from "@/lib/types";
import { syncPosition, syncClosePosition, syncFullState } from "@/lib/api";

const INITIAL_BALANCE = 25000;
const STORAGE_KEY = "afindr_trading_state_v2";
const DEMO_VERSION = 4; // bump to force fresh demo data
const DEMO_VERSION_KEY = "afindr_demo_version";

function loadSavedState(): AccountState | null {
  if (typeof window === "undefined") return null;
  try {
    // If demo version changed, wipe stale state
    const ver = localStorage.getItem(DEMO_VERSION_KEY);
    if (ver !== String(DEMO_VERSION)) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem("afindr_trading_state"); // old key cleanup
      localStorage.setItem(DEMO_VERSION_KEY, String(DEMO_VERSION));
      return null;
    }
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

  // Holdings purchased over the last ~60 days with staggered entry dates
  const demoPositions: Position[] = [
    { id: "demo-pos-1", symbol: "AAPL",  side: "long", size: 25, entryPrice: 225.80, entryTime: now - 52 * DAY, stopLoss: 215.00, takeProfit: 250.00, commission: 0.62, unrealizedPnl: 355.00 },
    { id: "demo-pos-2", symbol: "NVDA",  side: "long", size: 15, entryPrice: 125.60, entryTime: now - 44 * DAY, stopLoss: 115.00, takeProfit: 160.00, commission: 0.62, unrealizedPnl: 682.50 },
    { id: "demo-pos-3", symbol: "MSFT",  side: "long", size: 12, entryPrice: 430.20, entryTime: now - 35 * DAY, stopLoss: 410.00, takeProfit: 460.00, commission: 0.62, unrealizedPnl: -170.40 },
    { id: "demo-pos-4", symbol: "META",  side: "long", size: 8,  entryPrice: 585.40, entryTime: now - 28 * DAY, stopLoss: 560.00, takeProfit: 650.00, commission: 0.62, unrealizedPnl: 436.80 },
    { id: "demo-pos-5", symbol: "AMZN",  side: "long", size: 20, entryPrice: 218.30, entryTime: now - 21 * DAY, stopLoss: 205.00, takeProfit: 245.00, commission: 0.62, unrealizedPnl: 294.00 },
    { id: "demo-pos-6", symbol: "GOOGL", side: "long", size: 18, entryPrice: 188.50, entryTime: now - 15 * DAY, stopLoss: 178.00, takeProfit: 210.00, commission: 0.62, unrealizedPnl: 198.00 },
    { id: "demo-pos-7", symbol: "V",     side: "long", size: 10, entryPrice: 328.90, entryTime: now - 10 * DAY, stopLoss: 315.00, takeProfit: 350.00, commission: 0.62, unrealizedPnl: -89.00 },
    { id: "demo-pos-8", symbol: "TSLA",  side: "long", size: 8,  entryPrice: 365.40, entryTime: now - 5 * DAY,  stopLoss: 340.00, takeProfit: 400.00, commission: 0.62, unrealizedPnl: 148.80 },
  ];

  // Closed trades from further back (~60-90 days ago)
  const demoHistory: ClosedTrade[] = [
    { id: "demo-t1",  symbol: "AAPL",  side: "long", size: 20, entryPrice: 218.30, exitPrice: 226.45, entryTime: now - 88 * DAY, exitTime: now - 80 * DAY, stopLoss: null, takeProfit: null, pnl: 161.76, pnlPoints: 8.15, commission: 1.24 },
    { id: "demo-t2",  symbol: "GOOGL", side: "long", size: 15, entryPrice: 178.90, exitPrice: 185.40, entryTime: now - 82 * DAY, exitTime: now - 76 * DAY, stopLoss: null, takeProfit: null, pnl: 96.26,  pnlPoints: 6.50, commission: 1.24 },
    { id: "demo-t3",  symbol: "AMZN",  side: "long", size: 10, entryPrice: 208.40, exitPrice: 203.10, entryTime: now - 78 * DAY, exitTime: now - 73 * DAY, stopLoss: null, takeProfit: null, pnl: -54.24, pnlPoints: -5.30, commission: 1.24 },
    { id: "demo-t4",  symbol: "NVDA",  side: "long", size: 12, entryPrice: 118.50, exitPrice: 127.80, entryTime: now - 74 * DAY, exitTime: now - 69 * DAY, stopLoss: null, takeProfit: null, pnl: 110.36, pnlPoints: 9.30, commission: 1.24 },
    { id: "demo-t5",  symbol: "META",  side: "long", size: 8,  entryPrice: 572.60, exitPrice: 589.30, entryTime: now - 70 * DAY, exitTime: now - 65 * DAY, stopLoss: null, takeProfit: null, pnl: 132.36, pnlPoints: 16.70, commission: 1.24 },
    { id: "demo-t6",  symbol: "TSLA",  side: "long", size: 10, entryPrice: 342.80, exitPrice: 358.40, entryTime: now - 66 * DAY, exitTime: now - 62 * DAY, stopLoss: null, takeProfit: null, pnl: 154.76, pnlPoints: 15.60, commission: 1.24 },
    { id: "demo-t7",  symbol: "V",     side: "long", size: 12, entryPrice: 318.50, exitPrice: 312.80, entryTime: now - 63 * DAY, exitTime: now - 60 * DAY, stopLoss: null, takeProfit: null, pnl: -69.64, pnlPoints: -5.70, commission: 1.24 },
    { id: "demo-t8",  symbol: "JPM",   side: "long", size: 15, entryPrice: 248.20, exitPrice: 256.90, entryTime: now - 60 * DAY, exitTime: now - 56 * DAY, stopLoss: null, takeProfit: null, pnl: 129.26, pnlPoints: 8.70, commission: 1.24 },
    { id: "demo-t9",  symbol: "CRM",   side: "long", size: 10, entryPrice: 338.40, exitPrice: 329.60, entryTime: now - 58 * DAY, exitTime: now - 55 * DAY, stopLoss: null, takeProfit: null, pnl: -89.24, pnlPoints: -8.80, commission: 1.24 },
    { id: "demo-t10", symbol: "MSFT",  side: "long", size: 8,  entryPrice: 418.50, exitPrice: 432.80, entryTime: now - 56 * DAY, exitTime: now - 53 * DAY, stopLoss: null, takeProfit: null, pnl: 113.16, pnlPoints: 14.30, commission: 1.24 },
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

      // Fire-and-forget sync to backend DB
      syncPosition(position);
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
        const exitTime = Date.now();

        const closedTrade: ClosedTrade = {
          id: position.id,
          symbol: position.symbol,
          side: position.side,
          size: position.size,
          entryPrice: position.entryPrice,
          exitPrice: currentPrice,
          entryTime: position.entryTime,
          exitTime,
          stopLoss: position.stopLoss,
          takeProfit: position.takeProfit,
          pnl: pnl - exitCommission,
          pnlPoints,
          commission: position.commission + exitCommission,
        };

        // Fire-and-forget sync to backend DB
        syncClosePosition(
          id, currentPrice, exitTime,
          pnl - exitCommission, pnlPoints,
          position.commission + exitCommission,
        );

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

  const updatePrices = useCallback((currentPrice: number, symbol?: string) => {
    setAccountState((prev) => {
      const updatedPositions = prev.positions.map((p) => {
        // Only update positions matching the symbol (or all if no symbol given and only one position)
        if (symbol && p.symbol !== symbol) return p;
        if (!symbol && prev.positions.length > 1) return p;
        return { ...p, unrealizedPnl: calcUnrealizedPnl(p, currentPrice) };
      });

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
    // Sync reset state to backend
    syncFullState({
      balance: initialAccountState.balance,
      equity: initialAccountState.equity,
      unrealizedPnl: 0,
      positions: [],
      tradeHistory: [],
    });
  }, []);

  const setBalance = useCallback((newBalance: number) => {
    setAccountState(() => {
      const state: AccountState = {
        balance: newBalance,
        equity: newBalance,
        unrealizedPnl: 0,
        positions: [],
        orders: [],
        tradeHistory: [],
      };
      syncFullState({
        balance: newBalance,
        equity: newBalance,
        unrealizedPnl: 0,
        positions: [],
        tradeHistory: [],
      });
      return state;
    });
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
    setBalance,
  };
}
