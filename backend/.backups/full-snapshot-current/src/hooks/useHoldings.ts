"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useConvexUserId } from "@/components/ConvexClientProvider";
import { useCallback } from "react";

export interface Holding {
  _id: string;
  symbol: string;
  shares: number;
  avgCostBasis: number;
  addedAt: number;
}

export function useHoldings() {
  const { userId } = useConvexUserId();

  const raw = useQuery(
    api.holdings.list,
    userId ? { userId } : "skip"
  );
  const addMutation = useMutation(api.holdings.add);
  const removeMutation = useMutation(api.holdings.remove);
  const updateSharesMutation = useMutation(api.holdings.updateShares);

  const holdings: Holding[] = (raw ?? []) as Holding[];
  const isLoading = raw === undefined;

  const addHolding = useCallback(
    async (symbol: string, shares: number, avgCostBasis: number) => {
      if (!userId) return;
      await addMutation({ userId, symbol, shares, avgCostBasis });
    },
    [userId, addMutation]
  );

  const removeHolding = useCallback(
    async (symbol: string) => {
      if (!userId) return;
      await removeMutation({ userId, symbol });
    },
    [userId, removeMutation]
  );

  const updateShares = useCallback(
    async (symbol: string, shares: number) => {
      if (!userId) return;
      await updateSharesMutation({ userId, symbol, shares });
    },
    [userId, updateSharesMutation]
  );

  return { holdings, isLoading, addHolding, removeHolding, updateShares };
}
