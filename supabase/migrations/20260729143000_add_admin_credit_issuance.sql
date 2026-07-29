insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-evidence',
  'payment-evidence',
  false,
  10485760,
  array['image/heic', 'image/heif', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.admin_issue_customer_credits(
  p_customer_id uuid,
  p_actor_account_id uuid,
  p_evidence_id uuid,
  p_evidence_storage_path text,
  p_evidence_file_name text,
  p_evidence_mime_type text,
  p_evidence_size_bytes bigint,
  p_payment_method text,
  p_amount_cents integer,
  p_transaction_group_id uuid,
  p_issuance_id uuid,
  p_ledger_entry_id uuid,
  p_reference text,
  p_idempotency_key text,
  p_occurred_at timestamptz
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_wallet_id uuid;
  v_tokens_per_dollar integer;
  v_token_amount integer;
begin
  if p_amount_cents <= 0 then
    raise exception 'Payment amount must be positive';
  end if;

  if p_payment_method not in ('cash', 'paynow') then
    raise exception 'Unsupported payment method';
  end if;

  if p_evidence_size_bytes <= 0 or p_evidence_size_bytes > 10485760 then
    raise exception 'Evidence size is invalid';
  end if;

  if p_evidence_mime_type not in (
    'image/heic',
    'image/heif',
    'image/jpeg',
    'image/png',
    'image/webp'
  ) then
    raise exception 'Evidence type is invalid';
  end if;

  select c.event_id, c.wallet_id
  into v_event_id, v_wallet_id
  from public.customers c
  join public.wallets w on w.id = c.wallet_id
  where c.id = p_customer_id
    and w.status = 'active';

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

  select s.tokens_per_dollar
  into v_tokens_per_dollar
  from public.event_settings s
  where s.event_id = v_event_id;

  v_token_amount :=
    floor((p_amount_cents::numeric * v_tokens_per_dollar) / 100)::integer;

  if v_token_amount <= 0 then
    raise exception 'Payment amount converts to zero credits';
  end if;

  insert into public.evidence (
    id,
    event_id,
    evidence_kind,
    storage_path,
    file_name,
    mime_type,
    size_bytes,
    captured_by_account_id,
    created_at,
    metadata
  )
  values (
    p_evidence_id,
    v_event_id,
    'manual_payment_image',
    p_evidence_storage_path,
    p_evidence_file_name,
    p_evidence_mime_type,
    p_evidence_size_bytes,
    p_actor_account_id,
    p_occurred_at,
    jsonb_build_object(
      'paymentMethod', p_payment_method,
      'manualVerificationRequired', true
    )
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
    'payment_evidence_recorded',
    p_actor_account_id,
    'evidence',
    p_evidence_id,
    'Manual payment evidence recorded before credit issuance.',
    p_occurred_at,
    jsonb_build_object(
      'amountCents', p_amount_cents,
      'customerId', p_customer_id,
      'evidenceId', p_evidence_id,
      'mimeType', p_evidence_mime_type,
      'paymentMethod', p_payment_method,
      'sizeBytes', p_evidence_size_bytes
    ),
    p_transaction_group_id
  );

  insert into public.token_issuances (
    id,
    event_id,
    customer_id,
    wallet_id,
    staff_account_id,
    evidence_id,
    paynow_amount_cents,
    tokens_per_dollar,
    token_amount,
    note,
    transaction_group_id,
    reference,
    idempotency_key,
    created_at
  )
  values (
    p_issuance_id,
    v_event_id,
    p_customer_id,
    v_wallet_id,
    p_actor_account_id,
    p_evidence_id,
    p_amount_cents,
    v_tokens_per_dollar,
    v_token_amount,
    'Manual ' || p_payment_method || ' payment recorded by administrator.',
    p_transaction_group_id,
    p_reference,
    p_idempotency_key,
    p_occurred_at
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
    related_evidence_id,
    reference,
    description,
    occurred_at,
    idempotency_key,
    metadata
  )
  values (
    p_ledger_entry_id,
    v_event_id,
    v_wallet_id,
    p_transaction_group_id,
    'token_issuance',
    'credit',
    v_token_amount,
    p_actor_account_id,
    p_customer_id,
    p_evidence_id,
    p_reference,
    'Credits issued after manual ' || p_payment_method || ' evidence was recorded.',
    p_occurred_at,
    'ledger:' || p_idempotency_key,
    jsonb_build_object(
      'amountCents', p_amount_cents,
      'evidenceId', p_evidence_id,
      'paymentMethod', p_payment_method,
      'tokensPerDollar', v_tokens_per_dollar
    )
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
    'customer_credits_issued',
    p_actor_account_id,
    'token_issuance',
    p_issuance_id,
    'Customer credits issued from manually recorded payment evidence.',
    p_occurred_at,
    jsonb_build_object(
      'amountCents', p_amount_cents,
      'customerId', p_customer_id,
      'evidenceId', p_evidence_id,
      'paymentMethod', p_payment_method,
      'tokenAmount', v_token_amount,
      'tokensPerDollar', v_tokens_per_dollar
    ),
    p_transaction_group_id
  );

  return v_token_amount;
end;
$$;

revoke all on function public.admin_issue_customer_credits(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  bigint,
  text,
  integer,
  uuid,
  uuid,
  uuid,
  text,
  text,
  timestamptz
) from public;

grant execute on function public.admin_issue_customer_credits(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  bigint,
  text,
  integer,
  uuid,
  uuid,
  uuid,
  text,
  text,
  timestamptz
) to service_role;
