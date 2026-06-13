# md1-mcp

MCP server for [md1.space](https://md1.space) — expose your notes to AI agents (Fable, Claude Desktop, Cursor, and other MCP hosts).

Your notes stay in the cloud. This package is a **local stdio bridge** to the md1 HTTP API (same pattern as GitHub MCP).

## Quick start

1. Create a personal API token at [md1.space/settings](https://md1.space/settings) → copy `m1_…`
2. Add to your MCP host config:

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

3. Restart the MCP host.

`MD1_API_URL` is optional (defaults to `https://md1.space`). Pin the version in `args` for stability, or use `md1-mcp@latest`.

## Tools

| Tool | Purpose |
|------|---------|
| `md1_list_docs` | List notes (id, title, slug, shareUrl) |
| `md1_get_doc` | Read one note by id, slug, or title fragment |
| `md1_create_doc` | Create markdown; `share: true` publishes immediately |
| `md1_create_from_file` | Import a local `.md` / `.txt` file |
| `md1_share_doc` | Publish an existing note and return share link |
| `md1_update_doc` | Update content or publish with `share: true` |

## Local dev (md1 app)

```json
"env": {
  "MD1_API_TOKEN": "m1_…",
  "MD1_API_URL": "http://localhost:3001"
}
```

## Publish (maintainers)

From this directory, with npm auth:

```bash
npm publish --access public
```

`prepack` builds `dist/` automatically. The package is also developed inside the [md1 repo](https://github.com/nickcurator/md1).

## HTTP API

Same token works with curl — see [docs/API.md](https://github.com/nickcurator/md1/blob/main/docs/API.md) in the repo.
