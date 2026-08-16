import { describe, expect, test } from "vitest";
import { getDisplayName } from "../lib/user";

describe("getDisplayName", () => {
	test("uses email local-part when name missing", () => {
		const { name, initial, email, avatar } = getDisplayName({
			email: "zheng@hexly.ai",
			name: null,
		});
		expect(name).toBe("zheng");
		expect(initial).toBe("Z");
		expect(email).toBe("zheng@hexly.ai");
		expect(avatar).toBeNull();
	});

	test("prefers explicit name over email", () => {
		const { name, initial } = getDisplayName({ email: "zheng@hexly.ai", name: "Zheng Li" });
		expect(name).toBe("Zheng Li");
		expect(initial).toBe("Z");
	});

	test("passes through a public avatar url", () => {
		const { avatar } = getDisplayName({
			email: "architie@gmail.com",
			name: "Zheng Li",
			avatar: "https://img.example/avatar-80.jpg",
		});
		expect(avatar).toBe("https://img.example/avatar-80.jpg");
	});

	test("treats empty avatar as missing", () => {
		const { avatar } = getDisplayName({ email: "a@b.com", name: "A", avatar: "" });
		expect(avatar).toBeNull();
	});

	test("falls back to '用户' / 'U' when no user info", () => {
		const { name, initial, email, avatar } = getDisplayName(null);
		expect(name).toBe("用户");
		expect(initial).toBe("U");
		expect(email).toBeNull();
		expect(avatar).toBeNull();
	});

	test("handles empty name string", () => {
		const { name } = getDisplayName({ email: "a@b.com", name: "" });
		expect(name).toBe("a");
	});
});
