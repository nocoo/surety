/**
 * L3 global teardown — best-effort cleanup of seeded rows. The wrangler
 * persist directory is also wiped at the start of every run, so failure
 * here is not fatal.
 */

const PORT = Number(process.env.L3_PORT ?? 27012);
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function deleteAll(path: string): Promise<void> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { accept: "application/json" },
    });
    if (!res.ok) return;
    const items = (await res.json()) as Array<{ id: number }>;
    for (const item of items) {
      await fetch(`${BASE_URL}${path}/${item.id}`, { method: "DELETE" });
    }
  } catch {
    // wrangler may already be tearing down — silent
  }
}

export default async function globalTeardown(): Promise<void> {
  // Order matters: leaf resources before parents.
  await deleteAll("/api/policies");
  await deleteAll("/api/members");
}
