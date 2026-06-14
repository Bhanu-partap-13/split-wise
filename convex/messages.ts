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
    return await ctx.db.insert("messages", { ...args, createdAt: Date.now() });
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
