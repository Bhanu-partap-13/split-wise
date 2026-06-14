import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const record = mutation({
  args: {
    groupId: v.id("groups"),
    fromUserId: v.id("users"),
    toUserId: v.id("users"),
    amount: v.number(),
    currency: v.string(),
    note: v.optional(v.string()),
    recordedBy: v.id("users"),
  },
  handler: async (ctx, args) => {
    // SECURITY: verify the recordedBy user is a member of the group
    const membership = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_and_user", (q) =>
        q.eq("groupId", args.groupId).eq("userId", args.recordedBy)
      )
      .first();
    if (!membership) {
      throw new Error("You must be a member of this group to record settlements.");
    }

    // SECURITY: validate amount is positive
    if (args.amount <= 0) {
      throw new Error("Settlement amount must be greater than 0.");
    }

    // SECURITY: fromUser and toUser must be different
    if (args.fromUserId === args.toUserId) {
      throw new Error("Cannot settle with yourself.");
    }

    return await ctx.db.insert("settlements", { ...args, createdAt: Date.now() });
  },
});

export const getGroupSettlements = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("settlements")
      .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
      .collect();
  },
});
