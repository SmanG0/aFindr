import { mutation, query, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./lib/auth";

export const create = mutation({
  args: {
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
    const userId = await requireAuth(ctx);
    return await ctx.db.insert("alerts", {
      userId,
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
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
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
    const userId = await requireAuth(ctx);
    const alert = await ctx.db.get(alertId);
    if (!alert || alert.userId !== userId) {
      throw new Error("Alert not found or access denied");
    }
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
    const userId = await requireAuth(ctx);
    const alert = await ctx.db.get(alertId);
    if (!alert || alert.userId !== userId) {
      throw new Error("Alert not found or access denied");
    }
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
