import { defineCrudCommand } from "../lib/crud.js";

interface Hospital extends Record<string, unknown> {
	id: number;
	name: string;
	level?: string | null;
	isPublic?: boolean | null;
}

export const hospitalsCommand = defineCrudCommand<Hospital>({
	name: "hospitals",
	description: "Manage hospitals",
	basePath: "/api/hospitals",
	summarize: (h) => ({ id: h.id, name: h.name, level: h.level }),
});
