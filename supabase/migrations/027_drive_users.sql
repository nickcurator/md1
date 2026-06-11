-- 027_drive_users.sql
--
-- Drive accounts for the standalone Drive service (/drive). A row is created
-- on first Google OAuth sign-in. Separate from the main app's Supabase Auth
-- session and from ADMIN_EMAILS.
--
-- RLS enabled with no policies: only the service-role client touches this
-- table (OAuth callback + session resolution).

create table if not exists drive_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text not null default '',
  avatar_url text not null default '',
  google_sub text unique,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

create index if not exists drive_users_email_idx on drive_users (lower(email));

alter table drive_users enable row level security;
