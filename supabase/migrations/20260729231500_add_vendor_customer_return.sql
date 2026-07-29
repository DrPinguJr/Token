create or replace function public.vendor_return_customer_tokens(
  p_customer_id uuid,
  p_vendor_username text,
  p_token_amount numeric(14, 2),
  p_transaction_group_id uuid,
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
  v_customer_event_id uuid;
  v_customer_wallet_id uuid;
  v_customer_balance numeric(14, 2);
  v_vendor_id uuid;
  v_vendor_account_id uuid;
  v_vendor_wallet_id uuid;
  v_vendor_balance numeric(14, 2);
begin
  if p_token_amount <= 0 then
    raise exception 'Token amount must be positive';
  end if;

  if p_token_amount <> round(p_token_amount, 2) then
    raise exception 'Token amount must use at most two decimal places';
  end if;

  select c.event_id, c.wallet_id
  into v_customer_event_id, v_customer_wallet_id
  from public.customers c
  join public.wallets w on w.id = c.wallet_id
  where c.id = p_customer_id
    and w.status = 'active';

  if v_customer_event_id is null then
    raise exception 'Active customer wallet was not found';
  end if;

  select v.id, a.id, v.wallet_id
  into v_vendor_id, v_vendor_account_id, v_vendor_wallet_id
  from public.account_profiles a
  join public.event_role_memberships m
    on m.account_id = a.id
    and m.event_id = v_customer_event_id
    and m.role = 'vendor'
  join public.vendors v
    on v.account_id = a.id
    and v.event_id = v_customer_event_id
  join public.wallets w
    on w.id = v.wallet_id
    and w.status = 'active'
  where a.username = p_vendor_username
    and a.role = 'vendor'
    and a.status = 'active'
    and v.operating_status = 'open';

  if v_vendor_id is null then
    raise exception 'Active vendor was not found';
  end if;

  perform 1
  from public.wallets
  where id in (v_customer_wallet_id, v_vendor_wallet_id)
  order by id
  for update;

  select coalesce(sum(case when direction = 'credit' then token_amount else -token_amount end), 0)
  into v_customer_balance
  from public.ledger_entries
  where wallet_id = v_customer_wallet_id;

  select coalesce(sum(case when direction = 'credit' then token_amount else -token_amount end), 0)
  into v_vendor_balance
  from public.ledger_entries
  where wallet_id = v_vendor_wallet_id;

  if v_vendor_balance < p_token_amount then
    raise exception 'Vendor wallet has insufficient tokens';
  end if;

  insert into public.ledger_entries (
    id, event_id, wallet_id, transaction_group_id, entry_type, direction,
    token_amount, actor_account_id, related_customer_id, related_vendor_id,
    reference, description, occurred_at, idempotency_key, metadata
  )
  values (
    p_customer_ledger_entry_id, v_customer_event_id, v_customer_wallet_id,
    p_transaction_group_id, 'customer_refund', 'credit', p_token_amount,
    v_vendor_account_id, p_customer_id, v_vendor_id, p_reference,
    'Vendor quick return customer wallet credit.', p_occurred_at,
    'operation:' || p_idempotency_key,
    jsonb_build_object('pairedLedgerEntryId', p_vendor_ledger_entry_id, 'source', 'supabase_vendor_quick_return')
  );

  insert into public.ledger_entries (
    id, event_id, wallet_id, transaction_group_id, entry_type, direction,
    token_amount, actor_account_id, related_customer_id, related_vendor_id,
    reference, description, occurred_at, idempotency_key, metadata
  )
  values (
    p_vendor_ledger_entry_id, v_customer_event_id, v_vendor_wallet_id,
    p_transaction_group_id, 'vendor_refund', 'debit', p_token_amount,
    v_vendor_account_id, p_customer_id, v_vendor_id, p_reference,
    'Vendor quick return debit.', p_occurred_at,
    'entry:vendor-debit:' || p_idempotency_key,
    jsonb_build_object('pairedLedgerEntryId', p_customer_ledger_entry_id, 'source', 'supabase_vendor_quick_return')
  );

  insert into public.audit_logs (
    event_id, event_type, actor_account_id, target_type, target_id,
    description, occurred_at, metadata, transaction_group_id
  )
  values (
    v_customer_event_id, 'refund_created', v_vendor_account_id, 'ledger_entry',
    p_customer_ledger_entry_id,
    'Vendor quick return recorded against customer wallet.',
    p_occurred_at,
    jsonb_build_object('customerId', p_customer_id, 'vendorId', v_vendor_id, 'tokenAmount', p_token_amount),
    p_transaction_group_id
  );

  return v_customer_balance + p_token_amount;
end;
$$;

revoke all on function public.vendor_return_customer_tokens(
  uuid, text, numeric, uuid, uuid, uuid, text, text, timestamptz
) from public;

grant execute on function public.vendor_return_customer_tokens(
  uuid, text, numeric, uuid, uuid, uuid, text, text, timestamptz
) to service_role;
