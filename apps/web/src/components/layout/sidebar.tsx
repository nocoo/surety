
import { useState } from "react";
import { Link, useLocation } from "react-router";
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
  ChevronUp,
  Stethoscope,
  Hospital,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { cn, getAvatarColor } from "@/lib/utils";
import { getDisplayName } from "@/lib/user";
import { useMe } from "@/hooks/use-me";
import { APP_VERSION } from "@surety/api/lib/version";
import {
  NAV_GROUPS as NAV_GROUPS_DEF,
  ALL_NAV_ITEMS as ALL_NAV_ITEMS_DEF,
  type NavItemDef,
  type NavGroupDef,
} from "@/lib/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Collapsible, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useSidebar } from "./sidebar-context";

// ── Icon mapping ──

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  FileText,
  Users,
  Settings,
  Building2,
  CalendarClock,
  ShieldCheck,
  Landmark,
  Stethoscope,
  Hospital,
  UserRound,
};

// ── Types (internal, with resolved icons) ──

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  label: string;
  items: NavItem[];
  defaultOpen?: boolean | undefined;
}

// ── Resolve icons from string names ──

function resolveNavItem(item: NavItemDef): NavItem {
  return {
    href: item.href,
    label: item.label,
    icon: ICON_MAP[item.icon] ?? LayoutDashboard,
  };
}

function resolveNavGroup(group: NavGroupDef): NavGroup {
  return {
    label: group.label,
    items: group.items.map(resolveNavItem),
    defaultOpen: group.defaultOpen,
  };
}

const NAV_GROUPS: NavGroup[] = NAV_GROUPS_DEF.map(resolveNavGroup);
const ALL_NAV_ITEMS: NavItem[] = ALL_NAV_ITEMS_DEF.map(resolveNavItem);

// ── Sub-components ──

function NavGroupSection({
  group,
  pathname,
  onNavigate,
}: {
  group: NavGroup;
  pathname: string;
  onNavigate: () => void;
}) {
  const [open, setOpen] = useState(group.defaultOpen ?? true);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="px-3 mt-2">
        <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
            {group.label}
          </span>
          <span className="flex h-5 w-5 shrink-0 items-center justify-center">
            <ChevronUp
              className={cn(
                "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
                !open && "rotate-180"
              )}
              strokeWidth={1.5}
            />
          </span>
        </CollapsibleTrigger>
      </div>
      <div
        className="grid overflow-hidden"
        style={{
          gridTemplateRows: open ? "1fr" : "0fr",
          transition: "grid-template-rows 200ms ease-out",
        }}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="flex flex-col gap-0.5 px-3">
            {group.items.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={onNavigate}
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
        </div>
      </div>
    </Collapsible>
  );
}

// ── Main component ──

interface SidebarProps {
  mobile?: boolean;
}

export function Sidebar({ mobile = false }: SidebarProps) {
  const { pathname } = useLocation();
  const { collapsed, toggle, setMobileOpen } = useSidebar();

  const { data: user } = useMe();
  const { name: userName, initial: userInitial, email: userEmail } = getDisplayName(user);

  const handleNavigate = () => setMobileOpen(false);

  // Mobile drawer always renders expanded (full-width) navigation
  const isCollapsed = mobile ? false : collapsed;

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        aria-label={mobile ? "主导航抽屉" : "主导航"}
        className={cn(
          "sticky top-0 flex h-screen shrink-0 flex-col bg-background transition-all duration-300 ease-in-out overflow-hidden",
          isCollapsed ? "w-[68px]" : "w-[260px]"
        )}
      >
        {isCollapsed ? (
          /* ── Collapsed (icon-only) view ── */
          <div className="flex h-screen w-[68px] flex-col items-center">
            {/* Logo */}
            <div className="flex h-14 w-full items-center justify-start pl-6 pr-3">
              <img
                src="/logo-24.png"
                alt="Surety"
                width={24}
                height={24}
                className="shrink-0"
              />
            </div>

            {/* Expand toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={toggle}
                  aria-label="展开侧边栏"
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors mb-2"
                >
                  <PanelLeft className="h-4 w-4" aria-hidden="true" strokeWidth={1.5} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                展开侧边栏
              </TooltipContent>
            </Tooltip>

            {/* Navigation — flat icon list, no groups */}
            <nav className="flex-1 flex flex-col items-center gap-1 overflow-y-auto pt-1">
              {ALL_NAV_ITEMS.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);

                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>
                      <Link
                        to={item.href}
                        onClick={handleNavigate}
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
              })}
            </nav>

            {/* User avatar */}
            <div className="py-3 flex justify-center w-full">
              <Avatar className="h-9 w-9">
                <AvatarFallback className={cn("text-xs text-white", getAvatarColor(userName))}>
                  {userInitial}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        ) : (
          /* ── Expanded view ── */
          <div className="flex h-screen w-[260px] flex-col">
            {/* Header: logo + collapse toggle */}
            <div className="px-3 h-14 flex items-center">
              <div className="flex w-full items-center justify-between px-3">
                <div className="flex items-center gap-3">
                  <img
                    src="/logo-24.png"
                    alt="Surety"
                    width={24}
                    height={24}
                    className="shrink-0"
                  />
                  <span className="text-lg font-bold tracking-tighter">surety</span>
                  <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground leading-none">
                    v{APP_VERSION}
                  </span>
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

            {/* Navigation — grouped with collapsible sections */}
            <nav className="flex-1 overflow-y-auto pt-1">
              {NAV_GROUPS.map((group) => (
                <NavGroupSection
                  key={group.label}
                  group={group}
                  pathname={pathname}
                  onNavigate={handleNavigate}
                />
              ))}
            </nav>

            {/* User info */}
            <div className="px-4 py-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarFallback className={cn("text-xs text-white", getAvatarColor(userName))}>
                    {userInitial}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{userName}</p>
                  {userEmail ? (
                    <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        )}
      </aside>
    </TooltipProvider>
  );
}

// Export for testing
export { NAV_GROUPS, ALL_NAV_ITEMS };
export type { NavItem, NavGroup };
