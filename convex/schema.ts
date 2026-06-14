import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    name: v.string(),
    tokenIdentifier: v.string(), // to match with Clerk tokenIdentifier
  }).index("by_token", ["tokenIdentifier"]),
});
