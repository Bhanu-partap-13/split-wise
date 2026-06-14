import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const createNewUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const clerkId = identity.subject;
    const email = identity.email || "";
    const name = identity.name || `${identity.givenName ?? ""} ${identity.familyName ?? ""}`.trim() || "User";
    const avatarUrl = identity.pictureUrl;

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .first();

    if (existing) {
      // If profile changed, update it
      if (existing.name !== name || existing.avatarUrl !== avatarUrl || existing.email !== email) {
        await ctx.db.patch(existing._id, { name, avatarUrl, email });
      }
      return existing._id;
    }

    // Otherwise, create a new user
    return await ctx.db.insert("users", {
      clerkId,
      email,
      name,
      avatarUrl,
      createdAt: Date.now(),
    });
  },
});

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }
    return await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
  },
});

export const upsertUser = mutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { name: args.name, avatarUrl: args.avatarUrl });
      return existing._id;
    }
    return await ctx.db.insert("users", { ...args, createdAt: Date.now() });
  },
});

export const getByClerkId = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();
  },
});

export const searchByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    // SECURITY: only return minimal fields needed for member lookup (name + _id)
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email.trim().toLowerCase()))
      .first();
    if (!user) return null;
    // Return only what is needed — do NOT expose clerkId or full profile
    return { _id: user._id, name: user.name, email: user.email, avatarUrl: user.avatarUrl };
  },
});

// SECURITY: getAllUsers removed — it exposed every user's email and clerkId to any
// authenticated client. Use searchByEmail for targeted lookups instead.
