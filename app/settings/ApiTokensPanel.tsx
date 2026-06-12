"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Key, Plus, Trash2 } from "lucide-react";
import type { ApiTokenMeta } from "@/lib/api-tokens";

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function ApiTokensPanel() {
  const [tokens, setTokens] = useState<ApiTokenMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("Cursor");
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tokens");
      if (!res.ok) throw new Error(`Failed to load tokens (${res.status})`);
      const data = (await res.json()) as { tokens: ApiTokenMeta[] };
      setTokens(data.tokens);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load tokens");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createToken = async () => {
    setBusy(true);
    setError(null);
    setRevealedToken(null);
    try {
      const res = await fetch("/api/tokens", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: newName.trim() || "API token" }),
      });
      const data = (await res.json()) as {
        token?: ApiTokenMeta;
        plain?: string;
        error?: string;
      };
      if (!res.ok || !data.token || !data.plain) {
        throw new Error(data.error || `Create failed (${res.status})`);
      }
      setTokens((prev) => [data.token!, ...prev]);
      setRevealedToken(data.plain);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create token");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    if (!confirm("Revoke this token? Tools using it will stop working.")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/tokens/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Revoke failed (${res.status})`);
      setTokens((prev) => prev.filter((t) => t.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to revoke token");
    } finally {
      setBusy(false);
    }
  };

  const copyToken = async () => {
    if (!revealedToken) return;
    await navigator.clipboard.writeText(revealedToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
      <div className="mb-4 flex items-start gap-3">
        <Key size={20} className="mt-0.5 shrink-0 text-[var(--muted)]" />
        <div>
          <h2 className="text-base font-semibold text-[var(--fg)]">API tokens</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            For Cursor, scripts, and automations. Paste the token into your MCP
            config — it is shown only once.
          </p>
        </div>
      </div>

      {revealedToken && (
        <div className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 p-4">
          <p className="mb-2 text-sm font-medium text-[var(--fg)]">
            Copy your token now — you won&apos;t see it again
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded bg-[var(--bg)] px-2 py-1.5 text-xs">
              {revealedToken}
            </code>
            <button
              type="button"
              onClick={() => void copyToken()}
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-sm hover:bg-[var(--card)]"
            >
              <Copy size={14} />
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <label className="flex min-w-[160px] flex-1 flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Token name</span>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Cursor"
            className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--fg)] outline-none focus:ring-2 focus:ring-[var(--fg)]/20"
            disabled={busy}
          />
        </label>
        <button
          type="button"
          onClick={() => void createToken()}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md bg-[var(--fg)] px-4 py-2 text-sm font-medium text-[var(--bg)] disabled:opacity-50"
        >
          <Plus size={16} />
          Create token
        </button>
      </div>

      {error && (
        <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {loading ? (
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      ) : tokens.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No tokens yet.</p>
      ) : (
        <ul className="divide-y divide-[var(--border)] rounded-md border border-[var(--border)]">
          {tokens.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between gap-3 px-3 py-2.5"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{t.name}</div>
                <div className="text-xs text-[var(--muted)]">
                  <code>{t.tokenPrefix}…</code>
                  {" · "}
                  Created {formatDate(t.createdAt)}
                  {t.lastUsedAt
                    ? ` · Last used ${formatDate(t.lastUsedAt)}`
                    : ""}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void revoke(t.id)}
                disabled={busy}
                className="shrink-0 rounded-md p-2 text-[var(--muted)] hover:bg-[var(--bg)] hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50"
                title="Revoke token"
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
