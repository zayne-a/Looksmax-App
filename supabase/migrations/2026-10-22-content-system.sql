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
