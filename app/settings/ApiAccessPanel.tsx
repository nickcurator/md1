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

function curlCreateAndShareExample(base: string): string {
  return `curl -X POST ${base}/api/docs \\
  -H "Authorization: Bearer m1_YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"title":"My note","content":"# Hello\\n","isPublished":true}'`;
}

function curlShareExistingExample(base: string): string {
  return `# 1. Read the note (response includes id and slug)
curl ${base}/api/docs/NOTE_UUID \\
  -H "Authorization: Bearer m1_YOUR_TOKEN"

# 2. Publish — no separate /share route; PATCH isPublished
curl -X PATCH ${base}/api/docs/NOTE_UUID \\
  -H "Authorization: Bearer m1_YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"isPublished":true}'

# 3. Share link for anyone with the URL
# ${base}/d/SLUG_FROM_RESPONSE`;
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

function mcpToolsExample(): string {
  return `# md1_list_docs
# → all notes (id, title, slug, shareUrl when published)

# md1_get_doc
#   query: NOTE_UUID | slug | part of title
# → full note JSON

# md1_create_doc
#   content: "# Hello\\n..."
#   share: true
# → Share link: https://md1.space/d/…

# md1_create_from_file
#   path: /path/to/note.md
#   share: true

# md1_share_doc
#   query: NOTE_UUID | slug | part of title
# → publishes if needed, returns Share link

# md1_update_doc
#   id: NOTE_UUID
#   content: "…" | share: true`;
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
  const curlCreateAndShare = useMemo(
    () => curlCreateAndShareExample(base),
    [base],
  );
  const curlShareExisting = useMemo(
    () => curlShareExistingExample(base),
    [base],
  );
  const mcpConfig = useMemo(() => mcpExample(base), [base]);
  const mcpTools = useMemo(() => mcpToolsExample(), []);

  return (
    <section className="space-y-6 rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
      <div className="flex items-start gap-3">
        <Terminal size={20} className="mt-0.5 shrink-0 text-[var(--muted)]" />
        <div>
          <h2 className="text-base font-semibold text-[var(--fg)]">
            HTTP API
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

      <div className="space-y-2 text-sm text-[var(--muted)]">
        <h3 className="font-medium text-[var(--fg)]">Endpoints</h3>
        <ul className="list-inside list-disc space-y-1">
          <li>
            <code className="text-xs">GET /api/docs</code> — list your notes
          </li>
          <li>
            <code className="text-xs">GET /api/docs/[id]</code> — read one note
            (includes <code className="text-xs">slug</code> for share links)
          </li>
          <li>
            <code className="text-xs">POST /api/docs</code> — create (
            <code className="text-xs">title</code>,{" "}
            <code className="text-xs">content</code>, optional{" "}
            <code className="text-xs">isPublished</code>)
          </li>
          <li>
            <code className="text-xs">PATCH /api/docs/[id]</code> — update
            content or publish with{" "}
            <code className="text-xs">isPublished: true</code>
          </li>
          <li>
            <code className="text-xs">DELETE /api/docs/[id]</code> — delete
          </li>
        </ul>
        <p>
          There is no separate <code className="text-xs">/share</code> route —
          publishing sets <code className="text-xs">isPublished</code> on create
          or update. Public link:{" "}
          <code className="rounded bg-[var(--bg)] px-1 py-0.5 text-xs">
            /d/&#123;slug&#125;
          </code>{" "}
          (slug is in the API response).
        </p>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium">Create a note</h3>
        <CopyBlock text={curlCreate} label="Copy curl" />
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium">Create and share</h3>
        <p className="text-sm text-[var(--muted)]">
          Add <code className="text-xs">isPublished: true</code> on POST, or
          PATCH an existing note. Response includes{" "}
          <code className="text-xs">slug</code> — build{" "}
          <code className="text-xs">{base}/d/&#123;slug&#125;</code>.
        </p>
        <CopyBlock text={curlCreateAndShare} label="Copy curl" />
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium">Share an existing note</h3>
        <CopyBlock text={curlShareExisting} label="Copy curl" />
      </div>

      <p className="text-sm text-[var(--muted)]">
        Env vars:{" "}
        <code className="rounded bg-[var(--bg)] px-1 py-0.5 text-xs">
          MD1_API_TOKEN
        </code>
        , optional{" "}
        <code className="rounded bg-[var(--bg)] px-1 py-0.5 text-xs">
          MD1_API_URL
        </code>
        . Full reference:{" "}
        <code className="rounded bg-[var(--bg)] px-1 py-0.5 text-xs">
          docs/API.md
        </code>{" "}
        in the repo.
      </p>

      <div className="border-t border-[var(--border)] pt-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-[var(--fg)]">
            MCP server
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Same token. Wraps the API above for agents and chat tools — add to
            any MCP-compatible host. Build:{" "}
            <code className="rounded bg-[var(--bg)] px-1 py-0.5 text-xs">
              cd mcp-server && npm install && npm run build
            </code>
            .
          </p>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-medium">Host config</h3>
          <CopyBlock text={mcpConfig} label="Copy MCP config" />
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-medium">Tools &amp; examples</h3>
          <p className="text-sm text-[var(--muted)]">
            <code className="text-xs">md1_share_doc</code> and{" "}
            <code className="text-xs">share: true</code> on create map to the
            same publish flow as{" "}
            <code className="text-xs">isPublished</code> in the HTTP API.
          </p>
          <CopyBlock text={mcpTools} label="Copy examples" />
        </div>
      </div>
    </section>
  );
}
