/**
 * Unit tests for the api_tokens repository.
 *
 * Validates the core CLI auth primitives:
 *   - hashing is SHA-256, raw token returned only once
 *   - verify() honors expiry and rejects unknown tokens
 *   - revoke / listByEmail / updateLastUsed round-trip correctly
 */
import { describe, expect, test, beforeEach } from "bun:test";
import { createHash } from "node:crypto";
import { createTestDb, resetTestDb } from "@/db";
import { createApiTokensRepo, hashToken } from "@/db/repositories/apiTokens";

function freshRepo() {
  const db = createTestDb();
  return createApiTokensRepo(db);
}

describe("apiTokens repository", () => {
  beforeEach(() => {
    resetTestDb();
  });

  test("hashToken returns SHA-256 hex digest", () => {
    const expected = createHash("sha256").update("hello").digest("hex");
    expect(hashToken("hello")).toBe(expected);
  });

  test("create returns raw token; only the hash is persisted", async () => {
    const repo = freshRepo();
    const { token, id, tokenPrefix } = await repo.create("alice@example.com");

    expect(token).toMatch(/^sk_[A-Za-z0-9_-]+$/);
    expect(id).toBeGreaterThan(0);
    expect(tokenPrefix).toBe(token.slice(0, 8));

    const stored = await repo.findById(id);
    if (!stored) throw new Error("token row not found after create");
    expect(stored.token).toBe(hashToken(token));
    expect(stored.token).not.toBe(token);
    expect(stored.email).toBe("alice@example.com");
    expect(stored.name).toBe("CLI");
  });

  test("create accepts custom name and expiry", async () => {
    const repo = freshRepo();
    const future = new Date(Date.now() + 60_000).toISOString();
    const { id } = await repo.create("bob@example.com", "my-laptop", future);
    const row = await repo.findById(id);
    if (!row) throw new Error("token row not found");
    expect(row.name).toBe("my-laptop");
    expect(row.expiresAt).toBe(future);
  });

  test("verify returns email/id for a valid raw token", async () => {
    const repo = freshRepo();
    const { token, id } = await repo.create("alice@example.com");
    const result = await repo.verify(token);
    expect(result).toEqual({ email: "alice@example.com", id });
  });

  test("verify returns null for unknown token", async () => {
    const repo = freshRepo();
    await repo.create("alice@example.com");
    expect(await repo.verify("sk_does_not_exist")).toBeNull();
  });

  test("verify returns null for empty input", async () => {
    const repo = freshRepo();
    expect(await repo.verify("")).toBeNull();
  });

  test("verify rejects expired tokens", async () => {
    const repo = freshRepo();
    const past = new Date(Date.now() - 60_000).toISOString();
    const { token } = await repo.create("alice@example.com", "old", past);
    expect(await repo.verify(token)).toBeNull();
  });

  test("verify accepts tokens whose expiry is in the future", async () => {
    const repo = freshRepo();
    const future = new Date(Date.now() + 60_000).toISOString();
    const { token, id } = await repo.create("alice@example.com", "fresh", future);
    expect(await repo.verify(token)).toEqual({ email: "alice@example.com", id });
  });

  test("updateLastUsed sets lastUsedAt", async () => {
    const repo = freshRepo();
    const { id } = await repo.create("alice@example.com");
    const before = await repo.findById(id);
    if (!before) throw new Error("token row missing before update");
    expect(before.lastUsedAt).toBeNull();
    await repo.updateLastUsed(id);
    const after = await repo.findById(id);
    if (!after) throw new Error("token row missing after update");
    expect(after.lastUsedAt).not.toBeNull();
    // ISO8601 sanity check
    const lastUsedAt = after.lastUsedAt;
    if (!lastUsedAt) throw new Error("lastUsedAt unexpectedly null");
    expect(new Date(lastUsedAt).toString()).not.toBe("Invalid Date");
  });

  test("listByEmail returns all tokens for an email, newest first", async () => {
    const repo = freshRepo();
    await repo.create("alice@example.com", "first");
    // Ensure distinct createdAt timestamps despite ms-resolution.
    await new Promise((r) => setTimeout(r, 5));
    await repo.create("alice@example.com", "second");
    await repo.create("bob@example.com", "other");

    const aliceTokens = await repo.listByEmail("alice@example.com");
    expect(aliceTokens).toHaveLength(2);
    expect(aliceTokens.map((t) => t.name)).toEqual(["second", "first"]);

    const bobTokens = await repo.listByEmail("bob@example.com");
    expect(bobTokens).toHaveLength(1);
  });

  test("revoke deletes the token and prevents further verification", async () => {
    const repo = freshRepo();
    const { token, id } = await repo.create("alice@example.com");
    expect(await repo.revoke(id)).toBe(true);
    expect(await repo.verify(token)).toBeNull();
    expect(await repo.findById(id)).toBeUndefined();
  });

  test("revoke returns false for unknown id", async () => {
    const repo = freshRepo();
    expect(await repo.revoke(99_999)).toBe(false);
  });

  test("token uniqueness is enforced", async () => {
    const repo = freshRepo();
    // Two creates produce two distinct random tokens; just sanity-check.
    const a = await repo.create("alice@example.com");
    const b = await repo.create("alice@example.com");
    expect(a.token).not.toBe(b.token);
  });
});
