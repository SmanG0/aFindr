import { mutation, query, internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    userId: v.id("users"),
    type: v.union(v.literal("price"), v.literal("news")),
    symbol: v.string(),
    condition: v.optional(
      v.union(
        v.literal("above"),
        v.literal("below"),
        v.literal("crosses_above"),
        v.literal("crosses_below"),
      ),
    ),
    targetPrice: v.optional(v.number()),
    keywords: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("alerts", {
      userId: args.userId,
      type: args.type,
      symbol: args.symbol,
      condition: args.condition,
      targetPrice: args.targetPrice,
      keywords: args.keywords,
      active: true,
      createdAt: Date.now(),
    });
  },
});

export const list = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const alerts = await ctx.db
      .query("alerts")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    return alerts.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const update = mutation({
  args: {
    alertId: v.id("alerts"),
    active: v.optional(v.boolean()),
    targetPrice: v.optional(v.number()),
    condition: v.optional(
      v.union(
        v.literal("above"),
        v.literal("below"),
        v.literal("crosses_above"),
        v.literal("crosses_below"),
      ),
    ),
    keywords: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { alertId, ...updates }) => {
    const patch: Record<string, unknown> = {};
    if (updates.active !== undefined) patch.active = updates.active;
    if (updates.targetPrice !== undefined) patch.targetPrice = updates.targetPrice;
    if (updates.condition !== undefined) patch.condition = updates.condition;
    if (updates.keywords !== undefined) patch.keywords = updates.keywords;
    await ctx.db.patch(alertId, patch);
  },
});

export const remove = mutation({
  args: { alertId: v.id("alerts") },
  handler: async (ctx, { alertId }) => {
    await ctx.db.delete(alertId);
  },
});

export const getActiveAlerts = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("alerts")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();
  },
});
