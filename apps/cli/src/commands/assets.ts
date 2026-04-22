import { defineCrudCommand } from "../lib/crud.js";

interface Asset extends Record<string, unknown> {
  id: number;
  type: string;
  name: string;
  identifier: string;
  ownerId?: number | null;
}

export const assetsCommand = defineCrudCommand<Asset>({
  name: "assets",
  description: "Manage insurable assets (real estate, vehicles)",
  basePath: "/api/assets",
  summarize: (a) => ({
    id: a.id,
    type: a.type,
    name: a.name,
    identifier: a.identifier,
  }),
});
