/**
 * Navigation configuration for the dashboard sidebar.
 * Pure data, no React dependencies.
 *
 * B-2 compliance: Navigation data in independent file.
 */

// Icon names as strings, mapped to Lucide components in sidebar.tsx
export interface NavItemDef {
  href: string;
  label: string;
  icon: string;
}

export interface NavGroupDef {
  label: string;
  items: NavItemDef[];
  defaultOpen?: boolean;
}

export const NAV_GROUPS: NavGroupDef[] = [
  {
    label: "总览",
    defaultOpen: true,
    items: [
      { href: "/", label: "仪表盘", icon: "LayoutDashboard" },
      { href: "/coverage-lookup", label: "保障速查", icon: "ShieldCheck" },
      { href: "/renewal-calendar", label: "续保日历", icon: "CalendarClock" },
    ],
  },
  {
    label: "数据管理",
    defaultOpen: true,
    items: [
      { href: "/policies", label: "保单管理", icon: "FileText" },
      { href: "/members", label: "家庭成员", icon: "Users" },
      { href: "/insurers", label: "保险公司", icon: "Landmark" },
      { href: "/assets", label: "资产管理", icon: "Building2" },
    ],
  },
  {
    label: "就诊管理",
    defaultOpen: true,
    items: [
      { href: "/medical-visits", label: "就诊记录", icon: "Stethoscope" },
      { href: "/hospitals", label: "医院管理", icon: "Hospital" },
      { href: "/doctors", label: "医生管理", icon: "UserRound" },
    ],
  },
  {
    label: "系统",
    defaultOpen: true,
    items: [
      { href: "/cli", label: "CLI", icon: "Terminal" },
      { href: "/settings", label: "系统设置", icon: "Settings" },
    ],
  },
];

export const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);
