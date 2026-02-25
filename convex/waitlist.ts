import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const join = mutation({
  args: {
    email: v.string(),
    referralSource: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();

    // Check for duplicate
    const existing = await ctx.db
      .query("waitlistSignups")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (existing) {
      return { success: true, alreadyJoined: true, position: existing.position };
    }

    // Get next position
    const latest = await ctx.db
      .query("waitlistSignups")
      .withIndex("by_position")
      .order("desc")
      .first();
    const position = (latest?.position ?? 0) + 1;

    await ctx.db.insert("waitlistSignups", {
      email,
      position,
      referralSource: args.referralSource,
      createdAt: Date.now(),
    });

    return { success: true, alreadyJoined: false, position };
  },
});

export const count = query({
  args: {},
  handler: async (ctx) => {
    const latest = await ctx.db
      .query("waitlistSignups")
      .withIndex("by_position")
      .order("desc")
      .first();
    return latest?.position ?? 0;
  },
});
