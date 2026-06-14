"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useCurrentUser() {
  const { user, isLoaded: isClerkLoaded } = useUser();
  const convexUser = useQuery(api.users.getCurrentUser);

  return {
    user,
    convexUser,
    isLoaded: isClerkLoaded && convexUser !== undefined,
  };
}
