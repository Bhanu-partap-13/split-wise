"use client";

import { useClerk } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import {
  LayoutGrid,
  Folder,
  Settings,
  Brain,
  LifeBuoy,
  ChevronRight,
  PlusCircle,
  FolderPlus,
  LogOut,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { api } from "../../convex/_generated/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { HelpSupportDialog } from "./HelpSupportDialog";
import { ThemeToggle } from "./ThemeToggle";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

export default function DashboardSidebar() {
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();
  const { signOut } = useClerk();
  const { state, setOpen } = useSidebar();
  const isCollapsed = state === "collapsed";

  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [helpDefaultTab, setHelpDefaultTab] = useState<"ai" | "contact">("ai");

  const { convexUser, isLoaded } = useCurrentUser();
  const groups = useQuery(
    api.groups.getUserGroups,
    convexUser ? { userId: convexUser._id } : "skip"
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const groupListRef = useRef<HTMLUListElement>(null);

  // GSAP: Animate logo hover
  const handleLogoMouseEnter = () => {
    if (logoRef.current) {
      gsap.to(logoRef.current, {
        scale: 1.05,
        rotate: 3,
        duration: 0.3,
        ease: "back.out(1.7)",
      });
    }
  };

  const handleLogoMouseLeave = () => {
    if (logoRef.current) {
      gsap.to(logoRef.current, {
        scale: 1,
        rotate: 0,
        duration: 0.3,
        ease: "power2.out",
      });
    }
  };

  // GSAP: Staggered animation of group list items once loaded
  useGSAP(() => {
    if (groups && groups.length > 0 && groupListRef.current) {
      const items = groupListRef.current.querySelectorAll(".group-item");
      gsap.fromTo(
        items,
        { opacity: 0, y: 15 },
        {
          opacity: 1,
          y: 0,
          stagger: 0.05,
          duration: 0.4,
          ease: "power2.out",
        }
      );
    }
  }, [groups]);

  const isActive = (url: string) => {
    return pathname === url || pathname.startsWith(`${url}/`);
  };

  const isActiveExact = (url: string) => {
    return pathname === url;
  };

  const openHelpWithTab = (tab: "ai" | "contact") => {
    setHelpDefaultTab(tab);
    setIsHelpOpen(true);
  };

  return (
    <Sidebar collapsible="icon" className="border bg-dark-navy-surface! border-subtle-blue-gray/30 text-white">
      {/* HEADER */}
      <SidebarHeader className="h-16 justify-center flex-none border-b border-subtle-blue-gray/25 px-4">
        {isCollapsed ? (
          <div className="flex items-center justify-center w-full">
            <Link href="/dashboard" className="flex items-center justify-center">
              <div
                ref={logoRef}
                onMouseEnter={handleLogoMouseEnter}
                onMouseLeave={handleLogoMouseLeave}
                className="w-8 h-8 rounded-lg bg-electric-blue flex items-center justify-center shadow-md shadow-electric-blue/20 border border-electric-blue/30"
              >
                <svg className="w-4.5 h-4.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
            </Link>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <Link href="/dashboard" className="flex items-center gap-2 group">
              <div
                ref={logoRef}
                onMouseEnter={handleLogoMouseEnter}
                onMouseLeave={handleLogoMouseLeave}
                className="w-8 h-8 rounded-lg bg-electric-blue flex items-center justify-center shadow-md shadow-electric-blue/20 border border-electric-blue/30"
              >
                <svg className="w-4.5 h-4.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="font-bold text-base tracking-tight font-heading text-white">
                Splitwise <span className="text-soft-teal">Smart</span>
              </span>
            </Link>
            <ThemeToggle />
          </div>
        )}
      </SidebarHeader>

      {/* CONTENT */}
      <SidebarContent className="px-2 py-4 group-data-[collapsible=icon]:px-0">
        <SidebarMenu className="flex flex-col space-y-1">
          {/* Dashboard link */}
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip="Dashboard"
              isActive={isActiveExact("/dashboard")}
              className="group relative cursor-pointer"
            >
              <Link href="/dashboard" className="flex items-center gap-3 w-full text-brand-gray group-hover:text-white">
                <LayoutGrid className="h-4.5 w-4.5 shrink-0" />
                <span className="text-sm font-medium group-data-[collapsible=icon]:hidden">
                  Dashboard
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* Groups List section */}
        <div className="mt-4 flex flex-col flex-1">
          {!isCollapsed && (
            <div className="flex items-center justify-between px-3 py-1.5 mb-1 text-xs text-brand-gray/60 font-semibold uppercase tracking-wider">
              <span>My Groups</span>
              <Link href="/dashboard/groups/new" title="Create Group" className="hover:text-soft-teal transition-colors">
                <PlusCircle className="w-4 h-4" />
              </Link>
            </div>
          )}

          <SidebarMenu ref={groupListRef} className="flex flex-col space-y-1">
            {groups && groups.length > 0 ? (
              groups.map((g) => {
                if (!g) return null;
                const url = `/dashboard/groups/${g._id}`;
                const active = isActive(url);
                return (
                  <SidebarMenuItem key={g._id} className="group-item opacity-0">
                    <SidebarMenuButton
                      asChild
                      tooltip={g.name}
                      isActive={active}
                      className="group relative cursor-pointer"
                    >
                      <Link href={url} className="flex items-center gap-3 w-full text-brand-gray group-hover:text-white">
                        <Folder className="h-4.5 w-4.5 shrink-0 text-soft-teal" />
                        <span className="text-sm font-medium truncate group-data-[collapsible=icon]:hidden">
                          {g.name}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })
            ) : (
              !isCollapsed && groups !== undefined && (
                <div className="text-xs text-brand-gray/40 italic px-3 py-2">
                  No groups created.
                </div>
              )
            )}
            {groups === undefined && !isCollapsed && (
              <div className="space-y-1.5 px-3 py-1.5">
                <div className="h-6 bg-subtle-blue-gray/30 rounded animate-pulse w-full" />
                <div className="h-6 bg-subtle-blue-gray/30 rounded animate-pulse w-[80%]" />
              </div>
            )}
          </SidebarMenu>
        </div>
      </SidebarContent>

      {/* FOOTER */}
      <SidebarFooter className="border-t border-subtle-blue-gray/25 p-3 flex flex-col gap-2">
        <SidebarMenu className="flex flex-col space-y-1">
          {/* AI Features (Gemini Bot) */}
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Gemini AI Assistant"
              onClick={() => openHelpWithTab("ai")}
              className="group relative cursor-pointer text-brand-gray hover:text-white"
            >
              <div className="flex items-center gap-3 w-full">
                <Brain className="h-4.5 w-4.5 text-soft-teal shrink-0 animate-pulse" />
                <span className="text-sm font-medium group-data-[collapsible=icon]:hidden">
                  Gemini AI Assistant
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {/* Help & Support */}
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Help and Support"
              onClick={() => openHelpWithTab("contact")}
              className="group relative cursor-pointer text-brand-gray hover:text-white"
            >
              <div className="flex items-center gap-3 w-full">
                <LifeBuoy className="h-4.5 w-4.5 text-brand-gray group-hover:text-white shrink-0" />
                <span className="text-sm font-medium group-data-[collapsible=icon]:hidden">
                  Help and Support
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* User plan & profile */}
        {convexUser && (
          <div className="mt-2 group-data-[collapsible=icon]:hidden">
            <div className="flex items-center gap-3 p-2 rounded-xl border border-subtle-blue-gray/35 bg-deep-navy relative group hover:border-soft-teal/40 transition-colors">
              <Avatar className="h-7 w-7 border border-subtle-blue-gray shrink-0">
                <AvatarImage src={convexUser.avatarUrl} />
                <AvatarFallback className="text-[10px] bg-subtle-blue-gray text-white font-bold">
                  {convexUser.name ? convexUser.name.charAt(0).toUpperCase() : "?"}
                </AvatarFallback>
              </Avatar>

              <div className="flex flex-col min-w-0 flex-1 text-left">
                <span className="text-xs font-semibold truncate leading-tight text-white">
                  {convexUser.name}
                </span>
                <span className="text-[9px] text-brand-gray truncate leading-tight">
                  {convexUser.email}
                </span>
              </div>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 text-brand-gray hover:text-white hover:bg-subtle-blue-gray/20 rounded-md cursor-pointer"
                  >
                    <Settings className="h-3 w-3" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  side="right"
                  align="end"
                  className="w-48 p-1 bg-dark-navy-surface border border-subtle-blue-gray/45 shadow-xl text-white rounded-lg"
                >
                  <div className="flex flex-col gap-0.5">
                    <p className="px-2.5 py-1.5 text-[9px] font-semibold text-brand-gray uppercase tracking-wider text-left">
                      Account Options
                    </p>
                    <Separator className="mb-1 bg-subtle-blue-gray/25" />
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-2 h-8 text-xs text-red-400 hover:text-red-400 hover:bg-red-500/10 border-none cursor-pointer"
                      onClick={() => signOut({ redirectUrl: "/" })}
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>Logout</span>
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        )}
      </SidebarFooter>

      {/* Help Dialog portal */}
      <HelpSupportDialog
        open={isHelpOpen}
        onOpenChange={setIsHelpOpen}
        currentUser={convexUser}
        defaultTab={helpDefaultTab}
      />
    </Sidebar>
  );
}
