import { LinkProvider, ThemeProvider } from "@nocoo/basalt";
import { AccentProvider } from "@nocoo/basalt/providers/accent";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, Link as RouterLink, RouterProvider } from "react-router";
import { App } from "./App";
import "./globals.css";

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
if (typeof window !== "undefined" && !localStorage.getItem("basalt-accent")) {
	localStorage.setItem("basalt-accent", "vermilion");
}

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
