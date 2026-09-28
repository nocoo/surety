import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { NativeInstance } from "./native";

export const ANCHOR = "2026-09-28";
export async function seedCatalog(instance: NativeInstance, persistent: boolean) {
	const marker = resolve(instance.path, "catalog.json");
	if (persistent && (await Bun.file(marker).exists())) return;
	const existing = await instance.request("/api/members");
	if (!existing.ok || ((await existing.json()) as unknown[]).length)
		throw new Error(
			"Catalog missing on nonempty storage; inspect data and explicitly reset Demo before seeding",
		);
	const premiums = [3600, 5200, 680, 12000, 960, 8000, 6400];
	async function post(path: string, body: object, method = "POST") {
		const res = await instance.request(path, {
			method,
			headers: { "content-type": "application/json" },
			body: JSON.stringify(body),
		});
		if (!res.ok) throw new Error(`Fixture ${path}: ${res.status} ${await res.text()}`);
		return (await res.json()) as { id: number };
	}
	const members = [];
	for (const [name, relation, gender, birthDate] of [
		["林知远", "Self", "M", "1988-03-12"],
		["陈映秋", "Spouse", "F", "1990-08-21"],
		["林小满", "Child", "F", "2017-05-06"],
		["林青山", "Parent", "M", "1959-11-18"],
	])
		members.push(
			await post("/api/members", { name, relation, gender, birthDate, hasSocialInsurance: true }),
		);
	const owner = members[0]?.id;
	const home = await post("/api/assets", {
		type: "RealEstate",
		name: "云杉示范公寓",
		identifier: "DEMO-HOME-001",
		ownerId: owner,
		details: "原创合成家庭住宅，用于演示",
	});
	await post("/api/assets", {
		type: "Vehicle",
		name: "晨光旅行车",
		identifier: "DEMO-CAR-001",
		ownerId: owner,
	});
	for (const [name, website] of [
		["云杉示范保险", "https://spruce.example.invalid"],
		["青禾示范保险", "https://meadow.example.invalid"],
	])
		await post("/api/insurers", { name, website, phone: "+1-202-555-0147" });
	const policies = [];
	for (const [index, category] of [
		"Medical",
		"Life",
		"Accident",
		"Annuity",
		"Property",
		"WholeLife",
		"CriticalIllness",
	].entries()) {
		policies.push(
			await post("/api/policies", {
				applicantId: owner,
				insuredType: category === "Property" ? "Asset" : "Member",
				insuredMemberId: members[index % members.length]?.id,
				insuredAssetId: home.id,
				category,
				insurerName: index % 2 ? "青禾示范保险" : "云杉示范保险",
				productName: [
					"安心住院医疗",
					"家庭守护定期寿险",
					"少年平安意外保障",
					"岁月年金计划",
					"温暖家园财产险",
					"长青终身寿险",
					"安心重大疾病保障",
				][index],
				policyNumber: `DEMO-2026-00${index + 1}`,
				effectiveDate: index === 0 ? "2025-09-01" : "2025-10-15",
				expiryDate: index === 2 ? "2026-08-31" : "2027-01-01",
				nextDueDate: index === 0 ? "2026-09-01" : "2026-10-15",
				premium: premiums[index],
				sumAssured: [2000000, 1000000, 500000, 200000, 1500000, 600000, 500000][index],
				paymentFrequency: "Yearly",
				paymentYears: 10,
				notes: "原创合成示范数据，无真实投保或理赔效力。",
			}),
		);
	}
	for (const [index, policy] of policies.entries()) {
		await post(`/api/policies/${policy.id}/coverage-items`, {
			name: index === 0 ? "住院医疗费用补偿" : "基本保障",
			periodLimit: 500000,
			deductible: index === 0 ? 10000 : 0,
			coveragePercent: 100,
			notes: "以示范合同条款为准",
		});
		await post(`/api/policies/${policy.id}/payments`, {
			periodNumber: 1,
			dueDate: index === 0 ? "2025-09-01" : "2025-10-15",
			amount: premiums[index],
			status: "Paid",
			paidDate: index === 0 ? "2025-09-01" : "2025-10-15",
			paidAmount: premiums[index],
		});
		if (index !== 2)
			await post(`/api/policies/${policy.id}/payments`, {
				periodNumber: 2,
				dueDate: index === 0 ? "2026-09-01" : "2026-10-15",
				amount: premiums[index],
				status: "Pending",
			});
	}
	await post(
		`/api/policies/${policies[3]?.id}/planned-surrender`,
		{ plannedSurrenderAt: "2027-01-01", plannedSurrenderNote: "年度预算调整评估" },
		"PUT",
	);
	for (const [index, status] of ["Surrendered", "Lapsed", "Claimed"].entries()) {
		const policy = await post("/api/policies", {
			applicantId: owner,
			insuredType: "Member",
			insuredMemberId: owner,
			category: "Life",
			insurerName: "云杉示范保险",
			productName: `历史保障 · ${status}`,
			policyNumber: `DEMO-HISTORY-${index}`,
			effectiveDate: "2025-01-01",
			premium: 2400,
			sumAssured: 300000,
			paymentFrequency: "Yearly",
		});
		await post(`/api/policies/${policy.id}/terminate`, {
			status,
			terminatedAt: "2026-08-01",
			terminationReason: "合成历史状态场景",
		});
	}
	for (const name of ["family-protection.png", "family-protection.pdf"]) {
		const form = new FormData();
		form.append("file", Bun.file(resolve(import.meta.dirname, "media", name)), name);
		const upload = await instance.request(`/api/policies/${policies[0]?.id}/attachments`, {
			method: "POST",
			body: form,
		});
		if (!upload.ok) throw new Error(`Fixture attachment: ${await upload.text()}`);
	}
	await instance.seedSql(
		`INSERT INTO beneficiaries (policy_id, member_id, share_percent, rank_order) VALUES (${policies[1]?.id}, ${members[1]?.id}, 100, 1); INSERT INTO cash_values (policy_id, policy_year, value) VALUES (${policies[5]?.id}, 1, 6800), (${policies[5]?.id}, 2, 14200), (${policies[5]?.id}, 3, 22800);`,
	);
	const hospital = await post("/api/hospitals", {
		name: "云杉示范医院",
		level: "三甲",
		isPublic: true,
		address: "示范市晨光路 18 号",
	});
	const doctor = await post("/api/doctors", {
		name: "许若宁",
		hospitalId: hospital.id,
		department: "全科医学科",
		title: "主任医师",
	});
	await post("/api/medical-visits", {
		memberId: owner,
		hospitalId: hospital.id,
		doctorId: doctor.id,
		visitDate: "2026-09-12",
		visitType: "门诊",
		visitReason: "年度健康复诊",
		symptoms: JSON.stringify(["睡眠改善", "例行随访"]),
		visitTimeStart: "09:30",
		visitTimeEnd: "10:00",
		diagnosis: "年度健康复诊",
		notes: "合成病历：规律作息，按计划复查。",
		totalCost: 360,
	});
	const clinic = await post("/api/hospitals", {
		name: "青禾儿童诊所",
		level: "专科",
		isPublic: false,
		address: "示范市青禾街 7 号",
	});
	await post("/api/medical-visits", {
		memberId: members[2]?.id,
		hospitalId: clinic.id,
		visitDate: "2026-08-20",
		visitType: "急诊",
		visitReason: "运动擦伤",
		symptoms: JSON.stringify(["皮肤擦伤", "局部红肿"]),
		diagnosis: "浅表皮肤擦伤",
		treatment: "清洁消毒，随访观察",
		totalCost: 260,
		insurancePaid: 160,
		selfPaid: 100,
	});
	await post(
		"/api/settings/backy",
		{ webhookUrl: "https://backy.example.invalid/webhook", apiKey: "synthetic-demo-provider" },
		"PUT",
	);
	const minted = await instance.request(
		"/api/auth/cli?callback_url=http%3A%2F%2Flocalhost%3A43210%2Fcallback&state=fixture",
		{
			headers: {
				"sec-fetch-mode": "navigate",
				"sec-fetch-dest": "document",
				"sec-fetch-site": "none",
			},
		},
	);
	if (minted.status !== 302) throw new Error("Fixture token issuance failed");
	for (const [key, value] of Object.entries({
		annualIncome: "480000",
		reminderDays: "30",
		currency: "CNY",
	}))
		await post("/api/settings", { key, value });
	await writeFile(
		marker,
		JSON.stringify({
			version: instance.fixtureVersion,
			anchor: ANCHOR,
			timezone: "Asia/Shanghai",
			policies,
		}),
		{ mode: 0o600 },
	);
}
