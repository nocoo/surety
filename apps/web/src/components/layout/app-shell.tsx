import { ContentIsland } from "@nocoo/basalt";
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
import { CommandPalette } from "./command-palette";
import { DbSelector } from "./db-selector";
import { Sidebar } from "./sidebar";
import { SidebarProvider, useSidebar } from "./sidebar-context";
import { ThemeToggle } from "./theme-toggle";

interface AppShellProps {
	children: React.ReactNode;
	breadcrumbs?: { label: string; href?: string }[];
}

function AppShellInner({ children, breadcrumbs = [] }: AppShellProps) {
	const isMobile = useIsMobile();
	const { mobileOpen, setMobileOpen } = useSidebar();
	const { pathname } = useLocation();

	// Close mobile sidebar on route change
	// biome-ignore lint/correctness/useExhaustiveDependencies: pathname triggers close on route change
	useEffect(() => {
		setMobileOpen(false);
	}, [pathname, setMobileOpen]);

	// Prevent body scroll when mobile sidebar is open
	useEffect(() => {
		if (mobileOpen) {
			document.body.style.overflow = "hidden";
		} else {
			document.body.style.overflow = "";
		}
		return () => {
			document.body.style.overflow = "";
		};
	}, [mobileOpen]);

	return (
		<BasaltAppShell>
			<AppSkipLink href="#main-content">跳至主要内容</AppSkipLink>

			{/* Desktop sidebar */}
			{!isMobile && <Sidebar />}

			{isMobile && (
				<Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
					<SheetContent
						side="left"
						className="w-[260px] p-0 sm:max-w-[260px]"
						showCloseButton={false}
					>
						<SheetHeader className="sr-only">
							<SheetTitle>导航菜单</SheetTitle>
							<SheetDescription>浏览 Surety 的主要页面</SheetDescription>
						</SheetHeader>
						<Sidebar mobile />
					</SheetContent>
				</Sheet>
			)}

			<BasaltAppMain>
				{/* Header — no border, matching basalt */}
				<header className="flex h-14 shrink-0 items-center justify-between px-4 md:px-6">
					<div className="flex items-center gap-3">
						{isMobile && (
							<button
								type="button"
								onClick={() => setMobileOpen(true)}
								aria-label="打开导航菜单"
								className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
							>
								<Menu className="h-5 w-5" aria-hidden="true" strokeWidth={1.5} />
							</button>
						)}
						<Breadcrumbs items={[{ label: "首页", href: "/" }, ...breadcrumbs]} />
					</div>
					<div className="flex items-center gap-1">
						<DbSelector />
						<a
							href="https://github.com/nocoo/surety"
							target="_blank"
							rel="noopener noreferrer"
							aria-label="GitHub repository"
							className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
						>
							<Github className="h-[18px] w-[18px]" aria-hidden="true" strokeWidth={1.5} />
						</a>
						<ThemeToggle />
					</div>
				</header>

				{/* Floating island content area */}
				<div className="flex min-h-0 flex-1 flex-col px-2 pb-2 md:px-3 md:pb-3">
					<ContentIsland>{children}</ContentIsland>
				</div>
			</BasaltAppMain>

			{/* Global Cmd/Ctrl+K command palette — present on every route. */}
			<CommandPalette />
		</BasaltAppShell>
	);
}

export function AppShell({ children, breadcrumbs = [] }: AppShellProps) {
	return (
		<SidebarProvider>
			<AppShellInner breadcrumbs={breadcrumbs}>{children}</AppShellInner>
		</SidebarProvider>
	);
}
