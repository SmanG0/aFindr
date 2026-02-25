"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useCurrentUser } from "@/hooks/useConvexUser";
import { useCallback } from "react";

export interface Holding {
  _id: string;
  symbol: string;
  shares: number;
  avgCostBasis: number;
  addedAt: number;
  purchaseDate?: number;
}

export function useHoldings() {
  const { isAuthenticated } = useCurrentUser();

  const raw = useQuery(
    api.holdings.list,
    isAuthenticated ? {} : "skip"
  );
  const addMutation = useMutation(api.holdings.add);
  const removeMutation = useMutation(api.holdings.remove);
  const updateSharesMutation = useMutation(api.holdings.updateShares);

  const holdings: Holding[] = (raw ?? []) as Holding[];
  const isLoading = raw === undefined;

  const addHolding = useCallback(
    async (symbol: string, shares: number, avgCostBasis: number, purchaseDate?: number) => {
      if (!isAuthenticated) return;
      await addMutation({ symbol, shares, avgCostBasis, ...(purchaseDate != null ? { purchaseDate } : {}) });
    },
    [isAuthenticated, addMutation]
  );

  const removeHolding = useCallback(
    async (symbol: string) => {
      if (!isAuthenticated) return;
      await removeMutation({ symbol });
    },
    [isAuthenticated, removeMutation]
  );

  const updateShares = useCallback(
    async (symbol: string, shares: number) => {
      if (!isAuthenticated) return;
      await updateSharesMutation({ symbol, shares });
    },
    [isAuthenticated, updateSharesMutation]
  );

  return { holdings, isLoading, addHolding, removeHolding, updateShares };
}
