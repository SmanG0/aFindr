import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getOrCreate = mutation({
  args: { deviceId: v.string() },
  handler: async (ctx, { deviceId }) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_deviceId", (q) => q.eq("deviceId", deviceId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { lastSeenAt: Date.now() });
      return existing._id;
    }

    const now = Date.now();
    return await ctx.db.insert("users", {
      deviceId,
      createdAt: now,
      lastSeenAt: now,
    });
  },
});

export const get = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db.get(userId);
  },
});

export const update = mutation({
  args: {
    userId: v.id("users"),
    displayName: v.optional(v.string()),
  },
  handler: async (ctx, { userId, ...fields }) => {
    await ctx.db.patch(userId, fields);
  },
});
