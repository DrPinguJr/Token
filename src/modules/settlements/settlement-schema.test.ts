import { describe, expect, it } from "vitest";

import { settlementSchema } from "@/modules/settlements";

const validDraftSettlement = {
  id: "settlement-001",
  reference: "SET-001",
  vendorId: "vendor-001",
  periodStart: "2026-07-25T00:00:00.000Z",
  periodEnd: "2026-07-27T00:00:00.000Z",
  earnedTokenAmount: 150,
  status: "draft",
  payoutReference: null,
  notes: "Manually recorded settlement draft.",
  createdByAccountId: "account-admin-001",
  approvedByAccountId: null,
  paidByAccountId: null,
  createdAt: "2026-07-27T03:00:00.000Z",
  updatedAt: "2026-07-27T03:00:00.000Z",
} as const;

describe("settlementSchema", () => {
  it("accepts a manually recorded draft with a valid period", () => {
    expect(settlementSchema.safeParse(validDraftSettlement).success).toBe(true);
  });

  it("requires lifecycle actors to match the recorded status", () => {
    expect(
      settlementSchema.safeParse({
        ...validDraftSettlement,
        status: "approved",
      }).success,
    ).toBe(false);

    expect(
      settlementSchema.safeParse({
        ...validDraftSettlement,
        status: "paid",
        approvedByAccountId: "account-admin-001",
        paidByAccountId: "account-admin-001",
      }).success,
    ).toBe(true);
  });

  it("rejects a reversed or zero-length accounting period", () => {
    expect(
      settlementSchema.safeParse({
        ...validDraftSettlement,
        periodEnd: validDraftSettlement.periodStart,
      }).success,
    ).toBe(false);
  });
});
