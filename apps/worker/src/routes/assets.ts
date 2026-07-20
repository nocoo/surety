import { Hono } from "hono";
import type { AppEnv } from "../lib/types";

const app = new Hono<AppEnv>();

app.get("/api/assets", async (c) => {
	const repos = c.get("repos");
	const assets = await repos.assets.findAll();
	const members = await repos.members.findAll();
	const memberMap = new Map(members.map((m: { id: number; name: string }) => [m.id, m.name]));
	return c.json(
		assets.map((a) => ({
			id: a.id,
			type: a.type,
			name: a.name,
			identifier: a.identifier,
			ownerId: a.ownerId,
			ownerName: a.ownerId ? (memberMap.get(a.ownerId) ?? null) : null,
			details: a.details,
		})),
	);
});

app.post("/api/assets", async (c) => {
	const repos = c.get("repos");
	const body = await c.req.json();
	if (!body.type || !body.name || !body.identifier)
		return c.json({ error: "type, name, and identifier are required" }, 400);
	const asset = await repos.assets.create({
		type: body.type,
		name: body.name,
		identifier: body.identifier,
		ownerId: body.ownerId ?? null,
		details: body.details ?? null,
	});
	return c.json(asset, 201);
});

app.get("/api/assets/:id", async (c) => {
	const repos = c.get("repos");
	const id = parseInt(c.req.param("id"), 10);
	if (Number.isNaN(id)) return c.json({ error: "Invalid id" }, 400);
	const asset = await repos.assets.findById(id);
	if (!asset) return c.json({ error: "Asset not found" }, 404);
	return c.json(asset);
});

app.put("/api/assets/:id", async (c) => {
	const repos = c.get("repos");
	const id = parseInt(c.req.param("id"), 10);
	if (Number.isNaN(id)) return c.json({ error: "Invalid id" }, 400);
	const body = await c.req.json();
	const updated = await repos.assets.update(id, {
		type: body.type,
		name: body.name,
		identifier: body.identifier,
		ownerId: body.ownerId,
		details: body.details,
	});
	if (!updated) return c.json({ error: "Asset not found" }, 404);
	return c.json(updated);
});

app.delete("/api/assets/:id", async (c) => {
	const repos = c.get("repos");
	const id = parseInt(c.req.param("id"), 10);
	if (Number.isNaN(id)) return c.json({ error: "Invalid id" }, 400);
	const policies = await repos.policies.findAll();
	const linked = policies.filter((p: { insuredAssetId: number | null }) => p.insuredAssetId === id);
	if (linked.length > 0)
		return c.json({ error: `该资产关联了 ${linked.length} 份保单，无法删除` }, 409);
	const deleted = await repos.assets.delete(id);
	if (!deleted) return c.json({ error: "Asset not found" }, 404);
	return c.json({ success: true });
});

export default app;
