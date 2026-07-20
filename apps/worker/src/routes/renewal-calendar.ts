import { buildRenewalCalendarData, type PolicyForRenewal } from "@surety/api/renewal-calendar";
import { isEffectivelyActive, type PolicyDbStatus } from "@surety/db/types";
import { Hono } from "hono";
import type { AppEnv } from "../lib/types";

const app = new Hono<AppEnv>();

app.get("/api/renewal-calendar", async (c) => {
	const repos = c.get("repos");
	const policies = await repos.policies.findAll();
	const members = await repos.members.findAll();
	const activePolicies = policies.filter((p: { status: string; expiryDate: string | null }) =>
		isEffectivelyActive(p.status as PolicyDbStatus, p.expiryDate),
	);
	const memberMap = new Map(members.map((m: { id: number; name: string }) => [m.id, m.name]));

	const policiesForRenewal: PolicyForRenewal[] = activePolicies.map((p) => ({
		id: p.id,
		productName: p.productName,
		category: p.category,
		subCategory: p.subCategory,
		premium: p.premium,
		paymentFrequency: p.paymentFrequency,
		nextDueDate: p.nextDueDate,
		insuredMemberName: p.insuredMemberId ? (memberMap.get(p.insuredMemberId) ?? "未知") : "未知",
	}));

	return c.json(buildRenewalCalendarData(policiesForRenewal, new Date(), 12));
});

export default app;
