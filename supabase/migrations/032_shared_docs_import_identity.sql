-- 032_shared_docs_import_identity.sql
--
-- Stable import identity for add-only migrations from external note stores.
-- The Fable importer writes import_source='fable' and import_id='fable:{note.id}'.
-- Re-running the importer can then skip existing docs instead of duplicating
-- them. Both columns are nullable so normal MD1-created docs stay unchanged.

alter table shared_docs
  add column if not exists import_source text,
  add column if not exists import_id text;

create unique index if not exists shared_docs_import_identity_uidx
  on shared_docs (owner_id, import_source, import_id)
  where import_source is not null and import_id is not null;

create index if not exists shared_docs_import_source_idx
  on shared_docs (owner_id, import_source)
  where import_source is not null;
