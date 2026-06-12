# md1 API

Personal API tokens let you manage notes from **any** HTTP client — curl, scripts, CI, Shortcuts, Raycast, custom apps, or your own integrations.

The same token also powers the bundled **MCP server** for agents and chat tools (Claude Desktop, Windsurf, and other MCP hosts).

## Setup

1. Run migration `supabase/migrations/030_drive_api_tokens.sql` (once).
2. Open [md1.space/settings](https://md1.space/settings) → **Create token** → copy `m1_…` (shown once).
3. Pass the token on every request:

```http
Authorization: Bearer m1_YOUR_TOKEN
```

Optional env vars for scripts and MCP:

| Variable | Purpose |
|----------|---------|
| `MD1_API_TOKEN` | Your `m1_…` token |
| `MD1_API_URL` | Base URL (default `https://md1.space`) |

## HTTP endpoints

All routes require Bearer auth. Unauthenticated requests return `404`.

### List notes

```bash
curl -s "$MD1_API_URL/api/docs" \
  -H "Authorization: Bearer $MD1_API_TOKEN"
```

### Get note

```bash
curl -s "$MD1_API_URL/api/docs/NOTE_UUID" \
  -H "Authorization: Bearer $MD1_API_TOKEN"
```

Returns the full note (including `content`, `slug`, `isPublished`). Use the slug for the public link: `$MD1_API_URL/d/{slug}` when `isPublished` is true.

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

## MCP server

`mcp-server/` is a thin wrapper around the same API — tools like `md1_create_doc`, `md1_create_from_file`, `md1_get_doc`, and `md1_share_doc`.

Typical agent flow:

1. **Create and share in one step** — `md1_create_doc` with `share: true` → returns `Share link: https://md1.space/d/…`
2. **Share an existing note** — `md1_share_doc` with `query` = id, slug, or part of the title
3. **Read before sharing** — `md1_get_doc` with the same `query`

```bash
cd mcp-server && npm install && npm run build
```

Add the server to your MCP host config (see `mcp.json.example` in the repo). Same `MD1_API_TOKEN` and optional `MD1_API_URL` as curl.

## Local dev

```bash
export MD1_API_URL=http://localhost:3001
export MD1_API_TOKEN=m1_...
```
