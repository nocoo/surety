import { NextRequest, NextResponse } from "next/server";
import { getReposFromRequest } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const __auth = await requireAuth();
  if (__auth instanceof Response) return __auth;
  const { repos } = await getReposFromRequest();
  const { id } = await context.params;
  const insurerId = parseInt(id, 10);

  if (isNaN(insurerId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const insurer = await repos.insurers.findById(insurerId);

  if (!insurer) {
    return NextResponse.json({ error: "Insurer not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: insurer.id,
    name: insurer.name,
    phone: insurer.phone,
    website: insurer.website,
  });
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const __auth = await requireAuth();
  if (__auth instanceof Response) return __auth;
  const { repos } = await getReposFromRequest();
  const { id } = await context.params;
  const insurerId = parseInt(id, 10);

  if (isNaN(insurerId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await request.json();

  // Check for duplicate name if name is being updated
  if (body.name) {
    const existing = await repos.insurers.findByName(body.name);
    if (existing && existing.id !== insurerId) {
      return NextResponse.json(
        { error: "Insurer with this name already exists" },
        { status: 409 }
      );
    }
  }

  const updated = await repos.insurers.update(insurerId, {
    name: body.name,
    phone: body.phone,
    website: body.website,
  });

  if (!updated) {
    return NextResponse.json({ error: "Insurer not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    phone: updated.phone,
    website: updated.website,
  });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const __auth = await requireAuth();
  if (__auth instanceof Response) return __auth;
  const { repos } = await getReposFromRequest();
  const { id } = await context.params;
  const insurerId = parseInt(id, 10);

  if (isNaN(insurerId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  // Check FK references: policies may reference this insurer
  const policies = await repos.policies.findAll();
  const linkedPolicies = policies.filter((p) => p.insurerId === insurerId);
  if (linkedPolicies.length > 0) {
    return NextResponse.json(
      { error: `该保险公司关联了 ${linkedPolicies.length} 份保单，无法删除` },
      { status: 409 }
    );
  }

  const deleted = await repos.insurers.delete(insurerId);

  if (!deleted) {
    return NextResponse.json({ error: "Insurer not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
