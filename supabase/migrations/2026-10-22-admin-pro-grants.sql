-- Owner admins + Pro grants (2026-10-22, Zayne's rule):
-- cerxemm@gmail.com and zayneasad7@gmail.com are THE admins — every
-- plan free for them (is_admin + is_premium), full panel access, and
-- they can grant Pro to any other email from /admin/users. A grant
-- for an email with no account yet applies automatically at signup.
--
-- How it holds together:
--   * public.pro_grants is the grant list — service-role only (RLS
--     on, NO client policies), written exclusively by
--     /api/admin/pro after requireAdmin.
--   * A BEFORE INSERT trigger on public.profiles forces the flags
--     from the row's email, whatever path created the row (the
--     auth signup trigger handle_new_user included): owner email →
--     is_admin + is_premium; an email present in pro_grants →
--     is_premium.
--   * The two owner emails are HARDCODED in this file (SQL cannot
--     import the app constant). The app-side source of truth is
--     OWNER_ADMIN_EMAILS in src/lib/admin.ts — keep the two in step.
--
-- Apply in the Supabase SQL editor (project "ascend"). The same DDL
-- is appended to supabase/schema.sql. Idempotent: safe to re-run.

-- ------------------------------------------------------------------
-- Grant list — service-role only.
-- ------------------------------------------------------------------

create table if not exists public.pro_grants (
  email text primary key,
  granted_by text,
  created_at timestamptz not null default now()
);

-- RLS on with NO policies: anon/authenticated clients can neither
-- read nor write it; the service role bypasses RLS and is the only
-- path (same posture as the portal tables' privileged writes).
alter table public.pro_grants enable row level security;

-- ------------------------------------------------------------------
-- Entitlement trigger on profiles INSERT.
-- ------------------------------------------------------------------

create or replace function public.apply_profile_entitlements()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(new.email) in ('cerxemm@gmail.com', 'zayneasad7@gmail.com') then
    new.is_admin := true;
    new.is_premium := true;
  elsif exists (
    select 1 from public.pro_grants g
    where lower(g.email) = lower(new.email)
  ) then
    new.is_premium := true;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_apply_entitlements on public.profiles;
create trigger profiles_apply_entitlements
  before insert on public.profiles
  for each row execute function public.apply_profile_entitlements();

-- ------------------------------------------------------------------
-- One-time backfill for rows that already exist.
-- (Runs as postgres from the SQL editor, which the
-- protect_profile_privileges trigger explicitly allows.)
-- ------------------------------------------------------------------

update public.profiles
set is_admin = true, is_premium = true
where lower(email) in ('cerxemm@gmail.com', 'zayneasad7@gmail.com')
  and (is_admin is distinct from true or is_premium is distinct from true);

update public.profiles p
set is_premium = true
where p.is_premium is distinct from true
  and exists (
    select 1 from public.pro_grants g
    where lower(g.email) = lower(p.email)
  );
