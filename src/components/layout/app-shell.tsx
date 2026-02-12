"use client";

import { Sidebar } from "./sidebar";
import { SidebarProvider } from "./sidebar-context";
import { ThemeToggle } from "./theme-toggle";
import { DbSelector } from "./db-selector";
import { Breadcrumbs } from "./breadcrumbs";

interface AppShellProps {
  children: React.ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
}

export function AppShell({ children, breadcrumbs = [] }: AppShellProps) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar />

        <main className="flex flex-1 flex-col min-h-screen min-w-0">
          {/* Header — no border, matching basalt */}
          <header className="flex h-14 shrink-0 items-center justify-between px-4 md:px-6">
            <Breadcrumbs items={[{ label: "首页", href: "/" }, ...breadcrumbs]} />
            <div className="flex items-center gap-1">
              <DbSelector />
              <ThemeToggle />
            </div>
          </header>

          {/* Floating island content area */}
          <div className="flex-1 px-2 pb-2 md:px-3 md:pb-3">
            <div className="h-full rounded-[16px] md:rounded-[20px] bg-card p-3 md:p-5 overflow-y-auto">
              {children}
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
