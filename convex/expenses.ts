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
    // SECURITY: verify the createdBy user is a member of the group
    const membership = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_and_user", (q) =>
        q.eq("groupId", args.groupId).eq("userId", args.createdBy)
      )
      .first();
    if (!membership) {
      throw new Error("You must be a member of this group to add expenses.");
    }

    // SECURITY: sanitize description to prevent XSS if rendered as HTML elsewhere
    const description = args.description.trim();
    if (!description) throw new Error("Description cannot be empty.");

    // SECURITY: validate amount is positive for non-settlement expenses
    if (!args.isSettlement && args.amount <= 0) {
      throw new Error("Expense amount must be greater than 0.");
    }

    const { splits, ...expenseData } = args;
    const expenseId = await ctx.db.insert("expenses", {
      ...expenseData,
      description,
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
    // SECURITY: verify importedBy user is a member of the group
    const membership = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_and_user", (q) =>
        q.eq("groupId", args.groupId).eq("userId", args.importedBy)
      )
      .first();
    if (!membership) {
      throw new Error("You must be a member of this group to import expenses.");
    }

    // SECURITY: limit batch size to prevent abuse / timeouts
    if (args.expenses.length > 500) {
      throw new Error("Batch import is limited to 500 rows at a time.");
    }

    for (const expense of args.expenses) {
      const { splits, ...expenseData } = expense;

      // Store paidById only if explicitly provided — never default to importedBy
      const expenseId = await ctx.db.insert("expenses", {
        ...expenseData,
        groupId: args.groupId,
        createdBy: args.importedBy,
        createdAt: Date.now(),
        importBatchId: args.batchId,
        paidById: expenseData.paidById ?? args.importedBy, // only used for manual expenses; CSV uses paidByName
      });

      for (const split of splits) {
        await ctx.db.insert("expenseSplits", { ...split, expenseId, isPaid: false });
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
        // For CSV-imported expenses, paidByName is the source of truth.
        // Only look up the user if paidByName is not set (manual expenses).
        const paidBy = e.paidByName ? null : (e.paidById ? await ctx.db.get(e.paidById) : null);
        return { ...e, splits, paidBy };
      })
    );
    return withSplits;
  },
});


export const deleteExpense = mutation({
  args: {
    expenseId: v.id("expenses"),
    requestingUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const expense = await ctx.db.get(args.expenseId);
    if (!expense) throw new Error("Expense not found.");

    // SECURITY: verify the requesting user is a member of the expense's group
    const membership = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_and_user", (q) =>
        q.eq("groupId", expense.groupId).eq("userId", args.requestingUserId)
      )
      .first();
    if (!membership) {
      throw new Error("You must be a member of this group to delete expenses.");
    }

    const splits = await ctx.db
      .query("expenseSplits")
      .withIndex("by_expense", (q) => q.eq("expenseId", args.expenseId))
      .collect();
    await Promise.all(splits.map((s) => ctx.db.delete(s._id)));

    // Also delete associated messages
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_expense", (q) => q.eq("expenseId", args.expenseId))
      .collect();
    await Promise.all(messages.map((m) => ctx.db.delete(m._id)));

    await ctx.db.delete(args.expenseId);
  },
});
