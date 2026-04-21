import { Hono } from "hono";
import { getDashboardData } from "@surety/api/dashboard";
import type { AppEnv } from "../lib/types";

const app = new Hono<AppEnv>();

app.get("/api/dashboard", async (c) => {
  const repos = c.get("repos");
  const data = await getDashboardData(repos);
  return c.json(data);
});

export default app;
