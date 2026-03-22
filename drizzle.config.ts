import { defineConfig } from "drizzle-kit";

// D1 management via drizzle-kit (dev-time only)
//
// Commands that need remote D1 (push, pull, studio): require credentials.
// Commands that are schema-only (generate, migrate): work without credentials.
const hasD1Credentials =
  process.env.CLOUDFLARE_ACCOUNT_ID &&
  process.env.CLOUDFLARE_DATABASE_ID &&
  process.env.CLOUDFLARE_D1_TOKEN;

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  ...(hasD1Credentials
    ? {
        driver: "d1-http",
        dbCredentials: {
          accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? "",
          databaseId: process.env.CLOUDFLARE_DATABASE_ID ?? "",
          token: process.env.CLOUDFLARE_D1_TOKEN ?? "",
        },
      }
    : {}),
});
