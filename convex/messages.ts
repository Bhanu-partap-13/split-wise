import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const send = mutation({
  args: {
    expenseId: v.id("expenses"),
    userId: v.id("users"),
    userName: v.string(),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    // SECURITY: verify the expense exists
    const expense = await ctx.db.get(args.expenseId);
    if (!expense) throw new Error("Expense not found.");

    // SECURITY: verify the sender is a member of the expense's group
    const membership = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_and_user", (q) =>
        q.eq("groupId", expense.groupId).eq("userId", args.userId)
      )
      .first();
    if (!membership) {
      throw new Error("You must be a member of this group to send messages.");
    }

    // SECURITY: enforce message length limit
    const text = args.text.trim();
    if (!text) throw new Error("Message cannot be empty.");
    if (text.length > 2000) throw new Error("Message cannot exceed 2000 characters.");

    return await ctx.db.insert("messages", {
      expenseId: args.expenseId,
      userId: args.userId,
      userName: args.userName,
      text,
      createdAt: Date.now(),
    });
  },
});

export const getByExpense = query({
  args: { expenseId: v.id("expenses") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_expense", (q) => q.eq("expenseId", args.expenseId))
      .order("asc")
      .collect();
  },
});
