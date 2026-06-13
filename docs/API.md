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
| `isPublished` | boolean | Default `false`. When `true`, note is live at `/d/{slug}` |
| `isPublic` | boolean | Set automatically when publishing; public read without login |

### Share / publish

There is no separate `/share` endpoint. Set `isPublished: true` on **create** or **update**. The response includes `slug` — share link: `$MD1_API_URL/d/{slug}`.

Create and publish in one request:

```bash
curl -s -X POST "$MD1_API_URL/api/docs" \
  -H "Authorization: Bearer $MD1_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"My note","content":"# Hello\n","isPublished":true}'
```

Publish an existing note:

```bash
curl -s -X PATCH "$MD1_API_URL/api/docs/NOTE_UUID" \
  -H "Authorization: Bearer $MD1_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isPublished":true}'
```

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

Thin wrapper around the same API for AI agents. See [MCP.md](./MCP.md).

### Recommended: hosted MCP (URL only)

No local process. Same Bearer token as curl:

```json
{
  "mcpServers": {
    "md1": {
      "url": "https://md1.space/mcp",
      "headers": {
        "Authorization": "Bearer m1_YOUR_TOKEN"
      }
    }
  }
}
```

Supports GET, POST, and DELETE (Streamable HTTP). `md1_create_from_file` is stdio-only.

### Alternative: npm / npx (stdio)

No repo clone or build. Add to any MCP host:

```json
{
  "mcpServers": {
    "md1": {
      "command": "npx",
      "args": ["-y", "md1-mcp@1.1.0"],
      "env": {
        "MD1_API_TOKEN": "m1_YOUR_TOKEN"
      }
    }
  }
}
```

Pin `md1-mcp@1.1.0` for stability. `MD1_API_URL` is optional (default `https://md1.space`).

### Typical agent flow

1. **Create and share in one step** — `md1_create_doc` with `share: true` → returns `Share link: https://md1.space/d/…`
2. **Share an existing note** — `md1_share_doc` with `query` = id, slug, or part of the title
3. **Read before sharing** — `md1_get_doc` with the same `query`

### Tools

| Tool | Purpose |
|------|---------|
| `md1_list_docs` | List notes (includes `shareUrl` when published) |
| `md1_get_doc` | Read one note by id, slug, or title fragment |
| `md1_create_doc` | Create from markdown; `share: true` publishes immediately |
| `md1_create_from_file` | Import a local `.md` / `.txt` file |
| `md1_share_doc` | Publish an existing note and return the share link |
| `md1_update_doc` | Update content or publish with `share: true` |

`md1_share_doc` and `share: true` use the same `isPublished` flow as the HTTP API above.

### From source (contributors)

```bash
cd mcp-server && npm install && npm run build
```

Use `node` + absolute path to `dist/index.js` — see `mcp.json.example` in the repo.

## Local dev

```bash
export MD1_API_URL=http://localhost:3001
export MD1_API_TOKEN=m1_...
```
