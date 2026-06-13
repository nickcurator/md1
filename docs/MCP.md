# md1 MCP server

Connect md1 to AI agents (Fable, Claude Desktop, Cursor, and other MCP hosts).

**Your notes stay on md1.space.** The MCP server is a small local process that calls the same HTTP API as curl — like GitHub MCP calls GitHub's API. No repo clone required when using npm.

## 1. API token

[md1.space/settings](https://md1.space/settings) → **Create token** → copy `m1_…` (shown once).

## 2. Recommended: npm / npx

No build step. Works in any MCP host that supports stdio + `npx`:

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

- Pin `md1-mcp@1.1.0` for stability, or use `@latest`
- `MD1_API_URL` is optional (default `https://md1.space`)
- Local app dev: `"MD1_API_URL": "http://localhost:3001"`

Package: [npmjs.com/package/md1-mcp](https://www.npmjs.com/package/md1-mcp)

## 3. From source (contributors)

```bash
git clone https://github.com/nickcurator/md1.git
cd md1/mcp-server && npm install && npm run build
```

```json
{
  "command": "node",
  "args": ["/ABSOLUTE/PATH/TO/md1/mcp-server/dist/index.js"],
  "env": {
    "MD1_API_TOKEN": "m1_YOUR_TOKEN"
  }
}
```

## Tools

See [API.md](./API.md#mcp-server) for the full tool list and share/publish flow.

## Hosted MCP (planned)

Streamable HTTP MCP at `https://md1.space/mcp` with the same Bearer token — no local process. Not available yet.
