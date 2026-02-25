import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./lib/auth";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    return await ctx.db
      .query("holdings")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const add = mutation({
  args: {
    symbol: v.string(),
    shares: v.number(),
    avgCostBasis: v.number(),
    purchaseDate: v.optional(v.number()),
  },
  handler: async (ctx, { symbol, shares, avgCostBasis, purchaseDate }) => {
    const userId = await requireAuth(ctx);
    const existing = await ctx.db
      .query("holdings")
      .withIndex("by_userId_symbol", (q) =>
        q.eq("userId", userId).eq("symbol", symbol)
      )
      .unique();

    if (existing) {
      // Weighted average cost basis
      const totalShares = existing.shares + shares;
      const newAvg =
        (existing.avgCostBasis * existing.shares + avgCostBasis * shares) /
        totalShares;
      const earlierDate = purchaseDate != null && existing.purchaseDate != null
        ? Math.min(purchaseDate, existing.purchaseDate)
        : purchaseDate ?? existing.purchaseDate;
      await ctx.db.patch(existing._id, {
        shares: totalShares,
        avgCostBasis: newAvg,
        ...(earlierDate != null ? { purchaseDate: earlierDate } : {}),
      });
      return existing._id;
    }

    return await ctx.db.insert("holdings", {
      userId,
      symbol,
      shares,
      avgCostBasis,
      addedAt: Date.now(),
      ...(purchaseDate != null ? { purchaseDate } : {}),
    });
  },
});

export const remove = mutation({
  args: {
    symbol: v.string(),
  },
  handler: async (ctx, { symbol }) => {
    const userId = await requireAuth(ctx);
    const existing = await ctx.db
      .query("holdings")
      .withIndex("by_userId_symbol", (q) =>
        q.eq("userId", userId).eq("symbol", symbol)
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const updateShares = mutation({
  args: {
    symbol: v.string(),
    shares: v.number(),
  },
  handler: async (ctx, { symbol, shares }) => {
    const userId = await requireAuth(ctx);
    const existing = await ctx.db
      .query("holdings")
      .withIndex("by_userId_symbol", (q) =>
        q.eq("userId", userId).eq("symbol", symbol)
      )
      .unique();

    if (!existing) return;

    if (shares <= 0) {
      await ctx.db.delete(existing._id);
    } else {
      await ctx.db.patch(existing._id, { shares });
    }
  },
});
