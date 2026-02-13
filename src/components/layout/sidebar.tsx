"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  LayoutDashboard,
  FileText,
  Users,
  Settings,
  PanelLeft,
  Building2,
  CalendarClock,
  ShieldCheck,
  Landmark,
  LogOut,
} from "lucide-react";
import { cn, getAvatarColor } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Logo } from "@/components/logo";
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

function CollapsedNavItem({
  item,
  currentPath,
}: {
  item: (typeof navItems)[number];
  currentPath: string;
}) {
  const isActive =
    item.href === "/" ? currentPath === "/" : currentPath.startsWith(item.href);

  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <Link
          href={item.href}
          className={cn(
            "relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
            isActive
              ? "bg-accent text-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          <item.icon className="h-4 w-4" strokeWidth={1.5} />
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {item.label}
      </TooltipContent>
    </Tooltip>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebar();
  const { data: session } = useSession();

  // Get user info from session (Google OAuth)
  const userName = session?.user?.name ?? "用户";
  const userImage = session?.user?.image;
  const userInitial = userName[0] ?? "?";

  return (
    <aside
      className={cn(
        "sticky top-0 flex h-screen shrink-0 flex-col bg-background transition-all duration-300 ease-in-out overflow-hidden",
        collapsed ? "w-[68px]" : "w-[260px]"
      )}
    >
      {collapsed ? (
        /* ── Collapsed (icon-only) view ── */
        <div className="flex h-screen w-[68px] flex-col items-center">
          <div className="flex h-14 items-center justify-center">
            <Logo size="sm" />
          </div>

          <button
            onClick={toggle}
            aria-label="展开侧边栏"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors mb-2"
          >
            <PanelLeft className="h-4 w-4" aria-hidden="true" strokeWidth={1.5} />
          </button>

          <nav className="flex-1 flex flex-col items-center gap-1 overflow-y-auto pt-1">
            {navItems.map((item) => (
              <CollapsedNavItem key={item.href} item={item} currentPath={pathname} />
            ))}
          </nav>

          <div className="py-3 flex justify-center w-full">
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="cursor-pointer"
                >
                  <Avatar className="h-9 w-9">
                    {userImage && <AvatarImage src={userImage} alt={userName} />}
                    <AvatarFallback className={cn("text-xs text-white", getAvatarColor(userName))}>
                      {userInitial}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                {userName} · 点击退出
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      ) : (
        /* ── Expanded view ── */
        <div className="flex h-screen w-[260px] flex-col">
          <div className="px-3 h-14 flex items-center">
            <div className="flex w-full items-center justify-between px-3">
              <div className="flex items-center gap-3">
                <Logo size="sm" />
                <span className="text-lg font-bold tracking-tighter">surety</span>
              </div>
              <button
                onClick={toggle}
                aria-label="收起侧边栏"
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground transition-colors"
              >
                <PanelLeft className="h-4 w-4" aria-hidden="true" strokeWidth={1.5} />
              </button>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto pt-1">
            <div className="flex flex-col gap-0.5 px-3">
              {navItems.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-normal transition-colors",
                      isActive
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                    <span className="flex-1 text-left">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>

          <div className="px-4 py-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9 shrink-0">
                {userImage && <AvatarImage src={userImage} alt={userName} />}
                <AvatarFallback className={cn("text-xs text-white", getAvatarColor(userName))}>
                  {userInitial}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{userName}</p>
                <p className="text-xs text-muted-foreground truncate">家庭管理员</p>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                aria-label="退出登录"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0 cursor-pointer"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
