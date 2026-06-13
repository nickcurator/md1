# md1 MCP server

Connect md1 to AI agents (Fable, Claude Desktop, Cursor, and other MCP hosts).

**Your notes stay on md1.space.** Same personal API token as curl.

## 1. API token

[md1.space/settings](https://md1.space/settings) → **Create token** → copy `m1_…` (shown once).

## 2. Recommended: hosted MCP (URL only)

No Node.js, no local process. Streamable HTTP at `/mcp`:

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

Local dev: `"url": "http://localhost:3001/mcp"`

`md1_create_from_file` is not available on hosted MCP (no access to your disk) — use `md1_create_doc` with markdown content, or stdio below.

## 3. Alternative: npm / npx (stdio)

For hosts that only support command-based MCP:

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

Package: [npmjs.com/package/md1-mcp](https://www.npmjs.com/package/md1-mcp) (when published)

## 4. From source (contributors)

```bash
git clone https://github.com/nickcurator/md1.git
cd md1/mcp-server && npm install && npm run build
```

## Tools

See [API.md](./API.md#mcp-server) for the full tool list and share/publish flow.
