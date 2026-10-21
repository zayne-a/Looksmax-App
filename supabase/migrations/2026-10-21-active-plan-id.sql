-- Plan version history with revert (2026-10-21): the user's chosen
-- ACTIVE plan version. Every generated plan is already its own row in
-- public.plans (versions are never overwritten); this nullable column
-- records which saved version the user has reverted to / selected as
-- active. NULL means "follow the latest plan" — the historical
-- behaviour, so nothing changes for users who never revert.
--
-- NOT YET APPLIED to the production project (run in the Supabase SQL
-- Editor when shipping the revert feature). The app code tolerates
-- the column being absent: the preference falls back to device-local
-- storage until this migration lands.
--
-- Deleting the referenced plan row clears the pointer (set null);
-- deleting the profile cascades as before. The existing
-- protect_profile_privileges trigger only guards is_admin/is_premium,
-- and profiles_update_own RLS already lets a user update their own
-- row, so no policy changes are needed.

alter table public.profiles
  add column if not exists active_plan_id uuid
  references public.plans(id) on delete set null;
