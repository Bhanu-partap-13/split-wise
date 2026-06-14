"use client";

import { use, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExpenseList } from "@/components/ExpenseList";
import { BalanceSummary } from "@/components/BalanceSummary";
import { MembersList } from "@/components/MembersList";
import { CSVImportWizard } from "@/components/CSVImportWizard";
import { Id } from "../../../../../convex/_generated/dataModel";
import { ArrowLeft, Loader2, ListFilter, Wallet, FileSpreadsheet, Users } from "lucide-react";
import Link from "next/link";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

interface PageProps {
  params: Promise<{ groupId: string }>;
}

export default function GroupPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const groupId = resolvedParams.groupId as Id<"groups">;

  const group = useQuery(api.groups.getGroup, { groupId });
  const { convexUser, isLoaded } = useCurrentUser();
  const [activeTab, setActiveTab] = useState("expenses");

  const headerRef = useRef<HTMLDivElement>(null);
  const tabContentRef = useRef<HTMLDivElement>(null);

  // GSAP: Animate header components on load
  useGSAP(() => {
    if (headerRef.current) {
      const items = headerRef.current.querySelectorAll(".animate-header-item");
      gsap.fromTo(
        items,
        { opacity: 0, y: -12 },
        {
          opacity: 1,
          y: 0,
          stagger: 0.08,
          duration: 0.5,
          ease: "power2.out",
        }
      );
    }
  }, { scope: headerRef });

  // GSAP: Animate tab content transitions on selection change
  useGSAP(() => {
    if (tabContentRef.current) {
      gsap.fromTo(
        tabContentRef.current,
        { opacity: 0, y: 15, scale: 0.985 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.45,
          ease: "power2.out",
        }
      );
    }
  }, [activeTab]);

  if (!isLoaded || group === undefined) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="w-10 h-10 text-soft-teal animate-spin mb-4" />
        <p className="text-brand-gray text-sm">Loading group data...</p>
      </div>
    );
  }

  if (group === null) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
        <h3 className="text-lg font-bold text-white mb-2">Group not found</h3>
        <Link href="/dashboard" className="text-sm text-soft-teal hover:underline">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 flex-1">
      {/* Header breadcrumb & info wrapper */}
      <div ref={headerRef} className="flex flex-col gap-6 w-full">
        <Link 
          href="/dashboard" 
          className="flex items-center gap-2 text-sm text-brand-gray hover:text-white self-start transition-colors animate-header-item opacity-0"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Groups
        </Link>

        <div className="flex flex-col gap-1 border-b border-subtle-blue-gray/20 pb-6 animate-header-item opacity-0">
          <h1 className="text-3xl font-extrabold tracking-tight font-heading text-white">
            {group.name}
          </h1>
          {group.description && (
            <p className="text-brand-gray text-sm mt-1 max-w-2xl leading-relaxed">
              {group.description}
            </p>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col">
        <TabsList className="bg-dark-navy-surface border border-subtle-blue-gray/40 p-1 rounded-xl self-start flex gap-1 mb-8">
          <TabsTrigger 
            value="expenses" 
            className="data-[state=active]:bg-electric-blue data-[state=active]:text-white text-brand-gray font-semibold text-sm flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors cursor-pointer"
          >
            <ListFilter className="w-4 h-4" />
            Expenses
          </TabsTrigger>
          <TabsTrigger 
            value="balances" 
            className="data-[state=active]:bg-electric-blue data-[state=active]:text-white text-brand-gray font-semibold text-sm flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors cursor-pointer"
          >
            <Wallet className="w-4 h-4" />
            Balances
          </TabsTrigger>
          <TabsTrigger 
            value="import" 
            className="data-[state=active]:bg-electric-blue data-[state=active]:text-white text-brand-gray font-semibold text-sm flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Import CSV
          </TabsTrigger>
          <TabsTrigger 
            value="members" 
            className="data-[state=active]:bg-electric-blue data-[state=active]:text-white text-brand-gray font-semibold text-sm flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors cursor-pointer"
          >
            <Users className="w-4 h-4" />
            Members
          </TabsTrigger>
        </TabsList>

        <div ref={tabContentRef} className="focus-visible:outline-none flex-1 flex flex-col opacity-0">
          <TabsContent value="expenses" className="focus-visible:outline-none flex-1">
            {activeTab === "expenses" && <ExpenseList groupId={groupId} currentUser={convexUser} />}
          </TabsContent>
          <TabsContent value="balances" className="focus-visible:outline-none flex-1">
            {activeTab === "balances" && <BalanceSummary groupId={groupId} currentUser={convexUser} />}
          </TabsContent>
          <TabsContent value="import" className="focus-visible:outline-none flex-1">
            {activeTab === "import" && (
              <CSVImportWizard
                groupId={groupId}
                currentUser={convexUser}
                onImportComplete={() => setActiveTab("expenses")}
              />
            )}
          </TabsContent>
          <TabsContent value="members" className="focus-visible:outline-none flex-1">
            {activeTab === "members" && <MembersList groupId={groupId} currentUser={convexUser} />}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
