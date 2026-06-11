-- 026_shared_docs_public.sql
--
-- Add a per-doc "public" flag to the shared docs drive.
--
-- `is_public = false` (the default): the doc is internal — /d/{slug} is gated
-- behind the same admin check as /admin (login + ADMIN_EMAILS), and the reader
-- shows a "Drive" link back to /admin/docs.
--
-- `is_public = true`: the doc is shareable with anyone — /d/{slug} opens with
-- no login, and the reader hides the "Drive" link so an outside reader can't
-- discover or navigate to the other (internal) docs.
--
-- A doc must still be published (is_published) to be reachable at all.

alter table shared_docs
  add column if not exists is_public boolean not null default false;
