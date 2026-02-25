import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./lib/auth";

// -- Drawings -----------------------------------------------------------------

export const listDrawings = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    return await ctx.db
      .query("chartDrawings")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const getDrawings = query({
  args: {
    symbol: v.string(),
  },
  handler: async (ctx, { symbol }) => {
    const userId = await requireAuth(ctx);
    return await ctx.db
      .query("chartDrawings")
      .withIndex("by_userId_symbol", (q) =>
        q.eq("userId", userId).eq("symbol", symbol),
      )
      .unique();
  },
});

export const saveDrawings = mutation({
  args: {
    symbol: v.string(),
    drawingsJson: v.string(),
  },
  handler: async (ctx, { symbol, drawingsJson }) => {
    const userId = await requireAuth(ctx);
    const existing = await ctx.db
      .query("chartDrawings")
      .withIndex("by_userId_symbol", (q) =>
        q.eq("userId", userId).eq("symbol", symbol),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        drawingsJson,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("chartDrawings", {
      userId,
      symbol,
      drawingsJson,
      updatedAt: Date.now(),
    });
  },
});

// -- Scripts ------------------------------------------------------------------

export const listScripts = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    return await ctx.db
      .query("chartScripts")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const upsertScript = mutation({
  args: {
    scriptId: v.string(),
    name: v.string(),
    symbol: v.optional(v.string()),
    visible: v.boolean(),
    elementsJson: v.string(),
    generatorsJson: v.string(),
  },
  handler: async (ctx, { scriptId, ...data }) => {
    const userId = await requireAuth(ctx);
    const existing = await ctx.db
      .query("chartScripts")
      .withIndex("by_userId_scriptId", (q) =>
        q.eq("userId", userId).eq("scriptId", scriptId),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...data,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("chartScripts", {
      userId,
      scriptId,
      ...data,
      updatedAt: Date.now(),
    });
  },
});

export const removeScript = mutation({
  args: {
    scriptId: v.string(),
  },
  handler: async (ctx, { scriptId }) => {
    const userId = await requireAuth(ctx);
    const existing = await ctx.db
      .query("chartScripts")
      .withIndex("by_userId_scriptId", (q) =>
        q.eq("userId", userId).eq("scriptId", scriptId),
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});
