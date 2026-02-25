import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getSettings = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("userSettings")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
  },
});

export const upsertSettings = mutation({
  args: {
    userId: v.id("users"),
    settings: v.object({
      theme: v.optional(v.string()),
      broker: v.optional(v.string()),
      brokerAccountId: v.optional(v.string()),
      fundingMethod: v.optional(v.string()),
      currency: v.optional(v.string()),
      language: v.optional(v.string()),
      marketRegion: v.optional(v.string()),
      oneClickTrading: v.optional(v.boolean()),
      tradeExecutionSound: v.optional(v.boolean()),
      showBuySellButtons: v.optional(v.boolean()),
      showPositionsOnChart: v.optional(v.boolean()),
      reversePositionButton: v.optional(v.boolean()),
      showPnlOnChart: v.optional(v.boolean()),
      defaultOrderType: v.optional(v.string()),
      defaultLotSize: v.optional(v.number()),
      showNotifications: v.optional(v.boolean()),
      notificationDuration: v.optional(v.number()),
      pushNotifications: v.optional(v.boolean()),
      smsAlerts: v.optional(v.boolean()),
      smsPhone: v.optional(v.string()),
      showTradeHistoryOnChart: v.optional(v.boolean()),
      bigLotThreshold: v.optional(v.number()),
      compactMode: v.optional(v.boolean()),
    }),
  },
  handler: async (ctx, { userId, settings }) => {
    const existing = await ctx.db
      .query("userSettings")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    const defaults = {
      theme: "dark-amber",
      broker: "egm",
      brokerAccountId: "EGM-2847593",
      fundingMethod: "mpesa",
      currency: "KES",
      language: "en",
      marketRegion: "ke",
      oneClickTrading: false,
      tradeExecutionSound: true,
      showBuySellButtons: false,
      showPositionsOnChart: true,
      reversePositionButton: false,
      showPnlOnChart: true,
      defaultOrderType: "market",
      defaultLotSize: 100,
      showNotifications: true,
      notificationDuration: 3,
      pushNotifications: true,
      smsAlerts: false,
      smsPhone: "+254",
      showTradeHistoryOnChart: false,
      bigLotThreshold: 10,
      compactMode: false,
    };

    if (existing) {
      const patch: Record<string, unknown> = { updatedAt: Date.now() };
      for (const [key, value] of Object.entries(settings)) {
        if (value !== undefined) {
          patch[key] = value;
        }
      }
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }

    return await ctx.db.insert("userSettings", {
      userId,
      ...defaults,
      ...Object.fromEntries(
        Object.entries(settings).filter(([, v]) => v !== undefined),
      ),
      updatedAt: Date.now(),
    });
  },
});

export const getApiKeys = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("apiKeys")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const upsertApiKey = mutation({
  args: {
    userId: v.id("users"),
    provider: v.string(),
    encryptedKey: v.string(),
    label: v.optional(v.string()),
  },
  handler: async (ctx, { userId, provider, encryptedKey, label }) => {
    const existing = await ctx.db
      .query("apiKeys")
      .withIndex("by_userId_provider", (q) =>
        q.eq("userId", userId).eq("provider", provider),
      )
      .unique();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        encryptedKey,
        label,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("apiKeys", {
      userId,
      provider,
      encryptedKey,
      label,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const deleteApiKey = mutation({
  args: {
    userId: v.id("users"),
    provider: v.string(),
  },
  handler: async (ctx, { userId, provider }) => {
    const existing = await ctx.db
      .query("apiKeys")
      .withIndex("by_userId_provider", (q) =>
        q.eq("userId", userId).eq("provider", provider),
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});
