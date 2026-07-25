import { Outlet, useLocation } from "react-router-dom";

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { navItems } from "@/config/nav";

function usePageTitle(): string {
  const { pathname } = useLocation();
  // Longest matching nav prefix wins (so /forms/123 still resolves to 表單管理).
  const match = [...navItems]
    .filter((item) =>
      item.end ? pathname === item.url : pathname.startsWith(item.url),
    )
    .sort((a, b) => b.url.length - a.url.length)[0];
  return match?.title ?? "Form Platform";
}

export function AppLayout() {
  const title = usePageTitle();

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <h1 className="text-base font-medium">{title}</h1>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
