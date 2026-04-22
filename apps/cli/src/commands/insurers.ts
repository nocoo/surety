import { defineCrudCommand } from "../lib/crud.js";

interface Insurer extends Record<string, unknown> {
  id: number;
  name: string;
  phone?: string | null;
  website?: string | null;
}

export const insurersCommand = defineCrudCommand<Insurer>({
  name: "insurers",
  description: "Manage insurance companies",
  basePath: "/api/insurers",
  summarize: (i) => ({ id: i.id, name: i.name }),
});
