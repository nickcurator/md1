-- 034_mail_client.sql
--
-- Mail client storage. Like shared_docs, these tables are intentionally locked
-- behind service-role access only; application code scopes every read/write by
-- drive_users.id. OAuth tokens are stored as app-level encrypted blobs.

create extension if not exists pgcrypto;

create table if not exists mail_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references drive_users (id) on delete cascade,
  provider text not null check (provider in ('gmail', 'imap')),
  provider_account_id text,
  email text not null,
  display_name text not null default '',
  status text not null default 'disconnected'
    check (status in ('connected', 'syncing', 'disconnected', 'error')),
  error text,
  scopes text[] not null default '{}',
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  sync_state jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists mail_accounts_owner_provider_email_uidx
  on mail_accounts (owner_id, provider, lower(email));
create index if not exists mail_accounts_owner_id_idx
  on mail_accounts (owner_id);

alter table mail_accounts enable row level security;

create table if not exists mail_folders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references drive_users (id) on delete cascade,
  account_id uuid not null references mail_accounts (id) on delete cascade,
  provider_folder_id text not null,
  name text not null,
  kind text not null default 'custom'
    check (kind in ('inbox', 'sent', 'drafts', 'archive', 'trash', 'spam', 'starred', 'custom')),
  unread_count integer not null default 0,
  total_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mail_folders_account_provider_unique unique (account_id, provider_folder_id)
);

create index if not exists mail_folders_owner_id_idx
  on mail_folders (owner_id);
create index if not exists mail_folders_account_id_idx
  on mail_folders (account_id);

alter table mail_folders enable row level security;

create table if not exists mail_threads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references drive_users (id) on delete cascade,
  account_id uuid not null references mail_accounts (id) on delete cascade,
  folder_id uuid references mail_folders (id) on delete set null,
  provider_thread_id text not null,
  subject text not null default '',
  participants jsonb not null default '[]'::jsonb,
  snippet text not null default '',
  last_message_at timestamptz,
  unread boolean not null default false,
  starred boolean not null default false,
  labels text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mail_threads_account_provider_unique unique (account_id, provider_thread_id)
);

create index if not exists mail_threads_owner_id_idx
  on mail_threads (owner_id);
create index if not exists mail_threads_account_updated_idx
  on mail_threads (account_id, last_message_at desc nulls last);
create index if not exists mail_threads_folder_id_idx
  on mail_threads (folder_id);

alter table mail_threads enable row level security;

create table if not exists mail_messages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references drive_users (id) on delete cascade,
  account_id uuid not null references mail_accounts (id) on delete cascade,
  thread_id uuid references mail_threads (id) on delete cascade,
  folder_id uuid references mail_folders (id) on delete set null,
  provider_message_id text not null,
  from_email text not null default '',
  from_name text not null default '',
  to_recipients jsonb not null default '[]'::jsonb,
  cc_recipients jsonb not null default '[]'::jsonb,
  bcc_recipients jsonb not null default '[]'::jsonb,
  subject text not null default '',
  snippet text not null default '',
  body_text text not null default '',
  body_html text not null default '',
  sent_at timestamptz,
  received_at timestamptz,
  unread boolean not null default false,
  starred boolean not null default false,
  has_attachments boolean not null default false,
  attachments jsonb not null default '[]'::jsonb,
  labels text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mail_messages_account_provider_unique unique (account_id, provider_message_id)
);

create index if not exists mail_messages_owner_id_idx
  on mail_messages (owner_id);
create index if not exists mail_messages_thread_id_idx
  on mail_messages (thread_id);
create index if not exists mail_messages_account_received_idx
  on mail_messages (account_id, received_at desc nulls last);
create index if not exists mail_messages_folder_id_idx
  on mail_messages (folder_id);

alter table mail_messages enable row level security;
