# md1 API

Personal API tokens let you manage notes from **any** HTTP client — curl, scripts, CI, Shortcuts, Raycast, custom apps, or agent tools (including Cursor via the optional MCP server).

## Setup

1. Run migration `supabase/migrations/030_drive_api_tokens.sql` (once).
2. Open [md1.space/settings](https://md1.space/settings) → **Create token** → copy `m1_…` (shown once).
3. Pass the token on every request:

```http
Authorization: Bearer m1_YOUR_TOKEN
```

Optional env vars for scripts:

| Variable | Purpose |
|----------|---------|
| `MD1_API_TOKEN` | Your `m1_…` token |
| `MD1_API_URL` | Base URL (default `https://md1.space`) |

## Endpoints

All routes require Bearer auth. Unauthenticated requests return `404`.

### List notes

```bash
curl -s "$MD1_API_URL/api/docs" \
  -H "Authorization: Bearer $MD1_API_TOKEN"
```

### Create note

```bash
curl -s -X POST "$MD1_API_URL/api/docs" \
  -H "Authorization: Bearer $MD1_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"My note","content":"# Hello\n"}'
```

Body fields (all optional except you need content for a useful note):

| Field | Type | Notes |
|-------|------|-------|
| `title` | string | Default `Untitled` |
| `content` | string | Markdown, max 200k chars |
| `description` | string | |
| `isPublished` | boolean | Default `false` |
| `isPublic` | boolean | Public `/d/slug` when published |

### Update note

```bash
curl -s -X PATCH "$MD1_API_URL/api/docs/NOTE_UUID" \
  -H "Authorization: Bearer $MD1_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"# Updated\n"}'
```

### Delete note

```bash
curl -s -X DELETE "$MD1_API_URL/api/docs/NOTE_UUID" \
  -H "Authorization: Bearer $MD1_API_TOKEN"
```

## Optional: Cursor MCP

If you use Cursor, the repo includes `mcp-server/` — a thin wrapper around this API with tools like `md1_create_doc` and `md1_create_from_file`.

```bash
cd mcp-server && npm install && npm run build
```

Add to `~/.cursor/mcp.json` (see `mcp.json.example`). This is **one** integration path; the API itself is not Cursor-specific.

## Local dev

```bash
export MD1_API_URL=http://localhost:3001
export MD1_API_TOKEN=m1_...
```
