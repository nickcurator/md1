"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Archive,
  Check,
  FileText,
  Inbox,
  Loader2,
  Mail,
  Plus,
  RefreshCw,
  Search,
  Send,
  Star,
  Trash2,
} from "lucide-react";
import AppLogo from "@/components/AppLogo";
import type { DriveUser } from "@/lib/drive-users-server";
import {
  folderKindLabel,
  formatRecipient,
  providerLabel,
  type MailAccount,
  type MailFolder,
  type MailFolderKind,
  type MailMessage,
  type MailThread,
  type MailWorkspace,
} from "@/lib/mail";
import DriveProfileButton from "../DriveProfileButton";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return new Intl.DateTimeFormat(undefined, sameDay
    ? { hour: "2-digit", minute: "2-digit" }
    : { month: "short", day: "numeric" }).format(date);
}

function folderIcon(kind: MailFolderKind, size = 16) {
  if (kind === "inbox") return <Inbox size={size} />;
  if (kind === "sent") return <Send size={size} />;
  if (kind === "drafts") return <FileText size={size} />;
  if (kind === "trash" || kind === "spam") return <Trash2 size={size} />;
  if (kind === "starred") return <Star size={size} />;
  if (kind === "archive") return <Archive size={size} />;
  return <Mail size={size} />;
}

const ESSENTIAL_LABELS = new Set(["INBOX", "SENT"]);
const MAILBOX_ORDER = ["INBOX", "STARRED", "SENT", "DRAFT", "SPAM", "TRASH"];
const HIDDEN_SYSTEM_LABELS = new Set([
  "CHAT",
  "IMPORTANT",
  "UNREAD",
  "YELLOW_STAR",
  "SNOOZED",
]);

function folderDisplayName(folder: MailFolder): string {
  const categoryName = categoryLabelName(folder.providerFolderId);
  if (categoryName) return categoryName;
  return folder.kind === "custom" ? folder.name : folderKindLabel(folder.kind);
}

function mailboxRank(folder: MailFolder): number {
  const rank = MAILBOX_ORDER.indexOf(folder.providerFolderId);
  return rank === -1 ? 100 : rank;
}

function categoryLabelName(providerFolderId: string): string | null {
  switch (providerFolderId) {
    case "CATEGORY_PERSONAL":
      return "Personal";
    case "CATEGORY_SOCIAL":
      return "Social";
    case "CATEGORY_PROMOTIONS":
      return "Promotions";
    case "CATEGORY_UPDATES":
      return "Updates";
    case "CATEGORY_FORUMS":
      return "Forums";
    default:
      return null;
  }
}

function accountName(account: MailAccount): string {
  return account.displayName.trim() || account.email.split("@")[0] || account.email;
}

function threadSender(thread: MailThread): string {
  const first = thread.participants[0];
  return first ? formatRecipient(first) : "Unknown sender";
}

function messageSender(message: MailMessage): string {
  return message.fromName || message.fromEmail || "Unknown sender";
}

function messageRecipients(recipients: MailMessage["toRecipients"]): string {
  return recipients.map(formatRecipient).join(", ");
}

export default function MailClient({
  user,
  isAdmin = false,
  workspace,
  initialAccountId,
  oauthError,
}: {
  user: DriveUser;
  isAdmin?: boolean;
  workspace: MailWorkspace;
  initialAccountId: string | null;
  oauthError: string | null;
}) {
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    initialAccountId ?? workspace.accounts[0]?.id ?? null,
  );
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [uiError, setUiError] = useState<string | null>(oauthError);

  const selectedAccount =
    workspace.accounts.find((account) => account.id === selectedAccountId) ??
    workspace.accounts[0] ??
    null;

  const accountThreadLabelCounts = useMemo(() => {
    const counts = new Map<string, number>();
    if (!selectedAccount) return counts;
    for (const thread of workspace.threads) {
      if (thread.accountId !== selectedAccount.id) continue;
      for (const label of thread.labels) {
        counts.set(label, (counts.get(label) ?? 0) + 1);
      }
    }
    return counts;
  }, [selectedAccount, workspace.threads]);

  const accountFolderGroups = useMemo(() => {
    const folders = selectedAccount
      ? workspace.folders.filter((folder) => folder.accountId === selectedAccount.id)
      : [];
    const visible = folders.filter((folder) => {
      if (HIDDEN_SYSTEM_LABELS.has(folder.providerFolderId)) return false;
      if (ESSENTIAL_LABELS.has(folder.providerFolderId)) return true;
      return (accountThreadLabelCounts.get(folder.providerFolderId) ?? 0) > 0;
    });
    return {
      mailboxes: visible
        .filter((folder) => folder.kind !== "custom")
        .sort((a, b) => mailboxRank(a) - mailboxRank(b)),
      categories: visible
        .filter((folder) => folder.providerFolderId.startsWith("CATEGORY_"))
        .sort((a, b) => folderDisplayName(a).localeCompare(folderDisplayName(b))),
      labels: visible
        .filter(
          (folder) =>
            folder.kind === "custom" &&
            !folder.providerFolderId.startsWith("CATEGORY_"),
        )
        .sort((a, b) => folderDisplayName(a).localeCompare(folderDisplayName(b))),
    };
  }, [accountThreadLabelCounts, selectedAccount, workspace.folders]);

  const accountFolders = useMemo(
    () => [
      ...accountFolderGroups.mailboxes,
      ...accountFolderGroups.categories,
      ...accountFolderGroups.labels,
    ],
    [accountFolderGroups],
  );

  const defaultFolderId =
    accountFolders.find((folder) => folder.kind === "inbox")?.id ??
    accountFolders[0]?.id ??
    null;

  useEffect(() => {
    if (!selectedAccount) {
      setSelectedFolderId(null);
      setSelectedThreadId(null);
      return;
    }
    if (
      selectedFolderId !== null &&
      !accountFolders.some((folder) => folder.id === selectedFolderId)
    ) {
      setSelectedFolderId(defaultFolderId);
    }
  }, [accountFolders, defaultFolderId, selectedAccount, selectedFolderId]);

  const activeFolderId = selectedFolderId ?? defaultFolderId;
  const activeFolder =
    accountFolders.find((folder) => folder.id === activeFolderId) ?? null;
  const normalizedQuery = query.trim().toLowerCase();

  const visibleThreads = useMemo(() => {
    if (!selectedAccount) return [];
    return workspace.threads.filter((thread) => {
      if (thread.accountId !== selectedAccount.id) return false;
      if (
        activeFolder &&
        !thread.labels.includes(activeFolder.providerFolderId)
      ) {
        return false;
      }
      if (!normalizedQuery) return true;
      const haystack = [
        thread.subject,
        thread.snippet,
        thread.participants.map(formatRecipient).join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [activeFolder, normalizedQuery, selectedAccount, workspace.threads]);

  useEffect(() => {
    if (!visibleThreads.length) {
      setSelectedThreadId(null);
      return;
    }
    if (!visibleThreads.some((thread) => thread.id === selectedThreadId)) {
      setSelectedThreadId(visibleThreads[0].id);
    }
  }, [selectedThreadId, visibleThreads]);

  const selectedThread =
    visibleThreads.find((thread) => thread.id === selectedThreadId) ??
    visibleThreads[0] ??
    null;
  const selectedMessages = selectedThread
    ? workspace.messages
        .filter((message) => message.threadId === selectedThread.id)
        .sort((a, b) => {
          const aTime = a.receivedAt ? new Date(a.receivedAt).getTime() : 0;
          const bTime = b.receivedAt ? new Date(b.receivedAt).getTime() : 0;
          return aTime - bTime;
        })
    : [];
  const selectedMessage = selectedMessages[selectedMessages.length - 1] ?? null;

  async function syncAccount(accountId: string) {
    setSyncingAccountId(accountId);
    setUiError(null);
    try {
      const res = await fetch("/api/mail/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accountId }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || `Sync failed (${res.status})`);
      window.location.reload();
    } catch (err) {
      setUiError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncingAccountId(null);
    }
  }

  async function removeAccount(accountId: string) {
    if (!window.confirm("Remove this mail account from md1?")) return;
    setPendingAction(`remove:${accountId}`);
    setUiError(null);
    try {
      const res = await fetch(`/api/mail/accounts/${accountId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`Remove failed (${res.status})`);
      window.location.href = "/mail";
    } catch (err) {
      setUiError(err instanceof Error ? err.message : "Remove failed");
      setPendingAction(null);
    }
  }

  async function runMessageAction(action: string) {
    if (!selectedMessage) return;
    setPendingAction(action);
    setUiError(null);
    try {
      const res = await fetch(`/api/mail/messages/${selectedMessage.id}/action`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || `Action failed (${res.status})`);
      window.location.reload();
    } catch (err) {
      setUiError(err instanceof Error ? err.message : "Action failed");
      setPendingAction(null);
    }
  }

  const threadTitle = selectedThread?.subject || "Mail";
  const folderTitle =
    activeFolder?.kind === "custom"
      ? (activeFolder ? folderDisplayName(activeFolder) : "All mail")
      : activeFolder
        ? folderKindLabel(activeFolder.kind)
        : "All mail";

  function renderFolderButton(folder: MailFolder) {
    const selected = activeFolderId === folder.id;
    const count = accountThreadLabelCounts.get(folder.providerFolderId) ?? 0;
    return (
      <button
        key={folder.id}
        type="button"
        onClick={() => setSelectedFolderId(folder.id)}
        className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
          selected
            ? "bg-[var(--card)] text-[var(--fg)]"
            : "text-[var(--muted)] hover:bg-[var(--card)]/80 hover:text-[var(--fg)]"
        }`}
      >
        {folderIcon(folder.kind)}
        <span className="min-w-0 flex-1 truncate">
          {folderDisplayName(folder)}
        </span>
        {count > 0 && <span className="text-xs tabular-nums">{count}</span>}
      </button>
    );
  }

  return (
    <div className="flex h-full min-h-0 bg-[var(--bg)] text-[var(--fg)]">
      <aside className="flex h-full w-[280px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg)]">
        <div className="border-b border-[var(--border)] px-3 py-4">
          <AppLogo className="px-2" />
        </div>

        <div className="border-b border-[var(--border)] p-2">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-[var(--muted)] hover:bg-[var(--card)] hover:text-[var(--fg)]"
          >
            <FileText size={15} />
            <span className="min-w-0 flex-1 truncate">Notes</span>
          </Link>
          <div className="mt-0.5 flex items-center gap-2 rounded-md bg-[var(--card)] px-2 py-1.5 text-sm text-[var(--fg)]">
            <Mail size={15} />
            <span className="min-w-0 flex-1 truncate">Mail</span>
          </div>
        </div>

        <div className="border-b border-[var(--border)] p-2">
          <div className="mb-1 flex items-center justify-between px-2">
            <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
              Accounts
            </h2>
            <a
              href="/api/mail/google/start"
              title="Connect Gmail"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--card)] hover:text-[var(--fg)]"
            >
              <Plus size={15} />
            </a>
          </div>
          <div className="space-y-0.5">
            {workspace.accounts.length === 0 ? (
              <a
                href="/api/mail/google/start"
                className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-[var(--muted)] hover:bg-[var(--card)] hover:text-[var(--fg)]"
              >
                <Mail size={15} />
                <span className="min-w-0 flex-1 truncate">Connect Gmail</span>
              </a>
            ) : (
              workspace.accounts.map((account) => {
                const selected = selectedAccount?.id === account.id;
                const busy = syncingAccountId === account.id;
                return (
                  <div
                    key={account.id}
                    className={`group flex items-center gap-1 rounded-md ${
                      selected
                        ? "bg-[var(--card)] text-[var(--fg)]"
                        : "text-[var(--muted)] hover:bg-[var(--card)]/80 hover:text-[var(--fg)]"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAccountId(account.id);
                        setSelectedFolderId(null);
                        setSelectedThreadId(null);
                      }}
                      className="min-w-0 flex-1 px-2 py-1.5 text-left"
                    >
                      <span className="block truncate text-sm font-medium">
                        {accountName(account)}
                      </span>
                      <span className="block truncate text-[11px] text-[var(--muted)]">
                        {providerLabel(account.provider)} · {account.email}
                      </span>
                    </button>
                    <button
                      type="button"
                      title="Sync"
                      disabled={busy}
                      onClick={() => void syncAccount(account.id)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--fg)] disabled:opacity-50"
                    >
                      <RefreshCw size={14} className={busy ? "animate-spin" : ""} />
                    </button>
                    <button
                      type="button"
                      title="Remove account"
                      disabled={pendingAction === `remove:${account.id}`}
                      onClick={() => void removeAccount(account.id)}
                      className="mr-1 inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted)] opacity-0 hover:bg-[var(--bg)] hover:text-red-500 group-hover:opacity-100 disabled:opacity-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {selectedAccount ? (
            <div className="space-y-4">
              {accountFolderGroups.mailboxes.length > 0 && (
                <div>
                  <div className="mb-1 px-2 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                    Mailboxes
                  </div>
                  <div className="space-y-0.5">
                    {accountFolderGroups.mailboxes.map(renderFolderButton)}
                  </div>
                </div>
              )}
              {accountFolderGroups.categories.length > 0 && (
                <div>
                  <div className="mb-1 px-2 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                    Categories
                  </div>
                  <div className="space-y-0.5">
                    {accountFolderGroups.categories.map(renderFolderButton)}
                  </div>
                </div>
              )}
              {accountFolderGroups.labels.length > 0 && (
                <div>
                  <div className="mb-1 px-2 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                    Labels
                  </div>
                  <div className="space-y-0.5">
                    {accountFolderGroups.labels.map(renderFolderButton)}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="px-2 py-4 text-xs text-[var(--muted)]">
              No accounts connected.
            </p>
          )}
        </div>

        <div className="mt-auto border-t border-[var(--border)] p-3">
          <DriveProfileButton user={user} isAdmin={isAdmin} />
        </div>
      </aside>

      <section className="flex h-full w-[360px] shrink-0 flex-col border-r border-[var(--border)]">
        <div className="border-b border-[var(--border)] p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold">{folderTitle}</h1>
              {selectedAccount && (
                <p className="truncate text-xs text-[var(--muted)]">
                  {selectedAccount.email}
                </p>
              )}
            </div>
            {selectedAccount && (
              <button
                type="button"
                title="Sync"
                disabled={syncingAccountId === selectedAccount.id}
                onClick={() => void syncAccount(selectedAccount.id)}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--card)] hover:text-[var(--fg)] disabled:opacity-50"
              >
                <RefreshCw
                  size={16}
                  className={
                    syncingAccountId === selectedAccount.id ? "animate-spin" : ""
                  }
                />
              </button>
            )}
          </div>
          <label className="mt-3 flex h-9 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 text-sm">
            <Search size={15} className="shrink-0 text-[var(--muted)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search mail"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--muted)]"
            />
          </label>
          {uiError && (
            <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
              {uiError}
            </div>
          )}
          {workspace.setupError && (
            <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
              {workspace.setupError}
            </div>
          )}
        </div>

        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto p-2">
          {!selectedAccount ? (
            <div className="px-3 py-8 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] text-[var(--muted)]">
                <Mail size={18} />
              </div>
              <a
                href="/api/mail/google/start"
                className="mt-4 inline-flex items-center gap-2 rounded-md bg-[var(--fg)] px-3 py-2 text-sm font-medium text-[var(--bg)]"
              >
                <Plus size={15} />
                Connect Gmail
              </a>
            </div>
          ) : visibleThreads.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-[var(--muted)]">
              No messages here.
            </p>
          ) : (
            <ul className="space-y-0.5">
              {visibleThreads.map((thread) => {
                const selected = selectedThread?.id === thread.id;
                return (
                  <li key={thread.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedThreadId(thread.id)}
                      className={`w-full rounded-lg px-3 py-2 text-left transition-colors ${
                        selected
                          ? "bg-[var(--card)] ring-1 ring-[var(--border)]"
                          : "hover:bg-[var(--card)]/80"
                      }`}
                    >
                      <span className="flex items-start gap-2">
                        <span className="min-w-0 flex-1">
                          <span
                            className={`block truncate text-sm ${
                              thread.unread ? "font-semibold" : "font-medium"
                            }`}
                          >
                            {threadSender(thread)}
                          </span>
                          <span
                            className={`mt-0.5 block truncate text-sm ${
                              thread.unread
                                ? "font-semibold text-[var(--fg)]"
                                : "text-[var(--fg)]"
                            }`}
                          >
                            {thread.subject}
                          </span>
                        </span>
                        <span className="shrink-0 text-[11px] text-[var(--muted)]">
                          {formatDate(thread.lastMessageAt)}
                        </span>
                      </span>
                      <span className="mt-1 flex items-center gap-1.5">
                        {thread.starred && (
                          <Star
                            size={12}
                            className="shrink-0 fill-yellow-400 text-yellow-500"
                          />
                        )}
                        <span className="line-clamp-2 text-xs leading-relaxed text-[var(--muted)]">
                          {thread.snippet}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <main className="flex h-full min-w-0 flex-1 flex-col">
        <div className="flex min-h-[57px] items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold">{threadTitle}</h2>
            {selectedMessage && (
              <p className="truncate text-xs text-[var(--muted)]">
                {messageSender(selectedMessage)} · {formatDate(selectedMessage.receivedAt)}
              </p>
            )}
          </div>
          {selectedMessage && (
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                title={selectedMessage.starred ? "Unstar" : "Star"}
                disabled={!!pendingAction}
                onClick={() =>
                  void runMessageAction(selectedMessage.starred ? "unstar" : "star")
                }
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--card)] hover:text-[var(--fg)] disabled:opacity-50"
              >
                <Star
                  size={16}
                  className={
                    selectedMessage.starred
                      ? "fill-yellow-400 text-yellow-500"
                      : ""
                  }
                />
              </button>
              <button
                type="button"
                title={selectedMessage.unread ? "Mark read" : "Mark unread"}
                disabled={!!pendingAction}
                onClick={() =>
                  void runMessageAction(
                    selectedMessage.unread ? "mark_read" : "mark_unread",
                  )
                }
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--card)] hover:text-[var(--fg)] disabled:opacity-50"
              >
                <Check size={16} />
              </button>
              <button
                type="button"
                title="Archive"
                disabled={!!pendingAction}
                onClick={() => void runMessageAction("archive")}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--card)] hover:text-[var(--fg)] disabled:opacity-50"
              >
                <Archive size={16} />
              </button>
              <button
                type="button"
                title="Trash"
                disabled={!!pendingAction}
                onClick={() => void runMessageAction("trash")}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--card)] hover:text-red-500 disabled:opacity-50"
              >
                {pendingAction ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Trash2 size={16} />
                )}
              </button>
            </div>
          )}
        </div>

        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
          {!selectedAccount ? (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-[var(--muted)]">
              Connect a Gmail account to start.
            </div>
          ) : !selectedMessage ? (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-[var(--muted)]">
              Select a message.
            </div>
          ) : (
            <article className="mx-auto max-w-3xl px-6 py-8">
              <header className="border-b border-[var(--border)] pb-5">
                <h1 className="text-2xl font-semibold">{selectedMessage.subject}</h1>
                <div className="mt-4 flex flex-col gap-1 text-sm">
                  <div>
                    <span className="text-[var(--muted)]">From </span>
                    <span>{messageSender(selectedMessage)}</span>
                    {selectedMessage.fromEmail && (
                      <span className="text-[var(--muted)]">
                        {" "}
                        &lt;{selectedMessage.fromEmail}&gt;
                      </span>
                    )}
                  </div>
                  {selectedMessage.toRecipients.length > 0 && (
                    <div className="truncate">
                      <span className="text-[var(--muted)]">To </span>
                      <span>{messageRecipients(selectedMessage.toRecipients)}</span>
                    </div>
                  )}
                  <div className="text-[var(--muted)]">
                    {selectedMessage.receivedAt
                      ? new Intl.DateTimeFormat(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(selectedMessage.receivedAt))
                      : ""}
                  </div>
                </div>
              </header>

              <div className="whitespace-pre-wrap py-6 text-[15px] leading-7">
                {selectedMessage.bodyText || selectedMessage.snippet}
              </div>
            </article>
          )}
        </div>
      </main>
    </div>
  );
}
