import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./lib/auth";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    return await ctx.db
      .query("journalEntries")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const create = mutation({
  args: {
    date: v.string(),
    title: v.string(),
    body: v.string(),
  },
  handler: async (ctx, { date, title, body }) => {
    const userId = await requireAuth(ctx);
    const now = Date.now();
    return await ctx.db.insert("journalEntries", {
      userId,
      date,
      title,
      body,
      screenshotIds: [],
      commentsJson: "[]",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("journalEntries"),
    title: v.optional(v.string()),
    market: v.optional(v.string()),
    outcome: v.optional(
      v.union(
        v.literal("win"),
        v.literal("loss"),
        v.literal("breakeven"),
      ),
    ),
    mmxm: v.optional(v.string()),
    tradeBreakdown: v.optional(v.string()),
    risk: v.optional(v.number()),
    returnVal: v.optional(v.number()),
    body: v.optional(v.string()),
    mood: v.optional(
      v.union(
        v.literal("bullish"),
        v.literal("bearish"),
        v.literal("neutral"),
      ),
    ),
    screenshotIds: v.optional(v.array(v.id("_storage"))),
    commentsJson: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...patch }) => {
    const userId = await requireAuth(ctx);
    const entry = await ctx.db.get(id);
    if (!entry || entry.userId !== userId) {
      throw new Error("Not found");
    }
    // Filter out undefined values
    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined) {
        updates[key] = value;
      }
    }
    await ctx.db.patch(id, updates);
  },
});

export const remove = mutation({
  args: {
    id: v.id("journalEntries"),
  },
  handler: async (ctx, { id }) => {
    const userId = await requireAuth(ctx);
    const entry = await ctx.db.get(id);
    if (!entry || entry.userId !== userId) {
      throw new Error("Not found");
    }
    // Delete associated screenshot files
    for (const storageId of entry.screenshotIds) {
      await ctx.storage.delete(storageId);
    }
    await ctx.db.delete(id);
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAuth(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const getScreenshotUrl = query({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, { storageId }) => {
    await requireAuth(ctx);
    return await ctx.storage.getUrl(storageId);
  },
});
