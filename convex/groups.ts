import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    createdBy: v.id("users"),
    currency: v.string(),
  },
  handler: async (ctx, args) => {
    const groupId = await ctx.db.insert("groups", { ...args, createdAt: Date.now() });
    await ctx.db.insert("groupMembers", {
      groupId,
      userId: args.createdBy,
      role: "admin",
      joinedAt: Date.now(),
    });
    return groupId;
  },
});

export const getUserGroups = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const memberships = await ctx.db
      .query("groupMembers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const groups = await Promise.all(
      memberships.map((m) => ctx.db.get(m.groupId))
    );
    return groups.filter(Boolean);
  },
});

export const getGroup = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.groupId);
  },
});

export const getGroupMembers = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    const members = await ctx.db
      .query("groupMembers")
      .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
      .collect();
    const users = await Promise.all(members.map((m) => ctx.db.get(m.userId)));
    return members.map((m, i) => ({ ...m, user: users[i] }));
  },
});

export const addMember = mutation({
  args: { groupId: v.id("groups"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_and_user", (q) =>
        q.eq("groupId", args.groupId).eq("userId", args.userId)
      )
      .first();
    if (existing) return;
    await ctx.db.insert("groupMembers", {
      ...args,
      role: "member",
      joinedAt: Date.now(),
    });
  },
});

export const removeMember = mutation({
  args: { groupId: v.id("groups"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const member = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_and_user", (q) =>
        q.eq("groupId", args.groupId).eq("userId", args.userId)
      )
      .first();
    if (member) await ctx.db.delete(member._id);
  },
});

export const deleteGroup = mutation({
  args: { groupId: v.id("groups"), requestingUserId: v.id("users") },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    if (!group) throw new Error("Group not found");
    if (group.createdBy !== args.requestingUserId) {
      throw new Error("Only the group owner can delete this group");
    }

    // Delete all groupMembers
    const members = await ctx.db
      .query("groupMembers")
      .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
      .collect();
    await Promise.all(members.map((m) => ctx.db.delete(m._id)));

    // Delete all expenses + their splits + their messages (cascade)
    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
      .collect();

    for (const expense of expenses) {
      // Delete expenseSplits
      const splits = await ctx.db
        .query("expenseSplits")
        .withIndex("by_expense", (q) => q.eq("expenseId", expense._id))
        .collect();
      await Promise.all(splits.map((s) => ctx.db.delete(s._id)));

      // Delete messages
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_expense", (q) => q.eq("expenseId", expense._id))
        .collect();
      await Promise.all(messages.map((m) => ctx.db.delete(m._id)));

      await ctx.db.delete(expense._id);
    }

    // Delete all settlements
    const settlements = await ctx.db
      .query("settlements")
      .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
      .collect();
    await Promise.all(settlements.map((s) => ctx.db.delete(s._id)));

    // Delete the group itself
    await ctx.db.delete(args.groupId);
  },
});
