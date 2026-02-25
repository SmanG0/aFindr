"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useCurrentUser } from "@/hooks/useConvexUser";
import {
  AccountState,
  Position,
  ClosedTrade,
  getContractConfig,
} from "@/lib/types";

const INITIAL_BALANCE = 25000;
const STORAGE_KEY = "afindr_trading_state_v3";

function loadSavedState(): AccountState | null {
  if (typeof window === "undefined") return null;
  try {
    // Clean up old storage keys from previous versions
    localStorage.removeItem("afindr_trading_state");
    localStorage.removeItem("afindr_trading_state_v2");
    localStorage.removeItem("afindr_demo_version");

    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved) as AccountState;
    if (typeof parsed.balance !== "number" || !Array.isArray(parsed.positions)) return null;
    if (typeof parsed.isActive !== "boolean") parsed.isActive = false;
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

/** Map null → undefined for Convex optional fields */
function nullToUndefined(v: number | null): number | undefined {
  return v === null ? undefined : v;
}

const initialAccountState: AccountState = {
  balance: 0,
  equity: 0,
  unrealizedPnl: 0,
  positions: [],
  orders: [],
  tradeHistory: [],
  isActive: false,
};

export function useTradingEngine() {
  const { isAuthenticated } = useCurrentUser();
  const [accountState, setAccountState] = useState<AccountState>(initialAccountState);
  const [stateHydrated, setStateHydrated] = useState(false);

  // Convex mutations
  const openPositionMut = useMutation(api.trading.openPosition);
  const closePositionMut = useMutation(api.trading.closePosition);
  const syncFullStateMut = useMutation(api.trading.syncFullState);

  useEffect(() => {
    const saved = loadSavedState();
    if (saved) {
      setAccountState(saved);
    }
    // No saved state → keep initialAccountState (inactive, zero balance)
    setStateHydrated(true);
  }, []);

  useEffect(() => {
    if (!stateHydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(accountState));
    } catch {
      /* localStorage might be full */
    }
  }, [accountState, stateHydrated]);

  // Initial sync to Convex — push full state (positions + trades) once after hydration
  const convexSyncedRef = useRef(false);
  useEffect(() => {
    if (!stateHydrated || !isAuthenticated || convexSyncedRef.current) return;
    convexSyncedRef.current = true;

    const state = accountState;
    syncFullStateMut({
      positions: state.positions.map((p) => ({
        positionId: p.id,
        symbol: p.symbol,
        side: p.side,
        size: p.size,
        entryPrice: p.entryPrice,
        entryTime: p.entryTime,
        stopLoss: nullToUndefined(p.stopLoss),
        takeProfit: nullToUndefined(p.takeProfit),
        commission: p.commission,
        unrealizedPnl: p.unrealizedPnl,
      })),
      trades: state.tradeHistory.map((t) => ({
        tradeId: t.id,
        symbol: t.symbol,
        side: t.side,
        size: t.size,
        entryPrice: t.entryPrice,
        exitPrice: t.exitPrice,
        entryTime: t.entryTime,
        exitTime: t.exitTime,
        stopLoss: nullToUndefined(t.stopLoss),
        takeProfit: nullToUndefined(t.takeProfit),
        pnl: t.pnl,
        pnlPoints: t.pnlPoints,
        commission: t.commission,
      })),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateHydrated, isAuthenticated]);

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

      // Fire-and-forget sync to Convex
      if (isAuthenticated) {
        openPositionMut({
          positionId: position.id,
          symbol: position.symbol,
          side: position.side,
          size: position.size,
          entryPrice: position.entryPrice,
          entryTime: position.entryTime,
          stopLoss: nullToUndefined(position.stopLoss),
          takeProfit: nullToUndefined(position.takeProfit),
          commission: position.commission,
          unrealizedPnl: position.unrealizedPnl,
        });
      }
    },
    [isAuthenticated, openPositionMut],
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

        // Fire-and-forget sync to Convex
        if (isAuthenticated) {
          closePositionMut({
            positionId: id,
            exitPrice: currentPrice,
            exitTime,
            pnl: pnl - exitCommission,
            pnlPoints,
            commission: position.commission + exitCommission,
          });
        }

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
    [isAuthenticated, closePositionMut],
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

  const editPosition = useCallback(
    (symbol: string, updates: { size?: number; stopLoss?: number; takeProfit?: number }) => {
      setAccountState((prev) => {
        const idx = prev.positions.findIndex((p) => p.symbol.toUpperCase() === symbol.toUpperCase());
        if (idx === -1) return prev;

        const pos = prev.positions[idx];
        const updatedPos: Position = {
          ...pos,
          ...(updates.size !== undefined && { size: updates.size }),
          ...(updates.stopLoss !== undefined && { stopLoss: updates.stopLoss }),
          ...(updates.takeProfit !== undefined && { takeProfit: updates.takeProfit }),
        };

        const newPositions = [...prev.positions];
        newPositions[idx] = updatedPos;
        return { ...prev, positions: newPositions };
      });
    },
    [],
  );

  const removeBySymbol = useCallback(
    (symbol: string, currentPrice: number) => {
      setAccountState((prev) => {
        const toRemove = prev.positions.filter((p) => p.symbol.toUpperCase() === symbol.toUpperCase());
        if (toRemove.length === 0) return prev;

        let newBalance = prev.balance;
        const closedTrades: ClosedTrade[] = [];

        for (const position of toRemove) {
          const contract = getContractConfig(position.symbol);
          const pointValue = contract.pointValue;
          const pnlPoints =
            position.side === "long"
              ? currentPrice - position.entryPrice
              : position.entryPrice - currentPrice;
          const pnl = pnlPoints * position.size * pointValue;
          const exitCommission = getCommissionPerSide(position.symbol) * position.size;
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

          if (isAuthenticated) {
            closePositionMut({
              positionId: position.id,
              exitPrice: currentPrice,
              exitTime: Date.now(),
              pnl: pnl - exitCommission,
              pnlPoints,
              commission: position.commission + exitCommission,
            });
          }
        }

        const remainingPositions = prev.positions.filter(
          (p) => p.symbol.toUpperCase() !== symbol.toUpperCase(),
        );
        const totalUnrealized = remainingPositions.reduce(
          (sum, p) => sum + p.unrealizedPnl,
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
    [isAuthenticated, closePositionMut],
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
    const resetState: AccountState = {
      balance: INITIAL_BALANCE,
      equity: INITIAL_BALANCE,
      unrealizedPnl: 0,
      positions: [],
      orders: [],
      tradeHistory: [],
      isActive: true,
    };
    setAccountState(resetState);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
    if (isAuthenticated) {
      syncFullStateMut({ positions: [], trades: [] });
    }
  }, [isAuthenticated, syncFullStateMut]);

  const setBalance = useCallback((newBalance: number) => {
    setAccountState(() => {
      const state: AccountState = {
        balance: newBalance,
        equity: newBalance,
        unrealizedPnl: 0,
        positions: [],
        orders: [],
        tradeHistory: [],
        isActive: true,
      };
      if (isAuthenticated) {
        syncFullStateMut({ positions: [], trades: [] });
      }
      return state;
    });
  }, [isAuthenticated, syncFullStateMut]);

  const logoutAccount = useCallback(() => {
    setAccountState({
      balance: 0,
      equity: 0,
      unrealizedPnl: 0,
      positions: [],
      orders: [],
      tradeHistory: [],
      isActive: false,
    });
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
    if (isAuthenticated) {
      syncFullStateMut({ positions: [], trades: [] });
    }
  }, [isAuthenticated, syncFullStateMut]);

  return {
    accountState,
    placeTrade,
    closePosition,
    closeAllPositions,
    closeAllProfitable,
    closeAllLosing,
    editPosition,
    removeBySymbol,
    updatePrices,
    resetAccount,
    setBalance,
    logoutAccount,
  };
}
