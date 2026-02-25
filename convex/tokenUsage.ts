import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./lib/auth";

/** Persist token usage for a single agent response. */
export const track = mutation({
  args: {
    conversationId: v.optional(v.id("chatConversations")),
    inputTokens: v.number(),
    outputTokens: v.number(),
    estimatedCost: v.number(),
    byModelJson: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    return await ctx.db.insert("tokenUsage", {
      userId,
      conversationId: args.conversationId,
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      totalTokens: args.inputTokens + args.outputTokens,
      estimatedCost: args.estimatedCost,
      byModelJson: args.byModelJson,
      createdAt: Date.now(),
    });
  },
});

/** Get aggregated token usage for a user, optionally filtered by date range. */
export const getUserUsage = query({
  args: {
    sinceTs: v.optional(v.number()),
  },
  handler: async (ctx, { sinceTs }) => {
    const userId = await requireAuth(ctx);
    let rows;
    if (sinceTs) {
      rows = await ctx.db
        .query("tokenUsage")
        .withIndex("by_userId_createdAt", (q) =>
          q.eq("userId", userId).gte("createdAt", sinceTs),
        )
        .collect();
    } else {
      rows = await ctx.db
        .query("tokenUsage")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();
    }

    let totalInput = 0;
    let totalOutput = 0;
    let totalCost = 0;
    for (const r of rows) {
      totalInput += r.inputTokens;
      totalOutput += r.outputTokens;
      totalCost += r.estimatedCost;
    }

    return {
      totalInputTokens: totalInput,
      totalOutputTokens: totalOutput,
      totalTokens: totalInput + totalOutput,
      totalCost: Math.round(totalCost * 1_000_000) / 1_000_000,
      messageCount: rows.length,
    };
  },
});

/** Get recent token usage entries for a user (for a usage history view). */
export const getRecentUsage = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { limit }) => {
    const userId = await requireAuth(ctx);
    return await ctx.db
      .query("tokenUsage")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit ?? 50);
  },
});
