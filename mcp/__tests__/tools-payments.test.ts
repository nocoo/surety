/**
 * Unit Tests: MCP Tools - Payments
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { createTestDb, resetTestDb } from "@/db";
import {
  paymentsRepo,
  membersRepo,
  policiesRepo,
  insurersRepo,
  settingsRepo,
} from "@/db/repositories";
import { registerPaymentTools } from "../tools/payments";
import { createMockServer, getHandler, parseResult } from "./helpers";

createTestDb();

function setup() {
  const { server, tools } = createMockServer();
  registerPaymentTools(server);
  return tools;
}

async function enableMcp() {
  await settingsRepo.set("mcp.enabled", "true");
}

/** Create a member + insurer + policy for payment tests */
async function seedPolicy() {
  const member = await membersRepo.create({ name: "Zhang San", relation: "Self" });
  const insurer = await insurersRepo.create({ name: "China Life" });
  const policy = await policiesRepo.create({
    applicantId: member.id,
    insuredType: "Member",
    insuredMemberId: member.id,
    category: "Life",
    insurerName: "China Life",
    insurerId: insurer.id,
    productName: "Term Life",
    policyNumber: "POL-001",
    sumAssured: 1000000,
    premium: 3000,
    paymentFrequency: "Yearly",
    effectiveDate: "2024-01-01",
    status: "Active",
  });
  return { member, insurer, policy };
}

describe("list-payments", () => {
  beforeEach(() => resetTestDb());

  test("should return guard error when mcp is disabled", async () => {
    const tools = setup();
    const result = await getHandler(tools, "list-payments")({ policyId: 1 });
    expect(result.isError).toBe(true);
  });

  test("should return error for non-existent policy", async () => {
    const tools = setup();
    await enableMcp();
    const result = await getHandler(tools, "list-payments")({ policyId: 999 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });

  test("should return empty array when policy has no payments", async () => {
    const tools = setup();
    await enableMcp();
    const { policy } = await seedPolicy();

    const result = await getHandler(tools, "list-payments")({ policyId: policy.id });
    expect(parseResult(result)).toEqual([]);
  });

  test("should return all payments for a policy", async () => {
    const tools = setup();
    await enableMcp();
    const { policy } = await seedPolicy();

    await paymentsRepo.create({
      policyId: policy.id,
      periodNumber: 1,
      dueDate: "2024-01-01",
      amount: 3000,
      status: "Paid",
      paidDate: "2024-01-01",
      paidAmount: 3000,
    });
    await paymentsRepo.create({
      policyId: policy.id,
      periodNumber: 2,
      dueDate: "2025-01-01",
      amount: 3000,
      status: "Pending",
    });

    const result = await getHandler(tools, "list-payments")({ policyId: policy.id });
    const data = parseResult(result);
    expect(data).toHaveLength(2);
    expect(data[0].periodNumber).toBe(1);
    expect(data[0].status).toBe("Paid");
    expect(data[1].periodNumber).toBe(2);
    expect(data[1].status).toBe("Pending");
  });
});

describe("get-payment", () => {
  beforeEach(() => resetTestDb());

  test("should return guard error when mcp is disabled", async () => {
    const tools = setup();
    const result = await getHandler(tools, "get-payment")({ paymentId: 1 });
    expect(result.isError).toBe(true);
  });

  test("should return error for non-existent payment", async () => {
    const tools = setup();
    await enableMcp();
    const result = await getHandler(tools, "get-payment")({ paymentId: 999 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });

  test("should return payment details", async () => {
    const tools = setup();
    await enableMcp();
    const { policy } = await seedPolicy();

    const payment = await paymentsRepo.create({
      policyId: policy.id,
      periodNumber: 1,
      dueDate: "2024-01-01",
      amount: 3000,
      status: "Paid",
      paidDate: "2024-01-01",
      paidAmount: 3000,
    });

    const result = await getHandler(tools, "get-payment")({ paymentId: payment.id });
    const data = parseResult(result);
    expect(data.id).toBe(payment.id);
    expect(data.amount).toBe(3000);
    expect(data.paidDate).toBe("2024-01-01");
  });
});

describe("create-payment", () => {
  beforeEach(() => resetTestDb());

  test("should return guard error when mcp is disabled", async () => {
    const tools = setup();
    const result = await getHandler(tools, "create-payment")({
      policyId: 1,
      periodNumber: 1,
      dueDate: "2024-01-01",
      amount: 3000,
    });
    expect(result.isError).toBe(true);
  });

  test("should return error for non-existent policy", async () => {
    const tools = setup();
    await enableMcp();
    const result = await getHandler(tools, "create-payment")({
      policyId: 999,
      periodNumber: 1,
      dueDate: "2024-01-01",
      amount: 3000,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Policy with id 999 not found");
  });

  test("should create a payment with required fields", async () => {
    const tools = setup();
    await enableMcp();
    const { policy } = await seedPolicy();

    const result = await getHandler(tools, "create-payment")({
      policyId: policy.id,
      periodNumber: 1,
      dueDate: "2024-01-01",
      amount: 3000,
    });
    const data = parseResult(result);
    expect(data.id).toBeDefined();
    expect(data.policyId).toBe(policy.id);
    expect(data.periodNumber).toBe(1);
    expect(data.amount).toBe(3000);
    expect(data.status).toBe("Pending"); // default
  });

  test("should create a paid payment with all fields", async () => {
    const tools = setup();
    await enableMcp();
    const { policy } = await seedPolicy();

    const result = await getHandler(tools, "create-payment")({
      policyId: policy.id,
      periodNumber: 1,
      dueDate: "2024-01-01",
      amount: 3000,
      status: "Paid",
      paidDate: "2024-01-02",
      paidAmount: 3000,
    });
    const data = parseResult(result);
    expect(data.status).toBe("Paid");
    expect(data.paidDate).toBe("2024-01-02");
    expect(data.paidAmount).toBe(3000);
  });
});

describe("update-payment", () => {
  beforeEach(() => resetTestDb());

  test("should return guard error when mcp is disabled", async () => {
    const tools = setup();
    const result = await getHandler(tools, "update-payment")({
      paymentId: 1,
      status: "Paid",
    });
    expect(result.isError).toBe(true);
  });

  test("should return error for non-existent payment", async () => {
    const tools = setup();
    await enableMcp();
    const result = await getHandler(tools, "update-payment")({
      paymentId: 999,
      status: "Paid",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });

  test("should update payment status and paid fields", async () => {
    const tools = setup();
    await enableMcp();
    const { policy } = await seedPolicy();

    const payment = await paymentsRepo.create({
      policyId: policy.id,
      periodNumber: 1,
      dueDate: "2024-01-01",
      amount: 3000,
    });

    const result = await getHandler(tools, "update-payment")({
      paymentId: payment.id,
      status: "Paid",
      paidDate: "2024-01-05",
      paidAmount: 3000,
    });
    const data = parseResult(result);
    expect(data.status).toBe("Paid");
    expect(data.paidDate).toBe("2024-01-05");
    expect(data.paidAmount).toBe(3000);
    expect(data.amount).toBe(3000); // unchanged
  });
});

describe("delete-payment", () => {
  beforeEach(() => resetTestDb());

  test("should return guard error when mcp is disabled", async () => {
    const tools = setup();
    const result = await getHandler(tools, "delete-payment")({ paymentId: 1 });
    expect(result.isError).toBe(true);
  });

  test("should return error for non-existent payment", async () => {
    const tools = setup();
    await enableMcp();
    const result = await getHandler(tools, "delete-payment")({ paymentId: 999 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });

  test("should delete a payment", async () => {
    const tools = setup();
    await enableMcp();
    const { policy } = await seedPolicy();

    const payment = await paymentsRepo.create({
      policyId: policy.id,
      periodNumber: 1,
      dueDate: "2024-01-01",
      amount: 3000,
    });

    const result = await getHandler(tools, "delete-payment")({ paymentId: payment.id });
    const data = parseResult(result);
    expect(data.deleted).toBe(true);
    expect(await paymentsRepo.findById(payment.id)).toBeUndefined();
  });
});
