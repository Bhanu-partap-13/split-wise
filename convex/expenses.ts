import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    groupId: v.id("groups"),
    description: v.string(),
    amount: v.number(),
    currency: v.string(),
    paidById: v.id("users"),
    splitType: v.union(
      v.literal("equal"),
      v.literal("unequal"),
      v.literal("percentage"),
      v.literal("share")
    ),
    date: v.number(),
    notes: v.optional(v.string()),
    isSettlement: v.boolean(),
    createdBy: v.id("users"),
    splits: v.array(v.object({
      userId: v.optional(v.id("users")),
      userName: v.string(),
      amount: v.number(),
      percentage: v.optional(v.number()),
      shares: v.optional(v.number()),
    })),
  },
  handler: async (ctx, args) => {
    const { splits, ...expenseData } = args;
    const expenseId = await ctx.db.insert("expenses", {
      ...expenseData,
      createdAt: Date.now(),
    });
    await Promise.all(
      splits.map((s) =>
        ctx.db.insert("expenseSplits", { ...s, expenseId, isPaid: false })
      )
    );
    return expenseId;
  },
});

export const importBatch = mutation({
  args: {
    groupId: v.id("groups"),
    importedBy: v.id("users"),
    expenses: v.array(v.object({
      description: v.string(),
      amount: v.number(),
      currency: v.string(),
      paidById: v.optional(v.id("users")),
      paidByName: v.optional(v.string()),
      splitType: v.union(
        v.literal("equal"),
        v.literal("unequal"),
        v.literal("percentage"),
        v.literal("share")
      ),
      date: v.number(),
      notes: v.optional(v.string()),
      isSettlement: v.boolean(),
      splits: v.array(v.object({
        userId: v.optional(v.id("users")),
        userName: v.string(),
        amount: v.number(),
        percentage: v.optional(v.number()),
        shares: v.optional(v.number()),
      })),
    })),
    batchId: v.string(),
  },
  handler: async (ctx, args) => {
    // Pre-fetch all group members and their user records for name resolution
    const groupMembers = await ctx.db
      .query("groupMembers")
      .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
      .collect();
    const memberUsers = await Promise.all(
      groupMembers.map((m) => ctx.db.get(m.userId))
    );
    // Build name→userId map (case-insensitive)
    const nameToUserId = new Map<string, any>();
    memberUsers.forEach((u) => {
      if (u?.name) nameToUserId.set(u.name.toLowerCase(), u._id);
    });

    for (const expense of args.expenses) {
      const { splits, ...expenseData } = expense;

      // Resolve paidById: match paidByName to a group member, else fall back to importedBy
      let resolvedPaidById = expenseData.paidById ?? args.importedBy;
      if (!expenseData.paidById && expenseData.paidByName) {
        const matched = nameToUserId.get(expenseData.paidByName.toLowerCase());
        if (matched) resolvedPaidById = matched;
      }

      const expenseId = await ctx.db.insert("expenses", {
        ...expenseData,
        groupId: args.groupId,
        createdBy: args.importedBy,
        createdAt: Date.now(),
        importBatchId: args.batchId,
        paidById: resolvedPaidById,
      });

      // Resolve split userIds as well
      for (const split of splits) {
        let splitUserId = split.userId;
        if (!splitUserId && split.userName) {
          splitUserId = nameToUserId.get(split.userName.toLowerCase());
        }
        await ctx.db.insert("expenseSplits", {
          ...split,
          userId: splitUserId,
          expenseId,
          isPaid: false,
        });
      }
    }
  },
});

export const getGroupExpenses = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
      .order("desc")
      .collect();
    const withSplits = await Promise.all(
      expenses.map(async (e) => {
        const splits = await ctx.db
          .query("expenseSplits")
          .withIndex("by_expense", (q) => q.eq("expenseId", e._id))
          .collect();
        const paidBy = await ctx.db.get(e.paidById);
        return { ...e, splits, paidBy };
      })
    );
    return withSplits;
  },
});

export const deleteExpense = mutation({
  args: { expenseId: v.id("expenses") },
  handler: async (ctx, args) => {
    const splits = await ctx.db
      .query("expenseSplits")
      .withIndex("by_expense", (q) => q.eq("expenseId", args.expenseId))
      .collect();
    await Promise.all(splits.map((s) => ctx.db.delete(s._id)));
    await ctx.db.delete(args.expenseId);
  },
});
