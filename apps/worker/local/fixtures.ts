import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { NativeInstance } from "./native";

export const ANCHOR = "2026-09-28";
export async function seedCatalog(instance: NativeInstance, persistent: boolean) {
	const marker = resolve(instance.path, "catalog.json");
	if (persistent && (await Bun.file(marker).exists())) return;
	async function post(path: string, body: object) {
		const res = await instance.request(path, {
			method: "POST",
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
	const policies = [];
	for (const [index, category] of ["Health", "Life", "Accident", "Savings", "Property"].entries()) {
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
				][index],
				policyNumber: `DEMO-2026-00${index + 1}`,
				effectiveDate: "2026-01-01",
				expiryDate: index === 2 ? "2026-08-31" : "2027-01-01",
				nextDueDate: "2026-10-15",
				premium: [3600, 5200, 680, 12000, 960][index],
				sumAssured: [2000000, 1000000, 500000, 200000, 1500000][index],
				paymentFrequency: "Yearly",
				paymentYears: 10,
				notes: "原创合成示范数据，无真实投保或理赔效力。",
			}),
		);
	}
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
		visitType: "Outpatient",
		visitReason: "年度健康复诊",
		diagnosis: "年度健康复诊",
		notes: "合成病历：规律作息，按计划复查。",
		totalCost: 360,
	});
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
