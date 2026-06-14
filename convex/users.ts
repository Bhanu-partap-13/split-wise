import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const createNewUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Check if user already exists
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (user !== null) {
      // If we have a new name from Clerk, update it
      const currentName = identity.name || `${identity.givenName ?? ""} ${identity.familyName ?? ""}`.trim() || "User";
      if (user.name !== currentName) {
        await ctx.db.patch(user._id, { name: currentName });
      }
      return user._id;
    }

    // Otherwise, create a new user
    const newName = identity.name || `${identity.givenName ?? ""} ${identity.familyName ?? ""}`.trim() || "User";
    return await ctx.db.insert("users", {
      name: newName,
      tokenIdentifier: identity.tokenIdentifier,
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
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
  },
});
