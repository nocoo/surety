import { ContentIsland, SidebarProvider } from "@nocoo/basalt";
import {
	AppSkipLink,
	AppMain as BasaltAppMain,
	AppShell as BasaltAppShell,
} from "@nocoo/basalt/components/app-shell";
import { Menu } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "react-router";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { Github } from "../icons/github";
import { Breadcrumbs } from "./breadcrumbs";
import { CommandPaletteProvider } from "./command-palette";
import { EnvironmentSelector } from "./environment-selector";
import { HeaderTooltip, HexlyLink } from "./header-links";
import { MobileNavProvider, useMobileNav } from "./mobile-nav-context";
import { PersistedSidebarProvider, Sidebar } from "./sidebar";
import { ThemeToggle } from "./theme-toggle";

interface AppShellProps {
	children: React.ReactNode;
	breadcrumbs?: { label: string; href?: string }[];
}

function AppShellInner({ children, breadcrumbs = [] }: AppShellProps) {
	const isMobile = useIsMobile();
	const { mobileOpen, setMobileOpen } = useMobileNav();
	const { pathname } = useLocation();

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
					<Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
						<SheetContent
							side="left"
							className="w-[260px] max-w-[260px] border-0 bg-basalt-background p-0 sm:max-w-[260px]"
							showCloseButton={false}
						>
							<SheetHeader className="sr-only">
								<SheetTitle>导航菜单</SheetTitle>
								<SheetDescription>浏览 Surety 的主要页面</SheetDescription>
							</SheetHeader>
							<SidebarProvider collapsed={false} defaultWidth={260}>
								<Sidebar
									ariaLabel="主导航抽屉"
									variant="mobile"
									onNavigate={() => setMobileOpen(false)}
								/>
							</SidebarProvider>
						</SheetContent>
					</Sheet>
				)}

				<BasaltAppMain>
					<header className="flex h-14 shrink-0 items-center justify-between px-4 md:px-6">
						<div className="flex items-center gap-3">
							{isMobile && (
								<HeaderTooltip label="打开导航菜单">
									<button
										type="button"
										onClick={() => setMobileOpen(true)}
										aria-label="打开导航菜单"
										className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
									>
										<Menu className="h-5 w-5" aria-hidden="true" strokeWidth={1.5} />
									</button>
								</HeaderTooltip>
							)}
							<Breadcrumbs items={[{ label: "首页", href: "/" }, ...breadcrumbs]} />
						</div>
						<div className="flex items-center gap-1">
							<EnvironmentSelector />
							<HeaderTooltip label="GitHub repository">
								<a
									href="https://github.com/nocoo/surety"
									target="_blank"
									rel="noopener noreferrer"
									aria-label="GitHub repository"
									className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
								>
									<Github className="h-[18px] w-[18px]" aria-hidden="true" strokeWidth={1.5} />
								</a>
							</HeaderTooltip>
							<HexlyLink />
							<ThemeToggle />
						</div>
					</header>

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
