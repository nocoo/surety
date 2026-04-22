import { describe, expect, test } from "bun:test";
import { emit, emitList, emitRecord } from "../src/output";

interface StreamCapture {
  chunks: string[];
  restore: () => void;
}

function captureStdout(): StreamCapture {
  const chunks: string[] = [];
  const original = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((chunk: string | Uint8Array) => {
    chunks.push(typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk));
    return true;
  }) as typeof process.stdout.write;
  return {
    chunks,
    restore: () => {
      process.stdout.write = original;
    },
  };
}

describe("emit", () => {
  test("writes JSON with trailing newline", () => {
    const cap = captureStdout();
    try {
      emit({ ok: true, n: 1 });
    } finally {
      cap.restore();
    }
    expect(cap.chunks.join("")).toBe('{"ok":true,"n":1}\n');
  });
});

interface Member {
  id: number;
  name: string;
  dateOfBirth: string;
  extra: string;
}

const member: Member = {
  id: 7,
  name: "Zhang Wei",
  dateOfBirth: "1985-01-01",
  extra: "bulk",
};
const summarize = (m: Member) => ({ id: m.id, name: m.name });

describe("emitRecord", () => {
  test("summary mode projects fields", () => {
    const cap = captureStdout();
    try {
      emitRecord(member, summarize, { full: false });
    } finally {
      cap.restore();
    }
    expect(JSON.parse(cap.chunks.join(""))).toEqual({ id: 7, name: "Zhang Wei" });
  });

  test("full mode returns whole record", () => {
    const cap = captureStdout();
    try {
      emitRecord(member, summarize, { full: true });
    } finally {
      cap.restore();
    }
    expect(JSON.parse(cap.chunks.join(""))).toEqual(member);
  });
});

describe("emitList", () => {
  test("summary mode maps each item", () => {
    const cap = captureStdout();
    try {
      emitList([member, { ...member, id: 8, name: "Li Si" }], summarize, {
        full: false,
      });
    } finally {
      cap.restore();
    }
    expect(JSON.parse(cap.chunks.join(""))).toEqual([
      { id: 7, name: "Zhang Wei" },
      { id: 8, name: "Li Si" },
    ]);
  });

  test("full mode returns array as-is", () => {
    const cap = captureStdout();
    try {
      emitList([member], summarize, { full: true });
    } finally {
      cap.restore();
    }
    expect(JSON.parse(cap.chunks.join(""))).toEqual([member]);
  });
});
