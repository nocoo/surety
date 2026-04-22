import { defineCrudCommand } from "../lib/crud.js";

interface Member extends Record<string, unknown> {
  id: number;
  name: string;
  relation?: string;
}

export const membersCommand = defineCrudCommand<Member>({
  name: "members",
  description: "Manage household members",
  basePath: "/api/members",
  summarize: (m) => ({ id: m.id, name: m.name, relation: m.relation }),
});
