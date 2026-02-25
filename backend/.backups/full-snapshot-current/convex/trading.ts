import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const listPositions = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("positions")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const openPosition = mutation({
  args: {
    userId: v.id("users"),
    positionId: v.string(),
    symbol: v.string(),
    side: v.union(v.literal("long"), v.literal("short")),
    size: v.number(),
    entryPrice: v.number(),
    entryTime: v.number(),
    stopLoss: v.optional(v.number()),
    takeProfit: v.optional(v.number()),
    commission: v.number(),
    unrealizedPnl: v.number(),
  },
  handler: async (ctx, { userId, ...position }) => {
    return await ctx.db.insert("positions", { userId, ...position });
  },
});

export const closePosition = mutation({
  args: {
    userId: v.id("users"),
    positionId: v.string(),
    exitPrice: v.number(),
    exitTime: v.number(),
    pnl: v.number(),
    pnlPoints: v.number(),
    commission: v.number(),
  },
  handler: async (ctx, { userId, positionId, exitPrice, exitTime, pnl, pnlPoints, commission }) => {
    // Find the open position
    const positions = await ctx.db
      .query("positions")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    const position = positions.find((p) => p.positionId === positionId);
    if (!position) throw new Error(`Position ${positionId} not found`);

    // Insert into trades
    await ctx.db.insert("trades", {
      userId,
      tradeId: position.positionId,
      symbol: position.symbol,
      side: position.side,
      size: position.size,
      entryPrice: position.entryPrice,
      exitPrice,
      entryTime: position.entryTime,
      exitTime,
      stopLoss: position.stopLoss,
      takeProfit: position.takeProfit,
      pnl,
      pnlPoints,
      commission,
    });

    // Remove from positions
    await ctx.db.delete(position._id);
  },
});

export const listTrades = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { userId, limit }) => {
    const q = ctx.db
      .query("trades")
      .withIndex("by_userId_exitTime", (q) => q.eq("userId", userId))
      .order("desc");

    if (limit) {
      return await q.take(limit);
    }
    return await q.collect();
  },
});

export const syncFullState = mutation({
  args: {
    userId: v.id("users"),
    positions: v.array(
      v.object({
        positionId: v.string(),
        symbol: v.string(),
        side: v.union(v.literal("long"), v.literal("short")),
        size: v.number(),
        entryPrice: v.number(),
        entryTime: v.number(),
        stopLoss: v.optional(v.number()),
        takeProfit: v.optional(v.number()),
        commission: v.number(),
        unrealizedPnl: v.number(),
      }),
    ),
    trades: v.array(
      v.object({
        tradeId: v.string(),
        symbol: v.string(),
        side: v.union(v.literal("long"), v.literal("short")),
        size: v.number(),
        entryPrice: v.number(),
        exitPrice: v.number(),
        entryTime: v.number(),
        exitTime: v.number(),
        stopLoss: v.optional(v.number()),
        takeProfit: v.optional(v.number()),
        pnl: v.number(),
        pnlPoints: v.number(),
        commission: v.number(),
      }),
    ),
  },
  handler: async (ctx, { userId, positions, trades }) => {
    // Clear existing positions for this user
    const existingPositions = await ctx.db
      .query("positions")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    for (const pos of existingPositions) {
      await ctx.db.delete(pos._id);
    }

    // Clear existing trades for this user
    const existingTrades = await ctx.db
      .query("trades")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    for (const trade of existingTrades) {
      await ctx.db.delete(trade._id);
    }

    // Insert new positions
    for (const pos of positions) {
      await ctx.db.insert("positions", { userId, ...pos });
    }

    // Insert new trades
    for (const trade of trades) {
      await ctx.db.insert("trades", { userId, ...trade });
    }
  },
});
