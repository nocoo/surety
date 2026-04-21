import type { AllRepos } from "@surety/db/repositories";
import type { DbInstance } from "@surety/db";

export type Bindings = {
  DB: D1Database;
  ATTACHMENTS: R2Bucket;
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
};

export type Variables = {
  accessAuthenticated?: boolean;
  db: DbInstance;
  repos: AllRepos;
};

export type AppEnv = { Bindings: Bindings; Variables: Variables };
