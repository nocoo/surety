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
		items: [{ href: "/settings", label: "系统设置", icon: "Settings" }],
	},
	{
		// CLI is intended for AI assistants and shell scripts, not for the
		// 99% of end users who just want to manage policies. Hide it in a
		// collapsed group so the sidebar stays focused on core tasks.
		label: "开发者",
		defaultOpen: false,
		items: [{ href: "/cli", label: "CLI", icon: "Terminal" }],
	},
];

export const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

/**
 * Same active-route check the sidebar uses for individual nav items —
 * exact match for "/", prefix match for everything else (so /policies/42
 * still highlights "保单管理"). Exported so the sidebar's per-group
 * "should open on mount" decision and per-item "is active" highlight
 * stay in sync, and so we can unit-test the group-expansion rule.
 */
export function isItemActive(href: string, pathname: string): boolean {
	return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/**
 * Initial open-state for a sidebar group: the group containing the
 * current route is always opened, otherwise we honour `defaultOpen`
 * (default true). Once the user toggles the group manually their
 * choice replaces this seed; this only decides the very first render.
 *
 * Generic over the group shape so the runtime resolved-icon variant
 * (NavGroup in sidebar.tsx) and the static NavGroupDef both work.
 */
export function shouldGroupBeOpenOnMount(
	group: { items: { href: string }[]; defaultOpen?: boolean | undefined },
	pathname: string,
): boolean {
	if (group.items.some((item) => isItemActive(item.href, pathname))) return true;
	return group.defaultOpen ?? true;
}
