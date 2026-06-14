import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { SidebarProvider } from "@/components/ui/sidebar";
import DashboardSidebar from "@/components/DashboardSidebar";
import { TopNavbar } from "@/components/TopNavbar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/");
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen w-full bg-background text-foreground flex">
        <DashboardSidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden pt-12">
          <TopNavbar />
          <main className="flex-1 flex flex-col min-h-0 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
