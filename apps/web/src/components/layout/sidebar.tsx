import {
	Sidebar as BasaltSidebar,
	SidebarBrand,
	SidebarFooter,
	SidebarGroup,
	SidebarHeader,
	SidebarIconItem,
	SidebarItem,
	SidebarNav,
	SidebarProvider,
	SidebarSearch,
	SidebarToggle,
	SidebarUser,
} from "@nocoo/basalt";
import { useSidebar } from "@nocoo/basalt/components/sidebar";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@nocoo/basalt/components/tooltip";
import { APP_VERSION } from "@surety/api/lib/version";
import {
	Building2,
	CalendarClock,
	FileText,
	Hospital,
	Landmark,
	LayoutDashboard,
	type LucideIcon,
	Settings,
	ShieldCheck,
	Stethoscope,
	Terminal,
	UserRound,
	Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { useCallback } from "react";
import { useLocation } from "react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useMe } from "@/hooks/use-me";
import { usePersistedState } from "@/hooks/use-persisted-state";
import {
	ALL_NAV_ITEMS as ALL_NAV_ITEMS_DEF,
	isItemActive,
	NAV_GROUPS as NAV_GROUPS_DEF,
	type NavGroupDef,
	type NavItemDef,
	shouldGroupBeOpenOnMount,
} from "@/lib/navigation";
import { getDisplayName } from "@/lib/user";
import { cn, getAvatarColor } from "@/lib/utils";
import { useOpenCommandPalette } from "./command-palette";

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
	Terminal,
};

interface NavItem {
	href: string;
	label: string;
	icon: LucideIcon;
}

function resolveNavItem(item: NavItemDef): NavItem {
	return {
		href: item.href,
		label: item.label,
		icon: ICON_MAP[item.icon] ?? LayoutDashboard,
	};
}

const NAV_GROUPS = NAV_GROUPS_DEF.map((group: NavGroupDef) => ({
	label: group.label,
	items: group.items.map(resolveNavItem),
	...(group.defaultOpen !== undefined ? { defaultOpen: group.defaultOpen } : {}),
}));

const ALL_NAV_ITEMS: NavItem[] = ALL_NAV_ITEMS_DEF.map(resolveNavItem);

const SIDEBAR_COLLAPSED_KEY = "surety:sidebar-collapsed";
type SidebarCollapsedPreference = "false" | "true";

export function PersistedSidebarProvider({ children }: { children: ReactNode }) {
	const [stored, setStored] = usePersistedState<SidebarCollapsedPreference>(
		SIDEBAR_COLLAPSED_KEY,
		"false",
	);
	const collapsed = stored === "true";
	const onCollapsedChange = useCallback(
		(next: boolean) => {
			setStored(next ? "true" : "false");
		},
		[setStored],
	);

	return (
		<SidebarProvider collapsed={collapsed} onCollapsedChange={onCollapsedChange} defaultWidth={260}>
			{children}
		</SidebarProvider>
	);
}

interface SidebarProps {
	/** Accessible name for the complementary landmark. */
	ariaLabel: string;
	/** Desktop shows collapse toggle; mobile drawer stays expanded without resize. */
	variant?: "desktop" | "mobile";
	onNavigate?: () => void;
	/** Mobile drawer: closes the drawer from the brand row. */
	onDismiss?: () => void;
}

function SuretySidebarBody({
	variant,
	onNavigate,
	onDismiss,
}: {
	variant?: SidebarProps["variant"];
	onNavigate?: () => void;
	onDismiss?: () => void;
}) {
	const { pathname } = useLocation();
	const { collapsed, peek, peeking } = useSidebar();
	const railCollapsed = collapsed && !(peek && peeking);
	const openCommandPalette = useOpenCommandPalette();

	const { data: user } = useMe();
	const {
		name: userName,
		initial: userInitial,
		email: userEmail,
		avatar: userAvatar,
	} = getDisplayName(user);

	const avatar = (
		<Avatar className="h-9 w-9">
			{userAvatar ? <AvatarImage src={userAvatar} alt={userName} /> : null}
			<AvatarFallback className={cn("text-xs text-white", getAvatarColor(userName))}>
				{userInitial}
			</AvatarFallback>
		</Avatar>
	);

	return (
		<>
			<SidebarHeader>
				<SidebarBrand
					logo={<img src="/logo-80.png" alt="" width={24} height={24} />}
					name="surety"
					version={`v${APP_VERSION}`}
					action={
						variant === "mobile" ? (
							<SidebarToggle
								mode="dismiss"
								dismissLabel="关闭导航菜单"
								{...(onDismiss ? { onDismiss } : {})}
							/>
						) : (
							<SidebarToggle expandLabel="展开侧边栏" collapseLabel="收起侧边栏" />
						)
					}
				/>
			</SidebarHeader>
			<SidebarNav>
				<SidebarSearch
					shortcut="⌘K"
					onClick={(event) => {
						event.preventDefault();
						openCommandPalette();
					}}
				>
					搜索
				</SidebarSearch>
				{railCollapsed
					? ALL_NAV_ITEMS.map((item) => {
							const Icon = item.icon;
							const active = isItemActive(item.href, pathname);
							return (
								<Tooltip key={item.href} delayDuration={0}>
									<TooltipTrigger asChild>
										<SidebarIconItem
											href={item.href}
											active={active}
											aria-label={item.label}
											onClick={onNavigate}
										>
											<Icon className="h-4 w-4" strokeWidth={1.5} />
										</SidebarIconItem>
									</TooltipTrigger>
									<TooltipContent side="right" sideOffset={8}>
										{item.label}
									</TooltipContent>
								</Tooltip>
							);
						})
					: NAV_GROUPS.map((group) => (
							<SidebarGroup
								key={group.label}
								label={group.label}
								defaultOpen={shouldGroupBeOpenOnMount(group, pathname)}
							>
								{group.items.map((item) => {
									const Icon = item.icon;
									const active = isItemActive(item.href, pathname);
									return (
										<SidebarItem
											key={item.href}
											href={item.href}
											active={active}
											onClick={onNavigate}
										>
											<Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
											<span className="flex-1 truncate text-left">{item.label}</span>
										</SidebarItem>
									);
								})}
							</SidebarGroup>
						))}
			</SidebarNav>
			<SidebarFooter>
				<SidebarUser name={userName} email={userEmail ?? undefined} avatar={avatar} />
			</SidebarFooter>
		</>
	);
}

export function Sidebar({ ariaLabel, variant = "desktop", onNavigate, onDismiss }: SidebarProps) {
	return (
		<TooltipProvider delayDuration={0}>
			<BasaltSidebar aria-label={ariaLabel} resizable={false}>
				<SuretySidebarBody
					variant={variant}
					{...(onNavigate ? { onNavigate } : {})}
					{...(onDismiss ? { onDismiss } : {})}
				/>
			</BasaltSidebar>
		</TooltipProvider>
	);
}
