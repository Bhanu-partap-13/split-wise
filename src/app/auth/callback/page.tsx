"use client";

import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useStoreUser } from "@/hooks/useStoreUser";
import { api } from "../../../../convex/_generated/api";

export default function AuthCallback() {
  const { isAuthenticated, isLoading: isStoreLoading } = useStoreUser();
  const router = useRouter();
  const user = useQuery(api.users.getCurrentUser);
  const [status, setStatus] = useState("Checking auth-token...");

  useEffect(() => {
    if (isStoreLoading) return;

    if (!isAuthenticated) {
      router.push("/login");
      return;
    }

    if (user === undefined) return;

    const handleRedirect = async () => {
      setStatus("Creating profile...");
      setTimeout(() => {
        setStatus("Redirecting to dashboard...");
        router.push("/");
        router.refresh();
      }, 800);
    };

    handleRedirect();
  }, [isAuthenticated, isStoreLoading, user, router]);

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-deep-navy font-sans text-brand-white">
      <div className="flex flex-col items-center gap-6 max-w-sm text-center">
        {/* Animated Loading Ring */}
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-4 border-subtle-blue-gray" />
          <div className="absolute inset-0 rounded-full border-4 border-t-electric-blue border-r-soft-teal animate-spin" />
        </div>
        
        <div className="space-y-2">
          <h3 className="text-xl font-bold font-heading text-white">Welcome Aboard</h3>
          <p className="text-sm text-brand-gray animate-pulse">{status}</p>
        </div>
      </div>
    </div>
  );
}
