-- 031_drive_folders.sql
--
-- Lightweight folders for the markdown Drive. Folders are owner-scoped and can
-- exist while empty; docs point at a folder by id and fall back to root when
-- folder_id is null.

create table if not exists drive_folders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references drive_users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint drive_folders_owner_name_unique unique (owner_id, name)
);

create index if not exists drive_folders_owner_id_idx on drive_folders (owner_id);

alter table drive_folders enable row level security;

alter table shared_docs
  add column if not exists folder_id uuid references drive_folders (id) on delete set null;

create index if not exists shared_docs_folder_id_idx on shared_docs (folder_id);
create index if not exists shared_docs_owner_folder_idx on shared_docs (owner_id, folder_id);
