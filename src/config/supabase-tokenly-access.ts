import "server-only";

import { randomBytes, randomUUID } from "node:crypto";

import { z } from "zod";

import {
  buildTokenlyQrPayload,
  parseTokenlyQrPayload,
} from "@/modules/qr-payments";
import type { CustomerTransactionListItem } from "@/modules/customer-application";
import type {
  AdminTransactionListItem,
  AdminTransactionOverview,
} from "@/modules/admin-application";

import { createSupabaseServerClient } from "./supabase-server-client";

const claimExpiryMinutes = 15;
const defaultEventName = "Tokenly Event";
const defaultEventVenue = "Event venue";
const defaultAdminUsername = "AdminLance";
const defaultVendorUsername = "Vendor1";

const nricSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[STFGM][0-9]{7}[A-Z]$/, "Enter a valid NRIC or FIN.");

export const createSupabaseTokenerSchema = z
  .object({
    displayName: z.string().trim().min(1).max(120),
    nric: nricSchema,
  })
  .strict();

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

export type CreateSupabaseTokenerInput = z.infer<
  typeof createSupabaseTokenerSchema
>;

export type SupabaseTokenAdjustmentInput = z.infer<
  typeof supabaseTokenAdjustmentSchema
>;

export interface SupabaseCreditIssuanceInput extends z.infer<
  typeof supabaseCreditIssuanceSchema
> {
  readonly evidence: File;
}

export interface SupabaseTokenerSummary {
  readonly balance: number;
  readonly claimCode: string;
  readonly claimExpiresAt: string;
  readonly claimedAt: string | null;
  readonly claimPath: string;
  readonly customerId: string;
  readonly displayName: string;
  readonly nric: string | null;
  readonly privateAccountPath: string;
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

export class SupabaseTokenlyAccessError extends Error {
  public constructor(
    public readonly code:
      | "CLAIM_QR_ALREADY_USED"
      | "CLAIM_QR_EXPIRED"
      | "CUSTOMER_ACCESS_DENIED"
      | "DUPLICATE_NRIC"
      | "INVALID_INPUT"
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

const customerRowSchema = z
  .object({
    account_id: z.string().uuid(),
    claim_code: z.string(),
    claim_expires_at: z.string(),
    claimed_at: z.string().nullable(),
    id: z.string().uuid(),
    nric: z.string().nullable().optional(),
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

const ledgerEntryRowSchema = z
  .object({
    description: z.string(),
    direction: z.enum(["credit", "debit"]),
    entry_type: z.string(),
    id: z.string().uuid(),
    occurred_at: z.string(),
    reference: z.string(),
    related_order_id: z.string().uuid().nullable().optional(),
    token_amount: z.number().int().positive(),
    transaction_group_id: z.string().uuid(),
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
    token_amount: z.number().int().positive(),
    transaction_group_id: z.string().uuid(),
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
  return entries.reduce((balance, entry) => {
    return entry.direction === "credit"
      ? balance + entry.token_amount
      : balance - entry.token_amount;
  }, 0);
}

function toTransaction(
  entry: z.infer<typeof ledgerEntryRowSchema>,
): CustomerTransactionListItem {
  const kind =
    entry.entry_type === "administrative_adjustment" ? "adjustment" : "other";
  const title =
    entry.entry_type === "administrative_adjustment"
      ? entry.direction === "credit"
        ? "Tokens added"
        : "Tokens removed"
      : "Wallet activity";

  return {
    direction: entry.direction,
    id: entry.id,
    kind,
    orderId: entry.related_order_id ?? null,
    occurredAt: entry.occurred_at,
    reference: entry.reference,
    subtitle: entry.description,
    title,
    tokenAmount: entry.token_amount,
    transactionGroupId: entry.transaction_group_id,
    transactionId: entry.related_order_id ?? entry.id,
    vendorName: null,
  };
}

async function ensureSupabaseBaseline(): Promise<{
  readonly adminAccountId: string;
  readonly eventId: string;
}> {
  const supabase = createSupabaseServerClient();
  const adminAccount = await supabase
    .from("account_profiles")
    .select("id, display_name, role, status")
    .eq("username", defaultAdminUsername)
    .maybeSingle();

  assertNoSupabaseError(adminAccount.error);

  let adminAccountId =
    adminAccount.data === null
      ? null
      : accountRowSchema.parse(adminAccount.data).id;

  if (adminAccountId === null) {
    const insertedAdmin = await supabase
      .from("account_profiles")
      .insert({
        display_name: "Lance Admin",
        role: "administrator",
        status: "active",
        username: defaultAdminUsername,
      })
      .select("id, display_name, role, status")
      .single();

    assertNoSupabaseError(insertedAdmin.error);
    adminAccountId = accountRowSchema.parse(insertedAdmin.data).id;
  }

  const existingEvent = await supabase
    .from("events")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  assertNoSupabaseError(existingEvent.error);

  let eventId =
    existingEvent.data === null
      ? null
      : eventRowSchema.parse(existingEvent.data).id;

  if (eventId === null) {
    const now = new Date();
    const insertedEvent = await supabase
      .from("events")
      .insert({
        ends_at: new Date(now.getTime() + 2 * 24 * 60 * 60_000).toISOString(),
        name: defaultEventName,
        starts_at: now.toISOString(),
        subtitle: "Prototype deployment",
        venue: defaultEventVenue,
      })
      .select("id")
      .single();

    assertNoSupabaseError(insertedEvent.error);
    eventId = eventRowSchema.parse(insertedEvent.data).id;

    const settings = await supabase.from("event_settings").insert({
      event_id: eventId,
      support_contact: "Event desk",
      support_instructions: "Ask the event desk for Tokenly account help.",
      support_label: "Tokenly help",
      tokens_per_dollar: 10,
      updated_by_account_id: adminAccountId,
    });
    assertNoSupabaseError(settings.error);
  }

  const vendorAccount = await supabase
    .from("account_profiles")
    .select("id, display_name, role, status")
    .eq("username", defaultVendorUsername)
    .maybeSingle();
  assertNoSupabaseError(vendorAccount.error);

  if (vendorAccount.data === null) {
    const insertedVendorAccount = await supabase
      .from("account_profiles")
      .insert({
        display_name: "Vendor 1",
        role: "vendor",
        status: "active",
        username: defaultVendorUsername,
      })
      .select("id, display_name, role, status")
      .single();
    assertNoSupabaseError(insertedVendorAccount.error);

    const vendorAccountId = accountRowSchema.parse(
      insertedVendorAccount.data,
    ).id;
    const insertedWallet = await supabase
      .from("wallets")
      .insert({
        event_id: eventId,
        owner_account_id: vendorAccountId,
        owner_type: "vendor",
        status: "active",
      })
      .select("id")
      .single();
    assertNoSupabaseError(insertedWallet.error);

    const vendor = await supabase.from("vendors").insert({
      account_id: vendorAccountId,
      description: "Prototype vendor account.",
      display_name: "Vendor 1",
      event_id: eventId,
      operating_status: "open",
      public_code: "vnd_Vendor1",
      stall_location: "Event floor",
      wallet_id: eventRowSchema.parse(insertedWallet.data).id,
    });
    assertNoSupabaseError(vendor.error);
  }

  const customerCount = await supabase
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);
  assertNoSupabaseError(customerCount.error);

  if ((customerCount.count ?? 0) === 0) {
    const insertedCustomerAccount = await supabase
      .from("account_profiles")
      .insert({
        display_name: "Lance Tan",
        role: "customer",
        status: "active",
      })
      .select("id, display_name, role, status")
      .single();
    assertNoSupabaseError(insertedCustomerAccount.error);

    const customerAccountId = accountRowSchema.parse(
      insertedCustomerAccount.data,
    ).id;
    const insertedCustomerWallet = await supabase
      .from("wallets")
      .insert({
        event_id: eventId,
        owner_account_id: customerAccountId,
        owner_type: "customer",
        status: "active",
      })
      .select("id")
      .single();
    assertNoSupabaseError(insertedCustomerWallet.error);

    const now = new Date();
    const customer = await supabase.from("customers").insert({
      account_id: customerAccountId,
      claim_code: generateCode("claim"),
      claim_expires_at: addMinutes(now, claimExpiryMinutes),
      event_id: eventId,
      private_access_code: generateCode("priv"),
      public_code: generateCode("cus"),
      wallet_id: eventRowSchema.parse(insertedCustomerWallet.data).id,
      wallet_qr_updated_at: now.toISOString(),
    });
    assertNoSupabaseError(customer.error);
  }

  return { adminAccountId, eventId };
}

async function loadEntriesForWallet(walletId: string) {
  const supabase = createSupabaseServerClient();
  const entries = await supabase
    .from("ledger_entries")
    .select(
      "id, transaction_group_id, entry_type, direction, token_amount, reference, description, occurred_at, related_order_id",
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

  return {
    balance: calculateBalance(entries),
    claimCode: customer.claim_code,
    claimExpiresAt: customer.claim_expires_at,
    claimedAt: customer.claimed_at,
    claimPath: buildClaimPath(customer.claim_code),
    customerId: customer.id,
    displayName: account.display_name,
    nric: customer.nric ?? null,
    privateAccountPath: buildPrivateAccountPath(customer.private_access_code),
    walletPublicCode: customer.public_code,
    walletQrUpdatedAt: customer.wallet_qr_updated_at,
  };
}

export async function listSupabaseTokeners(): Promise<
  readonly SupabaseTokenerSummary[]
> {
  const { eventId } = await ensureSupabaseBaseline();
  const supabase = createSupabaseServerClient();
  const customers = await supabase
    .from("customers")
    .select(
      "id, account_id, wallet_id, private_access_code, claim_code, claim_expires_at, claimed_at, public_code, wallet_qr_updated_at, nric",
    )
    .eq("event_id", eventId);

  assertNoSupabaseError(customers.error);

  const summaries = await Promise.all(
    z.array(customerRowSchema).parse(customers.data).map(toSummary),
  );

  return summaries.sort((left, right) =>
    left.displayName.localeCompare(right.displayName),
  );
}

export async function getSupabaseAdminTransactionOverview(): Promise<AdminTransactionOverview> {
  const { eventId } = await ensureSupabaseBaseline();
  const supabase = createSupabaseServerClient();
  const result = await supabase
    .from("ledger_entries")
    .select(
      "id, transaction_group_id, entry_type, direction, token_amount, reference, description, occurred_at",
    )
    .eq("event_id", eventId)
    .order("occurred_at", { ascending: false });

  assertNoSupabaseError(result.error);
  const rows = z.array(adminLedgerEntryRowSchema).parse(result.data);
  const transactions: readonly AdminTransactionListItem[] = rows.map((row) => ({
    description: row.description,
    direction: row.direction,
    entryType: row.entry_type,
    id: row.id,
    occurredAt: row.occurred_at,
    reference: row.reference,
    tokenAmount: row.token_amount,
    transactionGroupId: row.transaction_group_id,
  }));

  return {
    metrics: {
      issuedTokens: rows
        .filter(
          (row) =>
            row.entry_type === "token_issuance" && row.direction === "credit",
        )
        .reduce((total, row) => total + row.token_amount, 0),
      refundedTokens: rows
        .filter(
          (row) =>
            row.entry_type === "customer_refund" && row.direction === "credit",
        )
        .reduce((total, row) => total + row.token_amount, 0),
      spentTokens: rows
        .filter(
          (row) =>
            row.entry_type === "customer_purchase" && row.direction === "debit",
        )
        .reduce((total, row) => total + row.token_amount, 0),
      transactionGroups: new Set(rows.map((row) => row.transaction_group_id))
        .size,
    },
    transactions,
  };
}

export async function createSupabaseTokener(
  input: CreateSupabaseTokenerInput,
): Promise<SupabaseTokenerSummary> {
  const parsed = createSupabaseTokenerSchema.parse(input);
  const { eventId } = await ensureSupabaseBaseline();
  const supabase = createSupabaseServerClient();
  const existingNric = await supabase
    .from("customers")
    .select("id")
    .eq("event_id", eventId)
    .eq("nric", parsed.nric)
    .maybeSingle();

  assertNoSupabaseError(existingNric.error);
  if (existingNric.data !== null) {
    throw new SupabaseTokenlyAccessError(
      "DUPLICATE_NRIC",
      "A tokener already exists for that NRIC.",
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
      nric: parsed.nric,
      private_access_code: generateCode("priv"),
      public_code: generateCode("cus"),
      wallet_id: walletId,
      wallet_qr_updated_at: now.toISOString(),
    })
    .select(
      "id, account_id, wallet_id, private_access_code, claim_code, claim_expires_at, claimed_at, public_code, wallet_qr_updated_at, nric",
    )
    .single();
  assertNoSupabaseError(customer.error);

  return toSummary(customerRowSchema.parse(customer.data));
}

export async function refreshSupabaseClaimQr(
  customerId: string,
): Promise<SupabaseTokenerSummary> {
  await ensureSupabaseBaseline();
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
      "id, account_id, wallet_id, private_access_code, claim_code, claim_expires_at, claimed_at, public_code, wallet_qr_updated_at, nric",
    )
    .single();

  assertNoSupabaseError(updated.error);
  return toSummary(customerRowSchema.parse(updated.data));
}

export async function claimSupabaseTokener(
  claimCode: string,
): Promise<SupabaseClaimResult> {
  await ensureSupabaseBaseline();
  const supabase = createSupabaseServerClient();
  const customerResult = await supabase
    .from("customers")
    .select(
      "id, account_id, wallet_id, private_access_code, claim_code, claim_expires_at, claimed_at, public_code, wallet_qr_updated_at, nric",
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
  await ensureSupabaseBaseline();
  const supabase = createSupabaseServerClient();
  const customerResult = await supabase
    .from("customers")
    .select(
      "id, account_id, wallet_id, private_access_code, claim_code, claim_expires_at, claimed_at, public_code, wallet_qr_updated_at, nric",
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
    transactions: entries.slice(0, 8).map(toTransaction),
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
  await ensureSupabaseBaseline();
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
      "id, account_id, wallet_id, private_access_code, claim_code, claim_expires_at, claimed_at, public_code, wallet_qr_updated_at, nric",
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
  const { adminAccountId, eventId } = await ensureSupabaseBaseline();
  const supabase = createSupabaseServerClient();
  const customerResult = await supabase
    .from("customers")
    .select(
      "id, account_id, wallet_id, private_access_code, claim_code, claim_expires_at, claimed_at, public_code, wallet_qr_updated_at, nric",
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
  const parsed = supabaseCreditIssuanceSchema.parse(input);
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

  const { adminAccountId } = await ensureSupabaseBaseline();
  const supabase = createSupabaseServerClient();
  const customerResult = await supabase
    .from("customers")
    .select(
      "id, account_id, wallet_id, private_access_code, claim_code, claim_expires_at, claimed_at, public_code, wallet_qr_updated_at, nric",
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

  return toSummary(customer);
}

export async function resolveSupabaseCustomerWallet(
  input: unknown,
): Promise<SupabaseResolvedCustomerWallet> {
  await ensureSupabaseBaseline();
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
      "id, account_id, wallet_id, private_access_code, claim_code, claim_expires_at, claimed_at, public_code, wallet_qr_updated_at, nric",
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
