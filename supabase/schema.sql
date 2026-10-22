-- Ascend — Supabase schema: profiles, scans, plans.
-- Admin identity: zayneasad7@gmail.com -> is_admin + is_premium on signup
-- (Zayne's rule, 2026-10-20: the admin email is granted premium features
-- as admin). Photos are NEVER stored here — measurement happens on the
-- user's device; only measurements, quiz answers and plans persist.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  is_admin boolean not null default false,
  is_premium boolean not null default false,
  created_at timestamptz not null default now(),
  -- The plan version the user reverted to / selected as active
  -- (plan version history, 2026-10-21). NULL = follow the latest
  -- plan. The FK is declared after public.plans below (the table does
  -- not exist yet at this point). Also shipped as
  -- supabase/migrations/2026-10-21-active-plan-id.sql for existing
  -- projects.
  active_plan_id uuid
);

create table if not exists public.scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  overall_score numeric,
  measurements jsonb not null,
  quiz jsonb
);
create index if not exists scans_user_created_idx
  on public.scans (user_id, created_at desc);

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  scan_id uuid references public.scans(id) on delete set null,
  created_at timestamptz not null default now(),
  tier text not null default 'free',
  plan jsonb not null
);
create index if not exists plans_user_created_idx
  on public.plans (user_id, created_at desc);

-- profiles.active_plan_id -> plans(id): declared here because plans
-- is created after profiles above. Deleting the active plan version
-- clears the pointer back to "follow the latest".
alter table public.profiles drop constraint if exists profiles_active_plan_fk;
alter table public.profiles
  add constraint profiles_active_plan_fk
  foreign key (active_plan_id) references public.plans(id) on delete set null;

-- Weekly check-ins: the retention loop. One row per weekly check-in;
-- the answers drive the adaptive adjustments + phase unlock counts.
create table if not exists public.checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  week int not null,
  adherence text not null,
  skin_reaction text not null,
  sleep_quality text not null,
  weight_trend text not null
);
create index if not exists checkins_user_created_idx
  on public.checkins (user_id, created_at desc);

-- Daily logs: the subscriber home's heartbeat — one row per user per
-- day (daily coach answers, habit checks, water, calories, weight).
-- Powers the streak, the calendar, and the trackers.
create table if not exists public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  answers jsonb not null default '{}'::jsonb,
  habits jsonb not null default '{}'::jsonb,
  water_ml int not null default 0,
  calories int,
  weight_kg numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, day)
);
create index if not exists daily_logs_user_day_idx
  on public.daily_logs (user_id, day desc);

-- Coach chat history: gives the AI coach memory across days.
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null,
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_user_created_idx
  on public.chat_messages (user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.scans enable row level security;
alter table public.plans enable row level security;
alter table public.checkins enable row level security;
alter table public.daily_logs enable row level security;
alter table public.chat_messages enable row level security;

-- profiles: read/update own row (privileged columns protected below)
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- scans + plans: full CRUD on own rows only
drop policy if exists "scans_own" on public.scans;
create policy "scans_own" on public.scans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "plans_own" on public.plans;
create policy "plans_own" on public.plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "checkins_own" on public.checkins;
create policy "checkins_own" on public.checkins
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "daily_logs_own" on public.daily_logs;
create policy "daily_logs_own" on public.daily_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "chat_messages_own" on public.chat_messages;
create policy "chat_messages_own" on public.chat_messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Auto-create the profile on signup; the admin email gets admin+premium.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, is_admin, is_premium)
  values (
    new.id,
    new.email,
    lower(new.email) = 'zayneasad7@gmail.com',
    lower(new.email) = 'zayneasad7@gmail.com'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- is_admin / is_premium can only change via the service role (Stripe
-- webhooks and admin scripts later) — never by the user themselves.
create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
as $$
begin
  if (new.is_admin is distinct from old.is_admin
      or new.is_premium is distinct from old.is_premium)
     and current_user not in ('service_role', 'postgres', 'supabase_admin')
  then
    raise exception 'is_admin/is_premium can only be changed by the service role';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_privileges on public.profiles;
create trigger profiles_protect_privileges
  before update on public.profiles
  for each row execute function public.protect_profile_privileges();

-- ==================================================================
-- Creator Portal (2026-10-22) — also shipped as
-- supabase/migrations/2026-10-22-creator-portal.sql for existing
-- projects.
-- ==================================================================

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

-- One live submission per (creator, video): payout is calculated on
-- the views at submission and never re-enters. A rejected submission
-- leaves the index, so it can be submitted again. (Audit fix,
-- 2026-10-22; also in migrations/2026-10-22-portal-submission-uniqueness.sql.)
create unique index if not exists video_submissions_creator_url_active_idx
  on public.video_submissions (creator_id, lower(video_url))
  where status in ('pending', 'approved');

-- ==================================================================
-- Unified Admin Content System (2026-10-22) — also shipped as
-- supabase/migrations/2026-10-22-content-system.sql for existing
-- projects.
-- ==================================================================

-- Unified Admin Content System (2026-10-22): generalizes the
-- funnel-only funnel_media table into public.content_items, which
-- backs every admin-managed collection (funnel slots, Omegle clips,
-- replays, creator examples, research cards, animations) for both
-- web and the native app. Writes go through the service-role admin
-- API (/api/admin/content) after requireAdmin; reads of ACTIVE rows
-- are public via RLS. Apply in the Supabase SQL editor (project
-- "ascend"). The same DDL is appended to supabase/schema.sql.
-- Idempotent: safe to re-run.

-- ------------------------------------------------------------------
-- Legacy funnel_media — reproduced faithfully so the whole content
-- schema is reproducible from the repo (its DDL previously lived
-- only in the live project). Slots: chad-reality, average-reality,
-- quote-1/2/3; kinds: video/image/quote.
-- ------------------------------------------------------------------

create table if not exists public.funnel_media (
  id uuid primary key default gen_random_uuid(),
  slot text not null unique,
  kind text not null default 'video'
    check (kind in ('video', 'image', 'quote')),
  url text,
  headline text,
  body text,
  sort int not null default 0,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.funnel_media enable row level security;

-- Public read of ACTIVE rows only; no client write policies (all
-- writes go through the service-role admin API).
drop policy if exists "funnel_media_read_active" on public.funnel_media;
create policy "funnel_media_read_active" on public.funnel_media
  for select to anon, authenticated using (active = true);

-- Public storage bucket for funnel media + public read.
insert into storage.buckets (id, name, public)
values ('funnel-media', 'funnel-media', true)
on conflict (id) do nothing;

drop policy if exists "funnel_media_storage_public_read" on storage.objects;
create policy "funnel_media_storage_public_read" on storage.objects
  for select to public using (bucket_id = 'funnel-media');

-- ------------------------------------------------------------------
-- content_items — one table for every admin-managed collection.
-- ------------------------------------------------------------------

create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  collection text not null,
  slot text,
  type text not null default 'video'
    check (type in ('video', 'image', 'quote', 'research', 'animation', 'link')),
  title text,
  caption text,
  source_name text,
  media_url text,
  poster_url text,
  link_url text,
  meta jsonb not null default '{}'::jsonb,
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists content_items_collection_active_sort_idx
  on public.content_items (collection, active, sort);

create unique index if not exists content_items_collection_slot_uidx
  on public.content_items (collection, slot) where slot is not null;

alter table public.content_items enable row level security;

drop policy if exists "content_items_read_active" on public.content_items;
create policy "content_items_read_active" on public.content_items
  for select to anon, authenticated using (active = true);

drop policy if exists "content_items_admin_all" on public.content_items;
create policy "content_items_admin_all" on public.content_items
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

-- Public storage bucket for content media + public read. No public
-- write policies — uploads go through the service-role admin API.
insert into storage.buckets (id, name, public)
values ('content-media', 'content-media', true)
on conflict (id) do nothing;

drop policy if exists "content_media_storage_public_read" on storage.objects;
create policy "content_media_storage_public_read" on storage.objects
  for select to public using (bucket_id = 'content-media');

-- ------------------------------------------------------------------
-- Copy existing funnel rows into the unified table (funnel
-- collection). Existing content_items win on conflict.
-- ------------------------------------------------------------------

do $$
begin
  if to_regclass('public.funnel_media') is not null then
    insert into public.content_items
      (collection, slot, type, title, caption, media_url, sort, active)
    select 'funnel', slot, kind, headline, body, url, sort, active
    from public.funnel_media
    on conflict (collection, slot) where slot is not null do nothing;
  end if;
end;
$$;

-- ------------------------------------------------------------------
-- Seed research cards — real studies only, mirroring the /start
-- funnel's existing claims. Each guarded so re-runs never duplicate.
-- ------------------------------------------------------------------

insert into public.content_items (collection, type, title, caption, source_name, sort)
select 'research', 'research',
  'The halo effect is real',
  'In Dion, Berscheid & Walster''s classic experiment, attractive people were judged more competent, more successful and happier — on no evidence beyond a photograph.',
  'Dion, Berscheid & Walster (1972)',
  1
where not exists (
  select 1 from public.content_items
  where collection = 'research' and title = 'The halo effect is real'
);

insert into public.content_items (collection, type, title, caption, source_name, sort)
select 'research', 'research',
  '919 studies. Same verdict.',
  'Langlois et al.''s meta-analysis of the entire field: attractive adults and children are treated better and judged better across nearly every social outcome ever measured.',
  'Langlois et al. (2000), Psychological Bulletin',
  2
where not exists (
  select 1 from public.content_items
  where collection = 'research' and title = '919 studies. Same verdict.'
);

insert into public.content_items (collection, type, title, caption, source_name, sort)
select 'research', 'research',
  'Looks pay. Literally.',
  'Economist Daniel Hamermesh''s research puts the beauty premium at roughly 10–15% higher earnings across a career — a lifetime gap in the hundreds of thousands.',
  'Hamermesh, Beauty Pays (2011)',
  3
where not exists (
  select 1 from public.content_items
  where collection = 'research' and title = 'Looks pay. Literally.'
);

insert into public.content_items (collection, type, title, caption, source_name, sort)
select 'research', 'research',
  '80% of men are rated below average',
  'From OkCupid''s own published data — women judged four out of five men below average. The top sliver of faces takes almost every match, every reply, every date.',
  'OkCupid, ''Your Looks and Your Inbox'' (2009)',
  4
where not exists (
  select 1 from public.content_items
  where collection = 'research' and title = '80% of men are rated below average'
);
