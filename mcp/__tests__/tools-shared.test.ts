import { describe, expect, test } from "bun:test";
import {
  stripUndefined,
  tryParseJson,
  validateJson,
  parseLocalDate,
} from "../tools/shared";

describe("stripUndefined", () => {
  test("removes keys with undefined values", () => {
    expect(stripUndefined({ a: 1, b: undefined, c: "x" })).toEqual({ a: 1, c: "x" });
  });

  test("keeps null values", () => {
    expect(stripUndefined({ a: null, b: undefined })).toEqual({ a: null });
  });

  test("returns empty object when all values are undefined", () => {
    expect(stripUndefined({ a: undefined, b: undefined })).toEqual({});
  });

  test("keeps falsy (but defined) values", () => {
    expect(stripUndefined({ a: 0, b: "", c: false })).toEqual({ a: 0, b: "", c: false });
  });
});

describe("tryParseJson", () => {
  test("parses valid JSON objects", () => {
    expect(tryParseJson('{"a":1}')).toEqual({ a: 1 });
  });

  test("parses valid JSON arrays", () => {
    expect(tryParseJson("[1,2,3]")).toEqual([1, 2, 3]);
  });

  test("returns raw string on parse failure", () => {
    expect(tryParseJson("not json")).toBe("not json");
  });

  test("returns raw string for empty input", () => {
    expect(tryParseJson("")).toBe("");
  });
});

describe("validateJson", () => {
  test("returns undefined for valid JSON", () => {
    expect(validateJson('{"a":1}')).toBeUndefined();
    expect(validateJson("[1,2]")).toBeUndefined();
    expect(validateJson('"str"')).toBeUndefined();
  });

  test("returns error message for invalid JSON", () => {
    const result = validateJson("not json");
    expect(typeof result).toBe("string");
    expect(result).toBeTruthy();
  });

  test("returns error message for empty string", () => {
    const result = validateJson("");
    expect(typeof result).toBe("string");
  });
});

describe("parseLocalDate", () => {
  test("parses YYYY-MM-DD at local midnight", () => {
    const d = parseLocalDate("2024-03-15");
    expect(d).not.toBeNull();
    expect(d?.getFullYear()).toBe(2024);
    expect(d?.getMonth()).toBe(2); // March, 0-indexed
    expect(d?.getDate()).toBe(15);
    expect(d?.getHours()).toBe(0);
    expect(d?.getMinutes()).toBe(0);
  });

  test("parses YYYY-MM-DD with time suffix", () => {
    const d = parseLocalDate("2024-01-01T12:34:56");
    expect(d).not.toBeNull();
    expect(d?.getFullYear()).toBe(2024);
    expect(d?.getMonth()).toBe(0);
    expect(d?.getDate()).toBe(1);
    // Always midnight local time, ignoring time portion
    expect(d?.getHours()).toBe(0);
  });

  test("returns null for invalid format", () => {
    expect(parseLocalDate("not-a-date")).toBeNull();
    expect(parseLocalDate("2024/03/15")).toBeNull();
    expect(parseLocalDate("")).toBeNull();
  });
});
