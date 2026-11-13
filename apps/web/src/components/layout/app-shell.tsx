import { ContentIsland, SidebarDrawer } from "@nocoo/basalt";
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

interface AppShellProps {
	children: React.ReactNode;
	breadcrumbs?: { label: string; href?: string }[];
}

function AppShellInner({ children, breadcrumbs = [] }: AppShellProps) {
	const isMobile = useIsMobile();
	const { mobileOpen, setMobileOpen } = useMobileNav();
	const { pathname } = useLocation();
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
					<SidebarDrawer
						id={drawerId}
						open={mobileOpen}
						onOpenChange={setMobileOpen}
						returnFocusRef={menuButton}
						title="导航菜单"
						description="浏览 Surety 的主要页面"
					>
						<Sidebar
							ariaLabel="主导航抽屉"
							variant="mobile"
							onNavigate={() => setMobileOpen(false)}
							onDismiss={() => setMobileOpen(false)}
						/>
					</SidebarDrawer>
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

					<div className="flex min-h-0 flex-1 flex-col px-2 pb-2 md:px-3 md:pb-3">
						<ContentIsland>{children}</ContentIsland>
					</div>
				</BasaltAppMain>
			</BasaltAppShell>
		</CommandPaletteProvider>
	);
}

export function AppShell({ children, breadcrumbs = [] }: AppShellProps) {
	return (
		<MobileNavProvider>
			<AppShellInner breadcrumbs={breadcrumbs}>{children}</AppShellInner>
		</MobileNavProvider>
	);
}
