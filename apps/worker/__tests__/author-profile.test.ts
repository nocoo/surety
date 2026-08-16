import { describe, expect, test } from "vitest";
import {
	AUTHOR_PROFILE_ENDPOINT,
	fetchAuthorProfile,
	hashEmail,
	normalizeEmail,
} from "../src/lib/author-profile";

const KNOWN_EMAIL = "architie@gmail.com";
const KNOWN_HASH = "7ba563171c26fb9b82e9f7750840c0455602eb35025192027230bcb40aae1217";

describe("normalizeEmail / hashEmail", () => {
	test("trims and lowercases", () => {
		expect(normalizeEmail("  Architie@Gmail.com  ")).toBe(KNOWN_EMAIL);
	});

	test("SHA-256 of UTF-8 bytes is 64-char lowercase hex", async () => {
		const hash = await hashEmail(KNOWN_EMAIL);
		expect(hash).toBe(KNOWN_HASH);
		expect(hash).toMatch(/^[0-9a-f]{64}$/);
	});

	test("normalization is applied before hashing", async () => {
		expect(await hashEmail("  ARCHITIE@GMAIL.COM\n")).toBe(KNOWN_HASH);
	});
});

describe("fetchAuthorProfile", () => {
	test("GETs the public profile endpoint with the email hash", async () => {
		const fetchFn = async (input: RequestInfo | URL) => {
			expect(String(input)).toBe(`${AUTHOR_PROFILE_ENDPOINT}?hash=${KNOWN_HASH}`);
			return new Response(
				JSON.stringify({ name: "Zheng Li", avatar: "https://img.example/a.jpg" }),
				{
					status: 200,
				},
			);
		};
		await expect(fetchAuthorProfile(KNOWN_EMAIL, fetchFn)).resolves.toEqual({
			name: "Zheng Li",
			avatar: "https://img.example/a.jpg",
		});
	});

	test("treats null fields as a miss", async () => {
		const fetchFn = async () =>
			new Response(JSON.stringify({ name: null, avatar: null }), { status: 200 });
		await expect(fetchAuthorProfile(KNOWN_EMAIL, fetchFn)).resolves.toEqual({
			name: null,
			avatar: null,
		});
	});

	test("treats 429 and other errors as a miss", async () => {
		const fetchFn = async () => new Response("slow down", { status: 429 });
		await expect(fetchAuthorProfile(KNOWN_EMAIL, fetchFn)).resolves.toEqual({
			name: null,
			avatar: null,
		});
	});

	test("treats network failure as a miss", async () => {
		const fetchFn = async () => {
			throw new Error("offline");
		};
		await expect(fetchAuthorProfile(KNOWN_EMAIL, fetchFn)).resolves.toEqual({
			name: null,
			avatar: null,
		});
	});

	test("treats empty strings and non-objects as a miss", async () => {
		const empty = async () =>
			new Response(JSON.stringify({ name: "", avatar: "" }), { status: 200 });
		const junk = async () => new Response(JSON.stringify("nope"), { status: 200 });
		await expect(fetchAuthorProfile(KNOWN_EMAIL, empty)).resolves.toEqual({
			name: null,
			avatar: null,
		});
		await expect(fetchAuthorProfile(KNOWN_EMAIL, junk)).resolves.toEqual({
			name: null,
			avatar: null,
		});
	});
});
