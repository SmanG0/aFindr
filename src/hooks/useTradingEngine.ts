"use client";

import { useState, useCallback } from "react";
import {
  AccountState,
  Position,
  ClosedTrade,
  CONTRACTS,
} from "@/lib/types";

const INITIAL_BALANCE = 25000;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getCommissionPerSide(symbol: string): number {
  const contract = CONTRACTS[symbol];
  if (!contract) return 4.10;
  return Math.max(0.62, contract.pointValue * 0.205);
}

function calcUnrealizedPnl(position: Position, currentPrice: number): number {
  const contract = CONTRACTS[position.symbol];
  if (!contract) return 0;
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

export function useTradingEngine() {
  const [accountState, setAccountState] =
    useState<AccountState>(initialAccountState);

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

        const contract = CONTRACTS[position.symbol];
        if (!contract) return prev;

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
          const contract = CONTRACTS[position.symbol];
          if (!contract) continue;

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
          const contract = CONTRACTS[position.symbol];
          if (!contract) continue;

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
          const contract = CONTRACTS[position.symbol];
          if (!contract) continue;

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
