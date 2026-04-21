import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import { db, type DbInstance } from "../index";
import { apiTokens, type ApiToken } from "../schema";

/**
 * Hash a raw token using SHA-256.
 * The DB only ever stores the hash; the raw token is shown to the user once.
 */
export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Generate a fresh, URL-safe random token (256 bits of entropy, base64url-encoded
 * without padding). Prefixed with "sk_" so it is recognizable in logs/UIs.
 */
function generateRawToken(): string {
  const bytes = randomBytes(32);
  const body = bytes
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `sk_${body}`;
}

export function createApiTokensRepo(dbInstance: DbInstance) {
  return {
    /**
     * Create a new API token for the given email.
     * Returns the raw token (shown once) plus the row ID.
     */
    async create(
      email: string,
      name: string = "CLI",
      expiresAt: string | null = null,
    ): Promise<{ token: string; id: number; tokenPrefix: string }> {
      const raw = generateRawToken();
      const hash = hashToken(raw);
      const tokenPrefix = raw.slice(0, 8);
      const row = await dbInstance
        .insert(apiTokens)
        .values({
          token: hash,
          tokenPrefix,
          email,
          name,
          createdAt: new Date().toISOString(),
          lastUsedAt: null,
          expiresAt,
        })
        .returning()
        .get();
      return { token: raw, id: row.id, tokenPrefix };
    },

    /**
     * Verify a raw token. Returns the owning email + token id when valid and
     * not expired; returns null otherwise. Does NOT update lastUsedAt — call
     * updateLastUsed() separately so verification stays a pure read.
     */
    async verify(rawToken: string): Promise<{ email: string; id: number } | null> {
      if (!rawToken) return null;
      const hash = hashToken(rawToken);
      const nowIso = new Date().toISOString();
      const row = await dbInstance
        .select()
        .from(apiTokens)
        .where(
          and(
            eq(apiTokens.token, hash),
            or(isNull(apiTokens.expiresAt), gt(apiTokens.expiresAt, nowIso)),
          ),
        )
        .get();
      if (!row) return null;
      return { email: row.email, id: row.id };
    },

    async updateLastUsed(id: number): Promise<void> {
      await dbInstance
        .update(apiTokens)
        .set({ lastUsedAt: new Date().toISOString() })
        .where(eq(apiTokens.id, id))
        .run();
    },

    async listByEmail(email: string): Promise<ApiToken[]> {
      return await dbInstance
        .select()
        .from(apiTokens)
        .where(eq(apiTokens.email, email))
        .orderBy(sql`${apiTokens.createdAt} desc`)
        .all();
    },

    async listAll(): Promise<ApiToken[]> {
      return await dbInstance
        .select()
        .from(apiTokens)
        .orderBy(sql`${apiTokens.createdAt} desc`)
        .all();
    },

    async findById(id: number): Promise<ApiToken | undefined> {
      return await dbInstance
        .select()
        .from(apiTokens)
        .where(eq(apiTokens.id, id))
        .get();
    },

    async revoke(id: number): Promise<boolean> {
      const rows = await dbInstance
        .delete(apiTokens)
        .where(eq(apiTokens.id, id))
        .returning()
        .all();
      return rows.length > 0;
    },

    /**
     * Revoke ALL tokens for a given email.
     * Returns the number of tokens revoked.
     */
    async revokeAllByEmail(email: string): Promise<number> {
      const rows = await dbInstance
        .delete(apiTokens)
        .where(eq(apiTokens.email, email))
        .returning()
        .all();
      return rows.length;
    },
  };
}

export type ApiTokensRepo = ReturnType<typeof createApiTokensRepo>;

// Backward-compatible global singleton (uses db Proxy)
export const apiTokensRepo = createApiTokensRepo(db);
