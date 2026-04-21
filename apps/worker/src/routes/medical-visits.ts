import { Hono } from "hono";
import type { AppEnv } from "../lib/types";

const app = new Hono<AppEnv>();

app.get("/api/medical-visits", async (c) => {
  const repos = c.get("repos");
  return c.json(await repos.medicalVisits.findAll());
});

app.post("/api/medical-visits", async (c) => {
  const repos = c.get("repos");
  const body = await c.req.json();
  if (!body.memberId || !body.hospitalId || !body.visitDate || !body.visitType || !body.visitReason) {
    return c.json({ error: "memberId, hospitalId, visitDate, visitType, and visitReason are required" }, 400);
  }
  const visit = await repos.medicalVisits.create({
    memberId: body.memberId, hospitalId: body.hospitalId, doctorId: body.doctorId ?? null,
    visitDate: body.visitDate, visitTimeStart: body.visitTimeStart ?? null,
    visitTimeEnd: body.visitTimeEnd ?? null, visitType: body.visitType,
    visitReason: body.visitReason, department: body.department ?? null,
    symptoms: body.symptoms ?? null, diagnosis: body.diagnosis ?? null,
    treatment: body.treatment ?? null, totalCost: body.totalCost ?? null,
    insurancePaid: body.insurancePaid ?? null, selfPaid: body.selfPaid ?? null,
    notes: body.notes ?? null,
  });
  return c.json(visit, 201);
});

app.get("/api/medical-visits/:id", async (c) => {
  const repos = c.get("repos");
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Invalid id" }, 400);
  const visit = await repos.medicalVisits.findById(id);
  if (!visit) return c.json({ error: "Visit not found" }, 404);
  return c.json(visit);
});

app.put("/api/medical-visits/:id", async (c) => {
  const repos = c.get("repos");
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Invalid id" }, 400);
  const body = await c.req.json();
  const updated = await repos.medicalVisits.update(id, {
    memberId: body.memberId, hospitalId: body.hospitalId, doctorId: body.doctorId,
    visitDate: body.visitDate, visitTimeStart: body.visitTimeStart,
    visitTimeEnd: body.visitTimeEnd, visitType: body.visitType,
    visitReason: body.visitReason, department: body.department,
    symptoms: body.symptoms, diagnosis: body.diagnosis,
    treatment: body.treatment, totalCost: body.totalCost,
    insurancePaid: body.insurancePaid, selfPaid: body.selfPaid,
    notes: body.notes,
  });
  if (!updated) return c.json({ error: "Visit not found" }, 404);
  return c.json(updated);
});

app.delete("/api/medical-visits/:id", async (c) => {
  const repos = c.get("repos");
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Invalid id" }, 400);
  const deleted = await repos.medicalVisits.delete(id);
  if (!deleted) return c.json({ error: "Visit not found" }, 404);
  return c.json({ success: true });
});

export default app;
