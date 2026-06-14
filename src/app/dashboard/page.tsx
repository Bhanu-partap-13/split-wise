"use client";

import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Users,
  FolderPlus,
  Compass,
  ArrowRight,
  Loader2,
  Layers,
  TrendingUp,
  Trash2,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function Dashboard() {
  const { convexUser, isLoaded } = useCurrentUser();
  const router = useRouter();
  const groups = useQuery(
    api.groups.getUserGroups,
    convexUser ? { userId: convexUser._id } : "skip"
  );
  const deleteGroup = useMutation(api.groups.deleteGroup);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (groupId: Id<"groups">, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!convexUser) return;
    setDeletingId(groupId);
    try {
      await deleteGroup({ groupId, requestingUserId: convexUser._id });
      toast.success("Group deleted");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  if (!isLoaded || groups === undefined) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh]" suppressHydrationWarning>
        <Loader2 className="w-6 h-6 text-muted-foreground animate-spin mb-3" suppressHydrationWarning />
        <p className="text-[13px] text-muted-foreground">Loading workspace...</p>
      </div>
    );
  }

  const welcomeName = convexUser?.name ? convexUser.name.split(" ")[0] : "there";

  const kpis = [
    { label: "Active Groups", value: groups.length, icon: <Layers className="w-3.5 h-3.5" /> },
    { label: "Members", value: groups.reduce((a, g) => a + ((g as any)?.memberCount ?? 0), 0), icon: <Users className="w-3.5 h-3.5" /> },
    { label: "Settlements", value: "—", icon: <TrendingUp className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="flex flex-col flex-1 px-8 py-8 gap-8 w-full">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[18px] font-semibold tracking-tight text-foreground leading-snug">
            Good to see you, {welcomeName}
          </h1>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            {groups.length === 0
              ? "Create your first group to get started."
              : `${groups.length} group${groups.length === 1 ? "" : "s"} in your workspace.`}
          </p>
        </div>
        <Link
          href="/dashboard/groups/new"
          className="h-8 px-3 rounded-lg bg-foreground text-background hover:bg-foreground/90 text-[12px] font-medium flex items-center gap-1.5 transition-colors shrink-0"
        >
          <FolderPlus className="w-3.5 h-3.5" />
          New Group
        </Link>
      </div>

      {/* KPI strip — colorless icons, auto-fit columns */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="flex flex-col gap-3 px-5 py-4 rounded-lg border border-border bg-card"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">
                {kpi.label}
              </span>
              <span className="text-muted-foreground/60">{kpi.icon}</span>
            </div>
            <span className="text-[26px] font-semibold text-foreground leading-none tabular-nums">
              {kpi.value}
            </span>
          </div>
        ))}
      </div>

      {/* Groups */}
      <div className="flex flex-col gap-3 flex-1">
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] font-medium text-foreground">Your Groups</h2>
          {groups.length > 0 && (
            <Link
              href="/dashboard/groups/new"
              className="text-[12px] text-muted-foreground hover:text-foreground transition-colors"
            >
              + New group
            </Link>
          )}
        </div>

        {groups.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center flex-1 min-h-[280px] rounded-lg border border-dashed border-border gap-3">
            <div className="w-10 h-10 rounded-lg border border-border flex items-center justify-center">
              <Compass className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-[13px] font-medium text-foreground">No groups yet</p>
              <p className="text-[12px] text-muted-foreground mt-0.5 max-w-xs">
                Create a group to start splitting bills with friends.
              </p>
            </div>
            <Link
              href="/dashboard/groups/new"
              className="h-8 px-3 rounded-lg bg-foreground text-background hover:bg-foreground/90 text-[12px] font-medium flex items-center gap-1.5 transition-colors"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              Create group
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {groups.map(
              (g) =>
                g && (
                  <Link
                    key={g._id}
                    href={`/dashboard/groups/${g._id}`}
                    className="group relative flex flex-col gap-3 p-4 rounded-lg border border-border bg-card hover:bg-accent/20 transition-all cursor-pointer"
                  >
                    {/* Card header */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Colorless initial avatar */}
                        <div className="w-7 h-7 rounded-md border border-border bg-muted flex items-center justify-center shrink-0">
                          <span className="text-[12px] font-semibold text-foreground">
                            {g.name[0]?.toUpperCase()}
                          </span>
                        </div>
                        <div className="flex flex-col min-w-0">
                          <p className="text-[13px] font-medium text-foreground leading-tight truncate">
                            {g.name}
                          </p>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                            {g.currency}
                          </p>
                        </div>
                      </div>

                      {/* Right side: arrow + delete (owner only) */}
                      <div className="flex items-center gap-1 shrink-0">
                        {/* Delete — only for owner */}
                        {convexUser && g.createdBy === convexUser._id && (
                          <AlertDialog>
                            <AlertDialogTrigger
                              render={<button className="h-6 w-6 flex items-center justify-center rounded-md opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-all" />}
                              onClick={(e: React.MouseEvent) => e.preventDefault()}
                            >
                              {deletingId === g._id
                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                : <Trash2 className="w-3 h-3" />}
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete &quot;{g.name}&quot;?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This permanently deletes the group and all its expenses. Cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-red-600 hover:bg-red-500 text-white"
                                  onClick={(e: React.MouseEvent) => handleDelete(g._id, e)}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                      </div>
                    </div>

                    {/* Description */}
                    {g.description && (
                      <p className="text-[11px] text-muted-foreground line-clamp-1 leading-relaxed">
                        {g.description}
                      </p>
                    )}

                    {/* Footer */}
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70 pt-2 border-t border-border/50">
                      <Users className="w-3 h-3" />
                      <span>{(g as any)?.memberCount ?? "—"} members</span>
                    </div>
                  </Link>
                )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
