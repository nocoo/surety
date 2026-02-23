/**
 * Backy remote backup service.
 *
 * Configuration helpers for reading, masking, and validating
 * Backy webhook settings stored in the settings table.
 *
 * Push and history functions for interacting with the Backy
 * webhook API (POST to push, GET for history).
 */

import { settingsRepo } from "@/db/repositories";
import { buildBackup, buildBackupFilename, type BackupData } from "@/db/backup";
import { APP_VERSION } from "@/lib/version";

// ── Types ──

export interface BackyCredentials {
  webhookUrl: string;
  apiKey: string;
}

export interface BackySettingsResponse {
  webhookUrl: string;
  apiKey: string;
  hasApiKey: boolean;
  environment: "prod" | "dev";
}

/** A single backup entry returned by the Backy webhook GET endpoint. */
export interface BackyBackupEntry {
  id: string;
  tag: string;
  environment: string;
  file_size: number;
  is_single_json: number;
  created_at: string;
}

/** Response from the Backy webhook GET endpoint. */
export interface BackyHistoryResponse {
  project_name: string;
  environment: string | null;
  total_backups: number;
  recent_backups: BackyBackupEntry[];
}

export interface BackyPushResult {
  ok: boolean;
  status: number;
  body: unknown;
  request: {
    url: string;
    method: "POST";
    environment: "prod" | "dev";
    tag: string;
    fileName: string;
    fileSizeBytes: number;
    backupStats: {
      members: number;
      insurers: number;
      assets: number;
      policies: number;
      beneficiaries: number;
      payments: number;
      cashValues: number;
      coverageItems: number;
      settings: number;
    };
  };
  durationMs: number;
}

export interface BackyHistoryResult {
  ok: boolean;
  status: number;
  data: BackyHistoryResponse | null;
  error: string | null;
}

// ── Helpers ──

/** Mask an API key, showing only the last 4 characters. */
export function maskApiKey(key: string): string {
  if (!key) return "";
  return `${"*".repeat(Math.max(0, key.length - 4))}${key.slice(-4)}`;
}

/** Return "prod" or "dev" based on NODE_ENV. */
export function getEnvironment(): "prod" | "dev" {
  return process.env.NODE_ENV === "production" ? "prod" : "dev";
}

// ── Settings read/write ──

/** Read Backy settings from the key-value settings table. */
export function readBackySettings(): BackyCredentials {
  return {
    webhookUrl: settingsRepo.get("backy.webhookUrl") ?? "",
    apiKey: settingsRepo.get("backy.apiKey") ?? "",
  };
}

/** Write Backy settings to the key-value settings table. */
export function writeBackySettings(credentials: BackyCredentials): void {
  settingsRepo.set("backy.webhookUrl", credentials.webhookUrl);
  settingsRepo.set("backy.apiKey", credentials.apiKey);
}

// ── Push ──

/**
 * Build a backup and push it to the Backy webhook.
 *
 * Generates a JSON backup, builds a descriptive tag with version/date/stats,
 * and POSTs it as multipart/form-data to the Backy webhook.
 */
export async function pushBackupToBacky(
  credentials: BackyCredentials,
): Promise<BackyPushResult> {
  const start = Date.now();
  const backup = buildBackup();
  const json = JSON.stringify(backup, null, 2);

  const environment = getEnvironment();
  const version = process.env.npm_package_version ?? APP_VERSION;

  const date = new Date().toISOString().slice(0, 10);
  const stats = buildStatsLabel(backup);
  const tag = `v${version}-${date}-${stats}`;

  const filename = buildBackupFilename();
  const blob = new Blob([json], { type: "application/json" });

  const form = new FormData();
  form.append("file", blob, filename);
  form.append("environment", environment);
  form.append("tag", tag);

  const requestMeta = {
    url: credentials.webhookUrl,
    method: "POST" as const,
    environment,
    tag,
    fileName: filename,
    fileSizeBytes: json.length,
    backupStats: {
      members: backup.data.members.length,
      insurers: backup.data.insurers.length,
      assets: backup.data.assets.length,
      policies: backup.data.policies.length,
      beneficiaries: backup.data.beneficiaries.length,
      payments: backup.data.payments.length,
      cashValues: backup.data.cashValues.length,
      coverageItems: backup.data.coverageItems.length,
      settings: backup.data.settings.length,
    },
  };

  let res: Response;
  try {
    res = await fetch(credentials.webhookUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credentials.apiKey}`,
      },
      body: form,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      status: 0,
      body: { fetchError: message },
      request: requestMeta,
      durationMs: Date.now() - start,
    };
  }

  let body: unknown;
  const text = await res.text().catch(() => "");
  try {
    body = JSON.parse(text);
  } catch {
    body = text || null;
  }

  return {
    ok: res.ok,
    status: res.status,
    body,
    request: requestMeta,
    durationMs: Date.now() - start,
  };
}

// ── History ──

/**
 * Fetch backup history from the Backy webhook (GET).
 *
 * Returns the total backup count and the most recent entries
 * as reported by the remote Backy service.
 */
export async function fetchBackyHistory(
  credentials: BackyCredentials,
): Promise<BackyHistoryResult> {
  try {
    const res = await fetch(credentials.webhookUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${credentials.apiKey}`,
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        status: res.status,
        data: null,
        error: text || `HTTP ${res.status}`,
      };
    }

    const data = (await res.json()) as BackyHistoryResponse;
    return { ok: true, status: res.status, data, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, status: 0, data: null, error: message };
  }
}

// ── Internal helpers ──

/** Build a compact stats label from backup data. */
function buildStatsLabel(backup: BackupData): string {
  const d = backup.data;
  return [
    `${d.members.length}mem`,
    `${d.policies.length}pol`,
    `${d.assets.length}ast`,
    `${d.insurers.length}ins`,
  ].join("-");
}
