import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./lib/auth";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
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
    const userId = await requireAuth(ctx);
    const backtest = await ctx.db.get(id);
    if (!backtest || backtest.userId !== userId) {
      throw new Error("Backtest not found");
    }
    return backtest;
  },
});

export const save = mutation({
  args: {
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
  handler: async (ctx, { ...data }) => {
    const userId = await requireAuth(ctx);
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
    const userId = await requireAuth(ctx);
    const backtest = await ctx.db.get(id);
    if (!backtest || backtest.userId !== userId) {
      throw new Error("Backtest not found");
    }
    await ctx.db.delete(id);
  },
});
