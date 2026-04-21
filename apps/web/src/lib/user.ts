export interface UserInfo {
  email: string | null;
  name: string | null;
  authenticated: boolean;
}

export function getDisplayName(
  user: { name?: string | null; email?: string | null } | null | undefined,
): { name: string; initial: string; email: string | null } {
  const email = user?.email ?? null;
  const rawName = user?.name;
  const derived = rawName && rawName.length > 0 ? rawName : email?.split("@")[0];
  const name = derived ?? "用户";
  const initial = (derived?.charAt(0) ?? "U").toUpperCase();
  return { name, initial, email };
}
