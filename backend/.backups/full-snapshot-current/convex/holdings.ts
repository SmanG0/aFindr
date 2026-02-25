import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("holdings")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const add = mutation({
  args: {
    userId: v.id("users"),
    symbol: v.string(),
    shares: v.number(),
    avgCostBasis: v.number(),
  },
  handler: async (ctx, { userId, symbol, shares, avgCostBasis }) => {
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
      await ctx.db.patch(existing._id, {
        shares: totalShares,
        avgCostBasis: newAvg,
      });
      return existing._id;
    }

    return await ctx.db.insert("holdings", {
      userId,
      symbol,
      shares,
      avgCostBasis,
      addedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: {
    userId: v.id("users"),
    symbol: v.string(),
  },
  handler: async (ctx, { userId, symbol }) => {
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
    userId: v.id("users"),
    symbol: v.string(),
    shares: v.number(),
  },
  handler: async (ctx, { userId, symbol, shares }) => {
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
