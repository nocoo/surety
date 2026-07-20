import { Hono } from "hono";
import type { AppEnv } from "../lib/types";

const LEGACY_SENSITIVE_PREFIX = "totp.";
function isLegacySensitiveKey(key: string): boolean {
	return key.startsWith(LEGACY_SENSITIVE_PREFIX);
}

const app = new Hono<AppEnv>();

app.get("/api/settings", async (c) => {
	const repos = c.get("repos");
	const settings = await repos.settings.findAll();
	return c.json(
		settings
			.filter((s: { key: string }) => !isLegacySensitiveKey(s.key))
			.map((s: { key: string; value: string }) => ({ key: s.key, value: s.value })),
	);
});

app.post("/api/settings", async (c) => {
	const repos = c.get("repos");
	const body = await c.req.json();
	if (!body.key || body.value === undefined)
		return c.json({ error: "key and value are required" }, 400);
	if (isLegacySensitiveKey(String(body.key)))
		return c.json({ error: "Cannot modify legacy sensitive settings" }, 403);
	const setting = await repos.settings.set(body.key, String(body.value));
	return c.json({ key: setting.key, value: setting.value }, 201);
});

// Backy routes MUST come before /api/settings/:key to avoid param capture
app.get("/api/settings/backy", async (c) => {
	const repos = c.get("repos");
	const webhookUrl = (await repos.settings.get("backy.webhookUrl")) ?? "";
	const apiKey = (await repos.settings.get("backy.apiKey")) ?? "";
	const masked = apiKey ? `${"*".repeat(Math.max(0, apiKey.length - 4))}${apiKey.slice(-4)}` : "";
	return c.json({ webhookUrl, apiKey: masked, hasApiKey: apiKey.length > 0, environment: "prod" });
});

app.put("/api/settings/backy", async (c) => {
	const repos = c.get("repos");
	const body = await c.req.json();
	const webhookUrl = typeof body.webhookUrl === "string" ? body.webhookUrl.trim() : "";
	const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
	if (!webhookUrl) return c.json({ error: "webhookUrl is required" }, 400);
	if (!apiKey) return c.json({ error: "apiKey is required" }, 400);
	await repos.settings.set("backy.webhookUrl", webhookUrl);
	await repos.settings.set("backy.apiKey", apiKey);
	const masked = `${"*".repeat(Math.max(0, apiKey.length - 4))}${apiKey.slice(-4)}`;
	return c.json({ webhookUrl, apiKey: masked, hasApiKey: true, environment: "prod" });
});

app.get("/api/settings/backy/history", async (c) => {
	const repos = c.get("repos");
	const webhookUrl = (await repos.settings.get("backy.webhookUrl")) ?? "";
	const apiKey = (await repos.settings.get("backy.apiKey")) ?? "";
	if (!webhookUrl || !apiKey)
		return c.json({ error: "Backy webhook URL and API key must be configured first" }, 400);
	try {
		const res = await fetch(webhookUrl, {
			method: "GET",
			headers: { Authorization: `Bearer ${apiKey}` },
		});
		if (!res.ok) {
			const text = await res.text().catch(() => "");
			return c.json({ error: text || `HTTP ${res.status}` }, 502);
		}
		return c.json(await res.json());
	} catch (err) {
		return c.json({ error: err instanceof Error ? err.message : String(err) }, 502);
	}
});

app.post("/api/settings/backy/test", async (c) => {
	const repos = c.get("repos");
	const webhookUrl = (await repos.settings.get("backy.webhookUrl")) ?? "";
	const apiKey = (await repos.settings.get("backy.apiKey")) ?? "";
	if (!webhookUrl || !apiKey)
		return c.json({ error: "Backy webhook URL and API key must be configured first" }, 400);
	try {
		const res = await fetch(webhookUrl, {
			method: "HEAD",
			headers: { Authorization: `Bearer ${apiKey}` },
		});
		return c.json({ success: res.ok, status: res.status });
	} catch (err) {
		return c.json(
			{ success: false, status: 0, error: err instanceof Error ? err.message : String(err) },
			502,
		);
	}
});

app.post("/api/settings/backy/push", async (c) => {
	const repos = c.get("repos");
	const db = c.get("db");
	const webhookUrl = (await repos.settings.get("backy.webhookUrl")) ?? "";
	const apiKey = (await repos.settings.get("backy.apiKey")) ?? "";
	if (!webhookUrl || !apiKey)
		return c.json({ error: "Backy webhook URL and API key must be configured first" }, 400);

	const { buildBackup, buildBackupFilename } = await import("@surety/db/backup");
	const { APP_VERSION } = await import("@surety/api/lib/version");

	const start = Date.now();
	const backup = await buildBackup(db);
	const json = JSON.stringify(backup, null, 2);
	const date = new Date().toISOString().slice(0, 10);
	const d = backup.data;
	const stats = `${d.members.length}mem-${d.policies.length}pol-${d.assets.length}ast-${d.insurers.length}ins`;
	const tag = `v${APP_VERSION}-${date}-${stats}`;
	const filename = buildBackupFilename();

	const form = new FormData();
	form.append("file", new Blob([json], { type: "application/json" }), filename);
	form.append("environment", "prod");
	form.append("tag", tag);

	const requestMeta = {
		url: webhookUrl,
		method: "POST" as const,
		environment: "prod",
		tag,
		fileName: filename,
		fileSizeBytes: json.length,
		backupStats: {
			members: d.members.length,
			insurers: d.insurers.length,
			assets: d.assets.length,
			policies: d.policies.length,
			beneficiaries: d.beneficiaries.length,
			payments: d.payments.length,
			cashValues: d.cashValues.length,
			coverageItems: d.coverageItems.length,
			settings: d.settings.length,
		},
	};

	try {
		const res = await fetch(webhookUrl, {
			method: "POST",
			headers: { Authorization: `Bearer ${apiKey}` },
			body: form,
		});
		let body: unknown;
		const text = await res.text().catch(() => "");
		try {
			body = JSON.parse(text);
		} catch {
			body = text || null;
		}
		if (!res.ok)
			return c.json(
				{
					success: false,
					error: `Backy returned HTTP ${res.status}`,
					request: requestMeta,
					response: { status: res.status, body },
					durationMs: Date.now() - start,
				},
				502,
			);
		return c.json({
			success: true,
			request: requestMeta,
			response: { status: res.status, body },
			durationMs: Date.now() - start,
		});
	} catch (err) {
		return c.json(
			{
				success: false,
				error: err instanceof Error ? err.message : String(err),
				request: requestMeta,
				response: { status: 0, body: null },
				durationMs: Date.now() - start,
			},
			502,
		);
	}
});

// Generic key-value routes (after backy to avoid param capture)
app.get("/api/settings/:key", async (c) => {
	const repos = c.get("repos");
	const key = c.req.param("key");
	if (!key) return c.json({ error: "Invalid key" }, 400);
	if (isLegacySensitiveKey(key))
		return c.json({ error: "Cannot access legacy sensitive settings" }, 403);
	const value = await repos.settings.get(key);
	return c.json({ key, value: value ?? null });
});

app.put("/api/settings/:key", async (c) => {
	const repos = c.get("repos");
	const key = c.req.param("key");
	if (!key) return c.json({ error: "Invalid key" }, 400);
	if (isLegacySensitiveKey(key))
		return c.json({ error: "Cannot access legacy sensitive settings" }, 403);
	const body = await c.req.json();
	if (body.value === undefined) return c.json({ error: "value is required" }, 400);
	const setting = await repos.settings.set(key, String(body.value));
	return c.json({ key: setting.key, value: setting.value });
});

app.delete("/api/settings/:key", async (c) => {
	const repos = c.get("repos");
	const key = c.req.param("key");
	if (!key) return c.json({ error: "Invalid key" }, 400);
	if (isLegacySensitiveKey(key))
		return c.json({ error: "Cannot access legacy sensitive settings" }, 403);
	const deleted = await repos.settings.delete(key);
	if (!deleted) return c.json({ error: "Setting not found" }, 404);
	return c.json({ success: true });
});

export default app;
