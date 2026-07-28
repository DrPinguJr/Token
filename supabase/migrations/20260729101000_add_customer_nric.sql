alter table public.customers
  add column nric text;

alter table public.customers
  add constraint customers_nric_format
    check (nric is null or nric ~ '^[STFGM][0-9]{7}[A-Z]$');

create unique index customers_event_nric_unique_idx
  on public.customers (event_id, nric)
  where nric is not null;
