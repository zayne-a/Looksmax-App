-- Guest-first support (Zayne, 2026-10-23): the native app creates
-- anonymous Supabase users on first launch. Two blockers fixed:
--  1. public.profiles.email was NOT NULL and handle_new_user()
--     inserted new.email verbatim -> anonymous signup (email NULL)
--     failed with "Database error creating anonymous user".
--     Fix: drop the NOT NULL, and coalesce the owner checks so a
--     NULL email never inserts NULL into is_admin / is_premium.
--     Owner behaviour unchanged for real emails.
--  2. profiles.email was only written at signup; a guest who later
--     converts (adds + confirms an email) would keep a NULL profile
--     email forever. Added an AFTER UPDATE OF email trigger on
--     auth.users that syncs profiles.email on any email change.

alter table public.profiles alter column email drop not null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.profiles (id, email, is_admin, is_premium)
  values (
    new.id,
    new.email,
    coalesce(lower(new.email) = 'zayneasad7@gmail.com', false),
    coalesce(lower(new.email) = 'zayneasad7@gmail.com', false)
  )
  on conflict (id) do nothing;
  return new;
end;
$function$;

create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.email is not null and new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$function$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute function public.sync_profile_email();
