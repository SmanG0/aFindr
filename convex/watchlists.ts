import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./lib/auth";

export const get = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    return await ctx.db
      .query("watchlists")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
  },
});

export const set = mutation({
  args: {
    symbols: v.array(v.string()),
  },
  handler: async (ctx, { symbols }) => {
    const userId = await requireAuth(ctx);
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
    symbol: v.string(),
  },
  handler: async (ctx, { symbol }) => {
    const userId = await requireAuth(ctx);
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
    symbol: v.string(),
  },
  handler: async (ctx, { symbol }) => {
    const userId = await requireAuth(ctx);
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
