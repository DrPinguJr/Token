import { describe, expect, it, vi } from "vitest";

import type { Account } from "@/modules/accounts";

import {
  activeCustomer,
  activeCustomerAccount,
} from "./qr-payment-test-fixtures";
import { CustomerAccountQrQuery } from "./customer-account-qr-query";
import { CustomerQrAccessDeniedError } from "./customer-qr-access";

describe("CustomerAccountQrQuery", () => {
  it("builds an opaque, versioned account payload for the active customer", async () => {
    const query = new CustomerAccountQrQuery({
      accounts: {
        getById: vi.fn(async () => activeCustomerAccount),
      },
      customers: {
        getByAccountId: vi.fn(async () => activeCustomer),
      },
    });

    await expect(
      query.getForAccount(activeCustomerAccount.id),
    ).resolves.toEqual({
      customerId: activeCustomer.id,
      publicCode: activeCustomer.publicCode,
      payload: "tokenly://qr/v1/customer/cus_7F3Q9K2M",
    });
  });

  it.each([
    null,
    {
      ...activeCustomerAccount,
      status: "disabled" as const,
    },
    {
      ...activeCustomerAccount,
      role: "vendor" as const,
    },
  ] satisfies readonly (Account | null)[])(
    "denies unavailable, inactive, and non-customer accounts",
    async (account) => {
      const getByAccountId = vi.fn(async () => activeCustomer);
      const query = new CustomerAccountQrQuery({
        accounts: {
          getById: vi.fn(async () => account),
        },
        customers: { getByAccountId },
      });

      await expect(
        query.getForAccount(activeCustomerAccount.id),
      ).rejects.toBeInstanceOf(CustomerQrAccessDeniedError);
      expect(getByAccountId).not.toHaveBeenCalled();
    },
  );

  it("denies an account without a customer profile", async () => {
    const query = new CustomerAccountQrQuery({
      accounts: {
        getById: vi.fn(async () => activeCustomerAccount),
      },
      customers: {
        getByAccountId: vi.fn(async () => null),
      },
    });

    await expect(
      query.getForAccount(activeCustomerAccount.id),
    ).rejects.toBeInstanceOf(CustomerQrAccessDeniedError);
  });
});
