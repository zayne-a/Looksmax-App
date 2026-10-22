-- App settings (2026-10-22, Zayne's directive): the owner controls
-- the app from the admin panel (/admin/settings) instead of touching
-- code. public.app_settings is a tiny key/value store; every key in
-- it is genuinely consumed somewhere real:
--
--   maintenance  { on, message }  — web shows a maintenance screen on
--                    the app surfaces while on (admins + auth +
--                    /admin exempt); also served by GET /api/settings
--                    for the native app to read.
--   announcement { on, text }     — banner on the web home page;
--                    also served by GET /api/settings.
--   features     { creator_program, forum } — creator_program=false
--                    gates the web /creator hub + /portal behind a
--                    "paused" notice; forum is served by
--                    GET /api/settings (the forum itself lives in
--                    the native app).
--   trial_days   3 | 7           — the free-trial length quoted by
--                    the web paywall/pricing copy and Max's support
--                    prompt (Monthly & Yearly only, as always).
--
-- Writes are service-role only (through /api/admin/settings after
-- requireAdmin); reads are public — the settings are not secret, and
-- GET /api/settings is the canonical read path for web + native.
--
-- Apply in the Supabase SQL editor (project "ascend"). The same DDL
-- is appended to supabase/schema.sql. Idempotent: safe to re-run.

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table public.app_settings enable row level security;

-- Public read (the values are public by design); NO client write
-- policies — the service role is the only write path.
drop policy if exists app_settings_public_read on public.app_settings;
create policy app_settings_public_read on public.app_settings
  for select to anon, authenticated using (true);

-- Seed the defaults so a fresh project behaves exactly like the
-- pre-settings product. Never overwrite an owner's saved values.
insert into public.app_settings (key, value) values
  ('maintenance', '{"on": false, "message": "Mewmax is briefly down for scheduled maintenance. We will be back shortly — your scans and plans are safe."}'::jsonb),
  ('announcement', '{"on": false, "text": ""}'::jsonb),
  ('features', '{"creator_program": true, "forum": true}'::jsonb),
  ('trial_days', '3'::jsonb)
on conflict (key) do nothing;
