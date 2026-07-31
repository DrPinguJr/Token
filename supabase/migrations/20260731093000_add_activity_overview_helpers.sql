create or replace function public.get_admin_transaction_metrics(
  p_event_id uuid
)
returns table (
  issued_tokens numeric(14, 2),
  refunded_tokens numeric(14, 2),
  spent_tokens numeric(14, 2),
  transaction_groups bigint
)
language sql
security definer
set search_path = public
as $$
  select
    coalesce(
      sum(le.token_amount) filter (
        where le.entry_type = 'token_issuance'
          and le.direction = 'credit'
      ),
      0
    )::numeric(14, 2) as issued_tokens,
    coalesce(
      sum(le.token_amount) filter (
        where le.entry_type = 'customer_refund'
          and le.direction = 'credit'
      ),
      0
    )::numeric(14, 2) as refunded_tokens,
    coalesce(
      sum(le.token_amount) filter (
        where le.entry_type = 'customer_purchase'
          and le.direction = 'debit'
      ),
      0
    )::numeric(14, 2) as spent_tokens,
    count(distinct le.transaction_group_id) as transaction_groups
  from public.ledger_entries le
  where le.event_id = p_event_id;
$$;

revoke all on function public.get_admin_transaction_metrics(uuid) from public;
grant execute on function public.get_admin_transaction_metrics(uuid) to service_role;

create or replace function public.get_vendor_overview(
  p_vendor_username text
)
returns table (
  display_name text,
  stall_location text,
  balance numeric(14, 2),
  recent_activity jsonb
)
language sql
security definer
set search_path = public
as $$
  with primary_event as (
    select e.id
    from public.events e
    order by e.created_at asc
    limit 1
  ),
  vendor_profile as (
    select
      v.id as vendor_id,
      v.display_name as vendor_display_name,
      v.stall_location as vendor_stall_location,
      v.wallet_id as vendor_wallet_id
    from public.vendors v
    join public.account_profiles a
      on a.id = v.account_id
    join primary_event e
      on e.id = v.event_id
    where a.username = p_vendor_username
      and a.role = 'vendor'
      and a.status = 'active'
    limit 1
  ),
  vendor_balance as (
    select coalesce(
      sum(
        case
          when le.direction = 'credit' then le.token_amount
          else -le.token_amount
        end
      ),
      0
    )::numeric(14, 2) as balance
    from public.ledger_entries le
    join vendor_profile vp
      on vp.vendor_wallet_id = le.wallet_id
  ),
  recent_entries as (
    select
      le.id,
      le.entry_type,
      le.direction,
      le.token_amount,
      le.reference,
      le.description,
      le.occurred_at
    from public.ledger_entries le
    join vendor_profile vp
      on vp.vendor_wallet_id = le.wallet_id
    order by le.occurred_at desc
    limit 12
  ),
  recent as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'description', re.description,
          'direction', re.direction,
          'entryType', re.entry_type,
          'id', re.id,
          'occurredAt', re.occurred_at,
          'reference', re.reference,
          'tokenAmount', re.token_amount
        )
        order by re.occurred_at desc
      ),
      '[]'::jsonb
    ) as recent_activity
    from recent_entries re
  )
  select
    vp.vendor_display_name as display_name,
    vp.vendor_stall_location as stall_location,
    vb.balance,
    recent.recent_activity
  from vendor_profile vp
  cross join vendor_balance vb
  cross join recent;
$$;

revoke all on function public.get_vendor_overview(text) from public;
grant execute on function public.get_vendor_overview(text) to service_role;
