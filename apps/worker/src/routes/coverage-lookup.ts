import {
	buildAssetCoverageData,
	buildMemberCoverageData,
	type PolicyForCoverage,
	type SelectionType,
} from "@surety/api/coverage-lookup";
import { deriveDisplayStatus, type PolicyDbStatus } from "@surety/db/types";
import { Hono } from "hono";
import type { AppEnv } from "../lib/types";

const app = new Hono<AppEnv>();

app.get("/api/coverage-lookup", async (c) => {
	const repos = c.get("repos");
	const selectionType = (c.req.query("type") ?? "member") as SelectionType;
	const idParam = c.req.query("id");
	const selectedId = idParam ? parseInt(idParam, 10) : undefined;

	const allMembers = await repos.members.findAll();
	const members = allMembers.map((m) => ({
		id: m.id,
		name: m.name,
		relation: m.relation,
		gender: m.gender,
	}));

	const allAssets = await repos.assets.findAll();
	const assets = allAssets.map((a) => ({
		id: a.id,
		name: a.name,
		type: a.type,
		identifier: a.identifier,
	}));

	const allInsurers = await repos.insurers.findAll();
	const insurerPhoneMap = new Map<string, string | null>();
	for (const insurer of allInsurers) insurerPhoneMap.set(insurer.name, insurer.phone);

	const allPolicies = await repos.policies.findAll();
	const policiesByMember = new Map<number, PolicyForCoverage[]>();
	const policiesByAsset = new Map<number, PolicyForCoverage[]>();

	for (const policy of allPolicies) {
		const pd: PolicyForCoverage = {
			id: policy.id,
			productName: policy.productName,
			category: policy.category,
			subCategory: policy.subCategory,
			sumAssured: policy.sumAssured,
			premium: policy.premium,
			insurerName: policy.insurerName,
			insurerPhone: insurerPhoneMap.get(policy.insurerName) ?? null,
			effectiveDate: policy.effectiveDate,
			expiryDate: policy.expiryDate,
			status: deriveDisplayStatus(policy.status as PolicyDbStatus, policy.expiryDate),
		};
		if (policy.insuredMemberId) {
			const existing = policiesByMember.get(policy.insuredMemberId) ?? [];
			existing.push(pd);
			policiesByMember.set(policy.insuredMemberId, existing);
		}
		if (policy.insuredAssetId) {
			const existing = policiesByAsset.get(policy.insuredAssetId) ?? [];
			existing.push(pd);
			policiesByAsset.set(policy.insuredAssetId, existing);
		}
	}

	const data =
		selectionType === "asset"
			? buildAssetCoverageData(members, assets, policiesByMember, policiesByAsset, selectedId)
			: buildMemberCoverageData(members, assets, policiesByMember, policiesByAsset, selectedId);

	return c.json(data);
});

export default app;
