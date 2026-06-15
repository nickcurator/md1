# Fable Import Preview

This flow starts with a read-only preview. It is intentionally separate from the
actual importer so we can verify counts, folders, duplicates, empty notes, and
secret-like content before anything is written to MD1.

## Preview

```bash
npm run import:fable:preview -- --snapshot /path/to/fable-notes-snapshot.json
```

Useful variants:

```bash
npm run import:fable:preview -- --snapshot /path/to/fable-notes-snapshot.json --all
npm run import:fable:preview -- --snapshot /path/to/fable-notes-snapshot.json --json
npm run import:fable:preview -- --snapshot /path/to/fable-notes-snapshot.json --no-titles
```

The preview does not write to MD1, Supabase, or Fable. It only reads the snapshot
file and prints the planned folder/doc mapping. By default deleted Fable notes
are skipped.

## Next Import Contract

The write importer should be add-only and idempotent:

- create or reuse MD1 folders by name
- create one MD1 doc per live Fable note
- use stable import ids like `fable:{note.id}` to avoid duplicates
- preserve Fable note text as markdown content
- keep Fable untouched

## Add-Only Import

Dry-run is the default:

```bash
npm run import:fable -- --snapshot /path/to/fable-notes-snapshot.json --no-titles
```

Check current MD1 DB state without writing:

```bash
npm run import:fable -- \
  --snapshot /path/to/fable-notes-snapshot.json \
  --owner-email you@example.com \
  --check-db \
  --no-titles
```

Execute requires an explicit flag and a secret-like decision:

```bash
npm run import:fable -- \
  --snapshot /path/to/fable-notes-snapshot.json \
  --owner-email you@example.com \
  --execute \
  --allow-secret-like
```

Use `--skip-secret-like` instead of `--allow-secret-like` when credentials or
other secrets should stay out of MD1. The importer never updates or deletes
Fable data. Re-running it skips docs with the same import identity.

Do not disable Fable notes until the imported MD1 docs have been reviewed in the
MD1 UI.
