"use client";

import { useState } from "react";
import { Copy, Terminal } from "lucide-react";

const MCP_EXAMPLE = `{
  "mcpServers": {
    "md1": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/md1/mcp-server/dist/index.js"],
      "env": {
        "MD1_API_TOKEN": "m1_YOUR_TOKEN_HERE",
        "MD1_API_URL": "https://md1.space"
      }
    }
  }
}`;

export default function CursorSetupPanel() {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(MCP_EXAMPLE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
      <div className="mb-4 flex items-start gap-3">
        <Terminal size={20} className="mt-0.5 shrink-0 text-[var(--muted)]" />
        <div>
          <h2 className="text-base font-semibold text-[var(--fg)]">
            Cursor MCP setup
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Add to{" "}
            <code className="rounded bg-[var(--bg)] px-1 py-0.5 text-xs">
              ~/.cursor/mcp.json
            </code>{" "}
            (or project{" "}
            <code className="rounded bg-[var(--bg)] px-1 py-0.5 text-xs">
              .cursor/mcp.json
            </code>
            ). Build the server first:{" "}
            <code className="rounded bg-[var(--bg)] px-1 py-0.5 text-xs">
              cd mcp-server && npm install && npm run build
            </code>
            .
          </p>
        </div>
      </div>

      <div className="relative">
        <pre className="overflow-x-auto rounded-md border border-[var(--border)] bg-[var(--bg)] p-4 text-xs leading-relaxed">
          {MCP_EXAMPLE}
        </pre>
        <button
          type="button"
          onClick={() => void copy()}
          className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-xs hover:bg-[var(--bg)]"
        >
          <Copy size={12} />
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <p className="mt-3 text-sm text-[var(--muted)]">
        Then in Cursor chat: &quot;отправь этот файл в md1&quot; or &quot;send
        to md1&quot;. The agent will use{" "}
        <code className="rounded bg-[var(--bg)] px-1 py-0.5 text-xs">
          md1_create_doc
        </code>{" "}
        /{" "}
        <code className="rounded bg-[var(--bg)] px-1 py-0.5 text-xs">
          md1_create_from_file
        </code>
        .
      </p>
    </section>
  );
}
