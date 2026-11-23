import {
	ContentIsland,
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SidebarProvider,
} from "@nocoo/basalt";
import { AppHeader, AppHeaderMenuButton, ProjectLinks } from "@nocoo/basalt/components/app-header";
import {
	AppSkipLink,
	AppMain as BasaltAppMain,
	AppShell as BasaltAppShell,
} from "@nocoo/basalt/components/app-shell";
import { ThemeToggle } from "@nocoo/basalt/components/theme-toggle";
import { useEffect, useId, useRef } from "react";
import { useLocation } from "react-router";
import { useIsMobile } from "@/hooks/use-mobile";
import { CommandPaletteProvider } from "./command-palette";
import { EnvironmentSelector } from "./environment-selector";
import { MobileNavProvider, useMobileNav } from "./mobile-nav-context";
import { PersistedSidebarProvider, Sidebar } from "./sidebar";

interface AppFrameProps {
	children: React.ReactNode;
}

const PAGE_BREADCRUMBS: Record<string, { label: string; href?: string }[]> = {
	"/": [],
	"/members": [{ label: "家庭成员" }],
	"/policies": [{ label: "保单" }],
	"/insurers": [{ label: "保险公司" }],
	"/assets": [{ label: "资产管理" }],
	"/hospitals": [{ label: "医院管理" }],
	"/doctors": [{ label: "医生管理" }],
	"/medical-visits": [{ label: "就诊记录" }],
	"/coverage-lookup": [{ label: "保障速查" }],
	"/renewal-calendar": [{ label: "续保日历" }],
	"/settings": [{ label: "设置" }],
	"/cli": [{ label: "CLI" }],
};

function getBreadcrumbs(pathname: string) {
	if (pathname.startsWith("/policies/")) {
		return [{ label: "保单管理", href: "/policies" }, { label: "保单详情" }];
	}
	return PAGE_BREADCRUMBS[pathname] ?? [];
}

function AppFrameInner({ children }: AppFrameProps) {
	const isMobile = useIsMobile();
	const { mobileOpen, setMobileOpen } = useMobileNav();
	const { pathname } = useLocation();
	const breadcrumbs = getBreadcrumbs(pathname);
	const menuButton = useRef<HTMLButtonElement>(null);
	const drawerId = useId();

	// Close mobile sidebar on route change
	// biome-ignore lint/correctness/useExhaustiveDependencies: pathname triggers close on route change
	useEffect(() => {
		setMobileOpen(false);
	}, [pathname, setMobileOpen]);

	return (
		<CommandPaletteProvider>
			<BasaltAppShell>
				<AppSkipLink href="#main-content">跳至主要内容</AppSkipLink>

				{!isMobile && (
					<PersistedSidebarProvider>
						<Sidebar ariaLabel="主导航" />
					</PersistedSidebarProvider>
				)}

				{isMobile && (
					// Basalt 3.6.0's SidebarDrawer omits showCloseButton={false} on SheetContent,
					// rendering a duplicate "Close" button over SidebarToggle(mode="dismiss").
					<Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
						<SheetContent
							id={drawerId}
							data-slot="sidebar-drawer"
							side="left"
							showCloseButton={false}
							className="basalt-sidebar-drawer max-h-dvh w-[var(--basalt-size-sidebar-width)] max-w-[var(--basalt-size-sidebar-width)] border-r-0 bg-basalt-background p-0 sm:p-0"
							onCloseAutoFocus={(event) => {
								if (menuButton.current) {
									event.preventDefault();
									menuButton.current.focus();
								}
							}}
						>
							<SheetHeader className="sr-only">
								<SheetTitle>导航菜单</SheetTitle>
								<SheetDescription>浏览 Surety 的主要页面</SheetDescription>
							</SheetHeader>
							<SidebarProvider collapsed={false}>
								<Sidebar
									ariaLabel="主导航抽屉"
									variant="mobile"
									onNavigate={() => setMobileOpen(false)}
									onDismiss={() => setMobileOpen(false)}
								/>
							</SidebarProvider>
						</SheetContent>
					</Sheet>
				)}

				<BasaltAppMain>
					<AppHeader
						leading={
							isMobile ? (
								<AppHeaderMenuButton
									ref={menuButton}
									label="打开导航菜单"
									aria-controls={drawerId}
									aria-expanded={mobileOpen}
									onClick={() => setMobileOpen(true)}
								/>
							) : null
						}
						breadcrumbs={[{ label: "首页", href: "/" }, ...breadcrumbs]}
						breadcrumbsLabel="面包屑导航"
						actions={
							<>
								<EnvironmentSelector />
								<ProjectLinks github="nocoo/surety" hexly="surety" name="Surety" />
								<ThemeToggle
									labels={{
										light: "切换为浅色主题",
										dark: "切换为深色主题",
										system: "跟随系统主题",
									}}
								/>
							</>
						}
					/>

					<div className="flex min-h-0 min-w-0 flex-1 flex-col px-basalt-space-lg pb-basalt-space-lg md:px-basalt-layout-sm md:pb-basalt-layout-sm">
						<ContentIsland>{children}</ContentIsland>
					</div>
				</BasaltAppMain>
			</BasaltAppShell>
		</CommandPaletteProvider>
	);
}

export function AppFrame({ children }: AppFrameProps) {
	return (
		<MobileNavProvider>
			<AppFrameInner>{children}</AppFrameInner>
		</MobileNavProvider>
	);
}
