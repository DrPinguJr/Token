import type { Account } from "@/modules/accounts";
import type { Customer } from "@/modules/customers";
import type { Vendor } from "@/modules/vendors";

const timestamp = "2026-07-01T01:00:00.000Z";

export const activeCustomerAccount: Account = Object.freeze({
  id: "account-customer-001",
  mobileNumber: "90000001",
  displayName: "Ari Rally",
  role: "customer",
  status: "active",
  createdAt: timestamp,
  updatedAt: timestamp,
});

export const activeCustomer: Customer = Object.freeze({
  id: "customer-001",
  accountId: activeCustomerAccount.id,
  walletId: "wallet-customer-001",
  publicCode: "cus_7F3Q9K2M",
  onboardingCompletedAt: timestamp,
  createdAt: timestamp,
  updatedAt: timestamp,
});

export const openVendor: Vendor = Object.freeze({
  id: "vendor-001",
  accountId: "account-vendor-001",
  walletId: "wallet-vendor-001",
  publicCode: "vnd_8K2M4Q7P",
  displayName: "Courtside Kitchen",
  logo: "/seed-assets/courtside-kitchen-logo.svg",
  banner: "/seed-assets/courtside-kitchen-banner.svg",
  description: "Fresh event food.",
  stallLocation: "Hall A · Stall 03",
  operatingStatus: "open",
  createdAt: timestamp,
  updatedAt: timestamp,
});

export const pausedVendor: Vendor = Object.freeze({
  ...openVendor,
  id: "vendor-002",
  accountId: "account-vendor-002",
  walletId: "wallet-vendor-002",
  publicCode: "vnd_3R9C6T1N",
  displayName: "Rally Point Merchandise",
  stallLocation: "Hall A · Stall 07",
  operatingStatus: "paused",
});
