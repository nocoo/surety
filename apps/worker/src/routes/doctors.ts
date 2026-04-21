import { Hono } from "hono";
import type { AppEnv } from "../lib/types";

const app = new Hono<AppEnv>();

app.get("/api/doctors", async (c) => {
  const repos = c.get("repos");
  return c.json(await repos.doctors.findAll());
});

app.post("/api/doctors", async (c) => {
  const repos = c.get("repos");
  const body = await c.req.json();
  if (!body.name || !body.hospitalId || !body.department) return c.json({ error: "name, hospitalId, and department are required" }, 400);
  const doctor = await repos.doctors.create({
    name: body.name, hospitalId: body.hospitalId, department: body.department,
    title: body.title ?? null, specialty: body.specialty ?? null,
    phone: body.phone ?? null, notes: body.notes ?? null,
  });
  return c.json(doctor, 201);
});

app.get("/api/doctors/:id", async (c) => {
  const repos = c.get("repos");
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Invalid id" }, 400);
  const doctor = await repos.doctors.findById(id);
  if (!doctor) return c.json({ error: "Doctor not found" }, 404);
  return c.json(doctor);
});

app.put("/api/doctors/:id", async (c) => {
  const repos = c.get("repos");
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Invalid id" }, 400);
  const body = await c.req.json();
  const updated = await repos.doctors.update(id, {
    name: body.name, hospitalId: body.hospitalId, department: body.department,
    title: body.title, specialty: body.specialty, phone: body.phone, notes: body.notes,
  });
  if (!updated) return c.json({ error: "Doctor not found" }, 404);
  return c.json(updated);
});

app.delete("/api/doctors/:id", async (c) => {
  const repos = c.get("repos");
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Invalid id" }, 400);
  const visits = await repos.medicalVisits.findByDoctorId(id);
  if (visits.length > 0) return c.json({ error: `该医生关联了 ${visits.length} 条就诊记录，无法删除` }, 409);
  const deleted = await repos.doctors.delete(id);
  if (!deleted) return c.json({ error: "Doctor not found" }, 404);
  return c.json({ success: true });
});

export default app;
