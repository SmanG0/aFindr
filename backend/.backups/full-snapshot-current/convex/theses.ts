import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getByTicker = query({
  args: {
    userId: v.id("users"),
    ticker: v.string(),
  },
  handler: async (ctx, { userId, ticker }) => {
    return await ctx.db
      .query("tickerTheses")
      .withIndex("by_userId_ticker", (q) =>
        q.eq("userId", userId).eq("ticker", ticker),
      )
      .unique();
  },
});

export const listByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("tickerTheses")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const upsert = mutation({
  args: {
    userId: v.id("users"),
    ticker: v.string(),
    sentiment: v.union(
      v.literal("bullish"),
      v.literal("bearish"),
      v.literal("neutral"),
    ),
    thesis: v.string(),
    targetPrice: v.optional(v.number()),
    timeframe: v.optional(v.string()),
    catalysts: v.array(v.string()),
    risks: v.array(v.string()),
  },
  handler: async (
    ctx,
    { userId, ticker, sentiment, thesis, targetPrice, timeframe, catalysts, risks },
  ) => {
    const existing = await ctx.db
      .query("tickerTheses")
      .withIndex("by_userId_ticker", (q) =>
        q.eq("userId", userId).eq("ticker", ticker),
      )
      .unique();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        sentiment,
        thesis,
        targetPrice,
        timeframe,
        catalysts,
        risks,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("tickerTheses", {
      userId,
      ticker,
      sentiment,
      thesis,
      targetPrice,
      timeframe,
      catalysts,
      risks,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const remove = mutation({
  args: {
    userId: v.id("users"),
    ticker: v.string(),
  },
  handler: async (ctx, { userId, ticker }) => {
    const existing = await ctx.db
      .query("tickerTheses")
      .withIndex("by_userId_ticker", (q) =>
        q.eq("userId", userId).eq("ticker", ticker),
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});
