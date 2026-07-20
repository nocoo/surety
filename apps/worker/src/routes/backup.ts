import {
	type BackupData,
	buildBackup,
	buildBackupFilename,
	restoreBackup,
	validateBackup,
} from "@surety/db/backup";
import { Hono } from "hono";
import type { AppEnv } from "../lib/types";

const app = new Hono<AppEnv>();

app.get("/api/backup", async (c) => {
	const db = c.get("db");
	const backup = await buildBackup(db);
	const filename = buildBackupFilename();
	return new Response(JSON.stringify(backup, null, 2), {
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			"Content-Disposition": `attachment; filename="${filename}"`,
		},
	});
});

app.post("/api/backup", async (c) => {
	const db = c.get("db");
	const body: unknown = await c.req.json();
	const error = validateBackup(body);
	if (error) return c.json({ error }, 400);
	try {
		const counts = await restoreBackup(db, body as BackupData);
		return c.json({ success: true, restored: counts });
	} catch (err) {
		return c.json(
			{ error: `Restore failed: ${err instanceof Error ? err.message : String(err)}` },
			500,
		);
	}
});

export default app;
