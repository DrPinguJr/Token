import { describe, expect, it, vi } from "vitest";

import type { AccountSummary } from "@/modules/accounts";

import {
  DevelopmentAccountQuery,
  DevelopmentAccountQueryDisabledError,
} from "./development-account-query";

const createdAt = "2026-07-01T01:00:00.000Z";

const accounts: readonly AccountSummary[] = [
  {
    id: "account-vendor-001",
    mobileNumber: "90000002",
    displayName: "Courtside Kitchen Team",
    role: "vendor",
    status: "active",
    createdAt,
    updatedAt: createdAt,
  },
  {
    id: "account-customer-001",
    mobileNumber: "90000001",
    displayName: "Ari Rally",
    role: "customer",
    status: "active",
    createdAt,
    updatedAt: createdAt,
  },
];

describe("DevelopmentAccountQuery", () => {
  it("returns sorted credential-free read models", async () => {
    const list = vi.fn(async () => accounts);
    const query = new DevelopmentAccountQuery({
      accounts: { list },
      isDevelopmentToolsEnabled: () => true,
    });

    await expect(query.listActiveAccounts()).resolves.toEqual([
      {
        id: "account-customer-001",
        mobileNumber: "90000001",
        displayName: "Ari Rally",
        role: "customer",
      },
      {
        id: "account-vendor-001",
        mobileNumber: "90000002",
        displayName: "Courtside Kitchen Team",
        role: "vendor",
      },
    ]);
    expect(list).toHaveBeenCalledWith({ status: "active" });
    expect(await query.listActiveAccounts()).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "active",
          createdAt,
          updatedAt: createdAt,
        }),
      ]),
    );
  });

  it("checks the environment gate before repository access", async () => {
    const list = vi.fn(async () => accounts);
    const query = new DevelopmentAccountQuery({
      accounts: { list },
      isDevelopmentToolsEnabled: () => false,
    });

    await expect(query.listActiveAccounts()).rejects.toBeInstanceOf(
      DevelopmentAccountQueryDisabledError,
    );
    expect(list).not.toHaveBeenCalled();
  });
});
