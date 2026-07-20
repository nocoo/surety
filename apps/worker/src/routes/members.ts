import { Hono } from "hono";
import type { AppEnv } from "../lib/types";

const app = new Hono<AppEnv>();

app.get("/api/members", async (c) => {
	const repos = c.get("repos");
	const members = await repos.members.findAll();

	const result = await Promise.all(
		members.map(async (m) => ({
			id: m.id,
			name: m.name,
			relation: m.relation,
			gender: m.gender,
			birthDate: m.birthDate,
			idCard: m.idCard,
			idType: m.idType,
			idExpiry: m.idExpiry,
			phone: m.phone,
			hasSocialInsurance: m.hasSocialInsurance,
			policyCount: (await repos.policies.findByInsuredMemberId(m.id)).length,
		})),
	);

	return c.json(result);
});

app.post("/api/members", async (c) => {
	const repos = c.get("repos");
	const body = await c.req.json();

	if (!body.name || !body.relation) {
		return c.json({ error: "name and relation are required" }, 400);
	}

	const member = await repos.members.create({
		name: body.name,
		relation: body.relation,
		gender: body.gender || null,
		birthDate: body.birthDate || null,
		idCard: body.idCard || null,
		idType: body.idType || null,
		idExpiry: body.idExpiry || null,
		phone: body.phone || null,
		hasSocialInsurance: body.hasSocialInsurance ?? null,
	});

	return c.json(
		{
			id: member.id,
			name: member.name,
			relation: member.relation,
			gender: member.gender,
			birthDate: member.birthDate,
			idCard: member.idCard,
			idType: member.idType,
			idExpiry: member.idExpiry,
			phone: member.phone,
			hasSocialInsurance: member.hasSocialInsurance,
		},
		201,
	);
});

app.get("/api/members/:id", async (c) => {
	const repos = c.get("repos");
	const memberId = parseInt(c.req.param("id"), 10);
	if (Number.isNaN(memberId)) return c.json({ error: "Invalid id" }, 400);

	const member = await repos.members.findById(memberId);
	if (!member) return c.json({ error: "Member not found" }, 404);

	return c.json({
		id: member.id,
		name: member.name,
		relation: member.relation,
		gender: member.gender,
		birthDate: member.birthDate,
		idCard: member.idCard,
		idType: member.idType,
		idExpiry: member.idExpiry,
		phone: member.phone,
		hasSocialInsurance: member.hasSocialInsurance,
	});
});

app.put("/api/members/:id", async (c) => {
	const repos = c.get("repos");
	const memberId = parseInt(c.req.param("id"), 10);
	if (Number.isNaN(memberId)) return c.json({ error: "Invalid id" }, 400);

	const body = await c.req.json();
	const updated = await repos.members.update(memberId, {
		name: body.name,
		relation: body.relation,
		gender: body.gender,
		birthDate: body.birthDate,
		idCard: body.idCard,
		idType: body.idType,
		idExpiry: body.idExpiry,
		phone: body.phone,
		hasSocialInsurance: body.hasSocialInsurance,
	});

	if (!updated) return c.json({ error: "Member not found" }, 404);

	return c.json({
		id: updated.id,
		name: updated.name,
		relation: updated.relation,
		gender: updated.gender,
		birthDate: updated.birthDate,
		idCard: updated.idCard,
		idType: updated.idType,
		idExpiry: updated.idExpiry,
		phone: updated.phone,
		hasSocialInsurance: updated.hasSocialInsurance,
	});
});

app.delete("/api/members/:id", async (c) => {
	const repos = c.get("repos");
	const memberId = parseInt(c.req.param("id"), 10);
	if (Number.isNaN(memberId)) return c.json({ error: "Invalid id" }, 400);

	const policies = await repos.policies.findAll();
	const linkedPolicies = policies.filter(
		(p) => p.applicantId === memberId || p.insuredMemberId === memberId,
	);
	if (linkedPolicies.length > 0) {
		return c.json({ error: `该成员关联了 ${linkedPolicies.length} 份保单，无法删除` }, 409);
	}

	const beneficiaryRefs = await repos.beneficiaries.findByMemberId(memberId);
	if (beneficiaryRefs.length > 0) {
		return c.json({ error: `该成员是 ${beneficiaryRefs.length} 份保单的受益人，无法删除` }, 409);
	}

	const visits = await repos.medicalVisits.findByMemberId(memberId);
	if (visits.length > 0) {
		return c.json({ error: `该成员有 ${visits.length} 条就诊记录，无法删除` }, 409);
	}

	const deleted = await repos.members.delete(memberId);
	if (!deleted) return c.json({ error: "Member not found" }, 404);

	return c.json({ success: true });
});

export default app;
