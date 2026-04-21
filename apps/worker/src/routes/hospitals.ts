import { Hono } from "hono";
import type { AppEnv } from "../lib/types";

const app = new Hono<AppEnv>();

app.get("/api/hospitals", async (c) => {
  const repos = c.get("repos");
  return c.json(await repos.hospitals.findAll());
});

app.post("/api/hospitals", async (c) => {
  const repos = c.get("repos");
  const body = await c.req.json();
  if (!body.name) return c.json({ error: "name is required" }, 400);
  const hospital = await repos.hospitals.create({
    name: body.name, level: body.level ?? null, isPublic: body.isPublic ?? true,
    address: body.address ?? null, phone: body.phone ?? null, notes: body.notes ?? null,
  });
  return c.json(hospital, 201);
});

app.get("/api/hospitals/:id", async (c) => {
  const repos = c.get("repos");
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Invalid id" }, 400);
  const hospital = await repos.hospitals.findById(id);
  if (!hospital) return c.json({ error: "Hospital not found" }, 404);
  return c.json(hospital);
});

app.put("/api/hospitals/:id", async (c) => {
  const repos = c.get("repos");
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Invalid id" }, 400);
  const body = await c.req.json();
  const updated = await repos.hospitals.update(id, {
    name: body.name, level: body.level, isPublic: body.isPublic,
    address: body.address, phone: body.phone, notes: body.notes,
  });
  if (!updated) return c.json({ error: "Hospital not found" }, 404);
  return c.json(updated);
});

app.delete("/api/hospitals/:id", async (c) => {
  const repos = c.get("repos");
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Invalid id" }, 400);
  const doctors = await repos.doctors.findByHospitalId(id);
  if (doctors.length > 0) return c.json({ error: `该医院关联了 ${doctors.length} 位医生，无法删除` }, 409);
  const deleted = await repos.hospitals.delete(id);
  if (!deleted) return c.json({ error: "Hospital not found" }, 404);
  return c.json({ success: true });
});

export default app;
