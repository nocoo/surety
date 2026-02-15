import { defineConfig } from "drizzle-kit";

const dbUrl = process.env.SURETY_DB
  ? `./${process.env.SURETY_DB}`
  : "./database/surety.db";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: dbUrl,
  },
});
