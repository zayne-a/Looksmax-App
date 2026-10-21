-- Creator Portal (2026-10-22): a functional mirror of the reference
-- app's creator portal — Discord-login creators connect TikTok /
-- Instagram accounts, verify them with a demographics recording,
-- submit videos (views lock at submission), and earn the view ladder.
-- Apply in the Supabase SQL editor (project "ascend"). The same DDL is
-- appended to supabase/schema.sql. All tables are RLS own-rows-only;
-- every privileged transition (account approval + tier, submission
-- approval + earned amount, referral qualification) happens through
-- the service role in /api/admin/portal, guarded by protect triggers.

-- ------------------------------------------------------------------
-- Tables
-- ------------------------------------------------------------------

create table if not exists public.creator_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  discord_id text,
  discord_username text,
  discord_avatar_url text,
  referral_code text not null unique,
  referred_by uuid references public.creator_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.connected_accounts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator_profiles(id) on delete cascade,
  platform text not null check (platform in ('tiktok', 'instagram')),
  handle text not null,
  profile_url text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  tier text check (tier in ('BASIC', 'ELITE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists connected_accounts_creator_platform_handle_idx
  on public.connected_accounts (creator_id, platform, lower(handle));
create index if not exists connected_accounts_creator_idx
  on public.connected_accounts (creator_id, created_at desc);

create table if not exists public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator_profiles(id) on delete cascade,
  account_id uuid not null references public.connected_accounts(id) on delete cascade,
  recording_url text,
  storage_path text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);
create index if not exists verification_requests_creator_idx
  on public.verification_requests (creator_id, created_at desc);
create index if not exists verification_requests_status_idx
  on public.verification_requests (status, created_at);

create table if not exists public.video_submissions (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator_profiles(id) on delete cascade,
  account_id uuid not null references public.connected_accounts(id) on delete cascade,
  video_url text not null,
  posted_at date not null,
  locked_views int not null check (locked_views >= 0),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  -- Payout month the submission counts toward (YYYY-MM of submission).
  month text not null,
  -- Set once, by the admin approval path (service role): the ladder
  -- amount this video earned and the tier it was approved at. NULL
  -- while pending; the UI projects it from locked_views + tier.
  earned_cents int,
  tier_at_approval text check (tier_at_approval in ('BASIC', 'ELITE')),
  created_at timestamptz not null default now()
);
create index if not exists video_submissions_creator_month_idx
  on public.video_submissions (creator_id, month);
create index if not exists video_submissions_status_idx
  on public.video_submissions (status, created_at);

create table if not exists public.payout_methods (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator_profiles(id) on delete cascade,
  type text not null check (type in ('paypal', 'cashapp', 'crypto', 'bank')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (creator_id, type)
);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.creator_profiles(id) on delete cascade,
  invitee_id uuid not null unique references public.creator_profiles(id) on delete cascade,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'qualified')),
  qualified_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists referrals_referrer_idx
  on public.referrals (referrer_id, created_at desc);

-- ------------------------------------------------------------------
-- Ladder math (single source of truth; mirrored in src/lib/portal.ts)
-- ------------------------------------------------------------------

create or replace function public.portal_ladder_cents(p_views int, p_tier text)
returns int
language sql
immutable
as $$
  select case when upper(coalesce(p_tier, 'BASIC')) = 'ELITE'
    then (case when p_views >= 40000 then 2000 else 0 end)
       + (case when p_views >= 100000 then 3000 else 0 end)
       + (case when p_views >= 500000 then 10000 else 0 end)
       + (case when p_views >= 1000000 then 15000 else 0 end)
    else (case when p_views >= 40000 then 2000 else 0 end)
       + (case when p_views >= 500000 then 3000 else 0 end)
       + (case when p_views >= 1000000 then 5000 else 0 end)
  end;
$$;

-- ------------------------------------------------------------------
-- Row level security: own rows only
-- ------------------------------------------------------------------

alter table public.creator_profiles enable row level security;
alter table public.connected_accounts enable row level security;
alter table public.verification_requests enable row level security;
alter table public.video_submissions enable row level security;
alter table public.payout_methods enable row level security;
alter table public.referrals enable row level security;

drop policy if exists "creator_profiles_select_own" on public.creator_profiles;
create policy "creator_profiles_select_own" on public.creator_profiles
  for select using (auth.uid() = id);
drop policy if exists "creator_profiles_insert_own" on public.creator_profiles;
create policy "creator_profiles_insert_own" on public.creator_profiles
  for insert with check (auth.uid() = id);
drop policy if exists "creator_profiles_update_own" on public.creator_profiles;
create policy "creator_profiles_update_own" on public.creator_profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Connected accounts: creators read/update/delete their own rows, but
-- a fresh claim always starts pending with no tier (the protect
-- trigger below additionally freezes status/tier for non-service
-- roles, so an update can never self-approve either).
drop policy if exists "connected_accounts_own" on public.connected_accounts;
drop policy if exists "connected_accounts_select_own" on public.connected_accounts;
create policy "connected_accounts_select_own" on public.connected_accounts
  for select using (auth.uid() = creator_id);
drop policy if exists "connected_accounts_insert_own" on public.connected_accounts;
create policy "connected_accounts_insert_own" on public.connected_accounts
  for insert with check (
    auth.uid() = creator_id and status = 'pending' and tier is null
  );
drop policy if exists "connected_accounts_update_own" on public.connected_accounts;
create policy "connected_accounts_update_own" on public.connected_accounts
  for update using (auth.uid() = creator_id) with check (auth.uid() = creator_id);
drop policy if exists "connected_accounts_delete_own" on public.connected_accounts;
create policy "connected_accounts_delete_own" on public.connected_accounts
  for delete using (auth.uid() = creator_id);

-- Verification requests: creators create (pending only) and read their
-- own; decisions are service-role only (no update/delete policy).
drop policy if exists "verification_requests_select_own" on public.verification_requests;
create policy "verification_requests_select_own" on public.verification_requests
  for select using (auth.uid() = creator_id);
drop policy if exists "verification_requests_insert_own" on public.verification_requests;
create policy "verification_requests_insert_own" on public.verification_requests
  for insert with check (auth.uid() = creator_id and status = 'pending');

-- Video submissions: same shape — create pending with no earned
-- amount, read own; approval is service-role only.
drop policy if exists "video_submissions_select_own" on public.video_submissions;
create policy "video_submissions_select_own" on public.video_submissions
  for select using (auth.uid() = creator_id);
drop policy if exists "video_submissions_insert_own" on public.video_submissions;
create policy "video_submissions_insert_own" on public.video_submissions
  for insert with check (
    auth.uid() = creator_id and status = 'pending'
    and earned_cents is null and tier_at_approval is null
  );

drop policy if exists "payout_methods_own" on public.payout_methods;
create policy "payout_methods_own" on public.payout_methods
  for all using (auth.uid() = creator_id) with check (auth.uid() = creator_id);

-- Referrals: visible to both sides; created by the invitee at signup
-- (in_progress only); qualification is service-role only.
drop policy if exists "referrals_select_party" on public.referrals;
create policy "referrals_select_party" on public.referrals
  for select using (auth.uid() = referrer_id or auth.uid() = invitee_id);
drop policy if exists "referrals_insert_invitee" on public.referrals;
create policy "referrals_insert_invitee" on public.referrals
  for insert with check (auth.uid() = invitee_id and status = 'in_progress');

-- ------------------------------------------------------------------
-- Privilege protection: approval fields move only via service role
-- (same pattern as profiles.protect_profile_privileges).
-- ------------------------------------------------------------------

create or replace function public.protect_connected_account_status()
returns trigger
language plpgsql
as $$
begin
  if (new.status is distinct from old.status
      or new.tier is distinct from old.tier)
     and current_user not in ('service_role', 'postgres', 'supabase_admin')
  then
    raise exception 'account status/tier can only be changed by the service role';
  end if;
  return new;
end;
$$;

drop trigger if exists connected_accounts_protect_status on public.connected_accounts;
create trigger connected_accounts_protect_status
  before update on public.connected_accounts
  for each row execute function public.protect_connected_account_status();

create or replace function public.protect_review_status()
returns trigger
language plpgsql
as $$
begin
  if (new.status is distinct from old.status
      or new.earned_cents is distinct from old.earned_cents)
     and current_user not in ('service_role', 'postgres', 'supabase_admin')
  then
    raise exception 'review fields can only be changed by the service role';
  end if;
  return new;
end;
$$;

drop trigger if exists video_submissions_protect_review on public.video_submissions;
create trigger video_submissions_protect_review
  before update on public.video_submissions
  for each row execute function public.protect_review_status();

create or replace function public.protect_referral_status()
returns trigger
language plpgsql
as $$
begin
  if (new.status is distinct from old.status
      or new.qualified_at is distinct from old.qualified_at)
     and current_user not in ('service_role', 'postgres', 'supabase_admin')
  then
    raise exception 'referral status can only be changed by the service role';
  end if;
  return new;
end;
$$;

drop trigger if exists referrals_protect_status on public.referrals;
create trigger referrals_protect_status
  before update on public.referrals
  for each row execute function public.protect_referral_status();

-- ------------------------------------------------------------------
-- Verification recording storage (private bucket, own folder only)
-- ------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('verification-recordings', 'verification-recordings', false)
on conflict (id) do nothing;

drop policy if exists "verification_recordings_insert_own" on storage.objects;
create policy "verification_recordings_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'verification-recordings'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
drop policy if exists "verification_recordings_select_own" on storage.objects;
create policy "verification_recordings_select_own" on storage.objects
  for select using (
    bucket_id = 'verification-recordings'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
drop policy if exists "verification_recordings_delete_own" on storage.objects;
create policy "verification_recordings_delete_own" on storage.objects
  for delete using (
    bucket_id = 'verification-recordings'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ------------------------------------------------------------------
-- Cross-creator reads that stay safe: security-definer RPCs exposing
-- only leaderboard aggregates and a referrer's own invitee list.
-- ------------------------------------------------------------------

-- Resolve an invite ?ref=CODE to the referrer's profile id at signup
-- (creator_profiles itself is own-row-only under RLS).
create or replace function public.portal_resolve_referral(p_code text)
returns uuid
language sql
security definer
set search_path = public
as $$
  select id from public.creator_profiles
  where referral_code = upper(trim(p_code))
  limit 1;
$$;

create or replace function public.portal_leaderboard(p_month text)
returns table (
  creator_id uuid,
  discord_username text,
  discord_avatar_url text,
  earnings_cents int,
  posts int,
  views bigint
)
language sql
security definer
set search_path = public
as $$
  select vs.creator_id,
         cp.discord_username,
         cp.discord_avatar_url,
         coalesce(sum(coalesce(vs.earned_cents,
           public.portal_ladder_cents(vs.locked_views, vs.tier_at_approval))), 0)::int,
         count(*)::int,
         coalesce(sum(vs.locked_views), 0)::bigint
  from public.video_submissions vs
  join public.creator_profiles cp on cp.id = vs.creator_id
  where vs.status = 'approved' and vs.month = p_month
  group by vs.creator_id, cp.discord_username, cp.discord_avatar_url
  order by 4 desc, 6 desc;
$$;

create or replace function public.portal_referral_friends()
returns table (
  invitee_id uuid,
  discord_username text,
  discord_avatar_url text,
  status text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select r.invitee_id,
         cp.discord_username,
         cp.discord_avatar_url,
         r.status,
         r.created_at
  from public.referrals r
  join public.creator_profiles cp on cp.id = r.invitee_id
  where r.referrer_id = auth.uid()
  order by r.created_at desc;
$$;

revoke all on function public.portal_resolve_referral(text) from public;
revoke all on function public.portal_leaderboard(text) from public;
revoke all on function public.portal_referral_friends() from public;
grant execute on function public.portal_resolve_referral(text) to authenticated;
grant execute on function public.portal_leaderboard(text) to authenticated;
grant execute on function public.portal_referral_friends() to authenticated;
