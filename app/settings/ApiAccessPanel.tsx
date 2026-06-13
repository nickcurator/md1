"use client";

import { useMemo, useState } from "react";
import { Copy } from "lucide-react";

const MCP_PACKAGE = "md1-mcp@1.1.0";

type Tab = "api" | "mcp";

function apiBaseUrl(): string {
  if (typeof window !== "undefined" && window.location.origin) {
    return window.location.origin;
  }
  return "https://md1.space";
}

function apiExample(base: string): string {
  return `# Auth on every request
Authorization: Bearer m1_YOUR_TOKEN

# ${base}/api/docs
GET    — list notes
GET    /{id} — read one note
POST   — create (title, content, isPublished)
PATCH  /{id} — update or publish
DELETE /{id} — delete

# Share link after publish: ${base}/d/{slug}

curl -s -X POST ${base}/api/docs \\
  -H "Authorization: Bearer m1_YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"title":"My note","content":"# Hello\\n","isPublished":true}'`;
}

function mcpHostedExample(base: string): string {
  return `{
  "mcpServers": {
    "md1": {
      "url": "${base}/mcp",
      "headers": {
        "Authorization": "Bearer m1_YOUR_TOKEN"
      }
    }
  }
}`;
}

function mcpNpxExample(base: string): string {
  return `{
  "mcpServers": {
    "md1": {
      "command": "npx",
      "args": ["-y", "${MCP_PACKAGE}"],
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

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "bg-[var(--fg)] text-[var(--bg)]"
          : "text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--fg)]"
      }`}
    >
      {children}
    </button>
  );
}

export default function ApiAccessPanel() {
  const base = useMemo(() => apiBaseUrl(), []);
  const [tab, setTab] = useState<Tab>("mcp");
  const apiSnippet = useMemo(() => apiExample(base), [base]);
  const mcpHosted = useMemo(() => mcpHostedExample(base), [base]);
  const mcpNpx = useMemo(() => mcpNpxExample(base), [base]);

  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--fg)]">Connect</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            One token above — pick API or MCP.
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] p-1">
          <TabButton active={tab === "api"} onClick={() => setTab("api")}>
            API
          </TabButton>
          <TabButton active={tab === "mcp"} onClick={() => setTab("mcp")}>
            MCP
          </TabButton>
        </div>
      </div>

      {tab === "api" ? (
        <div className="mt-5 space-y-3">
          <p className="text-sm text-[var(--muted)]">
            HTTP for curl, scripts, CI, Shortcuts, Raycast, or your own code.
          </p>
          <CopyBlock text={apiSnippet} label="Copy" />
          <p className="text-xs text-[var(--muted)]">
            Full reference:{" "}
            <code className="rounded bg-[var(--bg)] px-1 py-0.5">
              docs/API.md
            </code>{" "}
            in the repo.
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          <p className="text-sm text-[var(--muted)]">
            AI agents — Fable, Claude Desktop, and other MCP hosts. Paste into
            your MCP config; replace{" "}
            <code className="text-xs">m1_YOUR_TOKEN</code> with a token from
            above.
          </p>
          <CopyBlock text={mcpHosted} label="Copy" />
          <details className="rounded-md border border-[var(--border)] bg-[var(--bg)]">
            <summary className="cursor-pointer px-3 py-2.5 text-sm text-[var(--muted)] hover:text-[var(--fg)]">
              Host needs stdio instead of URL
            </summary>
            <div className="border-t border-[var(--border)] p-3">
              <CopyBlock text={mcpNpx} label="Copy npx" />
            </div>
          </details>
          <p className="text-xs text-[var(--muted)]">
            Tools: list, read, create, share notes. Details in{" "}
            <code className="rounded bg-[var(--bg)] px-1 py-0.5">
              docs/MCP.md
            </code>
            .
          </p>
        </div>
      )}
    </section>
  );
}
