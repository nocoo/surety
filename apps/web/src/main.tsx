import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createBrowserRouter } from "react-router";
import { App } from "./App";
import "./globals.css";

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

// Single catch-all data route delegating to <App/>'s nested <Routes>.
// We need a data router (not <BrowserRouter>) so child pages can use
// useBlocker for unsaved-edit guards (settings page); Routes/Route
// inside <App/> stay unchanged.
const router = createBrowserRouter([
  { path: "*", element: <App /> },
]);

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
