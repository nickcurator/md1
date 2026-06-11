-- 029_shared_docs_comments.sql
-- Inline review comments anchored to character ranges in the markdown body.

alter table shared_docs
  add column if not exists comments jsonb not null default '[]'::jsonb;
