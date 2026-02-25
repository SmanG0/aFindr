import { query, mutation, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { requireAuth } from "./lib/auth";

// ─── Public Queries ───

export const getProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    return await ctx.db
      .query("userMemory")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
  },
});

// ─── Trigger a rebuild (called from frontend or on demand) ───

export const triggerRebuild = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    await ctx.scheduler.runAfter(0, internal.memory.rebuildProfile, { userId });
  },
});

// ─── Add a single insight from a chat session ───

export const addInsight = internalMutation({
  args: {
    userId: v.id("users"),
    insight: v.string(),
  },
  handler: async (ctx, { userId, insight }) => {
    const existing = await ctx.db
      .query("userMemory")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (existing) {
      // Keep last 20 insights
      const insights = [...existing.conversationInsights, insight].slice(-20);
      await ctx.db.patch(existing._id, { conversationInsights: insights });
    }
    // If no memory profile yet, insights will be captured on next rebuild
  },
});

// ─── Rebuild a single user's memory profile ───

export const rebuildProfile = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    // 1. Gather user data
    const [watchlist, theses, trades, positions, settings, conversations] =
      await Promise.all([
        ctx.runQuery(internal.memory.gatherWatchlist, { userId }),
        ctx.runQuery(internal.memory.gatherTheses, { userId }),
        ctx.runQuery(internal.memory.gatherTrades, { userId }),
        ctx.runQuery(internal.memory.gatherPositions, { userId }),
        ctx.runQuery(internal.memory.gatherSettings, { userId }),
        ctx.runQuery(internal.memory.gatherRecentConversations, { userId }),
      ]);

    // 2. Compute favorite symbols (by trade frequency + watchlist)
    const symbolCounts: Record<string, number> = {};
    for (const t of trades) {
      symbolCounts[t.symbol] = (symbolCounts[t.symbol] || 0) + 1;
    }
    for (const s of (watchlist?.symbols ?? [])) {
      symbolCounts[s] = (symbolCounts[s] || 0) + 2; // watchlist items get a boost
    }
    const favoriteSymbols = Object.entries(symbolCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([sym]) => sym);

    // 3. Compute trading stats
    const totalTrades = trades.length;
    const winners = trades.filter((t) => t.pnl > 0);
    const losers = trades.filter((t) => t.pnl < 0);
    const winRate = totalTrades > 0 ? (winners.length / totalTrades) * 100 : 0;
    const avgHoldTime =
      totalTrades > 0
        ? trades.reduce((sum, t) => sum + (t.exitTime - t.entryTime), 0) /
          totalTrades /
          3600000 // hours
        : 0;

    // 4. Derive trading style
    let tradingStyle = "Unknown";
    if (avgHoldTime < 1) tradingStyle = "Scalper (sub-hour holds)";
    else if (avgHoldTime < 24) tradingStyle = "Day trader";
    else if (avgHoldTime < 168) tradingStyle = "Swing trader";
    else tradingStyle = "Position trader";

    const longCount = trades.filter((t) => t.side === "long").length;
    const shortCount = trades.filter((t) => t.side === "short").length;
    if (longCount > shortCount * 2) tradingStyle += ", long-biased";
    else if (shortCount > longCount * 2) tradingStyle += ", short-biased";

    // 5. Derive strengths and weaknesses
    const strengths: string[] = [];
    const weaknesses: string[] = [];

    if (winRate > 55) strengths.push(`Good win rate (${winRate.toFixed(0)}%)`);
    if (winRate < 40 && totalTrades > 10) weaknesses.push(`Low win rate (${winRate.toFixed(0)}%)`);

    const avgWin = winners.length > 0
      ? winners.reduce((s, t) => s + t.pnl, 0) / winners.length
      : 0;
    const avgLoss = losers.length > 0
      ? Math.abs(losers.reduce((s, t) => s + t.pnl, 0) / losers.length)
      : 0;
    if (avgWin > avgLoss * 1.5) strengths.push("Good risk/reward ratio");
    if (avgLoss > avgWin * 2 && totalTrades > 10) weaknesses.push("Losses larger than wins on average");

    // Risk profile from settings
    const riskProfile = settings?.oneClickTrading
      ? "Aggressive (one-click trading enabled)"
      : "Moderate";

    // 6. Recent activity summary
    const now = Date.now();
    const weekAgo = now - 7 * 86400000;
    const recentTrades = trades.filter((t) => t.exitTime > weekAgo);
    const recentTheses = theses.filter((t) => t.updatedAt > weekAgo);
    const openPositionSymbols = positions.map((p) => `${p.symbol} (${p.side})`);

    const recentActivity = JSON.stringify({
      tradesLast7d: recentTrades.length,
      openPositions: openPositionSymbols,
      recentTheses: recentTheses.map((t) => `${t.ticker}: ${t.sentiment}`),
      watchlistSize: watchlist?.symbols?.length ?? 0,
    });

    // 7. Gather existing conversation insights
    const existingMemory = await ctx.runQuery(internal.memory.getProfileInternal, { userId });
    const conversationInsights = existingMemory?.conversationInsights ?? [];

    // 8. Build the profile summary (pre-formatted for system prompt injection)
    const lines: string[] = [];
    lines.push(`Trading Style: ${tradingStyle}`);
    if (favoriteSymbols.length > 0) lines.push(`Favorite Symbols: ${favoriteSymbols.join(", ")}`);
    lines.push(`Risk Profile: ${riskProfile}`);
    if (totalTrades > 0) {
      lines.push(`Track Record: ${totalTrades} trades, ${winRate.toFixed(0)}% win rate, avg hold ${avgHoldTime.toFixed(1)}h`);
    }
    if (strengths.length > 0) lines.push(`Strengths: ${strengths.join("; ")}`);
    if (weaknesses.length > 0) lines.push(`Areas to improve: ${weaknesses.join("; ")}`);
    if (openPositionSymbols.length > 0) lines.push(`Open Positions: ${openPositionSymbols.join(", ")}`);
    if (theses.length > 0) {
      lines.push(`Active Theses: ${theses.slice(0, 5).map((t) => `${t.ticker} (${t.sentiment})`).join(", ")}`);
    }
    if (conversationInsights.length > 0) {
      lines.push(`Key Insights: ${conversationInsights.slice(-5).join("; ")}`);
    }
    if (settings?.marketRegion) lines.push(`Market Region: ${settings.marketRegion}`);
    if (settings?.currency) lines.push(`Currency: ${settings.currency}`);

    const profileSummary = lines.join("\n");

    // 9. Upsert the memory doc
    await ctx.runMutation(internal.memory.upsertMemory, {
      userId,
      tradingStyle,
      favoriteSymbols,
      riskProfile,
      strengths,
      weaknesses,
      recentActivity,
      conversationInsights,
      profileSummary,
      lastRebuiltAt: Date.now(),
      version: (existingMemory?.version ?? 0) + 1,
    });
  },
});

// ─── Rebuild all active users (called by cron) ───

export const rebuildAllProfiles = internalAction({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.runQuery(internal.memory.getAllActiveUsers);
    for (const user of users) {
      await ctx.scheduler.runAfter(0, internal.memory.rebuildProfile, {
        userId: user._id,
      });
    }
  },
});

// ─── Internal queries for data gathering ───

export const gatherWatchlist = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("watchlists")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
  },
});

export const gatherTheses = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("tickerTheses")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const gatherTrades = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    // Last 50 trades
    return await ctx.db
      .query("trades")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .order("desc")
      .take(50);
  },
});

export const gatherPositions = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("positions")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const gatherSettings = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("userSettings")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
  },
});

export const gatherRecentConversations = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("chatConversations")
      .withIndex("by_userId_updatedAt", (q) => q.eq("userId", userId))
      .order("desc")
      .take(5);
  },
});

export const getProfileInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("userMemory")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
  },
});

export const getAllActiveUsers = internalQuery({
  args: {},
  handler: async (ctx) => {
    // Get users who were active in the last 30 days
    const cutoff = Date.now() - 30 * 86400000;
    const allUsers = await ctx.db.query("users").collect();
    return allUsers.filter((u) => (u as Record<string, unknown>).lastSeenAt !== undefined && Number((u as Record<string, unknown>).lastSeenAt) > cutoff);
  },
});

export const upsertMemory = internalMutation({
  args: {
    userId: v.id("users"),
    tradingStyle: v.optional(v.string()),
    favoriteSymbols: v.array(v.string()),
    riskProfile: v.optional(v.string()),
    strengths: v.array(v.string()),
    weaknesses: v.array(v.string()),
    recentActivity: v.string(),
    conversationInsights: v.array(v.string()),
    profileSummary: v.string(),
    lastRebuiltAt: v.number(),
    version: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("userMemory")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        tradingStyle: args.tradingStyle,
        favoriteSymbols: args.favoriteSymbols,
        riskProfile: args.riskProfile,
        strengths: args.strengths,
        weaknesses: args.weaknesses,
        recentActivity: args.recentActivity,
        conversationInsights: args.conversationInsights,
        profileSummary: args.profileSummary,
        lastRebuiltAt: args.lastRebuiltAt,
        version: args.version,
      });
      return existing._id;
    }

    return await ctx.db.insert("userMemory", {
      userId: args.userId,
      tradingStyle: args.tradingStyle,
      favoriteSymbols: args.favoriteSymbols,
      riskProfile: args.riskProfile,
      strengths: args.strengths,
      weaknesses: args.weaknesses,
      recentActivity: args.recentActivity,
      conversationInsights: args.conversationInsights,
      profileSummary: args.profileSummary,
      lastRebuiltAt: args.lastRebuiltAt,
      version: args.version,
    });
  },
});
