import "server-only";

import { randomBytes, randomUUID } from "node:crypto";

import { z } from "zod";

import {
  buildTokenlyQrPayload,
  parseTokenlyQrPayload,
} from "@/modules/qr-payments";
import type { CustomerTransactionListItem } from "@/modules/customer-application";
import {
  createTokenerSchema,
  type AdminTokenerTransactionItem,
  type CreateTokenerInput,
} from "@/modules/customer-access";
import type {
  AdminBoothCategory,
  AdminBoothReport,
  AdminBoothSummary,
  AdminBoothTransactionItem,
  AdminCreditIssuanceReportItem,
  AdminTransactionOverview,
} from "@/modules/admin-application";

import { createSupabaseServerClient } from "./supabase-server-client";

const claimExpiryMinutes = 15;
const defaultAdminUsername = "AdminLance";
const defaultVendorUsername = "Vendor1";
const fractionalTokenAmountSchema = z.coerce
  .number()
  .positive()
  .multipleOf(0.01);

export const createSupabaseTokenerSchema = createTokenerSchema;

export const supabaseTokenAdjustmentSchema = z
  .object({
    customerId: z.string().uuid(),
    direction: z.enum(["credit", "debit"]),
    reason: z.string().trim().min(1).max(400),
    tokenAmount: z.coerce.number().int().positive().safe(),
  })
  .strict();

export const supabaseCreditIssuanceSchema = z
  .object({
    amountCents: z.coerce.number().int().positive().safe(),
    customerId: z.string().uuid(),
    paymentMethod: z.enum(["cash", "paynow"]),
  })
  .strict();

export const supabaseVendorChargeSchema = z
  .object({
    customerId: z.string().uuid(),
    direction: z.literal("deduct").default("deduct"),
    tokenAmount: z.coerce.number().positive().multipleOf(0.01),
    vendorUsername: z.string().trim().min(1).max(64),
  })
  .strict();

export const supabaseAdminVendorRefundSchema = z
  .object({
    customerId: z.string().uuid(),
    purchaseTransactionGroupId: z.string().uuid(),
    reason: z.string().trim().min(1).max(400),
    tokenAmount: z.coerce.number().positive().multipleOf(0.01),
  })
  .strict();

export type CreateSupabaseTokenerInput = CreateTokenerInput;

export type SupabaseTokenAdjustmentInput = z.infer<
  typeof supabaseTokenAdjustmentSchema
>;

export interface SupabaseCreditIssuanceInput extends z.infer<
  typeof supabaseCreditIssuanceSchema
> {
  readonly evidence: File;
}

export type SupabaseVendorChargeInput = z.infer<
  typeof supabaseVendorChargeSchema
>;

export type SupabaseAdminVendorRefundInput = z.infer<
  typeof supabaseAdminVendorRefundSchema
>;

export interface SupabaseTokenerSummary {
  readonly balance: number;
  readonly claimExpiresAt: string;
  readonly claimedAt: string | null;
  readonly claimPath: string;
  readonly customerId: string;
  readonly displayName: string;
  readonly mobileNumber: string | null;
  readonly transactions: readonly AdminTokenerTransactionItem[];
  readonly walletPublicCode: string;
  readonly walletQrUpdatedAt: string;
}

export interface SupabasePrivateAccount {
  readonly balance: number;
  readonly customerId: string;
  readonly displayName: string;
  readonly privateAccountPath: string;
  readonly transactions: readonly CustomerTransactionListItem[];
  readonly walletPublicCode: string;
  readonly walletQrPayload: string;
  readonly walletQrUpdatedAt: string;
  readonly walletStatus: "active" | "frozen";
}

export interface SupabaseClaimResult {
  readonly displayName: string;
  readonly privateAccountPath: string;
}

export interface SupabaseResolvedCustomerWallet {
  readonly balance: number;
  readonly customerId: string;
  readonly displayName: string;
  readonly walletPublicCode: string;
}

export interface SupabaseVendorChargeResult extends SupabaseResolvedCustomerWallet {
  readonly reference: string;
}

export interface SupabaseAdminVendorRefundResult {
  readonly remainingRefundableTokenAmount: number;
  readonly reference: string;
  readonly tokener: SupabaseTokenerSummary;
}

export interface SupabaseVendorActivityItem {
  readonly description: string;
  readonly direction: "credit" | "debit";
  readonly entryType:
    | "administrative_adjustment"
    | "customer_purchase"
    | "customer_refund"
    | "token_issuance"
    | "vendor_receipt"
    | "vendor_refund"
    | "vendor_settlement";
  readonly id: string;
  readonly occurredAt: string;
  readonly reference: string;
  readonly tokenAmount: number;
}

export interface SupabaseVendorOverview {
  readonly balance: number;
  readonly displayName: string;
  readonly recentActivity: readonly SupabaseVendorActivityItem[];
  readonly stallLocation: string;
}

export class SupabaseTokenlyAccessError extends Error {
  public constructor(
    public readonly code:
      | "CLAIM_QR_ALREADY_USED"
      | "CLAIM_QR_EXPIRED"
      | "CUSTOMER_ACCESS_DENIED"
      | "DUPLICATE_MOBILE_NUMBER"
      | "INVALID_INPUT"
      | "TOKEN_CHARGE_INSUFFICIENT_BALANCE"
      | "TOKEN_REFUND_AMOUNT_EXCEEDS_REMAINING"
      | "TOKEN_REFUND_INSUFFICIENT_VENDOR_BALANCE"
      | "TOKEN_REFUND_PURCHASE_NOT_FOUND"
      | "TOKEN_ADJUSTMENT_OVERDRAWS_WALLET"
      | "TOKENLY_SUPABASE_WRITE_FAILED",
    message: string,
  ) {
    super(message);
    this.name = "SupabaseTokenlyAccessError";
  }
}

const eventRowSchema = z
  .object({
    id: z.string().uuid(),
  })
  .passthrough();

const accountRowSchema = z
  .object({
    display_name: z.string(),
    id: z.string().uuid(),
    role: z.enum(["customer", "vendor", "staff", "administrator"]),
    status: z.enum(["active", "disabled"]),
  })
  .passthrough();

const accountReportRowSchema = accountRowSchema.extend({
  username: z.string().nullable().optional(),
});

const customerRowSchema = z
  .object({
    account_id: z.string().uuid(),
    claim_code: z.string(),
    claim_expires_at: z.string(),
    claimed_at: z.string().nullable(),
    id: z.string().uuid(),
    mobile_number: z.string().nullable().optional(),
    private_access_code: z.string(),
    public_code: z.string(),
    wallet_id: z.string().uuid(),
    wallet_qr_updated_at: z.string(),
  })
  .passthrough();

const walletRowSchema = z
  .object({
    id: z.string().uuid(),
    owner_account_id: z.string().uuid(),
    owner_type: z.enum(["customer", "vendor"]),
    status: z.enum(["active", "frozen"]),
  })
  .passthrough();

const adminVendorReportRowSchema = z
  .object({
    account_id: z.string().uuid(),
    display_name: z.string(),
    id: z.string().uuid(),
    stall_location: z.string(),
    wallet_id: z.string().uuid(),
  })
  .passthrough();

const vendorNameRowSchema = z
  .object({
    account_id: z.string().uuid(),
    display_name: z.string(),
    id: z.string().uuid(),
  })
  .passthrough();

const ledgerEntryRowSchema = z
  .object({
    description: z.string(),
    direction: z.enum(["credit", "debit"]),
    entry_type: z.string(),
    id: z.string().uuid(),
    occurred_at: z.string(),
    reference: z.string(),
    related_customer_id: z.string().uuid().nullable().optional(),
    related_order_id: z.string().uuid().nullable().optional(),
    related_vendor_id: z.string().uuid().nullable().optional(),
    reverses_ledger_entry_id: z.string().uuid().nullable().optional(),
    token_amount: fractionalTokenAmountSchema,
    transaction_group_id: z.string().uuid(),
    wallet_id: z.string().uuid(),
  })
  .passthrough();

const adminLedgerEntryRowSchema = z
  .object({
    description: z.string(),
    direction: z.enum(["credit", "debit"]),
    entry_type: z.enum([
      "administrative_adjustment",
      "customer_purchase",
      "customer_refund",
      "token_issuance",
      "vendor_receipt",
      "vendor_refund",
      "vendor_settlement",
    ]),
    id: z.string().uuid(),
    occurred_at: z.string(),
    reference: z.string(),
    token_amount: fractionalTokenAmountSchema,
    transaction_group_id: z.string().uuid(),
  })
  .strict();

const adminCustomerReportRowSchema = z
  .object({
    account_id: z.string().uuid(),
    id: z.string().uuid(),
    mobile_number: z.string().nullable().optional(),
  })
  .passthrough();

const adminEvidenceReportRowSchema = z
  .object({
    file_name: z.string(),
    id: z.string().uuid(),
    metadata: z.unknown(),
    mime_type: z.string(),
    size_bytes: z.coerce.number().int().positive(),
    storage_path: z.string(),
  })
  .passthrough();

const adminTokenIssuanceReportRowSchema = z
  .object({
    created_at: z.string(),
    customer_id: z.string().uuid(),
    evidence_id: z.string().uuid(),
    id: z.string().uuid(),
    paynow_amount_cents: z.coerce.number().int().positive(),
    reference: z.string(),
    token_amount: fractionalTokenAmountSchema,
    transaction_group_id: z.string().uuid(),
  })
  .passthrough();

const adminTransactionMetricsRowSchema = z
  .object({
    issued_tokens: fractionalTokenAmountSchema.catch(0),
    refunded_tokens: fractionalTokenAmountSchema.catch(0),
    spent_tokens: fractionalTokenAmountSchema.catch(0),
    transaction_groups: z.coerce.number().int().nonnegative().safe(),
  })
  .strict();

const vendorOverviewActivityRowSchema = z
  .object({
    description: z.string(),
    direction: z.enum(["credit", "debit"]),
    entryType: adminLedgerEntryRowSchema.shape.entry_type,
    id: z.string().uuid(),
    occurredAt: z.string(),
    reference: z.string(),
    tokenAmount: fractionalTokenAmountSchema,
  })
  .strict();

const vendorOverviewRpcRowSchema = z
  .object({
    balance: fractionalTokenAmountSchema.catch(0),
    display_name: z.string(),
    recent_activity: z.array(vendorOverviewActivityRowSchema),
    stall_location: z.string(),
  })
  .strict();

function assertNoSupabaseError(error: { readonly message?: string } | null) {
  if (error !== null) {
    throw new SupabaseTokenlyAccessError(
      "TOKENLY_SUPABASE_WRITE_FAILED",
      "Tokenly Supabase operation failed.",
    );
  }
}

function addMinutes(date: Date, minutes: number): string {
  return new Date(date.getTime() + minutes * 60_000).toISOString();
}

function encodeBase64Url(bytes: Buffer): string {
  return bytes
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function generateCode(prefix: "claim" | "cus" | "priv"): string {
  if (prefix === "priv") {
    return randomBytes(20)
      .toString("hex")
      .replaceAll(/[a-f]/g, (value) => String(value.charCodeAt(0) % 10));
  }

  return `${prefix}_${encodeBase64Url(randomBytes(24))}`;
}

function buildClaimPath(claimCode: string): string {
  return `/claim/${encodeURIComponent(claimCode)}`;
}

function buildPrivateAccountPath(privateAccessCode: string): string {
  return `/card/${encodeURIComponent(privateAccessCode)}`;
}

function calculateBalance(
  entries: readonly z.infer<typeof ledgerEntryRowSchema>[],
) {
  const balance = entries.reduce((currentBalance, entry) => {
    return entry.direction === "credit"
      ? currentBalance + entry.token_amount
      : currentBalance - entry.token_amount;
  }, 0);

  return Math.round(balance * 100) / 100;
}

interface VendorDisplayDetails {
  readonly displayName: string;
  readonly username: string | null;
}

type LedgerEntryRow = z.infer<typeof ledgerEntryRowSchema>;

function getCustomerTransactionPresentation(entry: LedgerEntryRow): {
  readonly kind: CustomerTransactionListItem["kind"];
  readonly title: string;
} {
  switch (entry.entry_type) {
    case "administrative_adjustment":
      return {
        kind: "adjustment",
        title: entry.direction === "credit" ? "Tokens added" : "Tokens removed",
      };
    case "customer_purchase":
      return { kind: "purchase", title: "Vendor charge" };
    case "customer_refund":
      return { kind: "refund", title: "Refund received" };
    case "token_issuance":
      return { kind: "issuance", title: "Credits issued" };
    default:
      return { kind: "other", title: "Wallet activity" };
  }
}

function getAdminTokenerTransactionTitle(entry: LedgerEntryRow): string {
  switch (entry.entry_type) {
    case "administrative_adjustment":
      return entry.direction === "credit" ? "Admin credit" : "Admin debit";
    case "customer_purchase":
      return "Vendor charge";
    case "customer_refund":
      return "Admin refund";
    case "token_issuance":
      return "Credit issuance";
    default:
      return "Wallet activity";
  }
}

async function loadVendorDisplayDetailsById(
  vendorIds: readonly string[],
): Promise<ReadonlyMap<string, VendorDisplayDetails>> {
  const uniqueVendorIds = [...new Set(vendorIds)];
  if (uniqueVendorIds.length === 0) {
    return new Map();
  }

  const supabase = createSupabaseServerClient();
  const vendorsResult = await supabase
    .from("vendors")
    .select("id, account_id, display_name")
    .in("id", uniqueVendorIds);

  assertNoSupabaseError(vendorsResult.error);
  const vendors = z.array(vendorNameRowSchema).parse(vendorsResult.data);
  const accountsResult = await supabase
    .from("account_profiles")
    .select("id, display_name, role, status, username")
    .in("id", [...new Set(vendors.map((vendor) => vendor.account_id))]);

  assertNoSupabaseError(accountsResult.error);
  const accountsById = new Map(
    z
      .array(accountReportRowSchema)
      .parse(accountsResult.data)
      .map((account) => [account.id, account]),
  );

  return new Map(
    vendors.map((vendor) => {
      const account = accountsById.get(vendor.account_id);
      return [
        vendor.id,
        {
          displayName: vendor.display_name,
          username: account?.username ?? null,
        } satisfies VendorDisplayDetails,
      ];
    }),
  );
}

function buildAdminTokenerTransactions(
  entries: readonly LedgerEntryRow[],
  vendorsById: ReadonlyMap<string, VendorDisplayDetails>,
): readonly AdminTokenerTransactionItem[] {
  const refundedByPurchaseEntryId = new Map<string, number>();

  for (const entry of entries) {
    if (
      entry.entry_type === "customer_refund" &&
      entry.direction === "credit" &&
      entry.reverses_ledger_entry_id !== null &&
      entry.reverses_ledger_entry_id !== undefined
    ) {
      refundedByPurchaseEntryId.set(
        entry.reverses_ledger_entry_id,
        (refundedByPurchaseEntryId.get(entry.reverses_ledger_entry_id) ?? 0) +
          entry.token_amount,
      );
    }
  }

  return entries
    .map((entry): AdminTokenerTransactionItem => {
      const vendor =
        entry.related_vendor_id === null ||
        entry.related_vendor_id === undefined
          ? null
          : (vendorsById.get(entry.related_vendor_id) ?? null);
      const refundedTokenAmount = refundedByPurchaseEntryId.get(entry.id) ?? 0;
      const refundableTokenAmount =
        entry.entry_type === "customer_purchase" && entry.direction === "debit"
          ? Math.max(
              0,
              Math.round((entry.token_amount - refundedTokenAmount) * 100) /
                100,
            )
          : 0;

      return {
        description: entry.description,
        direction: entry.direction,
        entryType: adminLedgerEntryRowSchema.shape.entry_type.parse(
          entry.entry_type,
        ),
        id: entry.id,
        occurredAt: entry.occurred_at,
        reference: entry.reference,
        refundableTokenAmount,
        title: getAdminTokenerTransactionTitle(entry),
        tokenAmount: entry.token_amount,
        transactionGroupId: entry.transaction_group_id,
        vendorName: vendor?.displayName ?? null,
        vendorUsername: vendor?.username ?? null,
      };
    })
    .sort(
      (left, right) =>
        Date.parse(right.occurredAt) - Date.parse(left.occurredAt),
    );
}

function toTransaction(
  entry: LedgerEntryRow,
  vendorsById: ReadonlyMap<string, VendorDisplayDetails> = new Map(),
): CustomerTransactionListItem {
  const presentation = getCustomerTransactionPresentation(entry);
  const vendor =
    entry.related_vendor_id === null || entry.related_vendor_id === undefined
      ? null
      : (vendorsById.get(entry.related_vendor_id) ?? null);

  return {
    direction: entry.direction,
    id: entry.id,
    kind: presentation.kind,
    orderId: entry.related_order_id ?? null,
    occurredAt: entry.occurred_at,
    reference: entry.reference,
    subtitle: entry.description,
    title: presentation.title,
    tokenAmount: entry.token_amount,
    transactionGroupId: entry.transaction_group_id,
    transactionId: entry.related_order_id ?? entry.id,
    vendorName: vendor?.displayName ?? null,
  };
}

async function loadPrimarySupabaseEventId(): Promise<string> {
  const supabase = createSupabaseServerClient();
  const existingEvent = await supabase
    .from("events")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  assertNoSupabaseError(existingEvent.error);
  return eventRowSchema.parse(existingEvent.data).id;
}

async function loadSupabaseAdminContext(): Promise<{
  readonly adminAccountId: string;
  readonly eventId: string;
}> {
  const supabase = createSupabaseServerClient();
  const [eventId, adminAccount] = await Promise.all([
    loadPrimarySupabaseEventId(),
    supabase
      .from("account_profiles")
      .select("id, display_name, role, status")
      .eq("username", defaultAdminUsername)
      .eq("role", "administrator")
      .eq("status", "active")
      .single(),
  ]);

  assertNoSupabaseError(adminAccount.error);
  return {
    adminAccountId: accountRowSchema.parse(adminAccount.data).id,
    eventId,
  };
}

async function loadEntriesForWallet(walletId: string) {
  const supabase = createSupabaseServerClient();
  const entries = await supabase
    .from("ledger_entries")
    .select(
      "id, wallet_id, transaction_group_id, entry_type, direction, token_amount, reference, description, occurred_at, related_customer_id, related_vendor_id, related_order_id, reverses_ledger_entry_id",
    )
    .eq("wallet_id", walletId)
    .order("occurred_at", { ascending: false });

  assertNoSupabaseError(entries.error);
  return z.array(ledgerEntryRowSchema).parse(entries.data);
}

async function loadAccount(accountId: string) {
  const supabase = createSupabaseServerClient();
  const account = await supabase
    .from("account_profiles")
    .select("id, display_name, role, status")
    .eq("id", accountId)
    .single();

  assertNoSupabaseError(account.error);
  return accountRowSchema.parse(account.data);
}

async function loadWallet(walletId: string) {
  const supabase = createSupabaseServerClient();
  const wallet = await supabase
    .from("wallets")
    .select("id, owner_account_id, owner_type, status")
    .eq("id", walletId)
    .single();

  assertNoSupabaseError(wallet.error);
  return walletRowSchema.parse(wallet.data);
}

async function toSummary(
  customer: z.infer<typeof customerRowSchema>,
): Promise<SupabaseTokenerSummary> {
  const [account, entries] = await Promise.all([
    loadAccount(customer.account_id),
    loadEntriesForWallet(customer.wallet_id),
  ]);
  const vendorsById = await loadVendorDisplayDetailsById(
    entries
      .map((entry) => entry.related_vendor_id)
      .filter((vendorId): vendorId is string => typeof vendorId === "string"),
  );

  return {
    balance: calculateBalance(entries),
    claimExpiresAt: customer.claim_expires_at,
    claimedAt: customer.claimed_at,
    claimPath: buildClaimPath(customer.claim_code),
    customerId: customer.id,
    displayName: account.display_name,
    mobileNumber: customer.mobile_number ?? null,
    transactions: buildAdminTokenerTransactions(entries, vendorsById),
    walletPublicCode: customer.public_code,
    walletQrUpdatedAt: customer.wallet_qr_updated_at,
  };
}

function parseEvidencePaymentMethod(
  metadata: unknown,
): AdminCreditIssuanceReportItem["paymentMethod"] {
  const parsed = z
    .object({ paymentMethod: z.enum(["cash", "paynow"]).optional() })
    .passthrough()
    .safeParse(metadata);

  return parsed.success ? (parsed.data.paymentMethod ?? "unknown") : "unknown";
}

async function buildEvidencePreviewUrl(
  storagePath: string,
): Promise<string | null> {
  const supabase = createSupabaseServerClient();
  const signedUrl = await supabase.storage
    .from("payment-evidence")
    .createSignedUrl(storagePath, 30 * 60);

  return signedUrl.error === null ? signedUrl.data.signedUrl : null;
}

async function getSupabaseAdminCreditIssuanceReports(
  eventId: string,
): Promise<readonly AdminCreditIssuanceReportItem[]> {
  const supabase = createSupabaseServerClient();
  const issuancesResult = await supabase
    .from("token_issuances")
    .select(
      "id, customer_id, evidence_id, paynow_amount_cents, token_amount, reference, transaction_group_id, created_at",
    )
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });

  assertNoSupabaseError(issuancesResult.error);
  const issuances = z
    .array(adminTokenIssuanceReportRowSchema)
    .parse(issuancesResult.data);

  if (issuances.length === 0) {
    return [];
  }

  const customerIds = [
    ...new Set(issuances.map((issuance) => issuance.customer_id)),
  ];
  const evidenceIds = [
    ...new Set(issuances.map((issuance) => issuance.evidence_id)),
  ];
  const [customersResult, evidenceResult] = await Promise.all([
    supabase
      .from("customers")
      .select("id, account_id, mobile_number")
      .in("id", customerIds),
    supabase
      .from("evidence")
      .select("id, storage_path, file_name, mime_type, size_bytes, metadata")
      .in("id", evidenceIds),
  ]);

  assertNoSupabaseError(customersResult.error);
  assertNoSupabaseError(evidenceResult.error);
  const customers = z
    .array(adminCustomerReportRowSchema)
    .parse(customersResult.data);
  const evidenceRows = z
    .array(adminEvidenceReportRowSchema)
    .parse(evidenceResult.data);
  const accountsResult = await supabase
    .from("account_profiles")
    .select("id, display_name, role, status, username")
    .in("id", [...new Set(customers.map((customer) => customer.account_id))]);

  assertNoSupabaseError(accountsResult.error);
  const customersById = new Map(
    customers.map((customer) => [customer.id, customer]),
  );
  const evidenceById = new Map(
    evidenceRows.map((evidence) => [evidence.id, evidence]),
  );
  const accountsById = new Map(
    z
      .array(accountReportRowSchema)
      .parse(accountsResult.data)
      .map((account) => [account.id, account]),
  );
  const previewUrlsByEvidenceId = new Map(
    await Promise.all(
      evidenceRows.map(
        async (evidence) =>
          [
            evidence.id,
            await buildEvidencePreviewUrl(evidence.storage_path),
          ] as const,
      ),
    ),
  );

  return issuances.map((issuance) => {
    const customer = customersById.get(issuance.customer_id);
    const evidence = evidenceById.get(issuance.evidence_id);
    const account =
      customer === undefined
        ? undefined
        : accountsById.get(customer.account_id);

    if (
      customer === undefined ||
      evidence === undefined ||
      account === undefined
    ) {
      throw new SupabaseTokenlyAccessError(
        "TOKENLY_SUPABASE_WRITE_FAILED",
        "Tokenly Supabase operation failed.",
      );
    }

    return {
      createdAt: issuance.created_at,
      customerId: customer.id,
      customerName: account.display_name,
      evidenceFileName: evidence.file_name,
      evidenceMimeType: evidence.mime_type,
      evidencePreviewUrl: previewUrlsByEvidenceId.get(evidence.id) ?? null,
      evidenceStoragePath: evidence.storage_path,
      id: issuance.id,
      mobileNumber: customer.mobile_number ?? null,
      paymentMethod: parseEvidencePaymentMethod(evidence.metadata),
      reference: issuance.reference,
      sgdAmountCents: issuance.paynow_amount_cents,
      tokenAmount: issuance.token_amount,
      transactionGroupId: issuance.transaction_group_id,
    } satisfies AdminCreditIssuanceReportItem;
  });
}

function getVendorBoothCategory(
  vendor: z.infer<typeof adminVendorReportRowSchema>,
  username: string,
): AdminBoothCategory | null {
  if (username === defaultVendorUsername) {
    return "vendor1";
  }

  const source = `${vendor.stall_location} ${username}`.toLocaleLowerCase(
    "en-SG",
  );

  if (source.includes("food")) {
    return "food";
  }

  if (source.includes("game")) {
    return "games";
  }

  return null;
}

function getVendorBoothNumber(
  vendor: z.infer<typeof adminVendorReportRowSchema>,
  username: string,
): number | null {
  if (username === defaultVendorUsername) {
    return 1;
  }

  const match = /booth\s*0?([1-6])\b/i.exec(vendor.stall_location);
  return match === null ? null : Number(match[1]);
}

function toBoothSummary(
  vendor: z.infer<typeof adminVendorReportRowSchema>,
  username: string,
  boothNumber: number,
  entries: readonly z.infer<typeof ledgerEntryRowSchema>[],
): AdminBoothSummary {
  const creditedTokens = calculateBalance(
    entries.filter((entry) => entry.direction === "credit"),
  );
  const debitedTokens = entries
    .filter((entry) => entry.direction === "debit")
    .reduce((total, entry) => total + entry.token_amount, 0);

  return {
    boothNumber,
    creditedTokens,
    debitedTokens,
    netTokens: calculateBalance(entries),
    stallLocation: vendor.stall_location,
    transactionCount: entries.length,
    vendorId: vendor.id,
    vendorName: vendor.display_name,
    vendorUsername: username,
  };
}

async function getSupabaseAdminBoothReports(
  eventId: string,
): Promise<readonly AdminBoothReport[]> {
  const supabase = createSupabaseServerClient();
  const vendorsResult = await supabase
    .from("vendors")
    .select("id, account_id, wallet_id, display_name, stall_location")
    .eq("event_id", eventId);

  assertNoSupabaseError(vendorsResult.error);
  const vendors = z.array(adminVendorReportRowSchema).parse(vendorsResult.data);
  if (vendors.length === 0) {
    return [
      { category: "vendor1", summaries: [], transactions: [] },
      { category: "games", summaries: [], transactions: [] },
      { category: "food", summaries: [], transactions: [] },
    ];
  }

  const [accountsResult, entriesResult] = await Promise.all([
    supabase
      .from("account_profiles")
      .select("id, display_name, role, status, username")
      .in("id", [...new Set(vendors.map((vendor) => vendor.account_id))]),
    supabase
      .from("ledger_entries")
      .select(
        "id, wallet_id, transaction_group_id, entry_type, direction, token_amount, reference, description, occurred_at, related_customer_id, related_vendor_id, related_order_id, reverses_ledger_entry_id",
      )
      .in("wallet_id", [...new Set(vendors.map((vendor) => vendor.wallet_id))])
      .order("occurred_at", { ascending: false }),
  ]);

  assertNoSupabaseError(accountsResult.error);
  assertNoSupabaseError(entriesResult.error);
  const accountsById = new Map(
    z
      .array(accountReportRowSchema)
      .parse(accountsResult.data)
      .map((account) => [account.id, account]),
  );
  const entriesByWalletId = new Map<
    string,
    z.infer<typeof ledgerEntryRowSchema>[]
  >();

  for (const entry of z.array(ledgerEntryRowSchema).parse(entriesResult.data)) {
    const walletEntries = entriesByWalletId.get(entry.wallet_id) ?? [];
    walletEntries.push(entry);
    entriesByWalletId.set(entry.wallet_id, walletEntries);
  }

  return (["vendor1", "games", "food"] as const).map((category) => {
    const summaries: AdminBoothSummary[] = [];
    const transactions: AdminBoothTransactionItem[] = [];

    for (const vendor of vendors) {
      const account = accountsById.get(vendor.account_id);
      const username = account?.username ?? "";
      const boothCategory = getVendorBoothCategory(vendor, username);
      const boothNumber = getVendorBoothNumber(vendor, username);

      if (boothCategory !== category || boothNumber === null) {
        continue;
      }

      const entries = entriesByWalletId.get(vendor.wallet_id) ?? [];
      summaries.push(toBoothSummary(vendor, username, boothNumber, entries));
      transactions.push(
        ...entries.map((entry): AdminBoothTransactionItem => ({
          boothNumber,
          description: entry.description,
          direction: entry.direction,
          entryType: adminLedgerEntryRowSchema.shape.entry_type.parse(
            entry.entry_type,
          ),
          id: entry.id,
          occurredAt: entry.occurred_at,
          reference: entry.reference,
          stallLocation: vendor.stall_location,
          tokenAmount: entry.token_amount,
          transactionGroupId: entry.transaction_group_id,
          vendorId: vendor.id,
          vendorName: vendor.display_name,
          vendorUsername: username,
        })),
      );
    }

    return {
      category,
      summaries: summaries.sort(
        (left, right) => left.boothNumber - right.boothNumber,
      ),
      transactions: transactions.sort(
        (left, right) =>
          Date.parse(right.occurredAt) - Date.parse(left.occurredAt),
      ),
    } satisfies AdminBoothReport;
  });
}

export async function listSupabaseTokeners(): Promise<
  readonly SupabaseTokenerSummary[]
> {
  const eventId = await loadPrimarySupabaseEventId();
  const supabase = createSupabaseServerClient();
  const customers = await supabase
    .from("customers")
    .select(
      "id, account_id, wallet_id, private_access_code, claim_code, claim_expires_at, claimed_at, public_code, wallet_qr_updated_at, mobile_number",
    )
    .eq("event_id", eventId);

  assertNoSupabaseError(customers.error);
  const customerRows = z.array(customerRowSchema).parse(customers.data);
  const accountIds = customerRows.map((customer) => customer.account_id);
  const walletIds = customerRows.map((customer) => customer.wallet_id);
  const [accounts, entries] = await Promise.all([
    supabase
      .from("account_profiles")
      .select("id, display_name, role, status")
      .in("id", accountIds),
    supabase
      .from("ledger_entries")
      .select(
        "id, transaction_group_id, entry_type, direction, token_amount, reference, description, occurred_at, related_customer_id, related_vendor_id, related_order_id, reverses_ledger_entry_id, wallet_id",
      )
      .in("wallet_id", walletIds),
  ]);

  assertNoSupabaseError(accounts.error);
  assertNoSupabaseError(entries.error);
  const accountsById = new Map(
    z
      .array(accountRowSchema)
      .parse(accounts.data)
      .map((account) => [account.id, account]),
  );
  const entryRows = z.array(ledgerEntryRowSchema).parse(entries.data);
  const entriesByWalletId = new Map<string, LedgerEntryRow[]>();
  for (const entry of entryRows) {
    const walletEntries = entriesByWalletId.get(entry.wallet_id) ?? [];
    walletEntries.push(entry);
    entriesByWalletId.set(entry.wallet_id, walletEntries);
  }

  return customerRows
    .map((customer) => {
      const account = accountsById.get(customer.account_id);

      if (account === undefined) {
        throw new SupabaseTokenlyAccessError(
          "TOKENLY_SUPABASE_WRITE_FAILED",
          "Tokenly Supabase operation failed.",
        );
      }

      return {
        balance: calculateBalance(
          entriesByWalletId.get(customer.wallet_id) ?? [],
        ),
        claimExpiresAt: customer.claim_expires_at,
        claimedAt: customer.claimed_at,
        claimPath: buildClaimPath(customer.claim_code),
        customerId: customer.id,
        displayName: account.display_name,
        mobileNumber: customer.mobile_number ?? null,
        transactions: [],
        walletPublicCode: customer.public_code,
        walletQrUpdatedAt: customer.wallet_qr_updated_at,
      } satisfies SupabaseTokenerSummary;
    })
    .sort((left, right) => left.displayName.localeCompare(right.displayName));
}

export async function getSupabaseTokener(
  customerId: string,
): Promise<SupabaseTokenerSummary> {
  const eventId = await loadPrimarySupabaseEventId();
  const supabase = createSupabaseServerClient();
  const customerResult = await supabase
    .from("customers")
    .select(
      "id, account_id, wallet_id, private_access_code, claim_code, claim_expires_at, claimed_at, public_code, wallet_qr_updated_at, mobile_number",
    )
    .eq("event_id", eventId)
    .eq("id", customerId)
    .single();

  assertNoSupabaseError(customerResult.error);
  return toSummary(customerRowSchema.parse(customerResult.data));
}

export async function getSupabaseAdminTransactionOverview(): Promise<AdminTransactionOverview> {
  const eventId = await loadPrimarySupabaseEventId();
  const supabase = createSupabaseServerClient();
  const [metricsResult, creditIssuances, boothReports] = await Promise.all([
    supabase.rpc("get_admin_transaction_metrics", { p_event_id: eventId }),
    getSupabaseAdminCreditIssuanceReports(eventId),
    getSupabaseAdminBoothReports(eventId),
  ]);
  assertNoSupabaseError(metricsResult.error);
  const metricsRows = z
    .array(adminTransactionMetricsRowSchema)
    .parse(metricsResult.data);
  const metricsRow = metricsRows[0] ?? {
    issued_tokens: 0,
    refunded_tokens: 0,
    spent_tokens: 0,
    transaction_groups: 0,
  };

  return {
    boothReports,
    creditIssuances,
    metrics: {
      issuedTokens: metricsRow.issued_tokens,
      refundedTokens: metricsRow.refunded_tokens,
      spentTokens: metricsRow.spent_tokens,
      transactionGroups: metricsRow.transaction_groups,
    },
    transactions: [],
  };
}

export async function getSupabaseVendorOverview(
  vendorUsername: string,
): Promise<SupabaseVendorOverview> {
  const supabase = createSupabaseServerClient();
  const result = await supabase.rpc("get_vendor_overview", {
    p_vendor_username: vendorUsername,
  });

  assertNoSupabaseError(result.error);
  const rows = z.array(vendorOverviewRpcRowSchema).parse(result.data);
  const row = rows[0];
  if (row === undefined) {
    throw new SupabaseTokenlyAccessError(
      "TOKENLY_SUPABASE_WRITE_FAILED",
      "Vendor overview could not load.",
    );
  }

  return {
    balance: row.balance,
    displayName: row.display_name,
    recentActivity: row.recent_activity,
    stallLocation: row.stall_location,
  };
}

export async function createSupabaseTokener(
  input: CreateSupabaseTokenerInput,
): Promise<SupabaseTokenerSummary> {
  const parsed = createSupabaseTokenerSchema.parse(input);
  const eventId = await loadPrimarySupabaseEventId();
  const supabase = createSupabaseServerClient();
  const existingMobileNumber = await supabase
    .from("customers")
    .select("id")
    .eq("event_id", eventId)
    .eq("mobile_number", parsed.mobileNumber)
    .maybeSingle();

  assertNoSupabaseError(existingMobileNumber.error);
  if (existingMobileNumber.data !== null) {
    throw new SupabaseTokenlyAccessError(
      "DUPLICATE_MOBILE_NUMBER",
      "A customer already exists for that mobile number.",
    );
  }

  const account = await supabase
    .from("account_profiles")
    .insert({
      display_name: parsed.displayName,
      role: "customer",
      status: "active",
    })
    .select("id, display_name, role, status")
    .single();
  assertNoSupabaseError(account.error);
  const accountId = accountRowSchema.parse(account.data).id;

  const wallet = await supabase
    .from("wallets")
    .insert({
      event_id: eventId,
      owner_account_id: accountId,
      owner_type: "customer",
      status: "active",
    })
    .select("id")
    .single();
  assertNoSupabaseError(wallet.error);
  const walletId = eventRowSchema.parse(wallet.data).id;

  const now = new Date();
  const customer = await supabase
    .from("customers")
    .insert({
      account_id: accountId,
      claim_code: generateCode("claim"),
      claim_expires_at: addMinutes(now, claimExpiryMinutes),
      event_id: eventId,
      mobile_number: parsed.mobileNumber,
      private_access_code: generateCode("priv"),
      public_code: generateCode("cus"),
      wallet_id: walletId,
      wallet_qr_updated_at: now.toISOString(),
    })
    .select(
      "id, account_id, wallet_id, private_access_code, claim_code, claim_expires_at, claimed_at, public_code, wallet_qr_updated_at, mobile_number",
    )
    .single();
  assertNoSupabaseError(customer.error);

  const customerRow = customerRowSchema.parse(customer.data);
  return {
    balance: 0,
    claimExpiresAt: customerRow.claim_expires_at,
    claimedAt: customerRow.claimed_at,
    claimPath: buildClaimPath(customerRow.claim_code),
    customerId: customerRow.id,
    displayName: parsed.displayName,
    mobileNumber: customerRow.mobile_number ?? null,
    transactions: [],
    walletPublicCode: customerRow.public_code,
    walletQrUpdatedAt: customerRow.wallet_qr_updated_at,
  };
}

export async function refreshSupabaseClaimQr(
  customerId: string,
): Promise<SupabaseTokenerSummary> {
  const supabase = createSupabaseServerClient();
  const now = new Date();
  const updated = await supabase
    .from("customers")
    .update({
      claim_code: generateCode("claim"),
      claim_expires_at: addMinutes(now, claimExpiryMinutes),
      claimed_at: null,
      updated_at: now.toISOString(),
    })
    .eq("id", customerId)
    .select(
      "id, account_id, wallet_id, private_access_code, claim_code, claim_expires_at, claimed_at, public_code, wallet_qr_updated_at, mobile_number",
    )
    .single();

  assertNoSupabaseError(updated.error);
  return toSummary(customerRowSchema.parse(updated.data));
}

export async function claimSupabaseTokener(
  claimCode: string,
): Promise<SupabaseClaimResult> {
  const supabase = createSupabaseServerClient();
  const customerResult = await supabase
    .from("customers")
    .select(
      "id, account_id, wallet_id, private_access_code, claim_code, claim_expires_at, claimed_at, public_code, wallet_qr_updated_at, mobile_number",
    )
    .eq("claim_code", claimCode)
    .maybeSingle();

  assertNoSupabaseError(customerResult.error);
  if (customerResult.data === null) {
    throw new SupabaseTokenlyAccessError(
      "CUSTOMER_ACCESS_DENIED",
      "This claim QR is unavailable.",
    );
  }

  const customer = customerRowSchema.parse(customerResult.data);
  if (customer.claimed_at !== null) {
    throw new SupabaseTokenlyAccessError(
      "CLAIM_QR_ALREADY_USED",
      "This one-time claim QR has already been used.",
    );
  }

  if (Date.parse(customer.claim_expires_at) <= Date.now()) {
    throw new SupabaseTokenlyAccessError(
      "CLAIM_QR_EXPIRED",
      "This one-time claim QR has expired.",
    );
  }

  const account = await loadAccount(customer.account_id);
  if (account.status !== "active") {
    throw new SupabaseTokenlyAccessError(
      "CUSTOMER_ACCESS_DENIED",
      "This claim QR is unavailable.",
    );
  }

  const now = new Date().toISOString();
  const updated = await supabase
    .from("customers")
    .update({ claimed_at: now, updated_at: now })
    .eq("id", customer.id)
    .is("claimed_at", null);

  assertNoSupabaseError(updated.error);

  return {
    displayName: account.display_name,
    privateAccountPath: buildPrivateAccountPath(customer.private_access_code),
  };
}

export async function getSupabasePrivateAccount(
  privateAccessCode: string,
): Promise<SupabasePrivateAccount> {
  const supabase = createSupabaseServerClient();
  const customerResult = await supabase
    .from("customers")
    .select(
      "id, account_id, wallet_id, private_access_code, claim_code, claim_expires_at, claimed_at, public_code, wallet_qr_updated_at, mobile_number",
    )
    .eq("private_access_code", privateAccessCode)
    .maybeSingle();

  assertNoSupabaseError(customerResult.error);
  if (customerResult.data === null) {
    throw new SupabaseTokenlyAccessError(
      "CUSTOMER_ACCESS_DENIED",
      "This private account link is unavailable.",
    );
  }

  const customer = customerRowSchema.parse(customerResult.data);
  const [account, wallet, entries] = await Promise.all([
    loadAccount(customer.account_id),
    loadWallet(customer.wallet_id),
    loadEntriesForWallet(customer.wallet_id),
  ]);
  const vendorsById = await loadVendorDisplayDetailsById(
    entries
      .map((entry) => entry.related_vendor_id)
      .filter((vendorId): vendorId is string => typeof vendorId === "string"),
  );

  if (account.status !== "active" || wallet.owner_account_id !== account.id) {
    throw new SupabaseTokenlyAccessError(
      "CUSTOMER_ACCESS_DENIED",
      "This private account link is unavailable.",
    );
  }

  return {
    balance: calculateBalance(entries),
    customerId: customer.id,
    displayName: account.display_name,
    privateAccountPath: buildPrivateAccountPath(customer.private_access_code),
    transactions: entries
      .slice(0, 8)
      .map((entry) => toTransaction(entry, vendorsById)),
    walletPublicCode: customer.public_code,
    walletQrPayload: buildTokenlyQrPayload({
      kind: "customer",
      publicCode: customer.public_code,
      version: 1,
    }),
    walletQrUpdatedAt: customer.wallet_qr_updated_at,
    walletStatus: wallet.status,
  };
}

export async function regenerateSupabaseWalletQr(
  privateAccessCode: string,
): Promise<SupabasePrivateAccount> {
  const supabase = createSupabaseServerClient();
  const now = new Date().toISOString();
  const updated = await supabase
    .from("customers")
    .update({
      public_code: generateCode("cus"),
      updated_at: now,
      wallet_qr_updated_at: now,
    })
    .eq("private_access_code", privateAccessCode)
    .select(
      "id, account_id, wallet_id, private_access_code, claim_code, claim_expires_at, claimed_at, public_code, wallet_qr_updated_at, mobile_number",
    )
    .single();

  assertNoSupabaseError(updated.error);
  const customer = customerRowSchema.parse(updated.data);
  return getSupabasePrivateAccount(customer.private_access_code);
}

export async function createSupabaseTokenAdjustment(
  input: SupabaseTokenAdjustmentInput,
): Promise<SupabaseTokenerSummary> {
  const parsed = supabaseTokenAdjustmentSchema.parse(input);
  const { adminAccountId, eventId } = await loadSupabaseAdminContext();
  const supabase = createSupabaseServerClient();
  const customerResult = await supabase
    .from("customers")
    .select(
      "id, account_id, wallet_id, private_access_code, claim_code, claim_expires_at, claimed_at, public_code, wallet_qr_updated_at, mobile_number",
    )
    .eq("id", parsed.customerId)
    .single();

  assertNoSupabaseError(customerResult.error);
  const customer = customerRowSchema.parse(customerResult.data);
  const entries = await loadEntriesForWallet(customer.wallet_id);
  const currentBalance = calculateBalance(entries);
  const resultingBalance =
    parsed.direction === "credit"
      ? currentBalance + parsed.tokenAmount
      : currentBalance - parsed.tokenAmount;

  if (resultingBalance < 0) {
    throw new SupabaseTokenlyAccessError(
      "TOKEN_ADJUSTMENT_OVERDRAWS_WALLET",
      "This token removal would overdraw the tokener wallet.",
    );
  }

  const ledgerEntryId = randomUUID();
  const transactionGroupId = randomUUID();
  const now = new Date().toISOString();
  const reference = `ADJ-${Date.now()}`;
  const ledger = await supabase.from("ledger_entries").insert({
    actor_account_id: adminAccountId,
    description: `Administrative ${parsed.direction} adjustment: ${parsed.reason}`,
    direction: parsed.direction,
    entry_type: "administrative_adjustment",
    event_id: eventId,
    id: ledgerEntryId,
    idempotency_key: `admin-adjustment:${ledgerEntryId}`,
    metadata: {
      reason: parsed.reason,
      source: "supabase_admin_tokener_adjustment",
    },
    occurred_at: now,
    reference,
    related_customer_id: customer.id,
    token_amount: parsed.tokenAmount,
    transaction_group_id: transactionGroupId,
    wallet_id: customer.wallet_id,
  });
  assertNoSupabaseError(ledger.error);

  const audit = await supabase.from("audit_logs").insert({
    actor_account_id: adminAccountId,
    description: `Administrative ${parsed.direction} adjustment recorded.`,
    event_id: eventId,
    event_type: "administrative_adjustment_created",
    metadata: {
      direction: parsed.direction,
      previousBalance: currentBalance,
      reason: parsed.reason,
      resultingBalance,
      tokenAmount: parsed.tokenAmount,
    },
    occurred_at: now,
    target_id: ledgerEntryId,
    target_type: "ledger_entry",
    transaction_group_id: transactionGroupId,
  });
  assertNoSupabaseError(audit.error);

  return toSummary(customer);
}

export async function createSupabaseCreditIssuance(
  input: SupabaseCreditIssuanceInput,
): Promise<SupabaseTokenerSummary> {
  const parsed = supabaseCreditIssuanceSchema.parse({
    amountCents: input.amountCents,
    customerId: input.customerId,
    paymentMethod: input.paymentMethod,
  });
  const supportedEvidenceTypes = new Set([
    "image/heic",
    "image/heif",
    "image/jpeg",
    "image/png",
    "image/webp",
  ]);

  if (
    !supportedEvidenceTypes.has(input.evidence.type) ||
    input.evidence.size <= 0 ||
    input.evidence.size > 10 * 1024 * 1024
  ) {
    throw new SupabaseTokenlyAccessError(
      "INVALID_INPUT",
      "Use a HEIC, HEIF, JPEG, PNG, or WebP evidence image up to 10 MB.",
    );
  }

  const { adminAccountId } = await loadSupabaseAdminContext();
  const supabase = createSupabaseServerClient();
  const customerResult = await supabase
    .from("customers")
    .select(
      "id, account_id, wallet_id, private_access_code, claim_code, claim_expires_at, claimed_at, public_code, wallet_qr_updated_at, mobile_number",
    )
    .eq("id", parsed.customerId)
    .single();

  assertNoSupabaseError(customerResult.error);
  const customer = customerRowSchema.parse(customerResult.data);
  const evidenceId = randomUUID();
  const issuanceId = randomUUID();
  const ledgerEntryId = randomUUID();
  const transactionGroupId = randomUUID();
  const now = new Date().toISOString();
  const reference = `ISS-${Date.now()}-${issuanceId.slice(0, 8)}`;
  const idempotencyKey = `admin-credit-issuance:${issuanceId}`;
  const storagePath = `${customer.id}/${evidenceId}`;

  const upload = await supabase.storage
    .from("payment-evidence")
    .upload(storagePath, await input.evidence.arrayBuffer(), {
      cacheControl: "3600",
      contentType: input.evidence.type,
      upsert: false,
    });

  assertNoSupabaseError(upload.error);

  const issuance = await supabase.rpc("admin_issue_customer_credits", {
    p_actor_account_id: adminAccountId,
    p_amount_cents: parsed.amountCents,
    p_customer_id: parsed.customerId,
    p_evidence_file_name: input.evidence.name.slice(0, 255),
    p_evidence_id: evidenceId,
    p_evidence_mime_type: input.evidence.type,
    p_evidence_size_bytes: input.evidence.size,
    p_evidence_storage_path: storagePath,
    p_idempotency_key: idempotencyKey,
    p_issuance_id: issuanceId,
    p_ledger_entry_id: ledgerEntryId,
    p_occurred_at: now,
    p_payment_method: parsed.paymentMethod,
    p_reference: reference,
    p_transaction_group_id: transactionGroupId,
  });

  if (issuance.error !== null) {
    await supabase.storage
      .from("payment-evidence")
      .remove([storagePath])
      .catch(() => undefined);
    assertNoSupabaseError(issuance.error);
  }

  const issuedTokenAmount = z.coerce
    .number()
    .positive()
    .multipleOf(0.01)
    .parse(issuance.data);
  const expectedTokenAmount = parsed.amountCents / 100;
  if (issuedTokenAmount !== expectedTokenAmount) {
    throw new SupabaseTokenlyAccessError(
      "TOKENLY_SUPABASE_WRITE_FAILED",
      "Issued token amount did not match the configured one-to-one rate.",
    );
  }

  return toSummary(customer);
}

export async function createSupabaseVendorCharge(
  input: SupabaseVendorChargeInput,
): Promise<SupabaseVendorChargeResult> {
  const parsed = supabaseVendorChargeSchema.parse(input);

  const supabase = createSupabaseServerClient();
  const customerLedgerEntryId = randomUUID();
  const vendorLedgerEntryId = randomUUID();
  const transactionGroupId = randomUUID();
  const now = new Date().toISOString();
  const reference = `PAY-${Date.now()}-${customerLedgerEntryId.slice(0, 8)}`;
  const idempotencyKey = `vendor-deduct:${customerLedgerEntryId}`;
  const result = await supabase.rpc("vendor_charge_customer_wallet", {
    p_customer_id: parsed.customerId,
    p_customer_ledger_entry_id: customerLedgerEntryId,
    p_idempotency_key: idempotencyKey,
    p_occurred_at: now,
    p_reference: reference,
    p_token_amount: parsed.tokenAmount,
    p_transaction_group_id: transactionGroupId,
    p_vendor_ledger_entry_id: vendorLedgerEntryId,
    p_vendor_username: parsed.vendorUsername,
  });

  if (result.error !== null) {
    if (
      result.error.message.toLocaleLowerCase("en-SG").includes("insufficient")
    ) {
      throw new SupabaseTokenlyAccessError(
        "TOKEN_CHARGE_INSUFFICIENT_BALANCE",
        "Customer wallet has insufficient tokens.",
      );
    }

    assertNoSupabaseError(result.error);
  }

  return {
    ...(await getSupabaseCustomerWalletById(parsed.customerId)),
    reference,
  };
}

export async function createSupabaseAdminVendorRefund(
  input: SupabaseAdminVendorRefundInput,
): Promise<SupabaseAdminVendorRefundResult> {
  const parsed = supabaseAdminVendorRefundSchema.parse(input);
  const { adminAccountId } = await loadSupabaseAdminContext();
  const supabase = createSupabaseServerClient();
  const refundId = randomUUID();
  const customerLedgerEntryId = randomUUID();
  const vendorLedgerEntryId = randomUUID();
  const transactionGroupId = randomUUID();
  const now = new Date().toISOString();
  const reference = `REF-${Date.now()}-${refundId.slice(0, 8)}`;
  const idempotencyKey = `admin-vendor-refund:${refundId}`;

  const result = await supabase.rpc("admin_refund_vendor_transaction", {
    p_actor_account_id: adminAccountId,
    p_customer_id: parsed.customerId,
    p_customer_ledger_entry_id: customerLedgerEntryId,
    p_idempotency_key: idempotencyKey,
    p_occurred_at: now,
    p_purchase_transaction_group_id: parsed.purchaseTransactionGroupId,
    p_reason: parsed.reason,
    p_reference: reference,
    p_refund_id: refundId,
    p_token_amount: parsed.tokenAmount,
    p_transaction_group_id: transactionGroupId,
    p_vendor_ledger_entry_id: vendorLedgerEntryId,
  });

  if (result.error !== null) {
    const message = result.error.message.toLocaleLowerCase("en-SG");

    if (message.includes("exceeds remaining")) {
      throw new SupabaseTokenlyAccessError(
        "TOKEN_REFUND_AMOUNT_EXCEEDS_REMAINING",
        "The refund amount exceeds the remaining refundable tokens.",
      );
    }

    if (message.includes("insufficient")) {
      throw new SupabaseTokenlyAccessError(
        "TOKEN_REFUND_INSUFFICIENT_VENDOR_BALANCE",
        "The vendor wallet does not have enough tokens for this refund.",
      );
    }

    if (message.includes("not found") || message.includes("invalid")) {
      throw new SupabaseTokenlyAccessError(
        "TOKEN_REFUND_PURCHASE_NOT_FOUND",
        "The selected vendor transaction is no longer refundable.",
      );
    }

    assertNoSupabaseError(result.error);
  }

  const remainingRefundableTokenAmount = z.coerce
    .number()
    .nonnegative()
    .multipleOf(0.01)
    .parse(result.data);
  const customerResult = await supabase
    .from("customers")
    .select(
      "id, account_id, wallet_id, private_access_code, claim_code, claim_expires_at, claimed_at, public_code, wallet_qr_updated_at, mobile_number",
    )
    .eq("id", parsed.customerId)
    .single();

  assertNoSupabaseError(customerResult.error);

  return {
    reference,
    remainingRefundableTokenAmount,
    tokener: await toSummary(customerRowSchema.parse(customerResult.data)),
  };
}

async function getSupabaseCustomerWalletById(
  customerId: string,
): Promise<SupabaseResolvedCustomerWallet> {
  const supabase = createSupabaseServerClient();
  const customerResult = await supabase
    .from("customers")
    .select(
      "id, account_id, wallet_id, private_access_code, claim_code, claim_expires_at, claimed_at, public_code, wallet_qr_updated_at, mobile_number",
    )
    .eq("id", customerId)
    .maybeSingle();

  assertNoSupabaseError(customerResult.error);
  if (customerResult.data === null) {
    throw new SupabaseTokenlyAccessError(
      "CUSTOMER_ACCESS_DENIED",
      "Customer wallet QR is unavailable.",
    );
  }

  const customer = customerRowSchema.parse(customerResult.data);
  const [account, entries] = await Promise.all([
    loadAccount(customer.account_id),
    loadEntriesForWallet(customer.wallet_id),
  ]);

  return {
    balance: calculateBalance(entries),
    customerId: customer.id,
    displayName: account.display_name,
    walletPublicCode: customer.public_code,
  };
}

export async function resolveSupabaseCustomerWallet(
  input: unknown,
): Promise<SupabaseResolvedCustomerWallet> {
  const rawValue = z.string().trim().min(1).max(200).parse(input);
  const publicCode = rawValue.startsWith("tokenly://")
    ? parseTokenlyQrPayload(rawValue).publicCode
    : rawValue;

  if (!publicCode.startsWith("cus_")) {
    throw new SupabaseTokenlyAccessError(
      "CUSTOMER_ACCESS_DENIED",
      "This is not a customer wallet QR.",
    );
  }

  const supabase = createSupabaseServerClient();
  const customerResult = await supabase
    .from("customers")
    .select(
      "id, account_id, wallet_id, private_access_code, claim_code, claim_expires_at, claimed_at, public_code, wallet_qr_updated_at, mobile_number",
    )
    .eq("public_code", publicCode)
    .maybeSingle();

  assertNoSupabaseError(customerResult.error);
  if (customerResult.data === null) {
    throw new SupabaseTokenlyAccessError(
      "CUSTOMER_ACCESS_DENIED",
      "Customer wallet QR is unavailable.",
    );
  }

  const customer = customerRowSchema.parse(customerResult.data);
  const [account, entries] = await Promise.all([
    loadAccount(customer.account_id),
    loadEntriesForWallet(customer.wallet_id),
  ]);

  return {
    balance: calculateBalance(entries),
    customerId: customer.id,
    displayName: account.display_name,
    walletPublicCode: customer.public_code,
  };
}
