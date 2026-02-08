"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Users,
  Settings,
  Shield,
  PanelLeftClose,
  PanelLeft,
  Building2,
} from "lucide-react";
import { cn, getAvatarColor } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSidebar } from "./sidebar-context";

interface Member {
  id: number;
  name: string;
  relation: string;
}

const navItems = [
  { href: "/", label: "仪表盘", icon: LayoutDashboard },
  { href: "/policies", label: "保单", icon: FileText },
  { href: "/members", label: "家庭成员", icon: Users },
  { href: "/assets", label: "资产", icon: Building2 },
  { href: "/settings", label: "设置", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebar();
  const [selfMember, setSelfMember] = useState<Member | null>(null);

  useEffect(() => {
    fetch("/api/members")
      .then((res) => res.json())
      .then((members: Member[]) => {
        // Find first Self member by id
        const self = members
          .filter((m) => m.relation === "Self")
          .sort((a, b) => a.id - b.id)[0];
        if (self) {
          setSelfMember(self);
        }
      })
      .catch(() => {});
  }, []);

  const userName = selfMember?.name ?? "用户";
  const userInitial = userName[0] ?? "?";

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "flex h-screen flex-col border-r border-border bg-sidebar transition-all duration-300",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {/* Header */}
        <div className={cn(
          "flex h-14 items-center gap-2",
          collapsed ? "justify-center px-2" : "px-6"
        )}>
          <Shield className="h-5 w-5 shrink-0 text-primary" />
          {!collapsed && (
            <span className="text-lg font-bold tracking-tighter">surety</span>
          )}
        </div>

        <Separator />

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            const linkContent = (
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  collapsed && "justify-center px-2",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && item.label}
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return <div key={item.href}>{linkContent}</div>;
          })}
        </nav>

        <Separator />

        {/* User info */}
        <div className={cn(
          "flex items-center gap-3 py-4",
          collapsed ? "flex-col px-2" : "px-4"
        )}>
          {!collapsed && (
            <>
              <Avatar className="h-8 w-8">
                <AvatarFallback className={cn("text-xs text-white", getAvatarColor(userName))}>{userInitial}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="text-sm font-medium">{userName}</span>
                <span className="text-xs text-muted-foreground">家庭管理员</span>
              </div>
            </>
          )}

          {collapsed && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Avatar className="h-8 w-8 cursor-pointer">
                  <AvatarFallback className={cn("text-xs text-white", getAvatarColor(userName))}>{userInitial}</AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent side="right">
                {userName} · 家庭管理员
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Toggle button - at the very bottom */}
        <div className={cn(
          "mt-auto border-t py-3",
          collapsed ? "px-2 flex justify-center" : "px-4"
        )}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggle}
                className="h-8 w-8 shrink-0"
              >
                {collapsed ? (
                  <PanelLeft className="h-4 w-4" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
                <span className="sr-only">
                  {collapsed ? "展开侧边栏" : "收起侧边栏"}
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side={collapsed ? "right" : "top"}>
              {collapsed ? "展开侧边栏" : "收起侧边栏"}
            </TooltipContent>
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
  );
}
