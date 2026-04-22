import { Hono } from "hono";
import { buildMemberCoverageData, buildAssetCoverageData, type SelectionType } from "@surety/api/coverage-lookup";
import { deriveDisplayStatus, type PolicyDbStatus } from "@surety/db/types";
import type { AppEnv } from "../lib/types";

const app = new Hono<AppEnv>();

app.get("/api/coverage-lookup", async (c) => {
  const repos = c.get("repos");
  const selectionType = (c.req.query("type") ?? "member") as SelectionType;
  const idParam = c.req.query("id");
  const selectedId = idParam ? parseInt(idParam, 10) : undefined;

  const allMembers = await repos.members.findAll();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const members = allMembers.map((m: any) => ({ id: m.id, name: m.name, relation: m.relation, gender: m.gender }));

  const allAssets = await repos.assets.findAll();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const assets = allAssets.map((a: any) => ({ id: a.id, name: a.name, type: a.type, identifier: a.identifier }));

  const allInsurers = await repos.insurers.findAll();
  const insurerPhoneMap = new Map<string, string | null>();
  for (const insurer of allInsurers) insurerPhoneMap.set(insurer.name, insurer.phone);

  const allPolicies = await repos.policies.findAll();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const policiesByMember = new Map<number, any[]>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const policiesByAsset = new Map<number, any[]>();

  for (const policy of allPolicies) {
    const pd = {
      id: policy.id, productName: policy.productName, category: policy.category,
      subCategory: policy.subCategory, sumAssured: policy.sumAssured, premium: policy.premium,
      insurerName: policy.insurerName, insurerPhone: insurerPhoneMap.get(policy.insurerName) ?? null,
      effectiveDate: policy.effectiveDate, expiryDate: policy.expiryDate,
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

  const data = selectionType === "asset"
    ? buildAssetCoverageData(members, assets, policiesByMember, policiesByAsset, selectedId)
    : buildMemberCoverageData(members, assets, policiesByMember, policiesByAsset, selectedId);

  return c.json(data);
});

export default app;
