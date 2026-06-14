"use client";

import { use, useRef, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExpenseList } from "@/components/ExpenseList";
import { BalanceSummary } from "@/components/BalanceSummary";
import { MembersList } from "@/components/MembersList";
import { CSVImportWizard } from "@/components/CSVImportWizard";
import { Id } from "../../../../../convex/_generated/dataModel";
import { ArrowLeft, Loader2, ListFilter, Wallet, FileSpreadsheet, Users, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
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

interface PageProps {
  params: Promise<{ groupId: string }>;
}

export default function GroupPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const groupId = resolvedParams.groupId as Id<"groups">;
  const router = useRouter();

  const group = useQuery(api.groups.getGroup, { groupId });
  const { convexUser, isLoaded } = useCurrentUser();
  const deleteGroup = useMutation(api.groups.deleteGroup);
  const [activeTab, setActiveTab] = useState("expenses");
  const [isDeleting, setIsDeleting] = useState(false);

  const headerRef = useRef<HTMLDivElement>(null);
  const tabContentRef = useRef<HTMLDivElement>(null);

  const isOwner = group && convexUser && group.createdBy === convexUser._id;

  // GSAP: Animate header on load
  useGSAP(() => {
    if (headerRef.current) {
      const items = headerRef.current.querySelectorAll(".animate-header-item");
      gsap.fromTo(
        items,
        { opacity: 0, y: -10 },
        { opacity: 1, y: 0, stagger: 0.07, duration: 0.4, ease: "power2.out" }
      );
    }
  }, { scope: headerRef });

  // GSAP: Animate tab content on tab switch
  useGSAP(() => {
    if (tabContentRef.current) {
      gsap.fromTo(
        tabContentRef.current,
        { opacity: 0, y: 12, scale: 0.99 },
        { opacity: 1, y: 0, scale: 1, duration: 0.35, ease: "power2.out" }
      );
    }
  }, [activeTab]);

  const handleDeleteGroup = async () => {
    if (!convexUser) return;
    setIsDeleting(true);
    try {
      await deleteGroup({ groupId, requestingUserId: convexUser._id });
      toast.success("Group deleted successfully");
      router.push("/dashboard");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to delete group");
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isLoaded || group === undefined) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]" suppressHydrationWarning>
        <Loader2 className="w-7 h-7 text-blue-500 animate-spin mb-3" suppressHydrationWarning />
        <p className="text-muted-foreground text-sm">Loading group...</p>
      </div>
    );
  }

  if (group === null) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[400px] gap-3">
        <p className="text-[15px] font-medium text-foreground">Group not found</p>
        <Link href="/dashboard" className="text-[13px] text-blue-500 hover:underline">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div ref={headerRef} className="flex flex-col gap-1 px-6 pt-5 pb-0">
        <Link
          href="/dashboard"
          className="animate-header-item inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors mb-2 w-fit"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Dashboard
        </Link>

        <div className="animate-header-item flex items-center justify-between gap-4">
          <div className="flex flex-col gap-0.5 min-w-0">
            <h1 className="text-[20px] font-semibold tracking-tight text-foreground leading-none">
              {group.name}
            </h1>
            {group.description && (
              <p className="text-[12px] text-muted-foreground truncate max-w-lg mt-0.5">
                {group.description}
              </p>
            )}
          </div>

          {/* Delete group — owner only */}
          {isOwner && (
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <button
                    disabled={isDeleting}
                    className="h-8 px-3 rounded-lg text-[12px] font-medium text-red-500 border border-red-500/20 hover:bg-red-500/10 transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
                  />
                }
              >
                {isDeleting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                Delete Group
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-card border-border">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-foreground">Delete &quot;{group.name}&quot;?</AlertDialogTitle>
                  <AlertDialogDescription className="text-muted-foreground">
                    This will permanently delete the group and all its expenses. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteGroup}
                    className="bg-red-600 hover:bg-red-500 text-white cursor-pointer"
                  >
                    Delete Group
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Linear-style underline tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
        <div className="border-b border-border px-6 mt-4">
          <TabsList className="h-auto bg-transparent p-0 gap-0 rounded-none">
            {[
              { value: "expenses", icon: <ListFilter className="w-3.5 h-3.5" />, label: "Expenses" },
              { value: "balances", icon: <Wallet className="w-3.5 h-3.5" />, label: "Balances" },
              { value: "import", icon: <FileSpreadsheet className="w-3.5 h-3.5" />, label: "Import CSV" },
              { value: "members", icon: <Users className="w-3.5 h-3.5" />, label: "Members" },
            ].map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="relative h-9 px-4 rounded-none bg-transparent border-0 text-muted-foreground data-[state=active]:text-foreground data-[state=active]:shadow-none font-medium text-[13px] flex items-center gap-2 cursor-pointer
                  after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:rounded-full
                  data-[state=active]:after:bg-foreground data-[state=inactive]:after:bg-transparent
                  hover:text-foreground transition-colors"
              >
                {tab.icon}
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* Tab content — GSAP handles the opacity animation, no hardcoded opacity-0 */}
        <div ref={tabContentRef} className="flex-1 flex flex-col min-h-0 p-6">
          <TabsContent value="expenses" className="flex-1 mt-0 focus-visible:outline-none">
            {activeTab === "expenses" && <ExpenseList groupId={groupId} currentUser={convexUser} />}
          </TabsContent>
          <TabsContent value="balances" className="flex-1 mt-0 focus-visible:outline-none">
            {activeTab === "balances" && <BalanceSummary groupId={groupId} currentUser={convexUser} />}
          </TabsContent>
          <TabsContent value="import" className="flex-1 mt-0 focus-visible:outline-none">
            {activeTab === "import" && (
              <CSVImportWizard
                groupId={groupId}
                currentUser={convexUser}
                onImportComplete={() => setActiveTab("expenses")}
              />
            )}
          </TabsContent>
          <TabsContent value="members" className="flex-1 mt-0 focus-visible:outline-none">
            {activeTab === "members" && <MembersList groupId={groupId} currentUser={convexUser} />}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
