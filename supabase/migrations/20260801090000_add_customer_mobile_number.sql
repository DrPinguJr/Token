alter table public.customers
  add column mobile_number text;

alter table public.customers
  add constraint customers_mobile_number_format_check
    check (mobile_number is null or mobile_number ~ '^[689][0-9]{7}$');

create unique index customers_event_mobile_number_unique
  on public.customers (event_id, mobile_number)
  where mobile_number is not null;

comment on column public.customers.mobile_number is
  'Normalized Singapore mobile number collected by administrators for customer identification; not verified and not used for sign-in.';
