import {
  accountPinCredentialSchema,
  accountSchema,
  type Account,
  type AccountPinCredential,
} from "@/modules/accounts";
import { auditLogSchema, type AuditLog } from "@/modules/audit-logs";
import { customerSchema, type Customer } from "@/modules/customers";
import {
  eventSettingsSchema,
  type EventSettings,
} from "@/modules/event-settings";
import { evidenceSchema, type Evidence } from "@/modules/evidence";
import { orderSchema, type Order } from "@/modules/orders";
import { productSchema, type Product } from "@/modules/products";
import { refundSchema, type Refund } from "@/modules/refunds";
import { settlementSchema, type Settlement } from "@/modules/settlements";
import {
  tokenIssuanceSchema,
  type TokenIssuance,
} from "@/modules/token-issuance";
import {
  createOperationLedgerIdempotencyKey,
  createScopedLedgerIdempotencyKey,
  ledgerEntrySchema,
  type LedgerEntry,
} from "@/modules/transactions";
import { vendorSchema, type Vendor } from "@/modules/vendors";
import { walletSchema, type Wallet } from "@/modules/wallets";

export const TOKENLY_SEED_VERSION = 5;

export const seededDevelopmentAccounts = Object.freeze({
  customer: "90000001",
  vendor: "90000002",
  staff: "90000003",
  administrator: "90000004",
});

export interface SeedEvidenceContent {
  readonly evidenceId: string;
  readonly mimeType: Evidence["mimeType"];
  readonly bytes: readonly number[];
}

export interface TokenlySeedData {
  readonly accounts: readonly Account[];
  readonly accountPinCredentials: readonly AccountPinCredential[];
  readonly customers: readonly Customer[];
  readonly wallets: readonly Wallet[];
  readonly ledgerEntries: readonly LedgerEntry[];
  readonly tokenIssuances: readonly TokenIssuance[];
  readonly evidence: readonly Evidence[];
  readonly evidenceContents: readonly SeedEvidenceContent[];
  readonly vendors: readonly Vendor[];
  readonly products: readonly Product[];
  readonly orders: readonly Order[];
  readonly refunds: readonly Refund[];
  readonly settlements: readonly Settlement[];
  readonly auditLogs: readonly AuditLog[];
  readonly eventSettings: EventSettings;
}

const prototypePinCredential =
  "prototype-sha256-v1$a1fb4e703a9ef1fa4936801721ff285a97ac85330856674412e054892afe6972";

const placeholderPngBytes = Object.freeze([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0,
  0, 0, 1, 8, 4, 0, 0, 0, 181, 28, 12, 2, 0, 0, 0, 11, 73, 68, 65, 84, 120, 218,
  99, 100, 248, 15, 0, 1, 5, 1, 1, 39, 24, 227, 102, 0, 0, 0, 0, 73, 69, 78, 68,
  174, 66, 96, 130,
]);

const accountSeedRecordSchema = accountSchema
  .extend({
    pinCredential: accountPinCredentialSchema.shape.pinCredential,
    failedPinAttempts: accountPinCredentialSchema.shape.failedPinAttempts,
    lockedUntil: accountPinCredentialSchema.shape.lockedUntil,
  })
  .strict();

interface ParsedSeedAccounts {
  readonly accounts: readonly Account[];
  readonly accountPinCredentials: readonly AccountPinCredential[];
}

function parseAccounts(records: readonly unknown[]): ParsedSeedAccounts {
  const parsedRecords = records.map((record) =>
    accountSeedRecordSchema.parse(record),
  );

  return {
    accounts: Object.freeze(
      parsedRecords.map((record) =>
        accountSchema.parse({
          id: record.id,
          mobileNumber: record.mobileNumber,
          ...(record.username === undefined
            ? {}
            : { username: record.username }),
          displayName: record.displayName,
          role: record.role,
          status: record.status,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        }),
      ),
    ),
    accountPinCredentials: Object.freeze(
      parsedRecords.map((record) =>
        accountPinCredentialSchema.parse({
          accountId: record.id,
          pinCredential: record.pinCredential,
          failedPinAttempts: record.failedPinAttempts,
          lockedUntil: record.lockedUntil,
        }),
      ),
    ),
  };
}

function parseCustomers(records: readonly unknown[]): readonly Customer[] {
  return Object.freeze(records.map((record) => customerSchema.parse(record)));
}

function parseWallets(records: readonly unknown[]): readonly Wallet[] {
  return Object.freeze(records.map((record) => walletSchema.parse(record)));
}

function parseLedgerEntries(
  records: readonly unknown[],
): readonly LedgerEntry[] {
  return Object.freeze(
    records.map((record) => ledgerEntrySchema.parse(record)),
  );
}

function parseTokenIssuances(
  records: readonly unknown[],
): readonly TokenIssuance[] {
  return Object.freeze(
    records.map((record) => tokenIssuanceSchema.parse(record)),
  );
}

function parseEvidence(records: readonly unknown[]): readonly Evidence[] {
  return Object.freeze(records.map((record) => evidenceSchema.parse(record)));
}

function parseVendors(records: readonly unknown[]): readonly Vendor[] {
  return Object.freeze(records.map((record) => vendorSchema.parse(record)));
}

function parseProducts(records: readonly unknown[]): readonly Product[] {
  return Object.freeze(records.map((record) => productSchema.parse(record)));
}

function parseOrders(records: readonly unknown[]): readonly Order[] {
  return Object.freeze(records.map((record) => orderSchema.parse(record)));
}

function parseRefunds(records: readonly unknown[]): readonly Refund[] {
  return Object.freeze(records.map((record) => refundSchema.parse(record)));
}

function parseSettlements(records: readonly unknown[]): readonly Settlement[] {
  return Object.freeze(records.map((record) => settlementSchema.parse(record)));
}

function parseAuditLogs(records: readonly unknown[]): readonly AuditLog[] {
  return Object.freeze(records.map((record) => auditLogSchema.parse(record)));
}

export function createTokenlySeedData(): TokenlySeedData {
  const { accounts, accountPinCredentials } = parseAccounts([
    {
      id: "account-customer-001",
      mobileNumber: seededDevelopmentAccounts.customer,
      displayName: "Lance Tan",
      role: "customer",
      status: "active",
      pinCredential: prototypePinCredential,
      failedPinAttempts: 0,
      lockedUntil: null,
      createdAt: "2026-07-01T01:00:00.000Z",
      updatedAt: "2026-07-01T01:00:00.000Z",
    },
    {
      id: "account-vendor-001",
      mobileNumber: seededDevelopmentAccounts.vendor,
      username: "Vendor1",
      displayName: "Courtside Kitchen Team",
      role: "vendor",
      status: "active",
      pinCredential: prototypePinCredential,
      failedPinAttempts: 0,
      lockedUntil: null,
      createdAt: "2026-07-01T01:01:00.000Z",
      updatedAt: "2026-07-01T01:01:00.000Z",
    },
    {
      id: "account-staff-001",
      mobileNumber: seededDevelopmentAccounts.staff,
      displayName: "Jordan Serve",
      role: "staff",
      status: "active",
      pinCredential: prototypePinCredential,
      failedPinAttempts: 0,
      lockedUntil: null,
      createdAt: "2026-07-01T01:02:00.000Z",
      updatedAt: "2026-07-01T01:02:00.000Z",
    },
    {
      id: "account-admin-001",
      mobileNumber: seededDevelopmentAccounts.administrator,
      username: "AdminLance",
      displayName: "Lance Admin",
      role: "administrator",
      status: "active",
      pinCredential: prototypePinCredential,
      failedPinAttempts: 0,
      lockedUntil: null,
      createdAt: "2026-07-01T01:03:00.000Z",
      updatedAt: "2026-07-01T01:03:00.000Z",
    },
    {
      id: "account-customer-002",
      mobileNumber: "90000005",
      displayName: "Mika Orbit",
      role: "customer",
      status: "active",
      pinCredential: prototypePinCredential,
      failedPinAttempts: 0,
      lockedUntil: null,
      createdAt: "2026-07-01T01:04:00.000Z",
      updatedAt: "2026-07-01T01:04:00.000Z",
    },
    {
      id: "account-vendor-002",
      mobileNumber: "90000006",
      displayName: "Rally Point Merchandise Team",
      role: "vendor",
      status: "active",
      pinCredential: prototypePinCredential,
      failedPinAttempts: 0,
      lockedUntil: null,
      createdAt: "2026-07-01T01:05:00.000Z",
      updatedAt: "2026-07-01T01:05:00.000Z",
    },
    {
      id: "account-vendor-003",
      mobileNumber: "90000007",
      displayName: "Stick and Grip Station Team",
      role: "vendor",
      status: "active",
      pinCredential: prototypePinCredential,
      failedPinAttempts: 0,
      lockedUntil: null,
      createdAt: "2026-07-01T01:06:00.000Z",
      updatedAt: "2026-07-01T01:06:00.000Z",
    },
    {
      id: "account-staff-002",
      mobileNumber: "90000008",
      displayName: "Taylor Line",
      role: "staff",
      status: "active",
      pinCredential: prototypePinCredential,
      failedPinAttempts: 0,
      lockedUntil: null,
      createdAt: "2026-07-01T01:07:00.000Z",
      updatedAt: "2026-07-01T01:07:00.000Z",
    },
    {
      id: "account-customer-003",
      mobileNumber: "90000009",
      displayName: "Noa Swift",
      role: "customer",
      status: "active",
      pinCredential: prototypePinCredential,
      failedPinAttempts: 0,
      lockedUntil: null,
      createdAt: "2026-07-01T01:08:00.000Z",
      updatedAt: "2026-07-01T01:08:00.000Z",
    },
  ]);

  const customers = parseCustomers([
    {
      id: "customer-001",
      accountId: "account-customer-001",
      walletId: "wallet-customer-001",
      privateAccessCode: "49281730659482017364920581736490",
      claimCode: "claim_73049281764059281630495726184015",
      claimExpiresAt: "2026-08-01T00:00:00.000Z",
      claimedAt: null,
      publicCode: "cus_7F3Q9K2M",
      walletQrUpdatedAt: "2026-07-01T01:00:00.000Z",
      onboardingCompletedAt: "2026-07-05T02:00:00.000Z",
      createdAt: "2026-07-01T01:00:00.000Z",
      updatedAt: "2026-07-05T02:00:00.000Z",
    },
    {
      id: "customer-002",
      accountId: "account-customer-002",
      walletId: "wallet-customer-002",
      privateAccessCode: "80631594720863491572048613957204",
      claimCode: "claim_51720486391572048631059274806319",
      claimExpiresAt: "2026-08-01T00:00:00.000Z",
      claimedAt: "2026-07-06T02:00:00.000Z",
      publicCode: "cus_4D8N2P6R",
      walletQrUpdatedAt: "2026-07-01T01:04:00.000Z",
      onboardingCompletedAt: "2026-07-06T02:00:00.000Z",
      createdAt: "2026-07-01T01:04:00.000Z",
      updatedAt: "2026-07-06T02:00:00.000Z",
    },
    {
      id: "customer-003",
      accountId: "account-customer-003",
      walletId: "wallet-customer-003",
      privateAccessCode: "13579024681357902468135790246813",
      claimCode: "claim_94068135790246813579024681357902",
      claimExpiresAt: "2026-08-01T00:00:00.000Z",
      claimedAt: null,
      publicCode: "cus_9M5T1W7C",
      walletQrUpdatedAt: "2026-07-01T01:08:00.000Z",
      onboardingCompletedAt: null,
      createdAt: "2026-07-01T01:08:00.000Z",
      updatedAt: "2026-07-01T01:08:00.000Z",
    },
  ]);

  const wallets = parseWallets([
    {
      id: "wallet-customer-001",
      ownerAccountId: "account-customer-001",
      ownerType: "customer",
      status: "active",
      createdAt: "2026-07-01T01:00:00.000Z",
    },
    {
      id: "wallet-customer-002",
      ownerAccountId: "account-customer-002",
      ownerType: "customer",
      status: "active",
      createdAt: "2026-07-01T01:04:00.000Z",
    },
    {
      id: "wallet-customer-003",
      ownerAccountId: "account-customer-003",
      ownerType: "customer",
      status: "active",
      createdAt: "2026-07-01T01:08:00.000Z",
    },
    {
      id: "wallet-vendor-001",
      ownerAccountId: "account-vendor-001",
      ownerType: "vendor",
      status: "active",
      createdAt: "2026-07-01T01:01:00.000Z",
    },
    {
      id: "wallet-vendor-002",
      ownerAccountId: "account-vendor-002",
      ownerType: "vendor",
      status: "active",
      createdAt: "2026-07-01T01:05:00.000Z",
    },
    {
      id: "wallet-vendor-003",
      ownerAccountId: "account-vendor-003",
      ownerType: "vendor",
      status: "active",
      createdAt: "2026-07-01T01:06:00.000Z",
    },
  ]);

  const evidence = parseEvidence([
    {
      id: "evidence-001",
      kind: "paynow_screenshot",
      fileName: "prototype-payment-placeholder-001.png",
      mimeType: "image/png",
      sizeBytes: placeholderPngBytes.length,
      localBlobKey: "blob-evidence-001",
      capturedByAccountId: "account-staff-001",
      createdAt: "2026-07-25T00:10:00.000Z",
      metadata: {
        source: "deterministic_seed",
        prototypePlaceholder: true,
        captureMode: "generated_placeholder",
      },
    },
    {
      id: "evidence-002",
      kind: "paynow_screenshot",
      fileName: "prototype-payment-placeholder-002.png",
      mimeType: "image/png",
      sizeBytes: placeholderPngBytes.length,
      localBlobKey: "blob-evidence-002",
      capturedByAccountId: "account-staff-001",
      createdAt: "2026-07-25T00:20:00.000Z",
      metadata: {
        source: "deterministic_seed",
        prototypePlaceholder: true,
        captureMode: "generated_placeholder",
      },
    },
    {
      id: "evidence-003",
      kind: "paynow_screenshot",
      fileName: "prototype-payment-placeholder-003.png",
      mimeType: "image/png",
      sizeBytes: placeholderPngBytes.length,
      localBlobKey: "blob-evidence-003",
      capturedByAccountId: "account-staff-002",
      createdAt: "2026-07-25T00:30:00.000Z",
      metadata: {
        source: "deterministic_seed",
        prototypePlaceholder: true,
        captureMode: "generated_placeholder",
      },
    },
  ]);

  const tokenIssuances = parseTokenIssuances([
    {
      id: "issuance-001",
      customerId: "customer-001",
      walletId: "wallet-customer-001",
      staffAccountId: "account-staff-001",
      evidenceId: "evidence-001",
      paynowAmountCents: 2_000,
      tokensPerDollar: 10,
      tokenAmount: 200,
      paymentReference: "PN-SEED-0001",
      normalizedPaymentReference: "pn-seed-0001",
      note: "Payment check recorded manually for the local prototype.",
      transactionGroupId: "transaction-issuance-001",
      reference: "ISS-20260725-001",
      idempotencyKey: "seed:issuance:001",
      createdAt: "2026-07-25T00:12:00.000Z",
    },
    {
      id: "issuance-002",
      customerId: "customer-002",
      walletId: "wallet-customer-002",
      staffAccountId: "account-staff-001",
      evidenceId: "evidence-002",
      paynowAmountCents: 1_200,
      tokensPerDollar: 10,
      tokenAmount: 120,
      paymentReference: "PN-SEED-0002",
      normalizedPaymentReference: "pn-seed-0002",
      note: "Payment check recorded manually for the local prototype.",
      transactionGroupId: "transaction-issuance-002",
      reference: "ISS-20260725-002",
      idempotencyKey: "seed:issuance:002",
      createdAt: "2026-07-25T00:22:00.000Z",
    },
    {
      id: "issuance-003",
      customerId: "customer-003",
      walletId: "wallet-customer-003",
      staffAccountId: "account-staff-002",
      evidenceId: "evidence-003",
      paynowAmountCents: 900,
      tokensPerDollar: 10,
      tokenAmount: 90,
      paymentReference: "PN-SEED-0003",
      normalizedPaymentReference: "pn-seed-0003",
      note: "Payment check recorded manually for the local prototype.",
      transactionGroupId: "transaction-issuance-003",
      reference: "ISS-20260725-003",
      idempotencyKey: "seed:issuance:003",
      createdAt: "2026-07-25T00:32:00.000Z",
    },
  ]);

  const vendors = parseVendors([
    {
      id: "vendor-001",
      accountId: "account-vendor-001",
      walletId: "wallet-vendor-001",
      publicCode: "vnd_8K2M4Q7P",
      displayName: "Courtside Kitchen",
      logo: "/seed-assets/courtside-kitchen-logo.svg",
      banner: "/seed-assets/courtside-kitchen-banner.svg",
      description:
        "Quick event meals, chilled drinks, and easy courtside snacks.",
      stallLocation: "Hall A, Stall 03",
      operatingStatus: "open",
      createdAt: "2026-07-02T01:00:00.000Z",
      updatedAt: "2026-07-02T01:00:00.000Z",
    },
    {
      id: "vendor-002",
      accountId: "account-vendor-002",
      walletId: "wallet-vendor-002",
      publicCode: "vnd_3R9C6T1N",
      displayName: "Rally Point Merchandise",
      logo: "/seed-assets/rally-point-logo.svg",
      banner: "/seed-assets/rally-point-banner.svg",
      description:
        "Event apparel and practical keepsakes for players and supporters.",
      stallLocation: "Main Concourse, Stall 08",
      operatingStatus: "open",
      createdAt: "2026-07-02T01:01:00.000Z",
      updatedAt: "2026-07-02T01:01:00.000Z",
    },
    {
      id: "vendor-003",
      accountId: "account-vendor-003",
      walletId: "wallet-vendor-003",
      publicCode: "vnd_5W7D2F9L",
      displayName: "Stick and Grip Station",
      logo: "/seed-assets/stick-grip-logo.svg",
      banner: "/seed-assets/stick-grip-banner.svg",
      description:
        "Floorball equipment, grips, training balls, and small accessories.",
      stallLocation: "Hall B, Equipment Corner",
      operatingStatus: "open",
      createdAt: "2026-07-02T01:02:00.000Z",
      updatedAt: "2026-07-02T01:02:00.000Z",
    },
  ]);

  const products = parseProducts([
    {
      id: "product-food-001",
      vendorId: "vendor-001",
      name: "Chicken Rice Bowl",
      description: "Roasted chicken, fragrant rice, cucumber, and light sauce.",
      image: "/seed-assets/product-food.svg",
      tokenPrice: 12,
      category: "Meals",
      isAvailable: true,
      isSoldOut: false,
      isArchived: false,
      displayOrder: 0,
      createdAt: "2026-07-10T01:00:00.000Z",
      updatedAt: "2026-07-10T01:00:00.000Z",
    },
    {
      id: "product-food-002",
      vendorId: "vendor-001",
      name: "Chilled Cocoa",
      description: "Cold cocoa drink served in a recyclable event cup.",
      image: "/seed-assets/product-food.svg",
      tokenPrice: 6,
      category: "Drinks",
      isAvailable: true,
      isSoldOut: false,
      isArchived: false,
      displayOrder: 1,
      createdAt: "2026-07-10T01:01:00.000Z",
      updatedAt: "2026-07-10T01:01:00.000Z",
    },
    {
      id: "product-food-003",
      vendorId: "vendor-001",
      name: "Citrus Sparkler",
      description: "Sparkling citrus cooler with a fresh lime finish.",
      image: "/seed-assets/product-food.svg",
      tokenPrice: 5,
      category: "Drinks",
      isAvailable: true,
      isSoldOut: false,
      isArchived: false,
      displayOrder: 2,
      createdAt: "2026-07-10T01:02:00.000Z",
      updatedAt: "2026-07-10T01:02:00.000Z",
    },
    {
      id: "product-food-004",
      vendorId: "vendor-001",
      name: "Banana Oat Bar",
      description: "Soft-baked banana and oat snack bar.",
      image: "/seed-assets/product-food.svg",
      tokenPrice: 4,
      category: "Snacks",
      isAvailable: true,
      isSoldOut: true,
      isArchived: false,
      displayOrder: 3,
      createdAt: "2026-07-10T01:03:00.000Z",
      updatedAt: "2026-07-25T06:00:00.000Z",
    },
    {
      id: "product-merch-001",
      vendorId: "vendor-002",
      name: "Event Team Tee",
      description: "Soft event T-shirt with an original two-colour court mark.",
      image: "/seed-assets/product-merchandise.svg",
      tokenPrice: 35,
      category: "Apparel",
      isAvailable: true,
      isSoldOut: false,
      isArchived: false,
      displayOrder: 0,
      createdAt: "2026-07-10T02:00:00.000Z",
      updatedAt: "2026-07-10T02:00:00.000Z",
    },
    {
      id: "product-merch-002",
      vendorId: "vendor-002",
      name: "Courtside Towel",
      description: "Compact quick-dry towel for matches and training.",
      image: "/seed-assets/product-merchandise.svg",
      tokenPrice: 18,
      category: "Accessories",
      isAvailable: true,
      isSoldOut: false,
      isArchived: false,
      displayOrder: 1,
      createdAt: "2026-07-10T02:01:00.000Z",
      updatedAt: "2026-07-10T02:01:00.000Z",
    },
    {
      id: "product-merch-003",
      vendorId: "vendor-002",
      name: "Court-Line Tote",
      description: "Reusable canvas tote with a simple court-line motif.",
      image: "/seed-assets/product-merchandise.svg",
      tokenPrice: 22,
      category: "Bags",
      isAvailable: true,
      isSoldOut: false,
      isArchived: false,
      displayOrder: 2,
      createdAt: "2026-07-10T02:02:00.000Z",
      updatedAt: "2026-07-10T02:02:00.000Z",
    },
    {
      id: "product-merch-004",
      vendorId: "vendor-002",
      name: "Event Sticker Pack",
      description: "Four weather-resistant event and floorball stickers.",
      image: "/seed-assets/product-merchandise.svg",
      tokenPrice: 5,
      category: "Keepsakes",
      isAvailable: true,
      isSoldOut: false,
      isArchived: false,
      displayOrder: 3,
      createdAt: "2026-07-10T02:03:00.000Z",
      updatedAt: "2026-07-10T02:03:00.000Z",
    },
    {
      id: "product-gear-001",
      vendorId: "vendor-003",
      name: "Grip Tape Roll",
      description: "Cushioned floorball grip tape in a neutral event colour.",
      image: "/seed-assets/product-equipment.svg",
      tokenPrice: 8,
      category: "Grips",
      isAvailable: true,
      isSoldOut: false,
      isArchived: false,
      displayOrder: 0,
      createdAt: "2026-07-10T03:00:00.000Z",
      updatedAt: "2026-07-10T03:00:00.000Z",
    },
    {
      id: "product-gear-002",
      vendorId: "vendor-003",
      name: "Training Ball Twin Pack",
      description: "Two regulation-style perforated training balls.",
      image: "/seed-assets/product-equipment.svg",
      tokenPrice: 12,
      category: "Training",
      isAvailable: true,
      isSoldOut: false,
      isArchived: false,
      displayOrder: 1,
      createdAt: "2026-07-10T03:01:00.000Z",
      updatedAt: "2026-07-10T03:01:00.000Z",
    },
    {
      id: "product-gear-003",
      vendorId: "vendor-003",
      name: "Blade Guard",
      description: "Clip-on guard for keeping a floorball blade protected.",
      image: "/seed-assets/product-equipment.svg",
      tokenPrice: 15,
      category: "Protection",
      isAvailable: true,
      isSoldOut: false,
      isArchived: false,
      displayOrder: 2,
      createdAt: "2026-07-10T03:02:00.000Z",
      updatedAt: "2026-07-10T03:02:00.000Z",
    },
    {
      id: "product-gear-004",
      vendorId: "vendor-003",
      name: "Sweatband Pair",
      description: "Two soft wrist sweatbands for tournament play.",
      image: "/seed-assets/product-equipment.svg",
      tokenPrice: 10,
      category: "Accessories",
      isAvailable: true,
      isSoldOut: false,
      isArchived: false,
      displayOrder: 3,
      createdAt: "2026-07-10T03:03:00.000Z",
      updatedAt: "2026-07-10T03:03:00.000Z",
    },
  ]);

  const orders = parseOrders([
    {
      id: "order-001",
      reference: "ORD-20260725-001",
      customerId: "customer-001",
      vendorId: "vendor-001",
      customerWalletId: "wallet-customer-001",
      vendorWalletId: "wallet-vendor-001",
      status: "completed",
      items: [
        {
          productId: "product-food-001",
          productName: "Chicken Rice Bowl",
          unitTokenPrice: 12,
          quantity: 1,
          lineTokenTotal: 12,
          displayOrder: 0,
        },
        {
          productId: "product-food-002",
          productName: "Chilled Cocoa",
          unitTokenPrice: 6,
          quantity: 2,
          lineTokenTotal: 12,
          displayOrder: 1,
        },
      ],
      tokenTotal: 24,
      transactionGroupId: "transaction-purchase-001",
      idempotencyKey: "seed:purchase:001",
      completedAt: "2026-07-25T02:00:00.000Z",
    },
    {
      id: "order-002",
      reference: "ORD-20260725-002",
      customerId: "customer-002",
      vendorId: "vendor-002",
      customerWalletId: "wallet-customer-002",
      vendorWalletId: "wallet-vendor-002",
      status: "completed",
      items: [
        {
          productId: "product-merch-001",
          productName: "Event Team Tee",
          unitTokenPrice: 35,
          quantity: 1,
          lineTokenTotal: 35,
          displayOrder: 0,
        },
        {
          productId: "product-merch-004",
          productName: "Event Sticker Pack",
          unitTokenPrice: 5,
          quantity: 1,
          lineTokenTotal: 5,
          displayOrder: 1,
        },
      ],
      tokenTotal: 40,
      transactionGroupId: "transaction-purchase-002",
      idempotencyKey: "seed:purchase:002",
      completedAt: "2026-07-25T03:00:00.000Z",
    },
    {
      id: "order-003",
      reference: "ORD-20260726-001",
      customerId: "customer-001",
      vendorId: "vendor-003",
      customerWalletId: "wallet-customer-001",
      vendorWalletId: "wallet-vendor-003",
      status: "completed",
      items: [
        {
          productId: "product-gear-001",
          productName: "Grip Tape Roll",
          unitTokenPrice: 8,
          quantity: 2,
          lineTokenTotal: 16,
          displayOrder: 0,
        },
        {
          productId: "product-gear-002",
          productName: "Training Ball Twin Pack",
          unitTokenPrice: 12,
          quantity: 1,
          lineTokenTotal: 12,
          displayOrder: 1,
        },
      ],
      tokenTotal: 28,
      transactionGroupId: "transaction-purchase-003",
      idempotencyKey: "seed:purchase:003",
      completedAt: "2026-07-26T01:00:00.000Z",
    },
    {
      id: "order-004",
      reference: "ORD-20260726-002",
      customerId: "customer-003",
      vendorId: "vendor-001",
      customerWalletId: "wallet-customer-003",
      vendorWalletId: "wallet-vendor-001",
      status: "completed",
      items: [
        {
          productId: "product-food-003",
          productName: "Citrus Sparkler",
          unitTokenPrice: 5,
          quantity: 2,
          lineTokenTotal: 10,
          displayOrder: 0,
        },
        {
          productId: "product-food-001",
          productName: "Chicken Rice Bowl",
          unitTokenPrice: 12,
          quantity: 1,
          lineTokenTotal: 12,
          displayOrder: 1,
        },
      ],
      tokenTotal: 22,
      transactionGroupId: "transaction-purchase-004",
      idempotencyKey: "seed:purchase:004",
      completedAt: "2026-07-26T02:00:00.000Z",
    },
  ]);

  const refunds = parseRefunds([
    {
      id: "refund-001",
      reference: "REF-20260725-001",
      orderId: "order-001",
      customerId: "customer-001",
      vendorId: "vendor-001",
      tokenAmount: 6,
      reason: "One chilled drink was unavailable at collection.",
      actorAccountId: "account-vendor-001",
      transactionGroupId: "transaction-refund-001",
      idempotencyKey: "seed:refund:001",
      createdAt: "2026-07-25T04:00:00.000Z",
    },
    {
      id: "refund-002",
      reference: "REF-20260725-002",
      orderId: "order-002",
      customerId: "customer-002",
      vendorId: "vendor-002",
      tokenAmount: 40,
      reason: "Requested apparel size was unavailable before collection.",
      actorAccountId: "account-vendor-002",
      transactionGroupId: "transaction-refund-002",
      idempotencyKey: "seed:refund:002",
      createdAt: "2026-07-25T05:00:00.000Z",
    },
  ]);

  const ledgerEntries = parseLedgerEntries([
    {
      id: "ledger-issuance-001",
      walletId: "wallet-customer-001",
      transactionGroupId: "transaction-issuance-001",
      entryType: "token_issuance",
      direction: "credit",
      tokenAmount: 200,
      actorAccountId: "account-staff-001",
      relatedCustomerId: "customer-001",
      relatedVendorId: null,
      relatedOrderId: null,
      relatedEvidenceId: "evidence-001",
      reference: "ISS-20260725-001",
      description: "Manual token issuance recorded by event staff.",
      occurredAt: "2026-07-25T00:12:00.000Z",
      idempotencyKey: createOperationLedgerIdempotencyKey("seed:issuance:001"),
      metadata: {
        tokensPerDollar: 10,
        source: "deterministic_seed",
      },
      reversesLedgerEntryId: null,
    },
    {
      id: "ledger-issuance-002",
      walletId: "wallet-customer-002",
      transactionGroupId: "transaction-issuance-002",
      entryType: "token_issuance",
      direction: "credit",
      tokenAmount: 120,
      actorAccountId: "account-staff-001",
      relatedCustomerId: "customer-002",
      relatedVendorId: null,
      relatedOrderId: null,
      relatedEvidenceId: "evidence-002",
      reference: "ISS-20260725-002",
      description: "Manual token issuance recorded by event staff.",
      occurredAt: "2026-07-25T00:22:00.000Z",
      idempotencyKey: createOperationLedgerIdempotencyKey("seed:issuance:002"),
      metadata: {
        tokensPerDollar: 10,
        source: "deterministic_seed",
      },
      reversesLedgerEntryId: null,
    },
    {
      id: "ledger-issuance-003",
      walletId: "wallet-customer-003",
      transactionGroupId: "transaction-issuance-003",
      entryType: "token_issuance",
      direction: "credit",
      tokenAmount: 90,
      actorAccountId: "account-staff-002",
      relatedCustomerId: "customer-003",
      relatedVendorId: null,
      relatedOrderId: null,
      relatedEvidenceId: "evidence-003",
      reference: "ISS-20260725-003",
      description: "Manual token issuance recorded by event staff.",
      occurredAt: "2026-07-25T00:32:00.000Z",
      idempotencyKey: createOperationLedgerIdempotencyKey("seed:issuance:003"),
      metadata: {
        tokensPerDollar: 10,
        source: "deterministic_seed",
      },
      reversesLedgerEntryId: null,
    },
    {
      id: "ledger-purchase-001-customer",
      walletId: "wallet-customer-001",
      transactionGroupId: "transaction-purchase-001",
      entryType: "customer_purchase",
      direction: "debit",
      tokenAmount: 24,
      actorAccountId: "account-customer-001",
      relatedCustomerId: "customer-001",
      relatedVendorId: "vendor-001",
      relatedOrderId: "order-001",
      relatedEvidenceId: null,
      reference: "ORD-20260725-001",
      description: "Customer wallet debit for completed order.",
      occurredAt: "2026-07-25T02:00:00.000Z",
      idempotencyKey: createOperationLedgerIdempotencyKey("seed:purchase:001"),
      metadata: {
        pairedLedgerEntryId: "ledger-purchase-001-vendor",
        source: "deterministic_seed",
      },
      reversesLedgerEntryId: null,
    },
    {
      id: "ledger-purchase-001-vendor",
      walletId: "wallet-vendor-001",
      transactionGroupId: "transaction-purchase-001",
      entryType: "vendor_receipt",
      direction: "credit",
      tokenAmount: 24,
      actorAccountId: "account-customer-001",
      relatedCustomerId: "customer-001",
      relatedVendorId: "vendor-001",
      relatedOrderId: "order-001",
      relatedEvidenceId: null,
      reference: "ORD-20260725-001",
      description: "Vendor wallet credit for completed order.",
      occurredAt: "2026-07-25T02:00:00.000Z",
      idempotencyKey: createScopedLedgerIdempotencyKey(
        "seed:purchase:001",
        "vendor-credit",
      ),
      metadata: {
        pairedLedgerEntryId: "ledger-purchase-001-customer",
        source: "deterministic_seed",
      },
      reversesLedgerEntryId: null,
    },
    {
      id: "ledger-purchase-002-customer",
      walletId: "wallet-customer-002",
      transactionGroupId: "transaction-purchase-002",
      entryType: "customer_purchase",
      direction: "debit",
      tokenAmount: 40,
      actorAccountId: "account-customer-002",
      relatedCustomerId: "customer-002",
      relatedVendorId: "vendor-002",
      relatedOrderId: "order-002",
      relatedEvidenceId: null,
      reference: "ORD-20260725-002",
      description: "Customer wallet debit for completed order.",
      occurredAt: "2026-07-25T03:00:00.000Z",
      idempotencyKey: createOperationLedgerIdempotencyKey("seed:purchase:002"),
      metadata: {
        pairedLedgerEntryId: "ledger-purchase-002-vendor",
        source: "deterministic_seed",
      },
      reversesLedgerEntryId: null,
    },
    {
      id: "ledger-purchase-002-vendor",
      walletId: "wallet-vendor-002",
      transactionGroupId: "transaction-purchase-002",
      entryType: "vendor_receipt",
      direction: "credit",
      tokenAmount: 40,
      actorAccountId: "account-customer-002",
      relatedCustomerId: "customer-002",
      relatedVendorId: "vendor-002",
      relatedOrderId: "order-002",
      relatedEvidenceId: null,
      reference: "ORD-20260725-002",
      description: "Vendor wallet credit for completed order.",
      occurredAt: "2026-07-25T03:00:00.000Z",
      idempotencyKey: createScopedLedgerIdempotencyKey(
        "seed:purchase:002",
        "vendor-credit",
      ),
      metadata: {
        pairedLedgerEntryId: "ledger-purchase-002-customer",
        source: "deterministic_seed",
      },
      reversesLedgerEntryId: null,
    },
    {
      id: "ledger-refund-001-customer",
      walletId: "wallet-customer-001",
      transactionGroupId: "transaction-refund-001",
      entryType: "customer_refund",
      direction: "credit",
      tokenAmount: 6,
      actorAccountId: "account-vendor-001",
      relatedCustomerId: "customer-001",
      relatedVendorId: "vendor-001",
      relatedOrderId: "order-001",
      relatedEvidenceId: null,
      reference: "REF-20260725-001",
      description: "Customer wallet credit for partial order refund.",
      occurredAt: "2026-07-25T04:00:00.000Z",
      idempotencyKey: createOperationLedgerIdempotencyKey("seed:refund:001"),
      metadata: {
        pairedLedgerEntryId: "ledger-refund-001-vendor",
        refundId: "refund-001",
        reason: "One chilled drink was unavailable at collection.",
        refundScope: "partial",
        source: "deterministic_seed",
      },
      reversesLedgerEntryId: "ledger-purchase-001-customer",
    },
    {
      id: "ledger-refund-001-vendor",
      walletId: "wallet-vendor-001",
      transactionGroupId: "transaction-refund-001",
      entryType: "vendor_refund",
      direction: "debit",
      tokenAmount: 6,
      actorAccountId: "account-vendor-001",
      relatedCustomerId: "customer-001",
      relatedVendorId: "vendor-001",
      relatedOrderId: "order-001",
      relatedEvidenceId: null,
      reference: "REF-20260725-001",
      description: "Vendor wallet debit for partial order refund.",
      occurredAt: "2026-07-25T04:00:00.000Z",
      idempotencyKey: createScopedLedgerIdempotencyKey(
        "seed:refund:001",
        "vendor-debit",
      ),
      metadata: {
        pairedLedgerEntryId: "ledger-refund-001-customer",
        refundId: "refund-001",
        reason: "One chilled drink was unavailable at collection.",
        refundScope: "partial",
        source: "deterministic_seed",
      },
      reversesLedgerEntryId: "ledger-purchase-001-vendor",
    },
    {
      id: "ledger-refund-002-customer",
      walletId: "wallet-customer-002",
      transactionGroupId: "transaction-refund-002",
      entryType: "customer_refund",
      direction: "credit",
      tokenAmount: 40,
      actorAccountId: "account-vendor-002",
      relatedCustomerId: "customer-002",
      relatedVendorId: "vendor-002",
      relatedOrderId: "order-002",
      relatedEvidenceId: null,
      reference: "REF-20260725-002",
      description: "Customer wallet credit for full order refund.",
      occurredAt: "2026-07-25T05:00:00.000Z",
      idempotencyKey: createOperationLedgerIdempotencyKey("seed:refund:002"),
      metadata: {
        pairedLedgerEntryId: "ledger-refund-002-vendor",
        refundId: "refund-002",
        reason: "Requested apparel size was unavailable before collection.",
        refundScope: "full",
        source: "deterministic_seed",
      },
      reversesLedgerEntryId: "ledger-purchase-002-customer",
    },
    {
      id: "ledger-refund-002-vendor",
      walletId: "wallet-vendor-002",
      transactionGroupId: "transaction-refund-002",
      entryType: "vendor_refund",
      direction: "debit",
      tokenAmount: 40,
      actorAccountId: "account-vendor-002",
      relatedCustomerId: "customer-002",
      relatedVendorId: "vendor-002",
      relatedOrderId: "order-002",
      relatedEvidenceId: null,
      reference: "REF-20260725-002",
      description: "Vendor wallet debit for full order refund.",
      occurredAt: "2026-07-25T05:00:00.000Z",
      idempotencyKey: createScopedLedgerIdempotencyKey(
        "seed:refund:002",
        "vendor-debit",
      ),
      metadata: {
        pairedLedgerEntryId: "ledger-refund-002-customer",
        refundId: "refund-002",
        reason: "Requested apparel size was unavailable before collection.",
        refundScope: "full",
        source: "deterministic_seed",
      },
      reversesLedgerEntryId: "ledger-purchase-002-vendor",
    },
    {
      id: "ledger-purchase-003-customer",
      walletId: "wallet-customer-001",
      transactionGroupId: "transaction-purchase-003",
      entryType: "customer_purchase",
      direction: "debit",
      tokenAmount: 28,
      actorAccountId: "account-customer-001",
      relatedCustomerId: "customer-001",
      relatedVendorId: "vendor-003",
      relatedOrderId: "order-003",
      relatedEvidenceId: null,
      reference: "ORD-20260726-001",
      description: "Customer wallet debit for completed order.",
      occurredAt: "2026-07-26T01:00:00.000Z",
      idempotencyKey: createOperationLedgerIdempotencyKey("seed:purchase:003"),
      metadata: {
        pairedLedgerEntryId: "ledger-purchase-003-vendor",
        source: "deterministic_seed",
      },
      reversesLedgerEntryId: null,
    },
    {
      id: "ledger-purchase-003-vendor",
      walletId: "wallet-vendor-003",
      transactionGroupId: "transaction-purchase-003",
      entryType: "vendor_receipt",
      direction: "credit",
      tokenAmount: 28,
      actorAccountId: "account-customer-001",
      relatedCustomerId: "customer-001",
      relatedVendorId: "vendor-003",
      relatedOrderId: "order-003",
      relatedEvidenceId: null,
      reference: "ORD-20260726-001",
      description: "Vendor wallet credit for completed order.",
      occurredAt: "2026-07-26T01:00:00.000Z",
      idempotencyKey: createScopedLedgerIdempotencyKey(
        "seed:purchase:003",
        "vendor-credit",
      ),
      metadata: {
        pairedLedgerEntryId: "ledger-purchase-003-customer",
        source: "deterministic_seed",
      },
      reversesLedgerEntryId: null,
    },
    {
      id: "ledger-purchase-004-customer",
      walletId: "wallet-customer-003",
      transactionGroupId: "transaction-purchase-004",
      entryType: "customer_purchase",
      direction: "debit",
      tokenAmount: 22,
      actorAccountId: "account-customer-003",
      relatedCustomerId: "customer-003",
      relatedVendorId: "vendor-001",
      relatedOrderId: "order-004",
      relatedEvidenceId: null,
      reference: "ORD-20260726-002",
      description: "Customer wallet debit for completed order.",
      occurredAt: "2026-07-26T02:00:00.000Z",
      idempotencyKey: createOperationLedgerIdempotencyKey("seed:purchase:004"),
      metadata: {
        pairedLedgerEntryId: "ledger-purchase-004-vendor",
        source: "deterministic_seed",
      },
      reversesLedgerEntryId: null,
    },
    {
      id: "ledger-purchase-004-vendor",
      walletId: "wallet-vendor-001",
      transactionGroupId: "transaction-purchase-004",
      entryType: "vendor_receipt",
      direction: "credit",
      tokenAmount: 22,
      actorAccountId: "account-customer-003",
      relatedCustomerId: "customer-003",
      relatedVendorId: "vendor-001",
      relatedOrderId: "order-004",
      relatedEvidenceId: null,
      reference: "ORD-20260726-002",
      description: "Vendor wallet credit for completed order.",
      occurredAt: "2026-07-26T02:00:00.000Z",
      idempotencyKey: createScopedLedgerIdempotencyKey(
        "seed:purchase:004",
        "vendor-credit",
      ),
      metadata: {
        pairedLedgerEntryId: "ledger-purchase-004-customer",
        source: "deterministic_seed",
      },
      reversesLedgerEntryId: null,
    },
  ]);

  const settlements = parseSettlements([
    {
      id: "settlement-001",
      reference: "SET-20260726-001",
      vendorId: "vendor-001",
      periodStart: "2026-07-25T00:00:00.000Z",
      periodEnd: "2026-07-26T10:00:00.000Z",
      earnedTokenAmount: 40,
      status: "paid",
      payoutReference: "MANUAL-PAYOUT-SEED-001",
      notes:
        "Manual prototype settlement record; no bank transfer was initiated.",
      createdByAccountId: "account-admin-001",
      approvedByAccountId: "account-admin-001",
      paidByAccountId: "account-admin-001",
      createdAt: "2026-07-26T11:00:00.000Z",
      updatedAt: "2026-07-26T11:30:00.000Z",
    },
  ]);

  const auditLogs = parseAuditLogs([
    ...evidence.map((record, index) => ({
      id: `audit-evidence-00${index + 1}`,
      eventType: "evidence_attached",
      actorAccountId: record.capturedByAccountId,
      targetType: "evidence",
      targetId: record.id,
      description: "Local prototype evidence metadata attached by event staff.",
      occurredAt: record.createdAt,
      metadata: {
        source: "deterministic_seed",
        prototypePlaceholder: true,
      },
      transactionGroupId: `transaction-issuance-00${index + 1}`,
    })),
    ...tokenIssuances.map((record, index) => ({
      id: `audit-issuance-00${index + 1}`,
      eventType: "token_issuance_created",
      actorAccountId: record.staffAccountId,
      targetType: "token_issuance",
      targetId: record.id,
      description:
        "Token issuance recorded after a manual staff payment check.",
      occurredAt: record.createdAt,
      metadata: {
        paynowAmountCents: record.paynowAmountCents,
        tokenAmount: record.tokenAmount,
        tokensPerDollar: record.tokensPerDollar,
        source: "deterministic_seed",
      },
      transactionGroupId: record.transactionGroupId,
    })),
    ...orders.map((record, index) => ({
      id: `audit-purchase-00${index + 1}`,
      eventType: "purchase_completed",
      actorAccountId: `account-customer-00${record.customerId.slice(-1)}`,
      targetType: "order",
      targetId: record.id,
      description: "Customer purchase completed.",
      occurredAt: record.completedAt,
      metadata: {
        tokenAmount: record.tokenTotal,
        itemCount: record.items.reduce(
          (total, item) => total + item.quantity,
          0,
        ),
        source: "deterministic_seed",
      },
      transactionGroupId: record.transactionGroupId,
    })),
    {
      id: "audit-refund-001",
      eventType: "refund_created",
      actorAccountId: "account-vendor-001",
      targetType: "refund",
      targetId: "refund-001",
      description: "Partial order refund recorded by vendor.",
      occurredAt: "2026-07-25T04:00:00.000Z",
      metadata: {
        tokenAmount: 6,
        refundScope: "partial",
        source: "deterministic_seed",
      },
      transactionGroupId: "transaction-refund-001",
    },
    {
      id: "audit-refund-002",
      eventType: "refund_created",
      actorAccountId: "account-vendor-002",
      targetType: "refund",
      targetId: "refund-002",
      description: "Full order refund recorded by vendor.",
      occurredAt: "2026-07-25T05:00:00.000Z",
      metadata: {
        tokenAmount: 40,
        refundScope: "full",
        source: "deterministic_seed",
      },
      transactionGroupId: "transaction-refund-002",
    },
    {
      id: "audit-product-availability-001",
      eventType: "product_availability_changed",
      actorAccountId: "account-vendor-001",
      targetType: "product",
      targetId: "product-food-004",
      description: "Product sold-out state changed.",
      occurredAt: "2026-07-25T06:00:00.000Z",
      metadata: {
        isAvailable: true,
        isSoldOut: true,
        source: "deterministic_seed",
      },
      transactionGroupId: null,
    },
    {
      id: "audit-settlement-created-001",
      eventType: "settlement_created",
      actorAccountId: "account-admin-001",
      targetType: "settlement",
      targetId: "settlement-001",
      description: "Manual vendor settlement record created.",
      occurredAt: "2026-07-26T11:00:00.000Z",
      metadata: {
        earnedTokenAmount: 40,
        status: "draft",
        manualRecord: true,
        source: "deterministic_seed",
      },
      transactionGroupId: null,
    },
    {
      id: "audit-settlement-approved-001",
      eventType: "settlement_status_changed",
      actorAccountId: "account-admin-001",
      targetType: "settlement",
      targetId: "settlement-001",
      description: "Manual vendor settlement status changed to approved.",
      occurredAt: "2026-07-26T11:15:00.000Z",
      metadata: {
        previousStatus: "draft",
        status: "approved",
        manualRecord: true,
        source: "deterministic_seed",
      },
      transactionGroupId: null,
    },
    {
      id: "audit-settlement-paid-001",
      eventType: "settlement_status_changed",
      actorAccountId: "account-admin-001",
      targetType: "settlement",
      targetId: "settlement-001",
      description: "Manual vendor settlement status changed to paid.",
      occurredAt: "2026-07-26T11:30:00.000Z",
      metadata: {
        previousStatus: "approved",
        status: "paid",
        manualRecord: true,
        source: "deterministic_seed",
      },
      transactionGroupId: null,
    },
  ]);

  const eventSettings = eventSettingsSchema.parse({
    id: "event-settings-main",
    eventName: "Tokenly Floorball Weekend",
    eventSubtitle: "Two days of floorball, food, and community",
    eventDates: {
      startsAt: "2026-07-25T00:00:00.000Z",
      endsAt: "2026-07-26T10:00:00.000Z",
    },
    venue: "Harbour Courts Event Hall",
    tokensPerDollar: 10,
    supportLabel: "Event help desk",
    supportContact: "help@tokenly.local",
    supportInstructions:
      "Visit the event help desk near the main entrance for wallet or purchase assistance.",
    updatedByAccountId: "account-admin-001",
    updatedAt: "2026-07-10T00:00:00.000Z",
  });

  const evidenceContents = Object.freeze(
    evidence.map((record) =>
      Object.freeze({
        evidenceId: record.id,
        mimeType: record.mimeType,
        bytes: placeholderPngBytes,
      }),
    ),
  );

  return Object.freeze({
    accounts,
    accountPinCredentials,
    customers,
    wallets,
    ledgerEntries,
    tokenIssuances,
    evidence,
    evidenceContents,
    vendors,
    products,
    orders,
    refunds,
    settlements,
    auditLogs,
    eventSettings: Object.freeze(eventSettings),
  });
}
