-- Coupons (2026-10-24, Zayne): discount codes the owner creates
-- from the admin panel — in the PHONE app (/admin-coupons) and on
-- the site (/admin/coupons) — choosing the code and its % off.
-- Codes apply to MONTHLY and YEARLY plans only, never Weekly (the
-- same plans-only shape as trials). Payments are parked, so today a
-- code's effect is validated + priced truthfully at the paywall;
-- when checkout wires in, the applied code passes through.
--
-- Access: service-role only (RLS on, no policies — the admin API
-- and the public validate endpoint both use the service client).

create table if not exists public.coupons (
  code text primary key,
  percent_off integer not null check (percent_off between 1 and 90),
  active boolean not null default true,
  created_by text,
  created_at timestamptz not null default now()
);

alter table public.coupons enable row level security;
