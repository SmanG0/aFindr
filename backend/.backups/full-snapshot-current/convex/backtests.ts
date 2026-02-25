import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("backtestRuns")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { id: v.id("backtestRuns") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

export const save = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    symbol: v.string(),
    strategyName: v.string(),
    period: v.string(),
    initialBalance: v.number(),
    commission: v.number(),
    metrics: v.object({
      totalTrades: v.number(),
      winRate: v.number(),
      profitFactor: v.number(),
      maxDrawdown: v.number(),
      sharpeRatio: v.number(),
      netPnl: v.number(),
      avgWin: v.number(),
      avgLoss: v.number(),
      finalBalance: v.number(),
    }),
    tradesJson: v.string(),
    equityCurveJson: v.string(),
    parametersJson: v.optional(v.string()),
  },
  handler: async (ctx, { userId, ...data }) => {
    return await ctx.db.insert("backtestRuns", {
      userId,
      ...data,
      createdAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("backtestRuns") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});
