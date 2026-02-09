"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  LayoutDashboard,
  FileText,
  Users,
  Settings,
  PanelLeftClose,
  PanelLeft,
  Building2,
  CalendarClock,
  ShieldCheck,
  Landmark,
  LogOut,
} from "lucide-react";
import { cn, getAvatarColor } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSidebar } from "./sidebar-context";

const navItems = [
  { href: "/", label: "仪表盘", icon: LayoutDashboard },
  { href: "/coverage-lookup", label: "保障速查", icon: ShieldCheck },
  { href: "/renewal-calendar", label: "续保日历", icon: CalendarClock },
  { href: "/policies", label: "保单管理", icon: FileText },
  { href: "/members", label: "家庭成员", icon: Users },
  { href: "/insurers", label: "保险公司", icon: Landmark },
  { href: "/assets", label: "资产管理", icon: Building2 },
  { href: "/settings", label: "系统设置", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebar();
  const { data: session } = useSession();

  // Get user info from session (Google OAuth)
  const userName = session?.user?.name ?? "用户";
  const userImage = session?.user?.image;
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
          <Image
            src="/logo-light-24.png"
            alt="Surety"
            width={24}
            height={24}
            className="shrink-0 dark:hidden"
            priority
          />
          <Image
            src="/logo-dark-24.png"
            alt="Surety"
            width={24}
            height={24}
            className="hidden shrink-0 dark:block"
            priority
          />
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
                {userImage && <AvatarImage src={userImage} alt={userName} />}
                <AvatarFallback className={cn("text-xs text-white", getAvatarColor(userName))}>{userInitial}</AvatarFallback>
              </Avatar>
              <div className="flex flex-1 flex-col">
                <span className="text-sm font-medium">{userName}</span>
                <span className="text-xs text-muted-foreground">家庭管理员</span>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="sr-only">退出登录</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">退出登录</TooltipContent>
              </Tooltip>
            </>
          )}

          {collapsed && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="h-8 w-8 p-0"
                >
                  <Avatar className="h-8 w-8">
                    {userImage && <AvatarImage src={userImage} alt={userName} />}
                    <AvatarFallback className={cn("text-xs text-white", getAvatarColor(userName))}>{userInitial}</AvatarFallback>
                  </Avatar>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {userName} · 点击退出
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
