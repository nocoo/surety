/**
 * Integration test: API token lifecycle
 *
 * Verifies the full bearer token authentication flow using an in-memory
 * SQLite database (same pattern as other surety unit tests):
 *
 *   1. Create a token via the apiTokens repo
 *   2. Verify the token resolves to the correct email
 *   3. Verify an invalid token returns null
 *   4. Verify an expired token returns null
 *   5. Revoke the token
 *   6. Verify the revoked token returns null
 *   7. List tokens by email
 *   8. Verify token prefix format (sk_...)
 */

import { describe, expect, test, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "../../db/schema";
import { createApiTokensRepo, hashToken } from "../../db/repositories/apiTokens";

function createTestDb() {
  const sqlite = new Database(":memory:");
  const db = drizzle(sqlite, { schema });

  // Create the api_tokens table
  sqlite.exec(`
    CREATE TABLE api_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL UNIQUE,
      token_prefix TEXT NOT NULL,
      email TEXT NOT NULL,
      name TEXT DEFAULT 'CLI',
      created_at TEXT NOT NULL,
      last_used_at TEXT,
      expires_at TEXT
    );
    CREATE INDEX idx_api_tokens_email ON api_tokens(email);
  `);

  return db;
}

describe("API Token Lifecycle Integration", () => {
  let db: ReturnType<typeof createTestDb>;
  let repo: ReturnType<typeof createApiTokensRepo>;

  beforeEach(() => {
    db = createTestDb();
    repo = createApiTokensRepo(db);
  });

  test("full lifecycle: create → verify → use → revoke → reject", async () => {
    // 1. Create token
    const { token, id, tokenPrefix } = await repo.create("user@example.com", "My CLI");

    expect(token).toStartWith("sk_");
    expect(tokenPrefix).toBe(token.slice(0, 8));
    expect(id).toBeGreaterThan(0);

    // 2. Verify token
    const verified = await repo.verify(token);
    expect(verified).not.toBeNull();
    expect(verified?.email).toBe("user@example.com");
    expect(verified?.id).toBe(id);

    // 3. Update lastUsedAt
    await repo.updateLastUsed(id);
    const tokens = await repo.listByEmail("user@example.com");
    expect(tokens).toHaveLength(1);
    expect(tokens[0]?.lastUsedAt).not.toBeNull();
    expect(tokens[0]?.name).toBe("My CLI");

    // 4. Revoke token
    const revoked = await repo.revoke(id);
    expect(revoked).toBe(true);

    // 5. Verify revoked token fails
    const afterRevoke = await repo.verify(token);
    expect(afterRevoke).toBeNull();
  });

  test("expired token is rejected", async () => {
    const { token } = await repo.create(
      "user@example.com",
      "Expired CLI",
      new Date(Date.now() - 86400000).toISOString() // expired yesterday
    );

    const verified = await repo.verify(token);
    expect(verified).toBeNull();
  });

  test("future expiry token is accepted", async () => {
    const { token } = await repo.create(
      "user@example.com",
      "Valid CLI",
      new Date(Date.now() + 86400000).toISOString() // expires tomorrow
    );

    const verified = await repo.verify(token);
    expect(verified).not.toBeNull();
    expect(verified?.email).toBe("user@example.com");
  });

  test("invalid token returns null", async () => {
    const verified = await repo.verify("sk_totally_invalid_token");
    expect(verified).toBeNull();
  });

  test("empty token returns null", async () => {
    const verified = await repo.verify("");
    expect(verified).toBeNull();
  });

  test("hashToken is deterministic", () => {
    const h1 = hashToken("test-token");
    const h2 = hashToken("test-token");
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64); // SHA-256 hex
  });

  test("multiple tokens for same email", async () => {
    await repo.create("user@example.com", "CLI 1");
    await repo.create("user@example.com", "CLI 2");
    await repo.create("other@example.com", "CLI 3");

    const userTokens = await repo.listByEmail("user@example.com");
    expect(userTokens).toHaveLength(2);

    const otherTokens = await repo.listByEmail("other@example.com");
    expect(otherTokens).toHaveLength(1);
  });

  test("revoke non-existent token returns false", async () => {
    const revoked = await repo.revoke(99999);
    expect(revoked).toBe(false);
  });

  test("each token is unique", async () => {
    const t1 = await repo.create("user@example.com");
    const t2 = await repo.create("user@example.com");
    expect(t1.token).not.toBe(t2.token);
    expect(t1.id).not.toBe(t2.id);
  });
});
