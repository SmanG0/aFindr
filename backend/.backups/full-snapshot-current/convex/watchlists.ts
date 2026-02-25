import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const get = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("watchlists")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
  },
});

export const set = mutation({
  args: {
    userId: v.id("users"),
    symbols: v.array(v.string()),
  },
  handler: async (ctx, { userId, symbols }) => {
    const existing = await ctx.db
      .query("watchlists")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        symbols,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("watchlists", {
      userId,
      symbols,
      updatedAt: Date.now(),
    });
  },
});

export const addSymbol = mutation({
  args: {
    userId: v.id("users"),
    symbol: v.string(),
  },
  handler: async (ctx, { userId, symbol }) => {
    const existing = await ctx.db
      .query("watchlists")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (existing) {
      if (!existing.symbols.includes(symbol)) {
        await ctx.db.patch(existing._id, {
          symbols: [...existing.symbols, symbol],
          updatedAt: Date.now(),
        });
      }
      return existing._id;
    }

    return await ctx.db.insert("watchlists", {
      userId,
      symbols: [symbol],
      updatedAt: Date.now(),
    });
  },
});

export const removeSymbol = mutation({
  args: {
    userId: v.id("users"),
    symbol: v.string(),
  },
  handler: async (ctx, { userId, symbol }) => {
    const existing = await ctx.db
      .query("watchlists")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        symbols: existing.symbols.filter((s) => s !== symbol),
        updatedAt: Date.now(),
      });
    }
  },
});
