"use client";

import { useMemo, useState } from "react";
import { Copy, Terminal } from "lucide-react";

function apiBaseUrl(): string {
  if (typeof window !== "undefined" && window.location.origin) {
    return window.location.origin;
  }
  return "https://md1.space";
}

function curlCreateExample(base: string): string {
  return `curl -X POST ${base}/api/docs \\
  -H "Authorization: Bearer m1_YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"title":"My note","content":"# Hello\\n"}'`;
}

function mcpExample(base: string): string {
  return `{
  "mcpServers": {
    "md1": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/md1/mcp-server/dist/index.js"],
      "env": {
        "MD1_API_TOKEN": "m1_YOUR_TOKEN",
        "MD1_API_URL": "${base}"
      }
    }
  }
}`;
}

function CopyBlock({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-md border border-[var(--border)] bg-[var(--bg)] p-4 text-xs leading-relaxed">
        {text}
      </pre>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-xs hover:bg-[var(--bg)]"
      >
        <Copy size={12} />
        {copied ? "Copied" : label}
      </button>
    </div>
  );
}

export default function ApiAccessPanel() {
  const base = useMemo(() => apiBaseUrl(), []);
  const curlCreate = useMemo(() => curlCreateExample(base), [base]);
  const mcpConfig = useMemo(() => mcpExample(base), [base]);

  return (
    <section className="space-y-6 rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
      <div className="flex items-start gap-3">
        <Terminal size={20} className="mt-0.5 shrink-0 text-[var(--muted)]" />
        <div>
          <h2 className="text-base font-semibold text-[var(--fg)]">
            Use the API anywhere
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Same token works in curl, your own scripts, CI, Shortcuts, Raycast,
            or any HTTP client. Pass{" "}
            <code className="rounded bg-[var(--bg)] px-1 py-0.5 text-xs">
              Authorization: Bearer m1_…
            </code>{" "}
            on{" "}
            <code className="rounded bg-[var(--bg)] px-1 py-0.5 text-xs">
              /api/docs
            </code>
            .
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium">Create a note</h3>
        <CopyBlock text={curlCreate} label="Copy curl" />
      </div>

      <div className="space-y-2 text-sm text-[var(--muted)]">
        <h3 className="font-medium text-[var(--fg)]">Endpoints</h3>
        <ul className="list-inside list-disc space-y-1">
          <li>
            <code className="text-xs">GET /api/docs</code> — list your notes
          </li>
          <li>
            <code className="text-xs">POST /api/docs</code> — create (
            <code className="text-xs">title</code>, <code className="text-xs">content</code>
            )
          </li>
          <li>
            <code className="text-xs">PATCH /api/docs/[id]</code> — update
          </li>
          <li>
            <code className="text-xs">DELETE /api/docs/[id]</code> — delete
          </li>
        </ul>
        <p>
          Env vars for tooling:{" "}
          <code className="rounded bg-[var(--bg)] px-1 py-0.5 text-xs">
            MD1_API_TOKEN
          </code>
          , optional{" "}
          <code className="rounded bg-[var(--bg)] px-1 py-0.5 text-xs">
            MD1_API_URL
          </code>{" "}
          (defaults to production). Full reference:{" "}
          <code className="rounded bg-[var(--bg)] px-1 py-0.5 text-xs">
            docs/API.md
          </code>{" "}
          in the repo.
        </p>
      </div>

      <details className="group rounded-md border border-[var(--border)] bg-[var(--bg)]">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
          Optional: Cursor MCP
        </summary>
        <div className="space-y-3 border-t border-[var(--border)] px-4 py-4">
          <p className="text-sm text-[var(--muted)]">
            For Cursor chat (&quot;send to md1&quot;), add the bundled MCP server
            to{" "}
            <code className="rounded bg-[var(--card)] px-1 py-0.5 text-xs">
              ~/.cursor/mcp.json
            </code>
            . Build:{" "}
            <code className="rounded bg-[var(--card)] px-1 py-0.5 text-xs">
              cd mcp-server && npm install && npm run build
            </code>
            .
          </p>
          <CopyBlock text={mcpConfig} label="Copy MCP config" />
        </div>
      </details>
    </section>
  );
}
