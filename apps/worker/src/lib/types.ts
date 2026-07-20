import type { DbInstance } from "@surety/db";
import type { AllRepos } from "@surety/db/repositories";

export type Bindings = {
	DB: D1Database;
	ATTACHMENTS: R2Bucket;
	CF_ACCESS_TEAM_DOMAIN?: string;
	CF_ACCESS_AUD?: string;
	E2E_SKIP_AUTH?: string;
	ENVIRONMENT?: string;
};

export type Variables = {
	accessAuthenticated?: boolean;
	/**
	 * True only when the request is authenticated as an interactive browser
	 * session via Cloudflare Access (or a localhost dev bypass). API-key /
	 * bearer-token auth does NOT set this flag — token-management routes use
	 * it to gate operations that must not be reachable from a CLI token.
	 */
	sessionAuthenticated?: boolean;
	accessEmail?: string;
	db: DbInstance;
	repos: AllRepos;
};

export type AppEnv = { Bindings: Bindings; Variables: Variables };
