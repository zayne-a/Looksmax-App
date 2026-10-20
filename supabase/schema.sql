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
  created_at timestamptz not null default now()
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

alter table public.profiles enable row level security;
alter table public.scans enable row level security;
alter table public.plans enable row level security;
alter table public.checkins enable row level security;

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
