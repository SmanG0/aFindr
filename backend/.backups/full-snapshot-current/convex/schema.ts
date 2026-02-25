import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ── Users (device-based identity for now) ──────────────────────────
  users: defineTable({
    deviceId: v.string(),
    displayName: v.optional(v.string()),
    createdAt: v.number(),
    lastSeenAt: v.number(),
  }).index("by_deviceId", ["deviceId"]),

  // ── Watchlists ─────────────────────────────────────────────────────
  watchlists: defineTable({
    userId: v.id("users"),
    symbols: v.array(v.string()),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),

  // ── Per-ticker thesis / sentiment ──────────────────────────────────
  tickerTheses: defineTable({
    userId: v.id("users"),
    ticker: v.string(),
    sentiment: v.union(
      v.literal("bullish"),
      v.literal("bearish"),
      v.literal("neutral"),
    ),
    thesis: v.string(),
    targetPrice: v.optional(v.number()),
    timeframe: v.optional(v.string()),
    catalysts: v.array(v.string()),
    risks: v.array(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_ticker", ["userId", "ticker"]),

  // ── User settings ──────────────────────────────────────────────────
  userSettings: defineTable({
    userId: v.id("users"),
    // Appearance
    theme: v.string(),
    // Broker & Connection
    broker: v.string(),
    brokerAccountId: v.string(),
    fundingMethod: v.string(),
    // Account
    currency: v.string(),
    language: v.string(),
    marketRegion: v.string(),
    // Trading
    oneClickTrading: v.boolean(),
    tradeExecutionSound: v.boolean(),
    showBuySellButtons: v.boolean(),
    showPositionsOnChart: v.boolean(),
    reversePositionButton: v.boolean(),
    showPnlOnChart: v.boolean(),
    defaultOrderType: v.string(),
    defaultLotSize: v.number(),
    // Notifications
    showNotifications: v.boolean(),
    notificationDuration: v.number(),
    pushNotifications: v.boolean(),
    smsAlerts: v.boolean(),
    smsPhone: v.string(),
    // Display
    showTradeHistoryOnChart: v.boolean(),
    bigLotThreshold: v.number(),
    compactMode: v.boolean(),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),

  // ── API keys (encrypted) ──────────────────────────────────────────
  apiKeys: defineTable({
    userId: v.id("users"),
    provider: v.string(),
    encryptedKey: v.string(),
    label: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_provider", ["userId", "provider"]),

  // ── Chat conversations ─────────────────────────────────────────────
  chatConversations: defineTable({
    userId: v.id("users"),
    title: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_userId_updatedAt", ["userId", "updatedAt"]),

  // ── Chat messages ──────────────────────────────────────────────────
  chatMessages: defineTable({
    conversationId: v.id("chatConversations"),
    role: v.union(
      v.literal("user"),
      v.literal("assistant"),
      v.literal("system"),
      v.literal("tool"),
    ),
    content: v.string(),
    toolResultsJson: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_conversationId", ["conversationId", "createdAt"]),

  // ── Open positions ─────────────────────────────────────────────────
  positions: defineTable({
    userId: v.id("users"),
    positionId: v.string(),
    symbol: v.string(),
    side: v.union(v.literal("long"), v.literal("short")),
    size: v.number(),
    entryPrice: v.number(),
    entryTime: v.number(),
    stopLoss: v.optional(v.number()),
    takeProfit: v.optional(v.number()),
    commission: v.number(),
    unrealizedPnl: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_symbol", ["userId", "symbol"]),

  // ── Closed trades ──────────────────────────────────────────────────
  trades: defineTable({
    userId: v.id("users"),
    tradeId: v.string(),
    symbol: v.string(),
    side: v.union(v.literal("long"), v.literal("short")),
    size: v.number(),
    entryPrice: v.number(),
    exitPrice: v.number(),
    entryTime: v.number(),
    exitTime: v.number(),
    stopLoss: v.optional(v.number()),
    takeProfit: v.optional(v.number()),
    pnl: v.number(),
    pnlPoints: v.number(),
    commission: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_exitTime", ["userId", "exitTime"])
    .index("by_userId_symbol", ["userId", "symbol"]),

  // ── Portfolio holdings (real, persistent) ─────────────────────────
  holdings: defineTable({
    userId: v.id("users"),
    symbol: v.string(),
    shares: v.number(),
    avgCostBasis: v.number(),
    addedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_symbol", ["userId", "symbol"]),

  // ── Backtest runs ──────────────────────────────────────────────────
  backtestRuns: defineTable({
    userId: v.id("users"),
    name: v.string(),
    symbol: v.string(),
    strategyName: v.string(),
    period: v.string(),
    initialBalance: v.number(),
    commission: v.number(),
    metrics: v.object({
      totalTrades: v.number(),
      winRate: v.number(),
      profitFactor: v.number(),
      maxDrawdown: v.number(),
      sharpeRatio: v.number(),
      netPnl: v.number(),
      avgWin: v.number(),
      avgLoss: v.number(),
      finalBalance: v.number(),
    }),
    tradesJson: v.string(),
    equityCurveJson: v.string(),
    parametersJson: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_createdAt", ["userId", "createdAt"]),

  // ── Chart drawings (per symbol) ────────────────────────────────────
  chartDrawings: defineTable({
    userId: v.id("users"),
    symbol: v.string(),
    drawingsJson: v.string(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_symbol", ["userId", "symbol"]),

  // ── Chart scripts (custom overlays) ────────────────────────────────
  chartScripts: defineTable({
    userId: v.id("users"),
    scriptId: v.string(),
    name: v.string(),
    symbol: v.optional(v.string()),
    visible: v.boolean(),
    elementsJson: v.string(),
    generatorsJson: v.string(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_scriptId", ["userId", "scriptId"]),

  // ── Alerts (user-defined price/news alerts) ──────────────────────
  alerts: defineTable({
    userId: v.id("users"),
    type: v.union(v.literal("price"), v.literal("news")),
    symbol: v.string(),
    // Price alert fields
    condition: v.optional(
      v.union(
        v.literal("above"),
        v.literal("below"),
        v.literal("crosses_above"),
        v.literal("crosses_below"),
      ),
    ),
    targetPrice: v.optional(v.number()),
    // News alert fields
    keywords: v.optional(v.array(v.string())),
    // State
    active: v.boolean(),
    lastTriggeredAt: v.optional(v.number()),
    lastCheckedPrice: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_active", ["active"]),

  // ── Notifications ────────────────────────────────────────────────
  notifications: defineTable({
    userId: v.id("users"),
    alertId: v.optional(v.id("alerts")),
    type: v.union(
      v.literal("price_alert"),
      v.literal("news_alert"),
      v.literal("system"),
    ),
    title: v.string(),
    body: v.string(),
    read: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_userId_createdAt", ["userId", "createdAt"])
    .index("by_userId_read", ["userId", "read"]),

  // ── User memory (AI profile, one per user) ───────────────────────
  userMemory: defineTable({
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
  }).index("by_userId", ["userId"]),
});
