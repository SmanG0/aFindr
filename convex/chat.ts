import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./lib/auth";

export const listConversations = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    return await ctx.db
      .query("chatConversations")
      .withIndex("by_userId_updatedAt", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const createConversation = mutation({
  args: {
    title: v.string(),
  },
  handler: async (ctx, { title }) => {
    const userId = await requireAuth(ctx);
    const now = Date.now();
    return await ctx.db.insert("chatConversations", {
      userId,
      title,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateConversationTitle = mutation({
  args: {
    conversationId: v.id("chatConversations"),
    title: v.string(),
  },
  handler: async (ctx, { conversationId, title }) => {
    const userId = await requireAuth(ctx);
    const conversation = await ctx.db.get(conversationId);
    if (!conversation || conversation.userId !== userId) {
      throw new Error("Conversation not found");
    }
    await ctx.db.patch(conversationId, {
      title,
      updatedAt: Date.now(),
    });
  },
});

export const deleteConversation = mutation({
  args: { conversationId: v.id("chatConversations") },
  handler: async (ctx, { conversationId }) => {
    const userId = await requireAuth(ctx);
    const conversation = await ctx.db.get(conversationId);
    if (!conversation || conversation.userId !== userId) {
      throw new Error("Conversation not found");
    }
    // Delete all messages in the conversation first
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_conversationId", (q) =>
        q.eq("conversationId", conversationId),
      )
      .collect();

    for (const msg of messages) {
      await ctx.db.delete(msg._id);
    }

    await ctx.db.delete(conversationId);
  },
});

export const listMessages = query({
  args: { conversationId: v.id("chatConversations") },
  handler: async (ctx, { conversationId }) => {
    const userId = await requireAuth(ctx);
    const conversation = await ctx.db.get(conversationId);
    if (!conversation || conversation.userId !== userId) {
      throw new Error("Conversation not found");
    }
    return await ctx.db
      .query("chatMessages")
      .withIndex("by_conversationId", (q) =>
        q.eq("conversationId", conversationId),
      )
      .order("asc")
      .collect();
  },
});

export const addMessage = mutation({
  args: {
    conversationId: v.id("chatConversations"),
    role: v.union(
      v.literal("user"),
      v.literal("assistant"),
      v.literal("system"),
      v.literal("tool"),
    ),
    content: v.string(),
    toolResultsJson: v.optional(v.string()),
  },
  handler: async (ctx, { conversationId, role, content, toolResultsJson }) => {
    const userId = await requireAuth(ctx);
    const conversation = await ctx.db.get(conversationId);
    if (!conversation || conversation.userId !== userId) {
      throw new Error("Conversation not found");
    }
    const now = Date.now();

    // Update conversation's updatedAt
    await ctx.db.patch(conversationId, { updatedAt: now });

    return await ctx.db.insert("chatMessages", {
      conversationId,
      role,
      content,
      toolResultsJson,
      createdAt: now,
    });
  },
});
