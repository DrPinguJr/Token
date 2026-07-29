/*
TOKENLY FUTURE SUPABASE SCHEMA — NON-EXECUTABLE PLANNING MATERIAL

DO NOT RUN THIS FILE.
DO NOT USE IT AS A MIGRATION.
NO SUPABASE PROJECT IS CONFIGURED FOR THE LOCAL PROTOTYPE.

This commented SQL-shaped document captures a proposed future Postgres model.
It deliberately remains inside this block comment so applying it cannot create,
alter, grant access to, or remove any database object.

Open questions that must be resolved before a real migration:
- final Supabase Auth linkage and multi-event role membership;
- conversion-rate representation and rounding;
- production ledger/clearing account semantics;
- row-level security and security-definer function design;
- evidence retention, signature validation, and malware scanning;
- real PayNow and vendor-payout provider reconciliation;
- privacy, backups, monitoring, and incident response.

PROPOSED ENUMS

create type public.account_role as enum (
  'customer',
  'vendor',
  'staff',
  'administrator'
);

create type public.account_status as enum ('active', 'disabled');
create type public.wallet_owner_type as enum ('customer', 'vendor');
create type public.wallet_status as enum ('active', 'frozen');
create type public.ledger_direction as enum ('credit', 'debit');
create type public.ledger_entry_type as enum (
  'token_issuance',
  'customer_purchase',
  'vendor_receipt',
  'customer_refund',
  'vendor_refund',
  'vendor_settlement',
  'administrative_adjustment'
);
create type public.vendor_operating_status as enum ('open', 'closed', 'paused');
create type public.order_status as enum ('completed');
create type public.settlement_status as enum ('draft', 'approved', 'paid');

PROPOSED EVENT AND IDENTITY TABLES

create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subtitle text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  venue text not null,
  created_at timestamptz not null default now(),
  constraint events_valid_period check (ends_at > starts_at)
);

create table public.account_profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  display_name text not null,
  mobile_number text not null,
  status public.account_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_profiles_mobile_number_format
    check (mobile_number ~ '^[0-9]{8,15}$')
);

create unique index account_profiles_mobile_number_unique
  on public.account_profiles (mobile_number);

create table public.event_role_memberships (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  account_id uuid not null references public.account_profiles(id) on delete restrict,
  role public.account_role not null,
  created_at timestamptz not null default now(),
  unique (event_id, account_id, role)
);

create table public.event_settings (
  event_id uuid primary key references public.events(id) on delete restrict,
  tokens_per_dollar integer not null,
  support_label text not null,
  support_contact text not null,
  support_instructions text not null,
  updated_by_account_id uuid not null references public.account_profiles(id) on delete restrict,
  updated_at timestamptz not null default now(),
  constraint event_settings_positive_rate check (tokens_per_dollar > 0)
);

PROPOSED CUSTOMER, VENDOR, PRODUCT, AND WALLET TABLES

create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  owner_account_id uuid not null references public.account_profiles(id) on delete restrict,
  owner_type public.wallet_owner_type not null,
  status public.wallet_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (event_id, owner_account_id)
);

-- No balance column is allowed. Balances derive from ledger_entries.

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  account_id uuid not null references public.account_profiles(id) on delete restrict,
  wallet_id uuid not null unique references public.wallets(id) on delete restrict,
  public_code text not null,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, account_id),
  unique (event_id, public_code)
);

create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  account_id uuid not null references public.account_profiles(id) on delete restrict,
  wallet_id uuid not null unique references public.wallets(id) on delete restrict,
  public_code text not null,
  display_name text not null,
  logo_storage_path text,
  banner_storage_path text,
  description text not null default '',
  stall_location text not null,
  operating_status public.vendor_operating_status not null default 'closed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, account_id),
  unique (event_id, public_code)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete restrict,
  name text not null,
  image_storage_path text,
  description text not null default '',
  token_price integer not null,
  category text not null,
  is_available boolean not null default true,
  is_sold_out boolean not null default false,
  is_archived boolean not null default false,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_positive_token_price check (token_price > 0),
  constraint products_nonnegative_display_order check (display_order >= 0)
);

create index products_vendor_display_order_idx
  on public.products (vendor_id, display_order);

PROPOSED EVIDENCE AND ISSUANCE TABLES

create table public.evidence (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  evidence_kind text not null,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  captured_by_account_id uuid not null references public.account_profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint evidence_positive_size check (size_bytes > 0)
);

create table public.token_issuances (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  wallet_id uuid not null references public.wallets(id) on delete restrict,
  staff_account_id uuid not null references public.account_profiles(id) on delete restrict,
  evidence_id uuid not null references public.evidence(id) on delete restrict,
  paynow_amount_cents integer not null,
  tokens_per_dollar integer not null,
  token_amount numeric(14, 2) not null,
  payment_reference text,
  normalized_payment_reference text,
  note text,
  transaction_group_id uuid not null,
  reference text not null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  constraint token_issuances_positive_paynow check (paynow_amount_cents > 0),
  constraint token_issuances_positive_rate check (tokens_per_dollar > 0),
  constraint token_issuances_positive_tokens check (token_amount > 0),
  unique (event_id, reference),
  unique (event_id, idempotency_key)
);

create index token_issuances_customer_created_idx
  on public.token_issuances (customer_id, created_at desc);
create index token_issuances_staff_created_idx
  on public.token_issuances (staff_account_id, created_at desc);
create index token_issuances_payment_reference_idx
  on public.token_issuances (event_id, normalized_payment_reference)
  where normalized_payment_reference is not null;

PROPOSED ORDER AND REFUND TABLES

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  vendor_id uuid not null references public.vendors(id) on delete restrict,
  customer_wallet_id uuid not null references public.wallets(id) on delete restrict,
  vendor_wallet_id uuid not null references public.wallets(id) on delete restrict,
  status public.order_status not null default 'completed',
  token_total integer not null,
  transaction_group_id uuid not null,
  reference text not null,
  idempotency_key text not null,
  completed_at timestamptz not null default now(),
  constraint orders_positive_total check (token_total > 0),
  unique (event_id, reference),
  unique (event_id, idempotency_key),
  unique (transaction_group_id)
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  product_name_snapshot text not null,
  unit_token_price integer not null,
  quantity integer not null,
  line_token_total integer not null,
  display_order integer not null,
  constraint order_items_positive_unit_price check (unit_token_price > 0),
  constraint order_items_positive_quantity check (quantity > 0),
  constraint order_items_positive_line_total check (line_token_total > 0),
  constraint order_items_exact_line_total
    check (line_token_total = unit_token_price * quantity),
  unique (order_id, display_order)
);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  vendor_id uuid not null references public.vendors(id) on delete restrict,
  token_amount numeric(14, 2) not null,
  reason text not null,
  actor_account_id uuid not null references public.account_profiles(id) on delete restrict,
  transaction_group_id uuid not null,
  reference text not null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  constraint refunds_positive_amount check (token_amount > 0),
  constraint refunds_nonblank_reason check (length(trim(reason)) > 0),
  unique (event_id, reference),
  unique (event_id, idempotency_key),
  unique (transaction_group_id)
);

create index refunds_order_created_idx
  on public.refunds (order_id, created_at);

PROPOSED SETTLEMENT TABLE

create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  vendor_id uuid not null references public.vendors(id) on delete restrict,
  period_start timestamptz not null,
  period_end timestamptz not null,
  earned_token_amount numeric(14, 2) not null,
  status public.settlement_status not null default 'draft',
  payout_reference text,
  notes text,
  reference text not null,
  created_by_account_id uuid not null references public.account_profiles(id) on delete restrict,
  approved_by_account_id uuid references public.account_profiles(id) on delete restrict,
  paid_by_account_id uuid references public.account_profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint settlements_valid_period check (period_end > period_start),
  constraint settlements_nonnegative_amount check (earned_token_amount >= 0),
  unique (event_id, reference)
);

create index settlements_vendor_period_idx
  on public.settlements (vendor_id, period_start, period_end);

PROPOSED APPEND-ONLY LEDGER

create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  wallet_id uuid not null references public.wallets(id) on delete restrict,
  transaction_group_id uuid not null,
  entry_type public.ledger_entry_type not null,
  direction public.ledger_direction not null,
  token_amount numeric(14, 2) not null,
  actor_account_id uuid not null references public.account_profiles(id) on delete restrict,
  related_customer_id uuid references public.customers(id) on delete restrict,
  related_vendor_id uuid references public.vendors(id) on delete restrict,
  related_order_id uuid references public.orders(id) on delete restrict,
  related_evidence_id uuid references public.evidence(id) on delete restrict,
  reference text not null,
  description text not null,
  occurred_at timestamptz not null default now(),
  idempotency_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  reverses_ledger_entry_id uuid references public.ledger_entries(id) on delete restrict,
  constraint ledger_entries_positive_amount check (token_amount > 0),
  constraint ledger_entries_nonblank_reference check (length(trim(reference)) > 0),
  unique (event_id, idempotency_key)
);

create index ledger_entries_wallet_occurred_idx
  on public.ledger_entries (wallet_id, occurred_at desc);
create index ledger_entries_transaction_group_idx
  on public.ledger_entries (transaction_group_id);
create index ledger_entries_order_idx
  on public.ledger_entries (related_order_id)
  where related_order_id is not null;

-- Database roles used by the application must not receive UPDATE or DELETE on
-- ledger_entries. Inserts should occur only inside reviewed server functions.
-- Balance checks and paired-entry equality must be serialized inside those
-- functions, not trusted to a browser pre-check.

PROPOSED APPEND-ONLY AUDIT LOG

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  event_type text not null,
  actor_account_id uuid not null references public.account_profiles(id) on delete restrict,
  target_type text not null,
  target_id uuid not null,
  description text not null,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  transaction_group_id uuid,
  constraint audit_logs_nonblank_event_type check (length(trim(event_type)) > 0),
  constraint audit_logs_nonblank_description check (length(trim(description)) > 0)
);

create index audit_logs_event_occurred_idx
  on public.audit_logs (event_id, occurred_at desc);
create index audit_logs_actor_occurred_idx
  on public.audit_logs (actor_account_id, occurred_at desc);
create index audit_logs_target_idx
  on public.audit_logs (target_type, target_id, occurred_at desc);
create index audit_logs_transaction_group_idx
  on public.audit_logs (transaction_group_id)
  where transaction_group_id is not null;

-- Database roles used by the application must not receive UPDATE or DELETE on
-- audit_logs. PINs, credentials, evidence bytes, secrets, and service keys are
-- forbidden in metadata.

PROPOSED SERVER-CONTROLLED OPERATIONS

-- issue_tokens(command)
-- complete_purchase(command)
-- refund_order(command)
-- create_administrative_adjustment(command)
-- create_settlement(command)
-- change_settlement_status(command)

Each function must derive the actor from the authenticated server context,
validate role/ownership and input, reload authoritative rows, serialize the
relevant wallet/order/idempotency scope, append ledger and audit rows in the
same transaction, and return only a safe receipt.

PROPOSED RLS DIRECTION

- Customers read their own safe profile, wallet history, orders, and refunds.
- Vendors manage only their vendor/profile/products and read their activity.
- Staff access only event-scoped customer lookup and token issuance functions.
- Administrators access event-scoped inspection and controlled mutation RPCs.
- No browser role writes arbitrary ledger or audit rows.
- Evidence is private and accessed through short-lived authorized URLs.
- Service-role credentials never appear in browser code.

END OF NON-EXECUTABLE PLANNING MATERIAL
*/
