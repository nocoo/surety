import { LinkProvider, ThemeProvider } from "@nocoo/basalt";
import { AccentProvider } from "@nocoo/basalt/providers/accent";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, Link as RouterLink, RouterProvider } from "react-router";
import { App } from "./App";
import { initializeEnvironment } from "./hooks/local-environment";
import "./globals.css";

try {
	await initializeEnvironment();
} catch (error) {
	const notice = document.createElement("p");
	notice.setAttribute("role", "alert");
	notice.textContent = `本地环境启动失败，请检查启动器日志后刷新：${error instanceof Error ? error.message : "未知错误"}`;
	document.body.append(notice);
	throw error;
}

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

// Single catch-all data route delegating to <App/>'s nested <Routes>.
// We need a data router (not <BrowserRouter>) so child pages can use
// useBlocker for unsaved-edit guards (settings page); Routes/Route
// inside <App/> stay unchanged.
const router = createBrowserRouter([{ path: "*", element: <App /> }]);

function BasaltLinkAdapter({
	href,
	className,
	children,
	...props
}: {
	href: string;
	className?: string;
	children?: React.ReactNode;
}) {
	return (
		<RouterLink to={href} className={className} {...props}>
			{children}
		</RouterLink>
	);
}

// Ensure default accent is vermilion if not set
try {
	if (!localStorage.getItem("basalt-accent")) {
		localStorage.setItem("basalt-accent", "vermilion");
	}
} catch {}

createRoot(root).render(
	<StrictMode>
		<ThemeProvider>
			<AccentProvider>
				<LinkProvider render={BasaltLinkAdapter}>
					<RouterProvider router={router} />
				</LinkProvider>
			</AccentProvider>
		</ThemeProvider>
	</StrictMode>,
);
