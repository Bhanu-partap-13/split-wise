"use client";

import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Users, FolderPlus, Compass, ArrowRight, Loader2 } from "lucide-react";

export default function Dashboard() {
  const { convexUser, isLoaded } = useCurrentUser();
  const groups = useQuery(
    api.groups.getUserGroups,
    convexUser ? { userId: convexUser._id } : "skip"
  );

  if (!isLoaded || groups === undefined) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="w-10 h-10 text-soft-teal animate-spin mb-4" />
        <p className="text-brand-gray text-sm">Loading dashboard details...</p>
      </div>
    );
  }

  const welcomeName = convexUser?.name ? convexUser.name.split(" ")[0] : "User";

  return (
    <div className="flex flex-col gap-8 flex-1">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight font-heading text-white">
            Welcome back, {welcomeName}!
          </h1>
          <p className="text-brand-gray mt-1 text-sm">
            Here&apos;s an overview of your shared expense groups and balances.
          </p>
        </div>
        <Link href="/dashboard/groups/new">
          <Button className="bg-electric-blue hover:bg-electric-blue/80 text-white font-semibold flex items-center gap-2 shadow-lg shadow-electric-blue/20">
            <FolderPlus className="w-4 h-4" />
            New Group
          </Button>
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-dark-navy-surface border-subtle-blue-gray/50 text-white shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold tracking-wider uppercase text-brand-gray">
              Active Groups
            </CardTitle>
            <Users className="w-4 h-4 text-soft-teal" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-heading">{groups?.length || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Group List Section */}
      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-bold text-white font-heading">Your Groups</h2>
        
        {!groups || groups.length === 0 ? (
          <Card className="bg-dark-navy-surface border-subtle-blue-gray/50 border-dashed text-center py-20">
            <CardContent className="flex flex-col items-center max-w-sm mx-auto">
              <div className="w-16 h-16 rounded-full bg-soft-teal/10 border border-soft-teal/20 flex items-center justify-center text-soft-teal mb-6">
                <Compass className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2 font-heading">No groups found</h3>
              <p className="text-brand-gray text-sm mb-8">
                Create a new group to start splitting bills and tracking settlements with friends.
              </p>
              <Link href="/dashboard/groups/new">
                <Button className="bg-soft-teal hover:bg-soft-teal/80 text-deep-navy font-bold flex items-center gap-2 shadow-lg shadow-soft-teal/15">
                  Create your first group
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groups.map((g) => g && (
              <Link key={g._id} href={`/dashboard/groups/${g._id}`}>
                <Card className="bg-dark-navy-surface border-subtle-blue-gray/40 hover:border-soft-teal/30 transition-all cursor-pointer group flex flex-col justify-between h-full hover:shadow-lg hover:shadow-soft-teal/5">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-lg font-bold text-white font-heading group-hover:text-soft-teal transition-colors">
                        {g.name}
                      </CardTitle>
                      <ArrowRight className="w-4 h-4 text-brand-gray group-hover:translate-x-1 group-hover:text-soft-teal transition-all shrink-0 mt-1" />
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col justify-between">
                    <p className="text-sm text-brand-gray line-clamp-2 leading-relaxed">
                      {g.description || "No description provided."}
                    </p>
                    <div className="flex items-center justify-between border-t border-subtle-blue-gray/20 pt-4 mt-6">
                      <span className="text-xs text-brand-gray/60 font-semibold tracking-wider uppercase">
                        Currency
                      </span>
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded bg-subtle-blue-gray/50 text-white border border-subtle-blue-gray">
                        {g.currency}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
