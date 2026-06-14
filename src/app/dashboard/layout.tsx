import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { SidebarProvider } from "@/components/ui/sidebar";
import DashboardSidebar from "@/components/DashboardSidebar";

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
      <div className="min-h-screen w-full bg-deep-navy dark:bg-deep-navy text-brand-white flex">
        <DashboardSidebar />
        <main className="flex-1 overflow-x-hidden w-full px-6 py-8 flex flex-col">
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}
