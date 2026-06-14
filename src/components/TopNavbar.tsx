"use client";

import { useSidebar } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useClerk } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { PanelLeft, ChevronRight, LogOut, Settings } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";

function useBreadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  const crumbs: { label: string; href: string }[] = [];

  segments.forEach((seg, i) => {
    const href = "/" + segments.slice(0, i + 1).join("/");
    const isId = seg.length > 20; // Convex IDs are long strings

    if (seg === "dashboard") crumbs.push({ label: "Dashboard", href });
    else if (seg === "groups") return; // skip the "groups" segment
    else if (seg === "new") crumbs.push({ label: "New Group", href });
    else if (isId) crumbs.push({ label: "Group", href }); // will be replaced by actual name
    else crumbs.push({ label: seg.charAt(0).toUpperCase() + seg.slice(1), href });
  });

  return crumbs;
}

export function TopNavbar() {
  const { toggleSidebar } = useSidebar();
  const { convexUser } = useCurrentUser();
  const { signOut } = useClerk();
  const crumbs = useBreadcrumbs();

  return (
    <header className="h-12 flex-none flex items-center justify-between px-4 border-b border-border bg-background/90 backdrop-blur-sm fixed top-0 left-0 right-0 z-30">
      {/* Left: sidebar toggle + breadcrumb */}
      <div className="flex items-center gap-2">
        <button
          onClick={toggleSidebar}
          className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label="Toggle sidebar"
        >
          <PanelLeft className="w-4 h-4" />
        </button>

        <nav className="flex items-center gap-1 text-[13px]" aria-label="Breadcrumb">
          {crumbs.map((crumb, i) => (
            <span key={crumb.href} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40" />}
              {i === crumbs.length - 1 ? (
                <span className="text-foreground font-medium">{crumb.label}</span>
              ) : (
                <Link
                  href={crumb.href}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {crumb.label}
                </Link>
              )}
            </span>
          ))}
        </nav>
      </div>

      {/* Right: theme toggle + user */}
      <div className="flex items-center gap-2">
        <ThemeToggle />

        {convexUser && (
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-2 h-7 pl-1 pr-2.5 rounded-full hover:bg-accent transition-colors cursor-pointer">
                <Avatar className="h-5 w-5">
                  <AvatarImage src={convexUser.avatarUrl} />
                  <AvatarFallback className="text-[9px] font-semibold bg-blue-600 text-white">
                    {convexUser.name?.[0]?.toUpperCase() ?? "?"}
                  </AvatarFallback>
                </Avatar>
                <span className="text-[12px] font-medium text-foreground leading-none">
                  {convexUser.name?.split(" ")[0]}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-52 p-1 rounded-lg shadow-lg border border-border bg-popover"
            >
              <div className="px-2.5 py-2 flex flex-col gap-0.5">
                <p className="text-[12px] font-semibold text-foreground leading-tight truncate">
                  {convexUser.name}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {convexUser.email}
                </p>
              </div>
              <Separator className="my-1" />
              <button
                onClick={() => signOut({ redirectUrl: "/" })}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[12px] text-red-500 hover:bg-red-500/10 rounded-md transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign out
              </button>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </header>
  );
}
