drop function if exists public.vendor_return_customer_tokens(
  uuid,
  text,
  numeric,
  uuid,
  uuid,
  uuid,
  text,
  text,
  timestamptz
);

create or replace function public.admin_refund_vendor_transaction(
  p_customer_id uuid,
  p_purchase_transaction_group_id uuid,
  p_actor_account_id uuid,
  p_token_amount numeric(14, 2),
  p_reason text,
  p_transaction_group_id uuid,
  p_refund_id uuid,
  p_customer_ledger_entry_id uuid,
  p_vendor_ledger_entry_id uuid,
  p_reference text,
  p_idempotency_key text,
  p_occurred_at timestamptz
)
returns numeric(14, 2)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_wallet_id uuid;
  v_event_id uuid;
  v_original_token_amount numeric(14, 2);
  v_order_id uuid;
  v_pair_count integer;
  v_prior_refund_amount numeric(14, 2);
  v_remaining_after_refund numeric(14, 2);
  v_remaining_before_refund numeric(14, 2);
  v_refund_scope text;
  v_vendor_balance numeric(14, 2);
  v_vendor_id uuid;
  v_vendor_wallet_id uuid;
  v_customer_purchase_entry_id uuid;
  v_vendor_receipt_entry_id uuid;
begin
  if p_token_amount <= 0 then
    raise exception 'Refund amount must be positive';
  end if;

  if p_token_amount <> round(p_token_amount, 2) then
    raise exception 'Refund amount must use at most two decimal places';
  end if;

  if length(trim(p_reason)) = 0 then
    raise exception 'Refund reason is required';
  end if;

  select c.event_id, c.wallet_id
  into v_event_id, v_customer_wallet_id
  from public.customers c
  join public.wallets w
    on w.id = c.wallet_id
    and w.status = 'active'
  where c.id = p_customer_id;

  if v_event_id is null then
    raise exception 'Active customer wallet was not found';
  end if;

  if not exists (
    select 1
    from public.account_profiles a
    join public.event_role_memberships m
      on m.account_id = a.id
      and m.event_id = v_event_id
      and m.role = 'administrator'
    where a.id = p_actor_account_id
      and a.role = 'administrator'
      and a.status = 'active'
  ) then
    raise exception 'Administrator actor is not allowed';
  end if;

  select
    le.id,
    le.related_vendor_id,
    le.related_order_id,
    le.token_amount
  into
    v_customer_purchase_entry_id,
    v_vendor_id,
    v_order_id,
    v_original_token_amount
  from public.ledger_entries le
  where le.event_id = v_event_id
    and le.wallet_id = v_customer_wallet_id
    and le.related_customer_id = p_customer_id
    and le.transaction_group_id = p_purchase_transaction_group_id
    and le.entry_type = 'customer_purchase'
    and le.direction = 'debit';

  if v_customer_purchase_entry_id is null or v_vendor_id is null then
    raise exception 'Refundable purchase transaction was not found';
  end if;

  select le.id, le.wallet_id
  into v_vendor_receipt_entry_id, v_vendor_wallet_id
  from public.ledger_entries le
  join public.vendors v
    on v.id = le.related_vendor_id
    and v.event_id = le.event_id
  join public.wallets w
    on w.id = le.wallet_id
    and w.id = v.wallet_id
    and w.status = 'active'
  where le.event_id = v_event_id
    and le.transaction_group_id = p_purchase_transaction_group_id
    and le.related_customer_id = p_customer_id
    and le.related_vendor_id = v_vendor_id
    and le.entry_type = 'vendor_receipt'
    and le.direction = 'credit'
    and le.token_amount = v_original_token_amount;

  if v_vendor_receipt_entry_id is null or v_vendor_wallet_id is null then
    raise exception 'Original vendor receipt entry was not found';
  end if;

  select count(*)
  into v_pair_count
  from public.ledger_entries le
  where le.event_id = v_event_id
    and le.transaction_group_id = p_purchase_transaction_group_id
    and le.entry_type in ('customer_purchase', 'vendor_receipt');

  if v_pair_count <> 2 then
    raise exception 'Purchase ledger pair is invalid';
  end if;

  perform 1
  from public.wallets
  where id in (v_customer_wallet_id, v_vendor_wallet_id)
  order by id
  for update;

  select coalesce(sum(le.token_amount), 0)
  into v_prior_refund_amount
  from public.ledger_entries le
  where le.event_id = v_event_id
    and le.entry_type = 'customer_refund'
    and le.direction = 'credit'
    and le.reverses_ledger_entry_id = v_customer_purchase_entry_id;

  v_remaining_before_refund := v_original_token_amount - v_prior_refund_amount;

  if p_token_amount > v_remaining_before_refund then
    raise exception 'Refund amount exceeds remaining refundable tokens';
  end if;

  select coalesce(
    sum(case when direction = 'credit' then token_amount else -token_amount end),
    0
  )
  into v_vendor_balance
  from public.ledger_entries
  where wallet_id = v_vendor_wallet_id;

  if v_vendor_balance < p_token_amount then
    raise exception 'Vendor wallet has insufficient tokens';
  end if;

  v_remaining_after_refund := v_remaining_before_refund - p_token_amount;
  v_refund_scope :=
    case when v_remaining_after_refund = 0 then 'full' else 'partial' end;

  if v_order_id is not null then
    insert into public.refunds (
      id,
      event_id,
      order_id,
      customer_id,
      vendor_id,
      token_amount,
      reason,
      actor_account_id,
      transaction_group_id,
      reference,
      idempotency_key,
      created_at
    )
    values (
      p_refund_id,
      v_event_id,
      v_order_id,
      p_customer_id,
      v_vendor_id,
      p_token_amount,
      trim(p_reason),
      p_actor_account_id,
      p_transaction_group_id,
      p_reference,
      p_idempotency_key,
      p_occurred_at
    );
  end if;

  insert into public.ledger_entries (
    id,
    event_id,
    wallet_id,
    transaction_group_id,
    entry_type,
    direction,
    token_amount,
    actor_account_id,
    related_customer_id,
    related_vendor_id,
    related_order_id,
    reference,
    description,
    occurred_at,
    idempotency_key,
    metadata,
    reverses_ledger_entry_id
  )
  values (
    p_customer_ledger_entry_id,
    v_event_id,
    v_customer_wallet_id,
    p_transaction_group_id,
    'customer_refund',
    'credit',
    p_token_amount,
    p_actor_account_id,
    p_customer_id,
    v_vendor_id,
    v_order_id,
    p_reference,
    'Administrator refund customer wallet credit.',
    p_occurred_at,
    'operation:' || p_idempotency_key,
    jsonb_build_object(
      'pairedLedgerEntryId', p_vendor_ledger_entry_id,
      'reason', trim(p_reason),
      'refundId', p_refund_id,
      'refundedTransactionGroupId', p_purchase_transaction_group_id,
      'refundScope', v_refund_scope,
      'source', 'supabase_admin_vendor_refund'
    ),
    v_customer_purchase_entry_id
  );

  insert into public.ledger_entries (
    id,
    event_id,
    wallet_id,
    transaction_group_id,
    entry_type,
    direction,
    token_amount,
    actor_account_id,
    related_customer_id,
    related_vendor_id,
    related_order_id,
    reference,
    description,
    occurred_at,
    idempotency_key,
    metadata,
    reverses_ledger_entry_id
  )
  values (
    p_vendor_ledger_entry_id,
    v_event_id,
    v_vendor_wallet_id,
    p_transaction_group_id,
    'vendor_refund',
    'debit',
    p_token_amount,
    p_actor_account_id,
    p_customer_id,
    v_vendor_id,
    v_order_id,
    p_reference,
    'Administrator refund vendor wallet debit.',
    p_occurred_at,
    'entry:vendor-debit:' || p_idempotency_key,
    jsonb_build_object(
      'pairedLedgerEntryId', p_customer_ledger_entry_id,
      'reason', trim(p_reason),
      'refundId', p_refund_id,
      'refundedTransactionGroupId', p_purchase_transaction_group_id,
      'refundScope', v_refund_scope,
      'source', 'supabase_admin_vendor_refund'
    ),
    v_vendor_receipt_entry_id
  );

  insert into public.audit_logs (
    event_id,
    event_type,
    actor_account_id,
    target_type,
    target_id,
    description,
    occurred_at,
    metadata,
    transaction_group_id
  )
  values (
    v_event_id,
    'refund_created',
    p_actor_account_id,
    case when v_order_id is null then 'ledger_entry' else 'refund' end,
    case when v_order_id is null then p_customer_ledger_entry_id else p_refund_id end,
    'Administrator refund recorded against vendor transaction.',
    p_occurred_at,
    jsonb_build_object(
      'customerId', p_customer_id,
      'vendorId', v_vendor_id,
      'purchaseTransactionGroupId', p_purchase_transaction_group_id,
      'tokenAmount', p_token_amount,
      'remainingRefundableTokenAmount', v_remaining_after_refund,
      'refundScope', v_refund_scope
    ),
    p_transaction_group_id
  );

  return v_remaining_after_refund;
end;
$$;

revoke all on function public.admin_refund_vendor_transaction(
  uuid,
  uuid,
  uuid,
  numeric,
  text,
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  text,
  timestamptz
) from public;

grant execute on function public.admin_refund_vendor_transaction(
  uuid,
  uuid,
  uuid,
  numeric,
  text,
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  text,
  timestamptz
) to service_role;
