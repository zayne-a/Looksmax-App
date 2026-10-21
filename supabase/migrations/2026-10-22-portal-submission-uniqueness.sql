-- Creator Portal (2026-10-22, audit fix): a video can only be
-- submitted once per creator. Payout is calculated on the views at
-- submission and never re-enters (the reference app's rule), and two
-- live rows for the same video could otherwise both be approved and
-- double-count earnings. The partial unique index keeps exactly one
-- pending-or-approved submission per (creator, video URL); a
-- REJECTED submission leaves the index, so a video turned down on a
-- technicality can be submitted again. The submit form checks first
-- and explains; this index is the server-side guarantee.
-- Apply in the Supabase SQL editor (project "ascend"). The same DDL
-- is appended to supabase/schema.sql.

create unique index if not exists video_submissions_creator_url_active_idx
  on public.video_submissions (creator_id, lower(video_url))
  where status in ('pending', 'approved');
