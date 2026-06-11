-- 028_shared_docs_owner.sql
--
-- Each Drive user owns their own files. `owner_id` links a shared_doc to
-- drive_users; list/create/update/delete in the app always scope by owner.
-- Public /d/{slug} links still work for anyone when is_public = true; internal
-- docs are visible only to the owner.

alter table shared_docs
  add column if not exists owner_id uuid references drive_users (id) on delete cascade;

create index if not exists shared_docs_owner_id_idx on shared_docs (owner_id);
