-- 025_shared_docs.sql
--
-- Internal "docs drive": markdown documents we can share via an unlisted
-- link (e.g. sending a context doc to a partner) without making the reader
-- log in. Managed from /admin/docs; read publicly at /d/{slug}.
--
-- Access model:
--   - `slug` is a random, unguessable token used in the public URL. There is
--     no public listing, so a doc is only reachable by someone who has the
--     link — and only while `is_published` is true.
--   - RLS is enabled with NO policies, so the anon/auth keys can neither read
--     nor write this table. Both the admin CRUD and the public read page go
--     through the service-role client (createAdminClient), which scopes
--     access in application code (admin gate for writes, published-only
--     filter for the public read).

create extension if not exists pgcrypto;

create table if not exists shared_docs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null default 'Untitled',
  description text not null default '',
  content text not null default '',
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Public reads look a doc up by slug; keep that fast.
create index if not exists shared_docs_slug_idx on shared_docs (slug);

-- Lock the table down to the service role only (see header).
alter table shared_docs enable row level security;
