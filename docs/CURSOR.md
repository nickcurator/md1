# Cursor + md1

Send notes from Cursor chat: *«отправь этот файл в md1»*.

## 1. Database migration

Run `supabase/migrations/030_drive_api_tokens.sql` in the md1 Supabase SQL editor (once).

## 2. Deploy md1

Push and deploy so `/settings` and Bearer auth on `/api/docs` are live.

## 3. API token

1. Open [md1.space/settings](https://md1.space/settings)
2. **Create token** → copy `m1_…` (shown once)

## 4. MCP server

```bash
cd mcp-server
npm install
npm run build
```

## 5. Cursor config

Copy `mcp.json.example` → `~/.cursor/mcp.json` (merge if you already have servers).

Set:
- `args[0]` → absolute path to `mcp-server/dist/index.js`
- `MD1_API_TOKEN` → your token

Restart Cursor.

## Tools

| Tool | Use |
|------|-----|
| `md1_create_from_file` | Send a local `.md` file |
| `md1_create_doc` | Send markdown text |
| `md1_list_docs` | List your notes |
| `md1_update_doc` | Patch by id |

## Local dev

Use `MD1_API_URL=http://localhost:3001` in MCP env when running `npm run dev`.
