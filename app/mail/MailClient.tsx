"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Archive,
  Check,
  CheckSquare,
  Download,
  FileText,
  Forward,
  Inbox,
  Loader2,
  Mail,
  Paperclip,
  PencilLine,
  Plus,
  RefreshCw,
  Reply,
  Search,
  Send,
  Square,
  Star,
  Trash2,
  X,
} from "lucide-react";
import AppLogo from "@/components/AppLogo";
import type { DriveUser } from "@/lib/drive-users-server";
import {
  applyMailActionToLabels,
  folderKindLabel,
  formatRecipient,
  providerLabel,
  type MailAccount,
  type MailAttachment,
  type MailFolder,
  type MailFolderKind,
  type MailMessageAction,
  type MailMessage,
  type MailRecipient,
  type MailThread,
  type MailWorkspace,
} from "@/lib/mail";
import { cleanMailText } from "@/lib/mail-text";
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

function plural(value: number, singular: string, pluralWord = `${singular}s`): string {
  return `${value} ${value === 1 ? singular : pluralWord}`;
}

function compactCount(value: number): string {
  return new Intl.NumberFormat(undefined, {
    notation: value >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
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
const ALL_MAIL_FOLDER_ID = "__all_mail__";
const ALL_MAIL_EXCLUDED_LABELS = new Set(["TRASH", "SPAM", "DRAFT"]);
const MAX_COMPOSE_ATTACHMENTS = 8;
const MAX_COMPOSE_ATTACHMENT_BYTES = 4 * 1024 * 1024;
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

function threadBelongsToAllMail(thread: MailThread): boolean {
  return !thread.labels.some((label) => ALL_MAIL_EXCLUDED_LABELS.has(label));
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

function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`;
  const kb = size / 1024;
  if (kb < 1024) return `${kb.toFixed(kb >= 100 ? 0 : 1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb >= 100 ? 0 : 1)} MB`;
}

function attachmentLabel(attachment: MailAttachment): string {
  const size = attachment.size;
  if (typeof size !== "number" || !Number.isFinite(size) || size <= 0) {
    return attachment.mimeType;
  }
  return `${attachment.mimeType} · ${formatFileSize(size)}`;
}

function attachmentDownloadHref(
  message: MailMessage,
  attachment: MailAttachment,
): string | null {
  const id = attachment.providerAttachmentId || attachment.id;
  if (!attachment.providerAttachmentId || !id) return null;
  return `/api/mail/messages/${encodeURIComponent(
    message.id,
  )}/attachments/${encodeURIComponent(id)}`;
}

function gmailSyncCursorKey(folder: MailFolder | null): string {
  return folder?.providerFolderId ?? "ALL";
}

function hasMoreSyncedMail(
  account: MailAccount | null,
  folder: MailFolder | null,
): boolean {
  const raw = account?.syncState.gmailHasMoreByLabel;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return true;
  const value = (raw as Record<string, unknown>)[gmailSyncCursorKey(folder)];
  return typeof value === "boolean" ? value : true;
}

const BARE_URL_PATTERN = /https?:\/\/[^\s<>"']+/gi;
const MARKDOWN_LINK_PATTERN = /\[([^\]]{1,160})\]\((https?:\/\/[^\s)]+)\)/gi;
const PARENTHESIZED_URL_PATTERN =
  /([^\n()[\]]{2,120}?)\s*\(\s*(https?:\/\/[^\s)]+)\s*\)/gi;
const TRAILING_URL_PUNCTUATION = /[),.;:!?]+$/;

function safeHttpUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function normalizeMailDisplayText(input: string): string {
  return cleanMailText(input)
    .replace(/(?:(?:&zwnj;|&#8204;|\u200c)\s*){3,}/gi, " ")
    .replace(PARENTHESIZED_URL_PATTERN, (match, label, url) => {
      const href = safeHttpUrl(url);
      const text = String(label).replace(/^[\s,.;:!?-]+/, "").trim();
      if (!href || text.length < 2) return match;
      return `[${text}](${href})`;
    })
    .replace(/\)(?=[A-ZА-Я])/g, ") ");
}

function trimUrlToken(token: string): { url: string; suffix: string } {
  let url = token;
  let suffix = "";
  while (TRAILING_URL_PUNCTUATION.test(url)) {
    suffix = `${url.at(-1) ?? ""}${suffix}`;
    url = url.slice(0, -1);
  }
  return { url, suffix };
}

function renderAnchor(href: string, children: ReactNode, key: string) {
  return (
    <a
      key={key}
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="break-words text-blue-400 underline decoration-blue-400/40 underline-offset-2 hover:text-blue-300 hover:decoration-blue-300"
    >
      {children}
    </a>
  );
}

function renderBareLinks(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(BARE_URL_PATTERN)) {
    const token = match[0];
    const start = match.index ?? 0;
    if (start > lastIndex) nodes.push(text.slice(lastIndex, start));

    const { url, suffix } = trimUrlToken(token);
    const href = safeHttpUrl(url);
    nodes.push(
      href ? renderAnchor(href, url, `${keyPrefix}-url-${start}`) : token,
    );
    if (suffix) nodes.push(suffix);
    lastIndex = start + token.length;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

function renderInlineMailText(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(MARKDOWN_LINK_PATTERN)) {
    const raw = match[0];
    const label = match[1]?.trim() ?? "";
    const url = match[2] ?? "";
    const start = match.index ?? 0;

    if (start > lastIndex) {
      nodes.push(
        ...renderBareLinks(
          text.slice(lastIndex, start),
          `${keyPrefix}-before-${start}`,
        ),
      );
    }

    const href = safeHttpUrl(url);
    nodes.push(
      href && label
        ? renderAnchor(href, label, `${keyPrefix}-link-${start}`)
        : raw,
    );
    lastIndex = start + raw.length;
  }

  if (lastIndex < text.length) {
    nodes.push(
      ...renderBareLinks(text.slice(lastIndex), `${keyPrefix}-tail-${lastIndex}`),
    );
  }

  return nodes;
}

function renderMailParagraph(
  lines: string[],
  key: string,
  keyPrefix: string,
): ReactNode {
  return (
    <p key={key} className="my-4">
      {lines.map((line, lineIndex) => (
        <span key={`${keyPrefix}-line-${lineIndex}`}>
          {lineIndex > 0 && <br />}
          {renderInlineMailText(line, `${keyPrefix}-line-${lineIndex}`)}
        </span>
      ))}
    </p>
  );
}

function renderMailList(
  lines: string[],
  key: string,
  keyPrefix: string,
): ReactNode {
  return (
    <ul key={key} className="my-4 list-disc space-y-1 pl-5">
      {lines.map((line, lineIndex) => (
        <li key={`${keyPrefix}-line-${lineIndex}`}>
          {renderInlineMailText(line, `${keyPrefix}-line-${lineIndex}`)}
        </li>
      ))}
    </ul>
  );
}

function renderMailBody(input: string): ReactNode {
  const text = normalizeMailDisplayText(input);
  if (!text) return null;

  const nodes: ReactNode[] = [];
  text.split(/\n{2,}/).forEach((block, blockIndex) => {
    const lines = block.split("\n").map((line) => line.trimEnd());
    let paragraphLines: string[] = [];
    let listLines: string[] = [];
    let groupIndex = 0;

    const flushParagraph = () => {
      if (!paragraphLines.some((line) => line.trim())) {
        paragraphLines = [];
        return;
      }
      nodes.push(
        renderMailParagraph(
          paragraphLines,
          `block-${blockIndex}-group-${groupIndex}`,
          `block-${blockIndex}-group-${groupIndex}`,
        ),
      );
      paragraphLines = [];
      groupIndex += 1;
    };
    const flushList = () => {
      if (listLines.length === 0) return;
      nodes.push(
        renderMailList(
          listLines,
          `block-${blockIndex}-group-${groupIndex}`,
          `block-${blockIndex}-group-${groupIndex}`,
        ),
      );
      listLines = [];
      groupIndex += 1;
    };

    for (const line of lines) {
      const bullet = /^\s*[*-]\s+(.+)$/.exec(line);
      if (bullet) {
        flushParagraph();
        listLines.push(bullet[1]);
      } else {
        flushList();
        paragraphLines.push(line);
      }
    }

    flushParagraph();
    flushList();
  });
  return nodes;
}

function renderMailHtml(html: string): ReactNode {
  const clean = html.trim();
  if (!clean) return null;
  return (
    <div
      className="mail-html text-[15px] leading-7"
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}

function renderMessageAttachments(message: MailMessage): ReactNode {
  if (message.attachments.length === 0) return null;
  return (
    <section className="border-t border-[var(--border)] pt-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
        <Paperclip size={15} className="text-[var(--muted)]" />
        <span>
          {message.attachments.length} attachment
          {message.attachments.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {message.attachments.map((attachment) => {
          const href = attachmentDownloadHref(message, attachment);
          const content = (
            <>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[var(--border)] text-[var(--muted)]">
                <Paperclip size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {attachment.filename}
                </span>
                <span className="block truncate text-xs text-[var(--muted)]">
                  {attachmentLabel(attachment)}
                </span>
              </span>
              <Download size={15} className="shrink-0 text-[var(--muted)]" />
            </>
          );
          return href ? (
            <a
              key={attachment.id}
              href={href}
              className="flex min-w-0 items-center gap-2 rounded-md border border-[var(--border)] p-2 hover:bg-[var(--card)]"
            >
              {content}
            </a>
          ) : (
            <div
              key={attachment.id}
              className="flex min-w-0 items-center gap-2 rounded-md border border-[var(--border)] p-2 opacity-70"
            >
              {content}
            </div>
          );
        })}
      </div>
    </section>
  );
}

type MailActionResponse = {
  message?: MailMessage;
  thread?: MailThread | null;
  workspace?: MailWorkspace;
  error?: string;
};

type MailBulkActionResponse = {
  workspace?: MailWorkspace;
  affectedCount?: number;
  error?: string;
};

type MailMoveResponse = {
  workspace?: MailWorkspace;
  affectedCount?: number;
  error?: string;
};

type MailSyncResponse = {
  workspace?: MailWorkspace;
  loadedCount?: number;
  hasMore?: boolean;
  error?: string;
};

type MailSearchResponse = {
  workspace?: MailWorkspace;
  loadedCount?: number;
  query?: string;
  error?: string;
};

type MailSendResponse = {
  workspace?: MailWorkspace;
  message?: MailMessage;
  thread?: MailThread | null;
  error?: string;
};

type MailMessageDetailResponse = {
  message?: MailMessage;
  error?: string;
};

type ComposeMode = "compose" | "reply" | "forward" | "draft";

type ComposeAttachment = {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  dataBase64: string;
};

type ComposeState = {
  mode: ComposeMode;
  accountId: string;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  bodyText: string;
  replyToMessageId: string | null;
  draftMessageId: string | null;
  attachments: ComposeAttachment[];
};

function composeAttachmentSize(attachments: ComposeAttachment[]): number {
  return attachments.reduce((total, attachment) => total + attachment.size, 0);
}

function composeAttachmentLabel(attachment: ComposeAttachment): string {
  return `${attachment.mimeType || "application/octet-stream"} · ${formatFileSize(
    attachment.size,
  )}`;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

async function fileToComposeAttachment(file: File): Promise<ComposeAttachment> {
  const buffer = await file.arrayBuffer();
  return {
    id: `${file.name}-${file.size}-${file.lastModified}-${
      globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
    }`,
    filename: file.name || "attachment",
    mimeType: file.type || "application/octet-stream",
    size: buffer.byteLength,
    dataBase64: arrayBufferToBase64(buffer),
  };
}

async function mailAttachmentToComposeAttachment(
  message: MailMessage,
  attachment: MailAttachment,
): Promise<ComposeAttachment> {
  const href = attachmentDownloadHref(message, attachment);
  if (!href) throw new Error(`Cannot load ${attachment.filename}`);
  const res = await fetch(href);
  if (!res.ok) throw new Error(`Cannot load ${attachment.filename}`);
  const buffer = await res.arrayBuffer();
  return {
    id: `${attachment.id}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`,
    filename: attachment.filename || "attachment",
    mimeType: attachment.mimeType || "application/octet-stream",
    size: buffer.byteLength,
    dataBase64: arrayBufferToBase64(buffer),
  };
}

function primaryFolderIdForLabels(
  workspace: MailWorkspace,
  accountId: string,
  labels: string[],
): string | null {
  for (const providerFolderId of [
    "INBOX",
    "SENT",
    "DRAFT",
    "STARRED",
    "SPAM",
    "TRASH",
  ]) {
    if (!labels.includes(providerFolderId)) continue;
    return (
      workspace.folders.find(
        (folder) =>
          folder.accountId === accountId &&
          folder.providerFolderId === providerFolderId,
      )?.id ?? null
    );
  }
  return null;
}

function latestMessage(messages: MailMessage[]): MailMessage | null {
  return messages.reduce<MailMessage | null>((latest, message) => {
    if (!latest) return message;
    const latestTime = latest.receivedAt ? new Date(latest.receivedAt).getTime() : 0;
    const messageTime = message.receivedAt
      ? new Date(message.receivedAt).getTime()
      : 0;
    return messageTime >= latestTime ? message : latest;
  }, null);
}

function recipientInput(recipient: MailRecipient): string {
  if (!recipient.name) return recipient.email;
  return `${recipient.name} <${recipient.email}>`;
}

function replySubject(subject: string): string {
  const clean = subject.trim() || "(no subject)";
  return /^re:/i.test(clean) ? clean : `Re: ${clean}`;
}

function forwardSubject(subject: string): string {
  const clean = subject.trim() || "(no subject)";
  return /^fwd?:/i.test(clean) ? clean : `Fwd: ${clean}`;
}

function quotedMessageBody(message: MailMessage): string {
  const body = cleanMailText(message.bodyText || message.snippet)
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n")
    .slice(0, 12000);
  const sentAt = message.receivedAt
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(message.receivedAt))
    : "";
  return [
    "",
    "",
    `On ${sentAt || "this date"}, ${messageSender(message)} wrote:`,
    body,
  ].join("\n");
}

function forwardedMessageBody(message: MailMessage): string {
  const body = cleanMailText(message.bodyText || message.snippet).slice(0, 16000);
  return [
    "",
    "",
    "---------- Forwarded message ----------",
    `From: ${messageSender(message)}${
      message.fromEmail ? ` <${message.fromEmail}>` : ""
    }`,
    `Date: ${
      message.receivedAt
        ? new Intl.DateTimeFormat(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(message.receivedAt))
        : ""
    }`,
    `Subject: ${message.subject}`,
    `To: ${messageRecipients(message.toRecipients)}`,
    "",
    body,
  ].join("\n");
}

function isDraftMessage(message: MailMessage | null): boolean {
  return Boolean(message?.labels.includes("DRAFT"));
}

function mergeWorkspacePreservingMessageBodies(
  nextWorkspace: MailWorkspace,
  currentWorkspace: MailWorkspace,
): MailWorkspace {
  const currentById = new Map(
    currentWorkspace.messages.map((message) => [message.id, message]),
  );
  return {
    ...nextWorkspace,
    messages: nextWorkspace.messages.map((message) => {
      if (message.bodyText || message.bodyHtml) return message;
      const current = currentById.get(message.id);
      if (!current?.bodyText && !current?.bodyHtml) return message;
      return {
        ...message,
        bodyText: current.bodyText,
        bodyHtml: current.bodyHtml,
      };
    }),
  };
}

function applyOptimisticMessageAction(
  workspace: MailWorkspace,
  messageId: string,
  action: MailMessageAction,
): MailWorkspace {
  const target = workspace.messages.find((message) => message.id === messageId);
  if (!target) return workspace;

  if (action === "delete_forever") {
    const now = new Date().toISOString();
    const messages = workspace.messages.filter((message) => message.id !== messageId);
    const threadMessages = target.threadId
      ? messages.filter((message) => message.threadId === target.threadId)
      : [];
    const latest = latestMessage(threadMessages);
    const threads =
      target.threadId && threadMessages.length === 0
        ? workspace.threads.filter((thread) => thread.id !== target.threadId)
        : workspace.threads.map((thread) => {
            if (thread.id !== target.threadId || !latest) return thread;
            return {
              ...thread,
              folderId: latest.folderId,
              labels: [
                ...new Set(
                  threadMessages.flatMap((message) => message.labels),
                ),
              ],
              unread: threadMessages.some((message) => message.unread),
              starred: threadMessages.some((message) => message.starred),
              updatedAt: now,
            };
          });
    return { ...workspace, messages, threads };
  }

  const next = applyMailActionToLabels(target.labels, action);
  const now = new Date().toISOString();
  const messages = workspace.messages.map((message) => {
    if (message.id !== messageId) return message;
    return {
      ...message,
      folderId: primaryFolderIdForLabels(workspace, message.accountId, next.labels),
      labels: next.labels,
      unread: next.unread,
      starred: next.starred,
      updatedAt: now,
    };
  });

  const threadMessages = target.threadId
    ? messages.filter((message) => message.threadId === target.threadId)
    : [];
  const latest = latestMessage(threadMessages);
  const threads = workspace.threads.map((thread) => {
    if (thread.id !== target.threadId || !latest) return thread;
    return {
      ...thread,
      folderId: latest.folderId,
      labels: latest.labels,
      unread: threadMessages.some((message) => message.unread),
      starred: threadMessages.some((message) => message.starred),
      updatedAt: now,
    };
  });

  return { ...workspace, messages, threads };
}

function applyOptimisticMessageActions(
  workspace: MailWorkspace,
  messageIds: string[],
  action: MailMessageAction,
): MailWorkspace {
  return messageIds.reduce(
    (nextWorkspace, messageId) =>
      applyOptimisticMessageAction(nextWorkspace, messageId, action),
    workspace,
  );
}

function mergeMailActionResponse(
  workspace: MailWorkspace,
  response: MailActionResponse,
): MailWorkspace {
  if (response.workspace) {
    return mergeWorkspacePreservingMessageBodies(response.workspace, workspace);
  }
  if (!response.message) return workspace;

  const messageExists = workspace.messages.some(
    (message) => message.id === response.message?.id,
  );
  const messages = messageExists
    ? workspace.messages.map((message) =>
        message.id === response.message?.id ? response.message : message,
      )
    : [...workspace.messages, response.message];

  if (response.thread === undefined) return { ...workspace, messages };

  const threads =
    response.thread === null
      ? workspace.threads.filter(
          (thread) => thread.id !== response.message?.threadId,
        )
      : workspace.threads.some((thread) => thread.id === response.thread?.id)
        ? workspace.threads.map((thread) =>
            thread.id === response.thread?.id ? response.thread : thread,
          )
        : [...workspace.threads, response.thread];

  return { ...workspace, messages, threads };
}

export default function MailClient({
  user,
  isAdmin = false,
  workspace: initialWorkspace,
  initialAccountId,
  oauthError,
}: {
  user: DriveUser;
  isAdmin?: boolean;
  workspace: MailWorkspace;
  initialAccountId: string | null;
  oauthError: string | null;
}) {
  const [mailWorkspace, setMailWorkspace] =
    useState<MailWorkspace>(initialWorkspace);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    initialAccountId ?? initialWorkspace.accounts[0]?.id ?? null,
  );
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [selectedThreadIds, setSelectedThreadIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [query, setQuery] = useState("");
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [uiError, setUiError] = useState<string | null>(oauthError);
  const [uiNotice, setUiNotice] = useState<string | null>(null);
  const [trashDialogAccountId, setTrashDialogAccountId] = useState<string | null>(
    null,
  );
  const [compose, setCompose] = useState<ComposeState | null>(null);
  const [showCcBcc, setShowCcBcc] = useState(false);
  const composeFileInputRef = useRef<HTMLInputElement | null>(null);
  const [messageDetailLoadingIds, setMessageDetailLoadingIds] = useState<
    Set<string>
  >(() => new Set());
  const [loadedMessageDetailIds, setLoadedMessageDetailIds] = useState<
    Set<string>
  >(() => new Set());

  const selectedAccount =
    mailWorkspace.accounts.find((account) => account.id === selectedAccountId) ??
    mailWorkspace.accounts[0] ??
    null;

  const accountThreadLabelCounts = useMemo(() => {
    const counts = new Map<string, number>();
    if (!selectedAccount) return counts;
    for (const thread of mailWorkspace.threads) {
      if (thread.accountId !== selectedAccount.id) continue;
      for (const label of thread.labels) {
        counts.set(label, (counts.get(label) ?? 0) + 1);
      }
    }
    return counts;
  }, [selectedAccount, mailWorkspace.threads]);

  const accountFolderGroups = useMemo(() => {
    const folders = selectedAccount
      ? mailWorkspace.folders.filter((folder) => folder.accountId === selectedAccount.id)
      : [];
    const visible = folders.filter((folder) => {
      if (HIDDEN_SYSTEM_LABELS.has(folder.providerFolderId)) return false;
      if (ESSENTIAL_LABELS.has(folder.providerFolderId)) return true;
      return (
        folder.totalCount > 0 ||
        folder.unreadCount > 0 ||
        (accountThreadLabelCounts.get(folder.providerFolderId) ?? 0) > 0
      );
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
  }, [accountThreadLabelCounts, selectedAccount, mailWorkspace.folders]);

  const accountFolders = useMemo(
    () => [
      ...accountFolderGroups.mailboxes,
      ...accountFolderGroups.categories,
      ...accountFolderGroups.labels,
    ],
    [accountFolderGroups],
  );

  const moveTargets = useMemo(() => {
    if (!selectedAccount) return [];
    const allowedSystemTargets = new Set(["INBOX", "SPAM", "TRASH"]);
    return mailWorkspace.folders
      .filter((folder) => {
        if (folder.accountId !== selectedAccount.id) return false;
        if (allowedSystemTargets.has(folder.providerFolderId)) return true;
        if (HIDDEN_SYSTEM_LABELS.has(folder.providerFolderId)) return false;
        if (folder.providerFolderId.startsWith("CATEGORY_")) return false;
        return folder.kind === "custom";
      })
      .sort((a, b) => {
        const aSystem = allowedSystemTargets.has(a.providerFolderId) ? 0 : 1;
        const bSystem = allowedSystemTargets.has(b.providerFolderId) ? 0 : 1;
        if (aSystem !== bSystem) return aSystem - bSystem;
        return folderDisplayName(a).localeCompare(folderDisplayName(b));
      });
  }, [mailWorkspace.folders, selectedAccount]);

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
      selectedFolderId !== ALL_MAIL_FOLDER_ID &&
      !accountFolders.some((folder) => folder.id === selectedFolderId)
    ) {
      setSelectedFolderId(defaultFolderId);
    }
  }, [accountFolders, defaultFolderId, selectedAccount, selectedFolderId]);

  useEffect(() => {
    if (
      selectedAccountId !== null &&
      !mailWorkspace.accounts.some((account) => account.id === selectedAccountId)
    ) {
      setSelectedAccountId(mailWorkspace.accounts[0]?.id ?? null);
      setSelectedFolderId(null);
      setSelectedThreadId(null);
    }
  }, [mailWorkspace.accounts, selectedAccountId]);

  const activeFolderId = selectedFolderId ?? defaultFolderId;
  const allMailActive =
    activeFolderId === ALL_MAIL_FOLDER_ID || activeFolderId === null;
  const activeFolder =
    allMailActive
      ? null
      : (accountFolders.find((folder) => folder.id === activeFolderId) ?? null);
  const activeLoadMoreKey = selectedAccount
    ? `load-more:${selectedAccount.id}:${gmailSyncCursorKey(activeFolder)}`
    : null;
  const loadingMore = activeLoadMoreKey !== null && pendingAction === activeLoadMoreKey;
  const canLoadMore = hasMoreSyncedMail(selectedAccount, activeFolder);
  const normalizedQuery = query.trim().toLowerCase();
  const trimmedQuery = query.trim();
  const activeSearchKey =
    selectedAccount && trimmedQuery
      ? `search:${selectedAccount.id}:${gmailSyncCursorKey(activeFolder)}:${trimmedQuery}`
      : null;
  const searchingMail =
    activeSearchKey !== null && pendingAction === activeSearchKey;

  const allMailLoadedThreads = useMemo(() => {
    if (!selectedAccount) return [];
    return mailWorkspace.threads.filter(
      (thread) =>
        thread.accountId === selectedAccount.id && threadBelongsToAllMail(thread),
    );
  }, [mailWorkspace.threads, selectedAccount]);
  const allMailUnreadLoadedCount = allMailLoadedThreads.filter(
    (thread) => thread.unread,
  ).length;

  const messageSearchTextByThreadId = useMemo(() => {
    const map = new Map<string, string>();
    for (const message of mailWorkspace.messages) {
      if (!message.threadId) continue;
      const value = [
        message.subject,
        message.snippet,
        message.bodyText,
        message.fromName,
        message.fromEmail,
        message.toRecipients.map(formatRecipient).join(" "),
        message.ccRecipients.map(formatRecipient).join(" "),
      ]
        .join(" ")
        .toLowerCase();
      map.set(message.threadId, `${map.get(message.threadId) ?? ""} ${value}`);
    }
    return map;
  }, [mailWorkspace.messages]);

  const visibleThreads = useMemo(() => {
    if (!selectedAccount) return [];
    return mailWorkspace.threads.filter((thread) => {
      if (thread.accountId !== selectedAccount.id) return false;
      if (allMailActive && !threadBelongsToAllMail(thread)) return false;
      if (
        !allMailActive &&
        activeFolder?.providerFolderId !== "TRASH" &&
        thread.labels.includes("TRASH")
      ) {
        return false;
      }
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
        messageSearchTextByThreadId.get(thread.id) ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [
    activeFolder,
    allMailActive,
    normalizedQuery,
    selectedAccount,
    mailWorkspace.threads,
    messageSearchTextByThreadId,
  ]);

  useEffect(() => {
    if (!visibleThreads.length) {
      setSelectedThreadId(null);
      return;
    }
    if (!visibleThreads.some((thread) => thread.id === selectedThreadId)) {
      setSelectedThreadId(visibleThreads[0].id);
    }
  }, [selectedThreadId, visibleThreads]);

  useEffect(() => {
    const visibleIds = new Set(visibleThreads.map((thread) => thread.id));
    setSelectedThreadIds((current) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of current) {
        if (visibleIds.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [visibleThreads]);

  const selectedThread =
    visibleThreads.find((thread) => thread.id === selectedThreadId) ??
    visibleThreads[0] ??
    null;
  const selectedMessages = useMemo(
    () =>
      selectedThread
        ? mailWorkspace.messages
            .filter((message) => message.threadId === selectedThread.id)
            .sort((a, b) => {
              const aTime = a.receivedAt
                ? new Date(a.receivedAt).getTime()
                : 0;
              const bTime = b.receivedAt
                ? new Date(b.receivedAt).getTime()
                : 0;
              return aTime - bTime;
            })
        : [],
    [mailWorkspace.messages, selectedThread],
  );
  const selectedMessage = selectedMessages[selectedMessages.length - 1] ?? null;
  const messageBodyIsLoading = (message: MailMessage) =>
    messageDetailLoadingIds.has(message.id) &&
    !message.bodyText &&
    !message.bodyHtml;
  const messageBodyLoading =
    selectedMessage !== null && messageBodyIsLoading(selectedMessage);
  const selectedIsDraft = isDraftMessage(selectedMessage);
  const selectedThreadActionMessageIds = useMemo(
    () =>
      selectedMessages
        .filter((message) => !message.labels.includes("DRAFT"))
        .map((message) => message.id),
    [selectedMessages],
  );
  const selectedThreadTrashMessageIds = useMemo(
    () =>
      selectedMessages
        .filter(
          (message) =>
            !message.labels.includes("DRAFT") && message.labels.includes("TRASH"),
        )
        .map((message) => message.id),
    [selectedMessages],
  );
  const selectedThreadDeleteForever =
    activeFolder?.providerFolderId === "TRASH" &&
    selectedThreadTrashMessageIds.length > 0;
  const selectedThreadDeleteAction: MailMessageAction = selectedThreadDeleteForever
    ? "delete_forever"
    : "trash";
  const selectedThreadDeleteMessageIds = selectedThreadDeleteForever
    ? selectedThreadTrashMessageIds
    : selectedThreadActionMessageIds;
  const selectedThreadUnread =
    selectedThreadActionMessageIds.length > 0 &&
    selectedMessages.some(
      (message) =>
        selectedThreadActionMessageIds.includes(message.id) && message.unread,
    );
  const selectedThreadStarred =
    selectedThread?.starred === true ||
    selectedMessages.some(
      (message) =>
        selectedThreadActionMessageIds.includes(message.id) && message.starred,
    );
  const selectedBulkThreads = visibleThreads.filter((thread) =>
    selectedThreadIds.has(thread.id),
  );
  const selectedBulkMessageIds = useMemo(() => {
    if (!selectedAccount || selectedThreadIds.size === 0) return [];
    const threadIds = selectedThreadIds;
    return [
      ...new Set(
        mailWorkspace.messages
          .filter(
            (message) =>
              message.accountId === selectedAccount.id &&
              message.threadId !== null &&
              threadIds.has(message.threadId) &&
              !message.labels.includes("DRAFT"),
          )
          .map((message) => message.id),
      ),
    ];
  }, [mailWorkspace.messages, selectedAccount, selectedThreadIds]);
  const selectedBulkTrashMessageIds = useMemo(() => {
    if (selectedBulkMessageIds.length === 0) return [];
    const selectedIds = new Set(selectedBulkMessageIds);
    return mailWorkspace.messages
      .filter(
        (message) => selectedIds.has(message.id) && message.labels.includes("TRASH"),
      )
      .map((message) => message.id);
  }, [mailWorkspace.messages, selectedBulkMessageIds]);
  const selectedBulkDeleteForever =
    activeFolder?.providerFolderId === "TRASH" &&
    selectedBulkTrashMessageIds.length > 0;
  const selectedBulkDeleteAction: MailMessageAction = selectedBulkDeleteForever
    ? "delete_forever"
    : "trash";
  const selectedBulkDeleteMessageIds = selectedBulkDeleteForever
    ? selectedBulkTrashMessageIds
    : selectedBulkMessageIds;
  const allVisibleThreadsSelected =
    visibleThreads.length > 0 &&
    visibleThreads.every((thread) => selectedThreadIds.has(thread.id));
  const bulkBusy =
    (pendingAction?.startsWith("bulk:") ?? false) ||
    (pendingAction?.startsWith("bulk-move:") ?? false);

  useEffect(() => {
    const missingMessages = selectedMessages.filter(
      (message) =>
        !message.bodyText &&
        !message.bodyHtml &&
        !loadedMessageDetailIds.has(message.id) &&
        !messageDetailLoadingIds.has(message.id),
    );
    if (missingMessages.length === 0) return;

    let cancelled = false;
    const ids = missingMessages.map((message) => message.id);
    setMessageDetailLoadingIds((current) => {
      const next = new Set(current);
      for (const id of ids) next.add(id);
      return next;
    });

    void Promise.all(
      missingMessages.map(async (message) => {
        try {
          const res = await fetch(
            `/api/mail/messages/${encodeURIComponent(message.id)}`,
          );
          const data = (await res
            .json()
            .catch(() => ({}))) as MailMessageDetailResponse;
          if (!res.ok) {
            throw new Error(data.error || `Message load failed (${res.status})`);
          }
          const detailMessage = data.message;
          if (!detailMessage || cancelled) return;
          setLoadedMessageDetailIds((current) => {
            if (current.has(detailMessage.id)) return current;
            const next = new Set(current);
            next.add(detailMessage.id);
            return next;
          });
          setMailWorkspace((current) => ({
            ...current,
            messages: current.messages.some(
              (currentMessage) => currentMessage.id === detailMessage.id,
            )
              ? current.messages.map((currentMessage) =>
                  currentMessage.id === detailMessage.id
                    ? detailMessage
                    : currentMessage,
                )
              : [detailMessage, ...current.messages],
          }));
        } catch (err) {
          if (!cancelled) {
            setLoadedMessageDetailIds((current) => {
              if (current.has(message.id)) return current;
              const next = new Set(current);
              next.add(message.id);
              return next;
            });
            setUiError(err instanceof Error ? err.message : "Message load failed");
          }
        } finally {
          if (!cancelled) {
            setMessageDetailLoadingIds((current) => {
              if (!current.has(message.id)) return current;
              const next = new Set(current);
              next.delete(message.id);
              return next;
            });
          }
        }
      }),
    );

    return () => {
      cancelled = true;
    };
  }, [loadedMessageDetailIds, messageDetailLoadingIds, selectedMessages]);

  function toggleThreadSelected(threadId: string) {
    setSelectedThreadIds((current) => {
      const next = new Set(current);
      if (next.has(threadId)) next.delete(threadId);
      else next.add(threadId);
      return next;
    });
  }

  function toggleAllVisibleThreads() {
    setSelectedThreadIds((current) => {
      if (allVisibleThreadsSelected) return new Set();
      const next = new Set(current);
      for (const thread of visibleThreads) next.add(thread.id);
      return next;
    });
  }

  function openCompose(accountId = selectedAccount?.id ?? "") {
    if (!accountId) return;
    setShowCcBcc(false);
    setCompose({
      mode: "compose",
      accountId,
      to: "",
      cc: "",
      bcc: "",
      subject: "",
      bodyText: "",
      replyToMessageId: null,
      draftMessageId: null,
      attachments: [],
    });
  }

  function openReply() {
    if (!selectedAccount || !selectedMessage?.fromEmail) return;
    setShowCcBcc(false);
    setCompose({
      mode: "reply",
      accountId: selectedAccount.id,
      to: recipientInput({
        email: selectedMessage.fromEmail,
        name: selectedMessage.fromName,
      }),
      cc: "",
      bcc: "",
      subject: replySubject(selectedMessage.subject),
      bodyText: quotedMessageBody(selectedMessage),
      replyToMessageId: selectedMessage.id,
      draftMessageId: null,
      attachments: [],
    });
  }

  function openForward() {
    if (!selectedAccount || !selectedMessage) return;
    setShowCcBcc(false);
    setCompose({
      mode: "forward",
      accountId: selectedAccount.id,
      to: "",
      cc: "",
      bcc: "",
      subject: forwardSubject(selectedMessage.subject),
      bodyText: forwardedMessageBody(selectedMessage),
      replyToMessageId: null,
      draftMessageId: null,
      attachments: [],
    });
  }

  async function openDraft() {
    if (!selectedAccount || !selectedMessage || !isDraftMessage(selectedMessage)) {
      return;
    }
    setPendingAction("open-draft");
    setUiError(null);
    setUiNotice(null);
    let attachments: ComposeAttachment[] = [];
    try {
      if (selectedMessage.attachments.length > MAX_COMPOSE_ATTACHMENTS) {
        throw new Error(`Draft has more than ${MAX_COMPOSE_ATTACHMENTS} attachments.`);
      }
      const expectedSize = selectedMessage.attachments.reduce(
        (total, attachment) => total + (attachment.size ?? 0),
        0,
      );
      if (expectedSize > MAX_COMPOSE_ATTACHMENT_BYTES) {
        throw new Error("Draft attachments are over the 4 MB compose limit.");
      }
      attachments = await Promise.all(
        selectedMessage.attachments.map((attachment) =>
          mailAttachmentToComposeAttachment(selectedMessage, attachment),
        ),
      );
      if (composeAttachmentSize(attachments) > MAX_COMPOSE_ATTACHMENT_BYTES) {
        throw new Error("Draft attachments are over the 4 MB compose limit.");
      }
    } catch (err) {
      setUiError(err instanceof Error ? err.message : "Draft attachments failed to load");
      setPendingAction(null);
      return;
    }
    setShowCcBcc(
      selectedMessage.ccRecipients.length > 0 ||
        selectedMessage.bccRecipients.length > 0,
    );
    setCompose({
      mode: "draft",
      accountId: selectedAccount.id,
      to: selectedMessage.toRecipients.map(recipientInput).join(", "),
      cc: selectedMessage.ccRecipients.map(recipientInput).join(", "),
      bcc: selectedMessage.bccRecipients.map(recipientInput).join(", "),
      subject: selectedMessage.subject === "(no subject)" ? "" : selectedMessage.subject,
      bodyText: selectedMessage.bodyText,
      replyToMessageId: null,
      draftMessageId: selectedMessage.id,
      attachments,
    });
    setPendingAction(null);
  }

  async function addComposeFiles(files: FileList | null) {
    if (!compose || !files?.length) return;
    setUiError(null);
    setUiNotice(null);
    const incoming = Array.from(files);
    if (compose.attachments.length + incoming.length > MAX_COMPOSE_ATTACHMENTS) {
      setUiError(`Attach up to ${MAX_COMPOSE_ATTACHMENTS} files.`);
      return;
    }
    const totalSize =
      composeAttachmentSize(compose.attachments) +
      incoming.reduce((total, file) => total + file.size, 0);
    if (totalSize > MAX_COMPOSE_ATTACHMENT_BYTES) {
      setUiError("Attachments can be up to 4 MB total.");
      return;
    }
    try {
      const attachments = await Promise.all(incoming.map(fileToComposeAttachment));
      setCompose((current) =>
        current
          ? { ...current, attachments: [...current.attachments, ...attachments] }
          : current,
      );
    } catch (err) {
      setUiError(err instanceof Error ? err.message : "Attachment failed to load");
    }
  }

  function removeComposeAttachment(id: string) {
    setCompose((current) =>
      current
        ? {
            ...current,
            attachments: current.attachments.filter((attachment) => attachment.id !== id),
          }
        : current,
    );
  }

  async function sendCompose() {
    if (!compose) return;
    const accountId = compose.accountId;
    const mode = compose.mode;
    setPendingAction("send-mail");
    setUiError(null);
    setUiNotice(null);
    try {
      const res = await fetch("/api/mail/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          accountId,
          to: compose.to,
          cc: compose.cc,
          bcc: compose.bcc,
          subject: compose.subject,
          bodyText: compose.bodyText,
          attachments: compose.attachments.map((attachment) => ({
            filename: attachment.filename,
            mimeType: attachment.mimeType,
            dataBase64: attachment.dataBase64,
          })),
          replyToMessageId: compose.replyToMessageId,
          draftMessageId: compose.draftMessageId,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as MailSendResponse;
      if (!res.ok) throw new Error(data.error || `Send failed (${res.status})`);
      if (data.workspace) {
        setMailWorkspace((current) =>
          mergeWorkspacePreservingMessageBodies(data.workspace!, current),
        );
      }
      setSelectedAccountId(accountId);
      if (mode === "compose" || mode === "forward" || mode === "draft") {
        const sentFolder =
          data.workspace?.folders.find(
            (folder) =>
              folder.accountId === accountId &&
              folder.providerFolderId === "SENT",
          ) ?? null;
        if (sentFolder) setSelectedFolderId(sentFolder.id);
      }
      if (data.thread) setSelectedThreadId(data.thread.id);
      setCompose(null);
      setUiNotice("Sent.");
    } catch (err) {
      setUiError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setPendingAction(null);
    }
  }

  async function saveDraft() {
    if (!compose) return;
    const accountId = compose.accountId;
    setPendingAction("save-draft");
    setUiError(null);
    setUiNotice(null);
    try {
      const res = await fetch("/api/mail/drafts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          accountId,
          to: compose.to,
          cc: compose.cc,
          bcc: compose.bcc,
          subject: compose.subject,
          bodyText: compose.bodyText,
          attachments: compose.attachments.map((attachment) => ({
            filename: attachment.filename,
            mimeType: attachment.mimeType,
            dataBase64: attachment.dataBase64,
          })),
          replyToMessageId: compose.replyToMessageId,
          draftMessageId: compose.draftMessageId,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as MailSendResponse;
      if (!res.ok) {
        throw new Error(data.error || `Draft save failed (${res.status})`);
      }
      if (data.workspace) {
        setMailWorkspace((current) =>
          mergeWorkspacePreservingMessageBodies(data.workspace!, current),
        );
      }
      if (data.message) {
        setCompose((current) =>
          current
            ? {
                ...current,
                mode: "draft",
                draftMessageId: data.message?.id ?? current.draftMessageId,
              }
            : current,
        );
      }
      setSelectedAccountId(accountId);
      const draftFolder =
        data.workspace?.folders.find(
          (folder) =>
            folder.accountId === accountId && folder.providerFolderId === "DRAFT",
        ) ?? null;
      if (draftFolder) setSelectedFolderId(draftFolder.id);
      if (data.thread) setSelectedThreadId(data.thread.id);
      setUiNotice("Draft saved.");
    } catch (err) {
      setUiError(err instanceof Error ? err.message : "Draft save failed");
    } finally {
      setPendingAction(null);
    }
  }

  async function syncAccount(
    accountId: string,
    options: {
      providerFolderId?: string | null;
      loadMore?: boolean;
      maxResults?: number;
    } = {},
  ) {
    const loadMoreKey = `load-more:${accountId}:${options.providerFolderId ?? "ALL"}`;
    if (options.loadMore) {
      setPendingAction(loadMoreKey);
    } else {
      setSyncingAccountId(accountId);
    }
    setUiError(null);
    setUiNotice(null);
    try {
      const res = await fetch("/api/mail/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          accountId,
          providerFolderId: options.providerFolderId ?? null,
          backfill: options.loadMore === true,
          maxResults: options.maxResults,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as MailSyncResponse;
      if (!res.ok) throw new Error(data.error || `Sync failed (${res.status})`);
      if (data.workspace) {
        setMailWorkspace((current) =>
          mergeWorkspacePreservingMessageBodies(data.workspace!, current),
        );
      }
      if (options.loadMore) {
        if ((data.loadedCount ?? 0) > 0) {
          setUiNotice(
            `Synced ${data.loadedCount} older message${data.loadedCount === 1 ? "" : "s"}.`,
          );
        } else if (data.hasMore === false) {
          setUiNotice("No more messages in this mailbox.");
        }
      }
    } catch (err) {
      setUiError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      if (options.loadMore) {
        setPendingAction(null);
      } else {
        setSyncingAccountId(null);
      }
    }
  }

  async function searchMail() {
    if (!selectedAccount || !trimmedQuery || !activeSearchKey) return;
    setPendingAction(activeSearchKey);
    setUiError(null);
    setUiNotice(null);
    try {
      const res = await fetch("/api/mail/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          accountId: selectedAccount.id,
          providerFolderId: activeFolder?.providerFolderId ?? null,
          query: trimmedQuery,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as MailSearchResponse;
      if (!res.ok) throw new Error(data.error || `Search failed (${res.status})`);
      if (data.workspace) {
        setMailWorkspace((current) =>
          mergeWorkspacePreservingMessageBodies(data.workspace!, current),
        );
      }
      setUiNotice(
        `Found ${data.loadedCount ?? 0} Gmail result${(data.loadedCount ?? 0) === 1 ? "" : "s"}.`,
      );
    } catch (err) {
      setUiError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setPendingAction(null);
    }
  }

  async function removeAccount(accountId: string) {
    if (!window.confirm("Remove this mail account from md1?")) return;
    setPendingAction(`remove:${accountId}`);
    setUiError(null);
    setUiNotice(null);
    try {
      const res = await fetch(`/api/mail/accounts/${accountId}`, {
        method: "DELETE",
      });
      const data = (await res.json().catch(() => ({}))) as {
        workspace?: MailWorkspace;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || `Remove failed (${res.status})`);
      if (data.workspace) {
        setMailWorkspace((current) =>
          mergeWorkspacePreservingMessageBodies(data.workspace!, current),
        );
      }
      setSelectedAccountId(data.workspace?.accounts[0]?.id ?? null);
      setSelectedFolderId(null);
      setSelectedThreadId(null);
    } catch (err) {
      setUiError(err instanceof Error ? err.message : "Remove failed");
    } finally {
      setPendingAction(null);
    }
  }

  async function emptyTrash(accountId: string) {
    setTrashDialogAccountId(null);
    setPendingAction("empty-trash");
    setUiError(null);
    setUiNotice(null);
    try {
      const res = await fetch(`/api/mail/accounts/${accountId}/empty-trash`, {
        method: "POST",
      });
      const data = (await res.json().catch(() => ({}))) as {
        deletedCount?: number;
        hasMore?: boolean;
        workspace?: MailWorkspace;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || `Empty Trash failed (${res.status})`);
      }
      if (data.hasMore) {
        setUiNotice(
          `Deleted ${data.deletedCount ?? 0} messages. Trash still has more messages; run Empty Trash again.`,
        );
      } else {
        setUiNotice(`Deleted ${data.deletedCount ?? 0} messages from Trash.`);
      }
      if (data.workspace) {
        setMailWorkspace((current) =>
          mergeWorkspacePreservingMessageBodies(data.workspace!, current),
        );
      }
    } catch (err) {
      setUiError(err instanceof Error ? err.message : "Empty Trash failed");
    } finally {
      setPendingAction(null);
    }
  }

  async function runMessageAction(action: MailMessageAction) {
    if (!selectedMessage) return;
    const previousWorkspace = mailWorkspace;
    setPendingAction(action);
    setUiError(null);
    setUiNotice(null);
    try {
      if (action === "delete_draft") {
        const res = await fetch(`/api/mail/messages/${selectedMessage.id}/action`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const data = (await res.json().catch(() => ({}))) as MailActionResponse;
        if (!res.ok) throw new Error(data.error || `Action failed (${res.status})`);
        setMailWorkspace((current) => mergeMailActionResponse(current, data));
        return;
      }

      const actionMessageIds =
        action === "delete_forever"
          ? selectedThreadTrashMessageIds
          : selectedThreadActionMessageIds;
      if (actionMessageIds.length === 0) return;
      setMailWorkspace((current) =>
        applyOptimisticMessageActions(current, actionMessageIds, action),
      );
      const res = await fetch("/api/mail/messages/bulk-action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          messageIds: actionMessageIds,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as MailBulkActionResponse;
      if (!res.ok) throw new Error(data.error || `Action failed (${res.status})`);
      if (data.workspace) {
        setMailWorkspace((current) =>
          mergeWorkspacePreservingMessageBodies(data.workspace!, current),
        );
      }
      if (action === "delete_forever") {
        setUiNotice(
          `Deleted ${data.affectedCount ?? actionMessageIds.length} message${
            (data.affectedCount ?? actionMessageIds.length) === 1 ? "" : "s"
          } forever.`,
        );
        return;
      }
      setUiNotice(
        `Updated ${data.affectedCount ?? actionMessageIds.length} message${
          (data.affectedCount ?? actionMessageIds.length) === 1 ? "" : "s"
        }.`,
      );
    } catch (err) {
      setMailWorkspace(previousWorkspace);
      setUiError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setPendingAction(null);
    }
  }

  async function runBulkAction(action: MailMessageAction) {
    const actionMessageIds =
      action === "delete_forever"
        ? selectedBulkTrashMessageIds
        : selectedBulkMessageIds;
    if (actionMessageIds.length === 0) return;
    const key = `bulk:${action}`;
    setPendingAction(key);
    setUiError(null);
    setUiNotice(null);
    try {
      const res = await fetch("/api/mail/messages/bulk-action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          messageIds: actionMessageIds,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as MailBulkActionResponse;
      if (!res.ok) {
        throw new Error(data.error || `Bulk action failed (${res.status})`);
      }
      if (data.workspace) {
        setMailWorkspace((current) =>
          mergeWorkspacePreservingMessageBodies(data.workspace!, current),
        );
      }
      setSelectedThreadIds(new Set());
      if (action === "delete_forever") {
        setUiNotice(
          `Deleted ${data.affectedCount ?? actionMessageIds.length} message${
            (data.affectedCount ?? actionMessageIds.length) === 1 ? "" : "s"
          } forever.`,
        );
        return;
      }
      setUiNotice(
        `Updated ${data.affectedCount ?? actionMessageIds.length} message${
          (data.affectedCount ?? actionMessageIds.length) === 1 ? "" : "s"
        }.`,
      );
    } catch (err) {
      setUiError(err instanceof Error ? err.message : "Bulk action failed");
    } finally {
      setPendingAction(null);
    }
  }

  async function moveMessages(
    messageIds: string[],
    targetProviderFolderId: string,
    bulk = false,
  ) {
    if (messageIds.length === 0 || !targetProviderFolderId) return;
    const key = `${bulk ? "bulk-" : ""}move:${targetProviderFolderId}`;
    setPendingAction(key);
    setUiError(null);
    setUiNotice(null);
    try {
      const res = await fetch("/api/mail/messages/move", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messageIds,
          targetProviderFolderId,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as MailMoveResponse;
      if (!res.ok) throw new Error(data.error || `Move failed (${res.status})`);
      if (data.workspace) {
        setMailWorkspace((current) =>
          mergeWorkspacePreservingMessageBodies(data.workspace!, current),
        );
      }
      if (bulk) setSelectedThreadIds(new Set());
      setUiNotice(
        `Moved ${data.affectedCount ?? messageIds.length} message${
          (data.affectedCount ?? messageIds.length) === 1 ? "" : "s"
        }.`,
      );
    } catch (err) {
      setUiError(err instanceof Error ? err.message : "Move failed");
    } finally {
      setPendingAction(null);
    }
  }

  const threadTitle = selectedThread?.subject || "Mail";
  const trashDialogAccount =
    mailWorkspace.accounts.find((account) => account.id === trashDialogAccountId) ??
    null;
  const trashDialogCount = trashDialogAccount
    ? mailWorkspace.threads.filter(
        (thread) =>
          thread.accountId === trashDialogAccount.id &&
          thread.labels.includes("TRASH"),
      ).length
    : 0;
  const folderTitle =
    allMailActive
      ? "All Mail"
      : activeFolder?.kind === "custom"
      ? (activeFolder ? folderDisplayName(activeFolder) : "All mail")
      : activeFolder
        ? folderKindLabel(activeFolder.kind)
        : "All Mail";
  const composeAccount = compose
    ? mailWorkspace.accounts.find((account) => account.id === compose.accountId) ??
      null
    : null;
  const sendingMail = pendingAction === "send-mail";
  const savingDraft = pendingAction === "save-draft";
  const composingBusy = sendingMail || savingDraft;
  const composeTitle =
    compose?.mode === "reply"
      ? "Reply"
      : compose?.mode === "forward"
        ? "Forward"
        : compose?.mode === "draft"
          ? "Draft"
          : "New message";
  const activeFolderSummary =
    selectedAccount && allMailActive
      ? normalizedQuery
        ? `${plural(visibleThreads.length, "loaded thread")} match`
        : [
            `${plural(allMailLoadedThreads.length, "loaded thread")}`,
            allMailUnreadLoadedCount > 0
              ? `${compactCount(allMailUnreadLoadedCount)} unread loaded`
              : null,
          ]
            .filter(Boolean)
            .join(" · ")
      : selectedAccount && activeFolder
      ? normalizedQuery
        ? `${plural(visibleThreads.length, "loaded thread")} match`
        : [
            `${plural(visibleThreads.length, "loaded thread")}`,
            activeFolder.unreadCount > 0
              ? `${compactCount(activeFolder.unreadCount)} unread`
              : null,
            activeFolder.totalCount > 0
              ? `${compactCount(activeFolder.totalCount)} Gmail message${
                  activeFolder.totalCount === 1 ? "" : "s"
                }`
              : null,
          ]
            .filter(Boolean)
            .join(" · ")
      : null;

  function renderFolderButton(folder: MailFolder) {
    const selected = activeFolderId === folder.id;
    const unreadCount = folder.unreadCount;
    const totalCount = folder.totalCount;
    const loadedCount = accountThreadLabelCounts.get(folder.providerFolderId) ?? 0;
    const loadedTitle =
      loadedCount > 0
        ? `${plural(loadedCount, "thread")} loaded in md1`
        : totalCount > 0
          ? `${plural(totalCount, "message")} reported by Gmail`
          : "";
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
        <span className="flex shrink-0 items-center gap-1">
          {unreadCount > 0 && (
            <span
              title={`${unreadCount} unread reported by Gmail`}
              className="rounded-full bg-[var(--fg)] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-[var(--bg)]"
            >
              {compactCount(unreadCount)} unread
            </span>
          )}
          {loadedCount > 0 ? (
            <span
              title={`${loadedTitle}${
                totalCount > 0
                  ? ` · ${plural(totalCount, "message")} reported by Gmail`
                  : ""
              }`}
              className="text-xs tabular-nums text-[var(--muted)]"
            >
              {compactCount(loadedCount)}
            </span>
          ) : totalCount > 0 ? (
            <span
              title={loadedTitle}
              className="text-[10px] tabular-nums text-[var(--muted)]"
            >
              Gmail {compactCount(totalCount)}
            </span>
          ) : null}
        </span>
      </button>
    );
  }

  function renderAllMailButton() {
    const loadedCount = allMailLoadedThreads.length;
    return (
      <button
        key={ALL_MAIL_FOLDER_ID}
        type="button"
        onClick={() => {
          setSelectedFolderId(ALL_MAIL_FOLDER_ID);
          setSelectedThreadId(null);
        }}
        className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
          allMailActive
            ? "bg-[var(--card)] text-[var(--fg)]"
            : "text-[var(--muted)] hover:bg-[var(--card)]/80 hover:text-[var(--fg)]"
        }`}
      >
        <Archive size={16} />
        <span className="min-w-0 flex-1 truncate">All Mail</span>
        <span className="flex shrink-0 items-center gap-1">
          {allMailUnreadLoadedCount > 0 && (
            <span
              title={`${allMailUnreadLoadedCount} unread loaded in md1`}
              className="rounded-full bg-[var(--fg)] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-[var(--bg)]"
            >
              {compactCount(allMailUnreadLoadedCount)} unread
            </span>
          )}
          {loadedCount > 0 && (
            <span
              title={`${plural(loadedCount, "thread")} loaded in md1`}
              className="text-xs tabular-nums text-[var(--muted)]"
            >
              {compactCount(loadedCount)}
            </span>
          )}
        </span>
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
            {mailWorkspace.accounts.length === 0 ? (
              <a
                href="/api/mail/google/start"
                className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-[var(--muted)] hover:bg-[var(--card)] hover:text-[var(--fg)]"
              >
                <Mail size={15} />
                <span className="min-w-0 flex-1 truncate">Connect Gmail</span>
              </a>
            ) : (
              mailWorkspace.accounts.map((account) => {
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
                      title="Refresh"
                      disabled={busy}
                      onClick={() =>
                        void syncAccount(account.id, {
                          providerFolderId:
                            selectedAccount?.id === account.id
                              ? (activeFolder?.providerFolderId ?? null)
                              : null,
                          maxResults: 20,
                        })
                      }
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
              <div>
                <div className="mb-1 px-2 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                  Mailboxes
                </div>
                <div className="space-y-0.5">
                  {renderAllMailButton()}
                  {accountFolderGroups.mailboxes.map(renderFolderButton)}
                </div>
              </div>
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
                <>
                  <p className="truncate text-xs text-[var(--muted)]">
                    {selectedAccount.email}
                  </p>
                  {activeFolderSummary && (
                    <p className="truncate text-[11px] text-[var(--muted)]">
                      {activeFolderSummary}
                    </p>
                  )}
                </>
              )}
            </div>
            {selectedAccount && (
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  title="Compose"
                  onClick={() => openCompose(selectedAccount.id)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--card)] hover:text-[var(--fg)] disabled:opacity-50"
                >
                  <PencilLine size={16} />
                </button>
                {activeFolder?.providerFolderId === "TRASH" && (
                  <button
                    type="button"
                    title="Empty Trash"
                    disabled={!!pendingAction}
                    onClick={() => setTrashDialogAccountId(selectedAccount.id)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-red-500 hover:bg-[var(--card)] disabled:opacity-50"
                  >
                    {pendingAction === "empty-trash" ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Trash2 size={14} />
                    )}
                    Empty
                  </button>
                )}
                <button
                  type="button"
                  title="Refresh"
                  disabled={syncingAccountId === selectedAccount.id}
                  onClick={() =>
                    void syncAccount(selectedAccount.id, {
                      providerFolderId: activeFolder?.providerFolderId ?? null,
                      maxResults: 20,
                    })
                  }
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--card)] hover:text-[var(--fg)] disabled:opacity-50"
                >
                  <RefreshCw
                    size={16}
                    className={
                      syncingAccountId === selectedAccount.id ? "animate-spin" : ""
                    }
                  />
                </button>
              </div>
            )}
          </div>
          <label className="mt-3 flex h-9 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 text-sm">
            <Search size={15} className="shrink-0 text-[var(--muted)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void searchMail();
                }
              }}
              placeholder="Search mail"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--muted)]"
            />
            <button
              type="button"
              title="Search Gmail"
              disabled={!trimmedQuery || !!pendingAction}
              onClick={() => void searchMail()}
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--fg)] disabled:opacity-50"
            >
              {searchingMail ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Search size={14} />
              )}
            </button>
          </label>
          {uiError && (
            <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
              {uiError}
            </div>
          )}
          {uiNotice && (
            <div className="mt-2 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-xs text-[var(--muted)]">
              {uiNotice}
            </div>
          )}
          {mailWorkspace.setupError && (
            <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
              {mailWorkspace.setupError}
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
            <div className="px-3 py-8 text-center">
              <p className="text-sm text-[var(--muted)]">No messages here.</p>
              {canLoadMore && (
                <button
                  type="button"
                  disabled={!!pendingAction}
                  onClick={() =>
                    void syncAccount(selectedAccount.id, {
                      providerFolderId: activeFolder?.providerFolderId ?? null,
                      loadMore: true,
                    })
                  }
                  className="mt-3 inline-flex h-8 items-center gap-2 rounded-md border border-[var(--border)] px-3 text-xs font-medium text-[var(--fg)] hover:bg-[var(--card)] disabled:opacity-50"
                >
                  {loadingMore && <Loader2 size={14} className="animate-spin" />}
                  Load mail
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="mb-2 flex h-9 items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--card)] px-2">
                <button
                  type="button"
                  title={allVisibleThreadsSelected ? "Clear selection" : "Select all visible"}
                  onClick={toggleAllVisibleThreads}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--fg)]"
                >
                  {allVisibleThreadsSelected ? (
                    <CheckSquare size={15} />
                  ) : (
                    <Square size={15} />
                  )}
                </button>
                <span className="min-w-0 flex-1 truncate text-xs text-[var(--muted)]">
                  {selectedBulkThreads.length > 0
                    ? `${selectedBulkThreads.length} selected`
                    : "Select"}
                </span>
                {selectedBulkThreads.length > 0 && (
                  <>
                    <button
                      type="button"
                      title="Mark read"
                      disabled={bulkBusy || selectedBulkMessageIds.length === 0}
                      onClick={() => void runBulkAction("mark_read")}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--fg)] disabled:opacity-50"
                    >
                      {pendingAction === "bulk:mark_read" ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Check size={14} />
                      )}
                    </button>
                    <button
                      type="button"
                      title="Mark unread"
                      disabled={bulkBusy || selectedBulkMessageIds.length === 0}
                      onClick={() => void runBulkAction("mark_unread")}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--fg)] disabled:opacity-50"
                    >
                      {pendingAction === "bulk:mark_unread" ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Mail size={14} />
                      )}
                    </button>
                    <button
                      type="button"
                      title={
                        activeFolder?.providerFolderId === "TRASH"
                          ? "Move out of Trash first"
                          : "Archive"
                      }
                      disabled={
                        bulkBusy ||
                        selectedBulkMessageIds.length === 0 ||
                        activeFolder?.providerFolderId === "TRASH"
                      }
                      onClick={() => void runBulkAction("archive")}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--fg)] disabled:opacity-50"
                    >
                      {pendingAction === "bulk:archive" ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Archive size={14} />
                      )}
                    </button>
                    <button
                      type="button"
                      title="Star"
                      disabled={bulkBusy || selectedBulkMessageIds.length === 0}
                      onClick={() => void runBulkAction("star")}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--fg)] disabled:opacity-50"
                    >
                      {pendingAction === "bulk:star" ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Star size={14} />
                      )}
                    </button>
                    <button
                      type="button"
                      title={
                        selectedBulkDeleteForever ? "Delete forever" : "Trash"
                      }
                      disabled={
                        bulkBusy ||
                        selectedBulkDeleteMessageIds.length === 0
                      }
                      onClick={() => void runBulkAction(selectedBulkDeleteAction)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--bg)] hover:text-red-500 disabled:opacity-50"
                    >
                      {pendingAction === `bulk:${selectedBulkDeleteAction}` ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                    <select
                      value=""
                      title="Move selected"
                      disabled={
                        bulkBusy ||
                        selectedBulkMessageIds.length === 0 ||
                        moveTargets.length === 0
                      }
                      onChange={(event) => {
                        const target = event.target.value;
                        event.currentTarget.value = "";
                        if (target) {
                          void moveMessages(selectedBulkMessageIds, target, true);
                        }
                      }}
                      className="h-7 w-24 rounded-md border border-[var(--border)] bg-[var(--bg)] px-1 text-xs text-[var(--fg)] outline-none disabled:opacity-50"
                    >
                      <option value="">Move</option>
                      {moveTargets.map((folder) => (
                        <option key={folder.id} value={folder.providerFolderId}>
                          {folderDisplayName(folder)}
                        </option>
                      ))}
                    </select>
                  </>
                )}
              </div>
              <ul className="space-y-0.5">
                {visibleThreads.map((thread) => {
                  const selected = selectedThread?.id === thread.id;
                  const checked = selectedThreadIds.has(thread.id);
                  return (
                    <li key={thread.id}>
                      <div
                        className={`flex rounded-lg transition-colors ${
                          selected
                            ? "bg-[var(--card)] ring-1 ring-[var(--border)]"
                            : checked
                              ? "bg-[var(--card)]/60"
                              : thread.unread
                                ? "bg-[var(--card)]/35 hover:bg-[var(--card)]/80"
                                : "hover:bg-[var(--card)]/80"
                        }`}
                      >
                        <button
                          type="button"
                          title={checked ? "Unselect" : "Select"}
                          onClick={() => toggleThreadSelected(thread.id)}
                          className="flex w-8 shrink-0 items-start justify-center rounded-l-lg pt-3 text-[var(--muted)] hover:text-[var(--fg)]"
                        >
                          {checked ? <CheckSquare size={15} /> : <Square size={15} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedThreadId(thread.id)}
                          aria-label={`${thread.unread ? "Unread: " : ""}${thread.subject}`}
                          className="min-w-0 flex-1 rounded-r-lg py-2 pr-3 text-left"
                        >
                          <span className="flex items-start gap-2">
                            <span
                              aria-hidden="true"
                              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                                thread.unread ? "bg-blue-400" : "bg-transparent"
                              }`}
                            />
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
                            <span
                              className="shrink-0 text-[11px] text-[var(--muted)]"
                            >
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
                              {cleanMailText(thread.snippet)}
                            </span>
                          </span>
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="px-3 py-3">
                <button
                  type="button"
                  disabled={!canLoadMore || !!pendingAction}
                  onClick={() =>
                    void syncAccount(selectedAccount.id, {
                      providerFolderId: activeFolder?.providerFolderId ?? null,
                      loadMore: true,
                    })
                  }
                  className="inline-flex h-8 w-full items-center justify-center gap-2 rounded-md border border-[var(--border)] text-xs font-medium text-[var(--muted)] hover:bg-[var(--card)] hover:text-[var(--fg)] disabled:cursor-default disabled:opacity-50"
                >
                  {loadingMore && <Loader2 size={14} className="animate-spin" />}
                  {canLoadMore ? "Load more" : "All synced"}
                </button>
              </div>
            </>
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
              {selectedIsDraft ? (
                <button
                  type="button"
                  title="Edit draft"
                  disabled={!!pendingAction || messageBodyLoading}
                  onClick={() => void openDraft()}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-[var(--fg)] hover:bg-[var(--card)] disabled:opacity-50"
                >
                  <PencilLine size={15} />
                  Edit
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    title="Reply"
                    disabled={
                      !!pendingAction || messageBodyLoading || !selectedMessage.fromEmail
                    }
                    onClick={openReply}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--card)] hover:text-[var(--fg)] disabled:opacity-50"
                  >
                    <Reply size={16} />
                  </button>
                  <button
                    type="button"
                    title="Forward"
                    disabled={!!pendingAction || messageBodyLoading}
                    onClick={openForward}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--card)] hover:text-[var(--fg)] disabled:opacity-50"
                  >
                    <Forward size={16} />
                  </button>
                </>
              )}
              {!selectedIsDraft && (
                <>
                  <button
                    type="button"
                    title={selectedThreadStarred ? "Unstar thread" : "Star thread"}
                    disabled={
                      !!pendingAction || selectedThreadActionMessageIds.length === 0
                    }
                    onClick={() =>
                      void runMessageAction(
                        selectedThreadStarred ? "unstar" : "star",
                      )
                    }
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--card)] hover:text-[var(--fg)] disabled:opacity-50"
                  >
                    <Star
                      size={16}
                      className={
                        selectedThreadStarred
                          ? "fill-yellow-400 text-yellow-500"
                          : ""
                      }
                    />
                  </button>
                  <button
                    type="button"
                    title={
                      selectedThreadUnread
                        ? "Mark thread read"
                        : "Mark thread unread"
                    }
                    disabled={
                      !!pendingAction || selectedThreadActionMessageIds.length === 0
                    }
                    onClick={() =>
                      void runMessageAction(
                        selectedThreadUnread ? "mark_read" : "mark_unread",
                      )
                    }
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--card)] hover:text-[var(--fg)] disabled:opacity-50"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    type="button"
                    title={
                      activeFolder?.providerFolderId === "TRASH"
                        ? "Move out of Trash first"
                        : "Archive thread"
                    }
                    disabled={
                      !!pendingAction ||
                      selectedThreadActionMessageIds.length === 0 ||
                      activeFolder?.providerFolderId === "TRASH"
                    }
                    onClick={() => void runMessageAction("archive")}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--card)] hover:text-[var(--fg)] disabled:opacity-50"
                  >
                    <Archive size={16} />
                  </button>
                  <select
                    value=""
                    title="Move thread"
                    disabled={
                      !!pendingAction ||
                      moveTargets.length === 0 ||
                      selectedThreadActionMessageIds.length === 0
                    }
                    onChange={(event) => {
                      const target = event.target.value;
                      event.currentTarget.value = "";
                      if (target) void moveMessages(selectedThreadActionMessageIds, target);
                    }}
                    className="h-8 w-24 rounded-md border border-[var(--border)] bg-[var(--bg)] px-1 text-xs text-[var(--fg)] outline-none disabled:opacity-50"
                  >
                    <option value="">Move</option>
                    {moveTargets.map((folder) => (
                      <option key={folder.id} value={folder.providerFolderId}>
                        {folderDisplayName(folder)}
                      </option>
                    ))}
                  </select>
                </>
              )}
              <button
                type="button"
                title={
                  selectedIsDraft
                    ? "Discard draft"
                    : selectedThreadDeleteForever
                      ? "Delete forever"
                      : "Trash"
                }
                disabled={
                  !!pendingAction ||
                  (!selectedIsDraft && selectedThreadDeleteMessageIds.length === 0)
                }
                onClick={() =>
                  void runMessageAction(
                    selectedIsDraft ? "delete_draft" : selectedThreadDeleteAction,
                  )
                }
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
                <h1 className="text-2xl font-semibold">{threadTitle}</h1>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {plural(selectedMessages.length, "message")} in this thread
                </p>
              </header>

              <div className="divide-y divide-[var(--border)]">
                {selectedMessages.map((message) => {
                  const loadingBody = messageBodyIsLoading(message);
                  return (
                    <section key={message.id} className="py-6">
                      <header className="mb-4 flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="truncate text-sm font-semibold">
                              {messageSender(message)}
                            </span>
                            {message.fromEmail && (
                              <span className="truncate text-xs text-[var(--muted)]">
                                &lt;{message.fromEmail}&gt;
                              </span>
                            )}
                          </div>
                          {message.toRecipients.length > 0 && (
                            <div className="mt-1 truncate text-xs text-[var(--muted)]">
                              To {messageRecipients(message.toRecipients)}
                            </div>
                          )}
                        </div>
                        <time className="shrink-0 text-xs text-[var(--muted)]">
                          {message.receivedAt
                            ? new Intl.DateTimeFormat(undefined, {
                                dateStyle: "medium",
                                timeStyle: "short",
                              }).format(new Date(message.receivedAt))
                            : ""}
                        </time>
                      </header>

                      <div className="text-[15px] leading-7">
                        {loadingBody ? (
                          <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
                            <Loader2 size={15} className="animate-spin" />
                            Loading message...
                          </div>
                        ) : (
                          renderMailHtml(message.bodyHtml) ??
                          renderMailBody(message.bodyText || message.snippet)
                        )}
                      </div>
                      {renderMessageAttachments(message)}
                    </section>
                  );
                })}
              </div>
            </article>
          )}
        </div>
      </main>
      {compose && (
        <div
          role="dialog"
          aria-modal="false"
          aria-labelledby="compose-title"
          className="fixed bottom-4 right-4 z-40 flex max-h-[calc(100dvh-2rem)] w-[min(560px,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg)] shadow-2xl"
        >
          <div className="flex h-11 shrink-0 items-center justify-between border-b border-[var(--border)] px-3">
            <div className="flex min-w-0 items-center gap-2">
              <PencilLine size={15} className="shrink-0 text-[var(--muted)]" />
              <h2 id="compose-title" className="truncate text-sm font-semibold">
                {composeTitle}
              </h2>
            </div>
            <button
              type="button"
              title="Close"
              disabled={composingBusy}
              onClick={() => setCompose(null)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--card)] hover:text-[var(--fg)] disabled:opacity-50"
            >
              <X size={16} />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="border-b border-[var(--border)] px-3 py-2">
              <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
                <span className="w-12 shrink-0">From</span>
                <select
                  value={compose.accountId}
                  disabled={composingBusy || compose.mode === "reply"}
                  onChange={(event) =>
                    setCompose((current) =>
                      current
                        ? { ...current, accountId: event.target.value }
                        : current,
                    )
                  }
                  className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm text-[var(--fg)] outline-none disabled:opacity-70"
                >
                  {mailWorkspace.accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {accountName(account)} · {account.email}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="border-b border-[var(--border)] px-3 py-2">
              <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
                <span className="w-12 shrink-0">To</span>
                <input
                  value={compose.to}
                  disabled={composingBusy}
                  onChange={(event) =>
                    setCompose((current) =>
                      current ? { ...current, to: event.target.value } : current,
                    )
                  }
                  className="min-w-0 flex-1 bg-transparent text-sm text-[var(--fg)] outline-none placeholder:text-[var(--muted)]"
                  placeholder="name@example.com"
                />
                <button
                  type="button"
                  disabled={composingBusy}
                  onClick={() => setShowCcBcc((value) => !value)}
                  className="rounded-md px-2 py-1 text-xs text-[var(--muted)] hover:bg-[var(--card)] hover:text-[var(--fg)] disabled:opacity-50"
                >
                  Cc/Bcc
                </button>
              </label>
            </div>
            {showCcBcc && (
              <>
                <div className="border-b border-[var(--border)] px-3 py-2">
                  <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
                    <span className="w-12 shrink-0">Cc</span>
                    <input
                      value={compose.cc}
                      disabled={composingBusy}
                      onChange={(event) =>
                        setCompose((current) =>
                          current
                            ? { ...current, cc: event.target.value }
                            : current,
                        )
                      }
                      className="min-w-0 flex-1 bg-transparent text-sm text-[var(--fg)] outline-none placeholder:text-[var(--muted)]"
                      placeholder="name@example.com"
                    />
                  </label>
                </div>
                <div className="border-b border-[var(--border)] px-3 py-2">
                  <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
                    <span className="w-12 shrink-0">Bcc</span>
                    <input
                      value={compose.bcc}
                      disabled={composingBusy}
                      onChange={(event) =>
                        setCompose((current) =>
                          current
                            ? { ...current, bcc: event.target.value }
                            : current,
                        )
                      }
                      className="min-w-0 flex-1 bg-transparent text-sm text-[var(--fg)] outline-none placeholder:text-[var(--muted)]"
                      placeholder="name@example.com"
                    />
                  </label>
                </div>
              </>
            )}
            <div className="border-b border-[var(--border)] px-3 py-2">
              <input
                value={compose.subject}
                disabled={composingBusy}
                onChange={(event) =>
                  setCompose((current) =>
                    current
                      ? { ...current, subject: event.target.value }
                      : current,
                  )
                }
                className="w-full bg-transparent text-sm font-medium text-[var(--fg)] outline-none placeholder:text-[var(--muted)]"
                placeholder="Subject"
              />
            </div>
            <textarea
              value={compose.bodyText}
              disabled={composingBusy}
              onChange={(event) =>
                setCompose((current) =>
                  current ? { ...current, bodyText: event.target.value } : current,
                )
              }
              className="min-h-[280px] w-full resize-none bg-transparent px-3 py-3 text-sm leading-6 text-[var(--fg)] outline-none placeholder:text-[var(--muted)] disabled:opacity-70"
              placeholder=""
            />
            {compose.attachments.length > 0 && (
              <div className="space-y-2 border-t border-[var(--border)] px-3 py-3">
                {compose.attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex min-w-0 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-2"
                  >
                    <Paperclip size={15} className="shrink-0 text-[var(--muted)]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">
                        {attachment.filename}
                      </span>
                      <span className="block truncate text-xs text-[var(--muted)]">
                        {composeAttachmentLabel(attachment)}
                      </span>
                    </span>
                    <button
                      type="button"
                      title="Remove attachment"
                      disabled={composingBusy}
                      onClick={() => removeComposeAttachment(attachment.id)}
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--bg)] hover:text-red-500 disabled:opacity-50"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[var(--border)] px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <input
                ref={composeFileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(event) => {
                  void addComposeFiles(event.currentTarget.files);
                  event.currentTarget.value = "";
                }}
              />
              <button
                type="button"
                title="Attach files"
                disabled={composingBusy}
                onClick={() => composeFileInputRef.current?.click()}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--card)] hover:text-[var(--fg)] disabled:opacity-50"
              >
                <Paperclip size={16} />
              </button>
              <span className="min-w-0 truncate text-xs text-[var(--muted)]">
                {compose.attachments.length > 0
                  ? `${compose.attachments.length} file${
                      compose.attachments.length === 1 ? "" : "s"
                    } · ${formatFileSize(composeAttachmentSize(compose.attachments))}`
                  : (composeAccount?.email ?? "")}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                disabled={composingBusy || !compose.accountId}
                onClick={() => void saveDraft()}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--border)] px-3 text-sm font-medium text-[var(--fg)] hover:bg-[var(--card)] disabled:opacity-50"
              >
                {savingDraft && <Loader2 size={15} className="animate-spin" />}
                Save draft
              </button>
              <button
                type="button"
                disabled={composingBusy || !compose.to.trim() || !compose.accountId}
                onClick={() => void sendCompose()}
                className="inline-flex h-9 items-center gap-2 rounded-md bg-[var(--fg)] px-3 text-sm font-medium text-[var(--bg)] hover:opacity-90 disabled:opacity-50"
              >
                {sendingMail ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Send size={15} />
                )}
                Send
              </button>
            </div>
          </div>
        </div>
      )}
      {trashDialogAccount && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="empty-trash-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !pendingAction) {
              setTrashDialogAccountId(null);
            }
          }}
        >
          <div className="w-full max-w-sm rounded-lg border border-[var(--border)] bg-[var(--bg)] p-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-500">
                <Trash2 size={18} />
              </div>
              <div className="min-w-0">
                <h2 id="empty-trash-title" className="text-base font-semibold">
                  Empty Trash?
                </h2>
                <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                  This will permanently delete
                  {trashDialogCount > 0
                    ? ` ${trashDialogCount} message${trashDialogCount === 1 ? "" : "s"}`
                    : " all messages"}
                  {" "}from Trash in {trashDialogAccount.email}. This cannot be
                  undone.
                </p>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={!!pendingAction}
                onClick={() => setTrashDialogAccountId(null)}
                className="inline-flex h-9 items-center rounded-md border border-[var(--border)] px-3 text-sm font-medium text-[var(--fg)] hover:bg-[var(--card)] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!!pendingAction}
                onClick={() => void emptyTrash(trashDialogAccount.id)}
                className="inline-flex h-9 items-center gap-2 rounded-md bg-red-600 px-3 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-60"
              >
                {pendingAction === "empty-trash" && (
                  <Loader2 size={15} className="animate-spin" />
                )}
                Empty Trash
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
