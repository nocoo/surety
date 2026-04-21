import type { Context, Next } from "hono";
import { createDbFromD1 } from "@surety/db";
import { createAllRepos } from "@surety/db/repositories";
import type { AppEnv } from "../lib/types";

export async function dbMiddleware(c: Context<AppEnv>, next: Next) {
  const db = createDbFromD1(c.env.DB);
  c.set("db", db);
  c.set("repos", createAllRepos(db));
  return next();
}
