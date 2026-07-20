import { afterAll, describe, expect, test } from "bun:test";
import { httpJson } from "./setup";

interface Member {
	id: number;
	name: string;
	relation: string;
}

interface Policy {
	id: number;
	policyNumber: string;
	productName: string;
}

const createdMembers: number[] = [];
const createdPolicies: number[] = [];

async function createMember(name: string): Promise<Member> {
	const res = await httpJson<Member>("POST", "/api/members", {
		name,
		relation: "self",
		gender: "male",
	});
	expect(res.status).toBe(201);
	createdMembers.push(res.body.id);
	return res.body;
}

afterAll(async () => {
	for (const id of createdPolicies) {
		await httpJson("DELETE", `/api/policies/${id}`);
	}
	for (const id of createdMembers) {
		await httpJson("DELETE", `/api/members/${id}`);
	}
});

describe("L2-HTTP: members CRUD over real D1", () => {
	test("create → list → get → update → delete", async () => {
		const tag = `m-${Date.now()}`;
		const created = await createMember(tag);
		expect(typeof created.id).toBe("number");
		expect(created.id).toBeGreaterThan(0);

		const list = await httpJson<Member[]>("GET", "/api/members");
		expect(list.status).toBe(200);
		const found = list.body.find((m) => m.id === created.id);
		expect(found).toBeDefined();
		// sqlite-proxy "get" mapping trap: id must be a scalar, never an array.
		expect(Array.isArray(found?.id)).toBe(false);

		const got = await httpJson<Member>("GET", `/api/members/${created.id}`);
		expect(got.status).toBe(200);
		expect(got.body.name).toBe(tag);

		const upd = await httpJson<Member>("PUT", `/api/members/${created.id}`, {
			name: `${tag}-upd`,
			relation: "self",
		});
		expect(upd.status).toBe(200);
		expect(upd.body.name).toBe(`${tag}-upd`);

		const del = await httpJson("DELETE", `/api/members/${created.id}`);
		expect(del.status).toBe(200);
		createdMembers.splice(createdMembers.indexOf(created.id), 1);

		const after = await httpJson("GET", `/api/members/${created.id}`);
		expect(after.status).toBe(404);
	});

	test("missing required fields → 400", async () => {
		const res = await httpJson("POST", "/api/members", {});
		expect(res.status).toBe(400);
	});
});

describe("L2-HTTP: policies CRUD over real D1", () => {
	test("create with applicant → get → update → delete", async () => {
		const member = await createMember(`applicant-${Date.now()}`);
		const policyNumber = `POL-${Date.now()}`;

		const create = await httpJson<Policy>("POST", "/api/policies", {
			applicantId: member.id,
			insuredType: "Member",
			insuredMemberId: member.id,
			category: "Health",
			insurerName: "L2-Insurer",
			productName: "L2-Product",
			policyNumber,
			effectiveDate: "2026-01-01",
			sumAssured: 1000000,
			premium: 5000,
			paymentFrequency: "Yearly",
		});
		expect(create.status).toBe(201);
		expect(typeof create.body.id).toBe("number");
		createdPolicies.push(create.body.id);

		const get = await httpJson<Policy>("GET", `/api/policies/${create.body.id}`);
		expect(get.status).toBe(200);
		expect(get.body.policyNumber).toBe(policyNumber);

		const upd = await httpJson<Policy>("PUT", `/api/policies/${create.body.id}`, {
			applicantId: member.id,
			insuredType: "Member",
			insuredMemberId: member.id,
			category: "Health",
			insurerName: "L2-Insurer",
			productName: "L2-Product-v2",
			policyNumber,
			effectiveDate: "2026-01-01",
			sumAssured: 2000000,
			premium: 6000,
			paymentFrequency: "Yearly",
			status: "Active",
		});
		expect(upd.status).toBe(200);
		expect(upd.body.productName).toBe("L2-Product-v2");

		const del = await httpJson("DELETE", `/api/policies/${create.body.id}`);
		expect(del.status).toBe(200);
		createdPolicies.splice(createdPolicies.indexOf(create.body.id), 1);

		const after = await httpJson("GET", `/api/policies/${create.body.id}`);
		expect(after.status).toBe(404);
	});
});
