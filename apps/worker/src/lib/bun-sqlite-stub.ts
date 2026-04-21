// Wrangler bundles dead-code paths from @surety/db that reference bun:sqlite
// (the test-only in-memory branch). This stub resolves the import at build
// time; the stubbed code paths are never hit at runtime on Workers.
export class Database {
  constructor() {
    throw new Error("bun:sqlite is not available on Cloudflare Workers");
  }
}
