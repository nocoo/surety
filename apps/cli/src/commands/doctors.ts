import { defineCrudCommand } from "../lib/crud.js";

interface Doctor extends Record<string, unknown> {
	id: number;
	name: string;
	hospitalId: number;
	department: string;
	title?: string | null;
}

export const doctorsCommand = defineCrudCommand<Doctor>({
	name: "doctors",
	description: "Manage doctors",
	basePath: "/api/doctors",
	summarize: (d) => ({
		id: d.id,
		name: d.name,
		hospitalId: d.hospitalId,
		department: d.department,
	}),
});
