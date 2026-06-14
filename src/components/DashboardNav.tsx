"use client";

import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function DashboardNav() {
  const path = usePathname();

  return (
    <nav className="bg-dark-navy-surface border-b border-subtle-blue-gray/50 px-6 py-4 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-electric-blue flex items-center justify-center shadow-md shadow-electric-blue/20 border border-electric-blue/30 group-hover:scale-[1.03] transition-transform">
            <svg className="w-4.5 h-4.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="text-lg font-bold tracking-tight font-heading text-white">
            Splitwise <span className="text-soft-teal">Smart</span>
          </span>
        </Link>
        
        <div className="flex items-center gap-6">
          <Link 
            href="/dashboard" 
            className={cn(
              "text-sm font-semibold transition-colors font-heading",
              path === "/dashboard" 
                ? "text-soft-teal" 
                : "text-brand-gray hover:text-white"
            )}
          >
            Dashboard
          </Link>
          <UserButton 
            appearance={{
              elements: {
                userButtonAvatarBox: "w-9 h-9 border border-subtle-blue-gray"
              }
            }}
          />
        </div>
      </div>
    </nav>
  );
}
