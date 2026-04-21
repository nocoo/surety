import { Hono } from "hono";
import type { AppEnv } from "../lib/types";

const app = new Hono<AppEnv>();

app.get("/api/insurers", async (c) => {
  const repos = c.get("repos");
  const insurers = await repos.insurers.findAll();
  const policies = await repos.policies.findAll();
  const policyCountMap = new Map<string, number>();
  for (const policy of policies) {
    policyCountMap.set(policy.insurerName, (policyCountMap.get(policy.insurerName) ?? 0) + 1);
  }
  return c.json(insurers.map((i: { id: number; name: string; phone: string | null; website: string | null }) => ({
    id: i.id, name: i.name, phone: i.phone, website: i.website,
    policyCount: policyCountMap.get(i.name) ?? 0,
  })));
});

app.post("/api/insurers", async (c) => {
  const repos = c.get("repos");
  const body = await c.req.json();
  if (!body.name) return c.json({ error: "name is required" }, 400);
  const existing = await repos.insurers.findByName(body.name);
  if (existing) return c.json({ error: "Insurer with this name already exists" }, 409);
  const insurer = await repos.insurers.create({ name: body.name, phone: body.phone || null, website: body.website || null });
  return c.json({ id: insurer.id, name: insurer.name, phone: insurer.phone, website: insurer.website }, 201);
});

app.get("/api/insurers/:id", async (c) => {
  const repos = c.get("repos");
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Invalid id" }, 400);
  const insurer = await repos.insurers.findById(id);
  if (!insurer) return c.json({ error: "Insurer not found" }, 404);
  return c.json({ id: insurer.id, name: insurer.name, phone: insurer.phone, website: insurer.website });
});

app.put("/api/insurers/:id", async (c) => {
  const repos = c.get("repos");
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Invalid id" }, 400);
  const body = await c.req.json();
  if (body.name) {
    const existing = await repos.insurers.findByName(body.name);
    if (existing && existing.id !== id) return c.json({ error: "Insurer with this name already exists" }, 409);
  }
  const updated = await repos.insurers.update(id, { name: body.name, phone: body.phone, website: body.website });
  if (!updated) return c.json({ error: "Insurer not found" }, 404);
  return c.json({ id: updated.id, name: updated.name, phone: updated.phone, website: updated.website });
});

app.delete("/api/insurers/:id", async (c) => {
  const repos = c.get("repos");
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Invalid id" }, 400);
  const policies = await repos.policies.findAll();
  const linked = policies.filter((p: { insurerId: number }) => p.insurerId === id);
  if (linked.length > 0) return c.json({ error: `该保险公司关联了 ${linked.length} 份保单，无法删除` }, 409);
  const deleted = await repos.insurers.delete(id);
  if (!deleted) return c.json({ error: "Insurer not found" }, 404);
  return c.json({ success: true });
});

export default app;
