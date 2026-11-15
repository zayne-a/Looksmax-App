-- Downgrade rule (Zayne 2026-11-15): no premium plan survives after
-- losing Pro. The client re-truncates premium plans for free users
-- on read (native getActivePlan), but a direct API caller could
-- INSERT a premium-tier plan and activate it — so the tier is
-- enforced in the database: a premium-tier plan row may only exist
-- for a premium profile.
--
-- APPLY: Supabase dashboard → project ascend → SQL Editor → paste
-- this file → Run. Idempotent (CREATE OR REPLACE + DROP IF EXISTS),
-- safe to re-run. Existing rows are untouched (the trigger fires on
-- INSERT/UPDATE only) — stored premium plans for now-free users stay
-- in the table, unserved, until they re-subscribe.
-- Also shipped in supabase/schema.sql (the full current schema).

create or replace function public.protect_plan_premium_tier()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_premium boolean;
begin
  if new.tier = 'premium' then
    select is_premium into v_premium
      from public.profiles where id = new.user_id;
    if not coalesce(v_premium, false) then
      raise exception 'premium-tier plans require a premium profile';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists plans_protect_premium_tier on public.plans;
create trigger plans_protect_premium_tier
  before insert or update on public.plans
  for each row execute function public.protect_plan_premium_tier();
