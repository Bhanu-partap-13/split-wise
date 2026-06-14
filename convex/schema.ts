import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    avatarUrl: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_clerk_id", ["clerkId"]).index("by_email", ["email"]),

  groups: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    createdBy: v.id("users"),
    createdAt: v.number(),
    currency: v.string(), // default "INR"
  }),

  groupMembers: defineTable({
    groupId: v.id("groups"),
    userId: v.id("users"),
    role: v.union(v.literal("admin"), v.literal("member")),
    joinedAt: v.number(),
    nickname: v.optional(v.string()), // for external people like "Dev's friend Kabir"
  })
    .index("by_group", ["groupId"])
    .index("by_user", ["userId"])
    .index("by_group_and_user", ["groupId", "userId"]),

  expenses: defineTable({
    groupId: v.id("groups"),
    description: v.string(),
    amount: v.number(),
    currency: v.string(),
    paidById: v.id("users"),
    paidByName: v.optional(v.string()), // fallback for imported data
    splitType: v.union(
      v.literal("equal"),
      v.literal("unequal"),
      v.literal("percentage"),
      v.literal("share")
    ),
    date: v.number(), // Unix timestamp
    notes: v.optional(v.string()),
    isSettlement: v.boolean(),
    createdBy: v.id("users"),
    createdAt: v.number(),
    importBatchId: v.optional(v.string()), // to group imported expenses
  })
    .index("by_group", ["groupId"])
    .index("by_paid_by", ["paidById"])
    .index("by_import_batch", ["importBatchId"]),

  expenseSplits: defineTable({
    expenseId: v.id("expenses"),
    userId: v.optional(v.id("users")),
    userName: v.string(), // always store name for display
    amount: v.number(), // actual amount owed
    percentage: v.optional(v.number()),
    shares: v.optional(v.number()),
    isPaid: v.boolean(),
  })
    .index("by_expense", ["expenseId"])
    .index("by_user", ["userId"]),

  settlements: defineTable({
    groupId: v.id("groups"),
    fromUserId: v.id("users"),
    toUserId: v.id("users"),
    amount: v.number(),
    currency: v.string(),
    note: v.optional(v.string()),
    recordedBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_group", ["groupId"])
    .index("by_from_user", ["fromUserId"])
    .index("by_to_user", ["toUserId"]),

  messages: defineTable({
    expenseId: v.id("expenses"),
    userId: v.id("users"),
    userName: v.string(),
    text: v.string(),
    createdAt: v.number(),
  })
    .index("by_expense", ["expenseId"]),

  importBatches: defineTable({
    groupId: v.id("groups"),
    uploadedBy: v.id("users"),
    fileName: v.string(),
    totalRows: v.number(),
    importedRows: v.number(),
    skippedRows: v.number(),
    issues: v.array(v.object({
      row: v.number(),
      type: v.string(),
      message: v.string(),
      severity: v.union(v.literal("error"), v.literal("warning")),
    })),
    status: v.union(v.literal("pending"), v.literal("reviewed"), v.literal("imported")),
    createdAt: v.number(),
  }).index("by_group", ["groupId"]),
});
