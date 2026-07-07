import { createAdminClient } from "@/lib/supabaseAdmin";
import {
  decryptMailSecret,
  encryptMailSecret,
} from "@/lib/mail-crypto-server";
import { applyMailActionToLabels } from "@/lib/mail";
import { cleanMailText } from "@/lib/mail-text";
import type {
  MailAccount,
  MailAccountStatus,
  MailFolder,
  MailFolderKind,
  MailMessage,
  MailMessageAction,
  MailProvider,
  MailRecipient,
  MailThread,
  MailWorkspace,
} from "@/lib/mail";

export const GMAIL_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://mail.google.com/",
] as const;

const FULL_GMAIL_SCOPE = "https://mail.google.com/";
const MAX_EMPTY_TRASH_MESSAGES = 500;
const GMAIL_BATCH_DELETE_CHUNK_SIZE = 500;
const GMAIL_SYNC_PAGE_SIZE = 50;
const MAIL_WORKSPACE_THREAD_LIMIT = 500;
const MAIL_WORKSPACE_MESSAGE_LIMIT = 2000;
const DEFAULT_GMAIL_CURSOR_KEY = "ALL";

const MAIL_TABLE_SETUP_ERROR =
  "Mail database is not set up yet. Apply supabase/migrations/034_mail_client.sql.";

export function emptyMailWorkspace(setupError: string): MailWorkspace {
  return {
    accounts: [],
    folders: [],
    threads: [],
    messages: [],
    setupError,
  };
}

export function mailWorkspaceLoadError(err: unknown): string {
  if (!err || typeof err !== "object") {
    return "Mail could not load. Check the server logs.";
  }
  const error = err as {
    code?: unknown;
    message?: unknown;
    details?: unknown;
    hint?: unknown;
  };
  const code = typeof error.code === "string" ? error.code : "";
  const message = [
    error.message,
    error.details,
    error.hint,
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ");
  const lowerMessage = message.toLowerCase();

  if (
    code === "42P01" ||
    code === "42703" ||
    code.startsWith("PGRST") ||
    lowerMessage.includes("mail_accounts") ||
    lowerMessage.includes("mail_folders") ||
    lowerMessage.includes("mail_threads") ||
    lowerMessage.includes("mail_messages") ||
    (lowerMessage.includes("schema cache") && lowerMessage.includes("mail_"))
  ) {
    return MAIL_TABLE_SETUP_ERROR;
  }

  return "Mail could not load. Check the server logs.";
}

type MailAccountRow = {
  id: string;
  owner_id: string;
  provider: MailProvider;
  provider_account_id: string | null;
  email: string;
  display_name: string;
  status: MailAccountStatus;
  error: string | null;
  scopes: string[] | null;
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  token_expires_at: string | null;
  sync_state: unknown;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
};

type MailFolderRow = {
  id: string;
  owner_id: string;
  account_id: string;
  provider_folder_id: string;
  name: string;
  kind: MailFolderKind;
  unread_count: number;
  total_count: number;
  created_at: string;
  updated_at: string;
};

type MailThreadRow = {
  id: string;
  owner_id: string;
  account_id: string;
  folder_id: string | null;
  provider_thread_id: string;
  subject: string;
  participants: unknown;
  snippet: string;
  last_message_at: string | null;
  unread: boolean;
  starred: boolean;
  labels: string[] | null;
  created_at: string;
  updated_at: string;
};

type MailMessageRow = {
  id: string;
  owner_id: string;
  account_id: string;
  thread_id: string | null;
  folder_id: string | null;
  provider_message_id: string;
  from_email: string;
  from_name: string;
  to_recipients: unknown;
  cc_recipients: unknown;
  bcc_recipients: unknown;
  subject: string;
  snippet: string;
  body_text: string;
  body_html: string;
  sent_at: string | null;
  received_at: string | null;
  unread: boolean;
  starred: boolean;
  has_attachments: boolean;
  attachments: unknown;
  labels: string[] | null;
  created_at: string;
  updated_at: string;
};

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

type GoogleUserInfo = {
  id?: string;
  email?: string;
  name?: string;
};

type GmailProfile = {
  emailAddress?: string;
  historyId?: string;
};

type GmailLabel = {
  id: string;
  name: string;
  type?: string;
  messagesTotal?: number;
  messagesUnread?: number;
};

type GmailMessageList = {
  messages?: { id: string; threadId: string }[];
  nextPageToken?: string;
};

type GmailHeader = {
  name: string;
  value: string;
};

type GmailMessagePart = {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: {
    attachmentId?: string;
    data?: string;
    size?: number;
  };
  parts?: GmailMessagePart[];
};

type GmailMessage = {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: GmailMessagePart;
};

type ParsedGmailMessage = {
  providerMessageId: string;
  providerThreadId: string;
  folderId: string | null;
  subject: string;
  snippet: string;
  from: MailRecipient;
  to: MailRecipient[];
  cc: MailRecipient[];
  bcc: MailRecipient[];
  bodyText: string;
  bodyHtml: string;
  sentAt: string | null;
  receivedAt: string | null;
  unread: boolean;
  starred: boolean;
  hasAttachments: boolean;
  labels: string[];
};

function jsonObject(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
}

function stringRecord(raw: unknown): Record<string, string | null> {
  const object = jsonObject(raw);
  return Object.fromEntries(
    Object.entries(object)
      .filter((entry): entry is [string, string | null] => {
        const value = entry[1];
        return typeof value === "string" || value === null;
      }),
  );
}

function booleanRecord(raw: unknown): Record<string, boolean> {
  const object = jsonObject(raw);
  return Object.fromEntries(
    Object.entries(object).filter(
      (entry): entry is [string, boolean] => typeof entry[1] === "boolean",
    ),
  );
}

function gmailCursorKey(providerFolderId: string | null | undefined): string {
  return providerFolderId || DEFAULT_GMAIL_CURSOR_KEY;
}

function stringArray(raw: string[] | null): string[] {
  return Array.isArray(raw) ? raw.filter((v) => typeof v === "string") : [];
}

function recipients(raw: unknown): MailRecipient[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const r = item as Record<string, unknown>;
      if (typeof r.email !== "string") return null;
      return {
        email: r.email,
        name: typeof r.name === "string" ? r.name : "",
      };
    })
    .filter((item): item is MailRecipient => item !== null);
}

function recordArray(raw: unknown): Record<string, unknown>[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is Record<string, unknown> =>
      !!item && typeof item === "object" && !Array.isArray(item),
  );
}

function mapAccount(row: MailAccountRow): MailAccount {
  return {
    id: row.id,
    ownerId: row.owner_id,
    provider: row.provider,
    providerAccountId: row.provider_account_id,
    email: row.email,
    displayName: row.display_name,
    status: row.status,
    error: row.error,
    scopes: stringArray(row.scopes),
    tokenExpiresAt: row.token_expires_at,
    syncState: jsonObject(row.sync_state),
    lastSyncedAt: row.last_synced_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapFolder(row: MailFolderRow): MailFolder {
  return {
    id: row.id,
    ownerId: row.owner_id,
    accountId: row.account_id,
    providerFolderId: row.provider_folder_id,
    name: row.name,
    kind: row.kind,
    unreadCount: row.unread_count,
    totalCount: row.total_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapThread(row: MailThreadRow): MailThread {
  return {
    id: row.id,
    ownerId: row.owner_id,
    accountId: row.account_id,
    folderId: row.folder_id,
    providerThreadId: row.provider_thread_id,
    subject: row.subject,
    participants: recipients(row.participants),
    snippet: row.snippet,
    lastMessageAt: row.last_message_at,
    unread: row.unread,
    starred: row.starred,
    labels: stringArray(row.labels),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMessage(row: MailMessageRow): MailMessage {
  return {
    id: row.id,
    ownerId: row.owner_id,
    accountId: row.account_id,
    threadId: row.thread_id,
    folderId: row.folder_id,
    providerMessageId: row.provider_message_id,
    fromEmail: row.from_email,
    fromName: row.from_name,
    toRecipients: recipients(row.to_recipients),
    ccRecipients: recipients(row.cc_recipients),
    bccRecipients: recipients(row.bcc_recipients),
    subject: row.subject,
    snippet: row.snippet,
    bodyText: row.body_text,
    bodyHtml: row.body_html,
    sentAt: row.sent_at,
    receivedAt: row.received_at,
    unread: row.unread,
    starred: row.starred,
    hasAttachments: row.has_attachments,
    attachments: recordArray(row.attachments),
    labels: stringArray(row.labels),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function requireGoogleClientId(): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID is required for Gmail");
  return clientId;
}

function requireGoogleClientSecret(): string {
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientSecret) {
    throw new Error("GOOGLE_CLIENT_SECRET is required for Gmail");
  }
  return clientSecret;
}

export function gmailOAuthUrl(input: {
  origin: string;
  state: string;
  loginHint?: string | null;
}): string {
  const params = new URLSearchParams({
    client_id: requireGoogleClientId(),
    redirect_uri: `${input.origin}/api/mail/google/callback`,
    response_type: "code",
    scope: GMAIL_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: input.state,
  });
  if (input.loginHint) params.set("login_hint", input.loginHint);
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGmailOAuthCode(input: {
  origin: string;
  code: string;
}): Promise<GoogleTokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: input.code,
      client_id: requireGoogleClientId(),
      client_secret: requireGoogleClientSecret(),
      redirect_uri: `${input.origin}/api/mail/google/callback`,
      grant_type: "authorization_code",
    }),
  });
  const data = (await res.json()) as GoogleTokenResponse;
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "OAuth failed");
  }
  return data;
}

async function googleJson<T>(accessToken: string, url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const data = (await res.json()) as T & {
    error?: { message?: string } | string;
  };
  if (!res.ok) {
    const message =
      typeof data.error === "object"
        ? data.error?.message
        : typeof data.error === "string"
          ? data.error
          : null;
    throw new Error(message || `Google request failed (${res.status})`);
  }
  return data;
}

async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  return googleJson<GoogleUserInfo>(
    accessToken,
    "https://www.googleapis.com/oauth2/v2/userinfo",
  );
}

async function fetchGmailProfile(accessToken: string): Promise<GmailProfile> {
  return googleJson<GmailProfile>(
    accessToken,
    "https://gmail.googleapis.com/gmail/v1/users/me/profile",
  );
}

export async function upsertGmailAccountFromOAuth(input: {
  ownerId: string;
  tokens: GoogleTokenResponse;
}): Promise<MailAccount> {
  const accessToken = input.tokens.access_token;
  if (!accessToken) throw new Error("Missing Google access token");
  const [profile, gmailProfile] = await Promise.all([
    fetchGoogleUserInfo(accessToken),
    fetchGmailProfile(accessToken),
  ]);
  const email = (gmailProfile.emailAddress || profile.email || "")
    .trim()
    .toLowerCase();
  if (!email) throw new Error("Google account did not return an email");

  const db = createAdminClient();
  const now = new Date().toISOString();
  const tokenExpiresAt =
    typeof input.tokens.expires_in === "number"
      ? new Date(Date.now() + input.tokens.expires_in * 1000).toISOString()
      : null;

  const existing = await db
    .from("mail_accounts")
    .select("*")
    .eq("owner_id", input.ownerId)
    .eq("provider", "gmail")
    .eq("email", email)
    .maybeSingle();
  if (existing.error) throw existing.error;

  const patch = {
    provider_account_id: profile.id ?? email,
    display_name: profile.name ?? "",
    status: "connected",
    error: null,
    scopes: (input.tokens.scope ?? GMAIL_SCOPES.join(" ")).split(/\s+/),
    access_token_encrypted: encryptMailSecret(accessToken),
    ...(input.tokens.refresh_token
      ? { refresh_token_encrypted: encryptMailSecret(input.tokens.refresh_token) }
      : {}),
    token_expires_at: tokenExpiresAt,
    sync_state: {
      ...(gmailProfile.historyId ? { historyId: gmailProfile.historyId } : {}),
    },
    updated_at: now,
  };

  if (existing.data) {
    const { data, error } = await db
      .from("mail_accounts")
      .update(patch)
      .eq("id", (existing.data as MailAccountRow).id)
      .eq("owner_id", input.ownerId)
      .select("*")
      .single();
    if (error) throw error;
    return mapAccount(data as MailAccountRow);
  }

  const { data, error } = await db
    .from("mail_accounts")
    .insert({
      owner_id: input.ownerId,
      provider: "gmail",
      email,
      ...patch,
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapAccount(data as MailAccountRow);
}

export async function listMailWorkspace(
  ownerId: string,
): Promise<MailWorkspace> {
  const db = createAdminClient();
  const [accountsRes, foldersRes, threadsRes, messagesRes] =
    await Promise.all([
      db
        .from("mail_accounts")
        .select("*")
        .eq("owner_id", ownerId)
        .order("email", { ascending: true }),
      db
        .from("mail_folders")
        .select("*")
        .eq("owner_id", ownerId)
        .order("kind", { ascending: true })
        .order("name", { ascending: true }),
      db
        .from("mail_threads")
        .select("*")
        .eq("owner_id", ownerId)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(MAIL_WORKSPACE_THREAD_LIMIT),
      db
        .from("mail_messages")
        .select("*")
        .eq("owner_id", ownerId)
        .order("received_at", { ascending: false, nullsFirst: false })
        .limit(MAIL_WORKSPACE_MESSAGE_LIMIT),
    ]);
  const setupError = [
    accountsRes.error,
    foldersRes.error,
    threadsRes.error,
    messagesRes.error,
  ]
    .map(mailWorkspaceLoadError)
    .find((message) => message === MAIL_TABLE_SETUP_ERROR);
  if (setupError) {
    return emptyMailWorkspace(setupError);
  }
  if (accountsRes.error) throw accountsRes.error;
  if (foldersRes.error) throw foldersRes.error;
  if (threadsRes.error) throw threadsRes.error;
  if (messagesRes.error) throw messagesRes.error;

  return {
    accounts: (accountsRes.data as MailAccountRow[]).map(mapAccount),
    folders: (foldersRes.data as MailFolderRow[]).map(mapFolder),
    threads: (threadsRes.data as MailThreadRow[]).map(mapThread),
    messages: (messagesRes.data as MailMessageRow[]).map(mapMessage),
  };
}

async function getPrivateAccount(
  ownerId: string,
  accountId: string,
): Promise<MailAccountRow | null> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("mail_accounts")
    .select("*")
    .eq("id", accountId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (error) throw error;
  return data ? (data as MailAccountRow) : null;
}

async function updateAccountStatus(
  accountId: string,
  ownerId: string,
  patch: Partial<{
    status: MailAccountStatus;
    error: string | null;
    last_synced_at: string | null;
    sync_state: Record<string, unknown>;
    access_token_encrypted: string;
    refresh_token_encrypted: string;
    token_expires_at: string | null;
  }>,
) {
  const db = createAdminClient();
  const { error } = await db
    .from("mail_accounts")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", accountId)
    .eq("owner_id", ownerId);
  if (error) throw error;
}

async function refreshGmailAccessToken(
  account: MailAccountRow,
): Promise<string> {
  const refreshToken = decryptMailSecret(account.refresh_token_encrypted);
  if (!refreshToken) {
    throw new Error("Reconnect this Gmail account to refresh access");
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requireGoogleClientId(),
      client_secret: requireGoogleClientSecret(),
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = (await res.json()) as GoogleTokenResponse;
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Token refresh failed");
  }
  await updateAccountStatus(account.id, account.owner_id, {
    access_token_encrypted: encryptMailSecret(data.access_token),
    ...(data.refresh_token
      ? { refresh_token_encrypted: encryptMailSecret(data.refresh_token) }
      : {}),
    token_expires_at:
      typeof data.expires_in === "number"
        ? new Date(Date.now() + data.expires_in * 1000).toISOString()
        : null,
    status: "connected",
    error: null,
  });
  return data.access_token;
}

async function gmailAccessToken(account: MailAccountRow): Promise<string> {
  const expiresAt = account.token_expires_at
    ? new Date(account.token_expires_at).getTime()
    : 0;
  if (expiresAt > Date.now() + 60_000) {
    const token = decryptMailSecret(account.access_token_encrypted);
    if (token) return token;
  }
  return refreshGmailAccessToken(account);
}

function gmailLabelKind(label: GmailLabel): MailFolderKind {
  switch (label.id) {
    case "INBOX":
      return "inbox";
    case "SENT":
      return "sent";
    case "DRAFT":
      return "drafts";
    case "TRASH":
      return "trash";
    case "SPAM":
      return "spam";
    case "STARRED":
      return "starred";
    default:
      return "custom";
  }
}

function gmailLabelName(label: GmailLabel): string {
  switch (label.id) {
    case "INBOX":
      return "Inbox";
    case "SENT":
      return "Sent";
    case "DRAFT":
      return "Drafts";
    case "TRASH":
      return "Trash";
    case "SPAM":
      return "Spam";
    case "STARRED":
      return "Starred";
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
      return label.name;
  }
}

function shouldSyncGmailLabel(label: GmailLabel): boolean {
  if (
    [
      "INBOX",
      "SENT",
      "DRAFT",
      "TRASH",
      "SPAM",
      "STARRED",
    ].includes(label.id)
  ) {
    return true;
  }
  if (label.id.startsWith("CATEGORY_")) return true;
  return label.type === "user";
}

async function syncGmailFolders(input: {
  ownerId: string;
  accountId: string;
  accessToken: string;
}): Promise<Map<string, string>> {
  const data = await googleJson<{ labels?: GmailLabel[] }>(
    input.accessToken,
    "https://gmail.googleapis.com/gmail/v1/users/me/labels",
  );
  const labels = data.labels ?? [];
  const db = createAdminClient();
  const folderIdByProviderId = new Map<string, string>();
  for (const label of labels.filter(shouldSyncGmailLabel)) {
    const { data: row, error } = await db
      .from("mail_folders")
      .upsert(
        {
          owner_id: input.ownerId,
          account_id: input.accountId,
          provider_folder_id: label.id,
          name: gmailLabelName(label),
          kind: gmailLabelKind(label),
          unread_count: label.messagesUnread ?? 0,
          total_count: label.messagesTotal ?? 0,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "account_id,provider_folder_id" },
      )
      .select("id, provider_folder_id")
      .single();
    if (error) throw error;
    folderIdByProviderId.set(
      (row as { provider_folder_id: string }).provider_folder_id,
      (row as { id: string }).id,
    );
  }
  return folderIdByProviderId;
}

async function listMailFolderIds(input: {
  ownerId: string;
  accountId: string;
}): Promise<Map<string, string>> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("mail_folders")
    .select("id, provider_folder_id")
    .eq("owner_id", input.ownerId)
    .eq("account_id", input.accountId);
  if (error) throw error;
  return new Map(
    (data as { id: string; provider_folder_id: string }[]).map((row) => [
      row.provider_folder_id,
      row.id,
    ]),
  );
}

function decodeGmailData(data: string | undefined): string {
  if (!data) return "";
  return Buffer.from(data, "base64url").toString("utf8");
}

function walkParts(part: GmailMessagePart | undefined): GmailMessagePart[] {
  if (!part) return [];
  return [part, ...(part.parts ?? []).flatMap(walkParts)];
}

function header(headers: GmailHeader[] | undefined, name: string): string {
  const lower = name.toLowerCase();
  return headers?.find((h) => h.name.toLowerCase() === lower)?.value ?? "";
}

function stripHtml(html: string): string {
  return cleanMailText(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(?:div|p|tr|li|h[1-6])>/gi, "\n")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  );
}

function parseAddressList(value: string): MailRecipient[] {
  if (!value.trim()) return [];
  const parts = value.match(/(?:"[^"]*"|[^,])+/g) ?? [];
  return parts
    .map((part) => {
      const trimmed = part.trim();
      const bracket = /^(?:"?([^"]*)"?\s*)?<([^<>@\s]+@[^<>]+)>$/.exec(
        trimmed,
      );
      if (bracket) {
        return { name: bracket[1]?.trim() ?? "", email: bracket[2].trim() };
      }
      if (trimmed.includes("@")) return { name: "", email: trimmed };
      return null;
    })
    .filter((item): item is MailRecipient => item !== null);
}

function primaryFolderId(
  labels: string[],
  folderIdByProviderId: Map<string, string>,
): string | null {
  for (const id of ["INBOX", "SENT", "DRAFT", "STARRED", "SPAM", "TRASH"]) {
    if (labels.includes(id)) return folderIdByProviderId.get(id) ?? null;
  }
  return null;
}

function parseGmailMessage(
  message: GmailMessage,
  folderIdByProviderId: Map<string, string>,
): ParsedGmailMessage {
  const labels = message.labelIds ?? [];
  const parts = walkParts(message.payload);
  const headers = message.payload?.headers ?? [];
  const subject = header(headers, "Subject") || "(no subject)";
  const from = parseAddressList(header(headers, "From"))[0] ?? {
    email: "",
    name: "",
  };
  const to = parseAddressList(header(headers, "To"));
  const cc = parseAddressList(header(headers, "Cc"));
  const bcc = parseAddressList(header(headers, "Bcc"));
  const dateHeader = header(headers, "Date");
  const headerDate = dateHeader ? new Date(dateHeader) : null;
  const internalDate =
    message.internalDate && /^\d+$/.test(message.internalDate)
      ? new Date(Number(message.internalDate))
      : null;
  const receivedAt =
    (internalDate && !Number.isNaN(internalDate.getTime())
      ? internalDate
      : headerDate && !Number.isNaN(headerDate.getTime())
        ? headerDate
        : null
    )?.toISOString() ?? null;
  const sentAt =
    headerDate && !Number.isNaN(headerDate.getTime())
      ? headerDate.toISOString()
      : receivedAt;

  const textPart = parts.find((p) => p.mimeType === "text/plain");
  const htmlPart = parts.find((p) => p.mimeType === "text/html");
  const bodyText = cleanMailText(decodeGmailData(textPart?.body?.data));
  const bodyHtml = decodeGmailData(htmlPart?.body?.data).trim();

  return {
    providerMessageId: message.id,
    providerThreadId: message.threadId,
    folderId: primaryFolderId(labels, folderIdByProviderId),
    subject,
    snippet: cleanMailText(message.snippet ?? ""),
    from,
    to,
    cc,
    bcc,
    bodyText: bodyText || stripHtml(bodyHtml),
    bodyHtml,
    sentAt,
    receivedAt,
    unread: labels.includes("UNREAD"),
    starred: labels.includes("STARRED"),
    hasAttachments: parts.some((p) => !!p.filename),
    labels,
  };
}

async function fetchGmailMessage(
  accessToken: string,
  id: string,
): Promise<GmailMessage> {
  const params = new URLSearchParams({
    format: "full",
  });
  return googleJson<GmailMessage>(
    accessToken,
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(
      id,
    )}?${params.toString()}`,
  );
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isGmailConcurrencyError(err: unknown): boolean {
  const message = err instanceof Error ? err.message.toLowerCase() : "";
  return (
    message.includes("too many concurrent requests") ||
    message.includes("user-rate limit exceeded") ||
    message.includes("rate limit")
  );
}

async function fetchGmailMessageWithRetry(
  accessToken: string,
  id: string,
): Promise<GmailMessage> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await fetchGmailMessage(accessToken, id);
    } catch (err) {
      if (!isGmailConcurrencyError(err) || attempt === 3) throw err;
      await wait(1200 * (attempt + 1));
    }
  }
  throw new Error("Gmail message fetch failed");
}

async function fetchGmailMessagesLimited(
  accessToken: string,
  messages: { id: string }[],
): Promise<GmailMessage[]> {
  const results: GmailMessage[] = [];
  let nextIndex = 0;
  const workerCount = Math.min(3, messages.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < messages.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await fetchGmailMessageWithRetry(
          accessToken,
          messages[index].id,
        );
        await wait(80);
      }
    }),
  );
  return results.filter(Boolean);
}

async function listGmailMessagesPage(
  accessToken: string,
  input: {
    providerFolderId?: string | null;
    pageToken?: string | null;
  } = {},
): Promise<GmailMessageList> {
  const params = new URLSearchParams({
    maxResults: String(GMAIL_SYNC_PAGE_SIZE),
  });
  if (input.providerFolderId) params.set("labelIds", input.providerFolderId);
  if (input.pageToken) params.set("pageToken", input.pageToken);
  return googleJson<GmailMessageList>(
    accessToken,
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`,
  );
}

export type GmailSyncResult = {
  workspace: MailWorkspace;
  loadedCount: number;
  hasMore: boolean;
  providerFolderId: string | null;
};

export async function syncGmailAccount(input: {
  ownerId: string;
  accountId: string;
  providerFolderId?: string | null;
  backfill?: boolean;
}): Promise<GmailSyncResult> {
  const account = await getPrivateAccount(input.ownerId, input.accountId);
  if (!account || account.provider !== "gmail") {
    throw new Error("Mail account not found");
  }
  const providerFolderId =
    typeof input.providerFolderId === "string" && input.providerFolderId.trim()
      ? input.providerFolderId.trim()
      : null;
  const syncState = jsonObject(account.sync_state);
  const cursorKey = gmailCursorKey(providerFolderId);
  const cursors = stringRecord(syncState.gmailCursors);
  const hasMoreByLabel = booleanRecord(syncState.gmailHasMoreByLabel);
  const pageToken = input.backfill ? (cursors[cursorKey] ?? null) : null;

  await updateAccountStatus(account.id, input.ownerId, {
    status: "syncing",
    error: null,
  });

  let parsedCount = 0;
  let hasMore = false;

  try {
    const accessToken = await gmailAccessToken(account);
    const folderIdByProviderId = await syncGmailFolders({
      ownerId: input.ownerId,
      accountId: account.id,
      accessToken,
    });
    const listed = await listGmailMessagesPage(accessToken, {
      providerFolderId,
      pageToken,
    });
    const detailed = await fetchGmailMessagesLimited(
      accessToken,
      listed.messages ?? [],
    );
    const parsed = detailed
      .map((message) => parseGmailMessage(message, folderIdByProviderId))
      .sort((a, b) => {
        const aTime = a.receivedAt ? new Date(a.receivedAt).getTime() : 0;
        const bTime = b.receivedAt ? new Date(b.receivedAt).getTime() : 0;
        return aTime - bTime;
      });
    parsedCount = parsed.length;
    hasMore = Boolean(listed.nextPageToken);

    const db = createAdminClient();
    for (const message of parsed) {
      const { data: threadRow, error: threadError } = await db
        .from("mail_threads")
        .upsert(
          {
            owner_id: input.ownerId,
            account_id: account.id,
            folder_id: message.folderId,
            provider_thread_id: message.providerThreadId,
            subject: message.subject,
            participants: [message.from],
            snippet: message.snippet,
            last_message_at: message.receivedAt,
            unread: message.unread,
            starred: message.starred,
            labels: message.labels,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "account_id,provider_thread_id" },
        )
        .select("id")
        .single();
      if (threadError) throw threadError;

      const { error: messageError } = await db.from("mail_messages").upsert(
        {
          owner_id: input.ownerId,
          account_id: account.id,
          thread_id: (threadRow as { id: string }).id,
          folder_id: message.folderId,
          provider_message_id: message.providerMessageId,
          from_email: message.from.email,
          from_name: message.from.name,
          to_recipients: message.to,
          cc_recipients: message.cc,
          bcc_recipients: message.bcc,
          subject: message.subject,
          snippet: message.snippet,
          body_text: message.bodyText,
          body_html: message.bodyHtml,
          sent_at: message.sentAt,
          received_at: message.receivedAt,
          unread: message.unread,
          starred: message.starred,
          has_attachments: message.hasAttachments,
          attachments: [],
          labels: message.labels,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "account_id,provider_message_id" },
      );
      if (messageError) throw messageError;
    }

    const profile = await fetchGmailProfile(accessToken);
    const nextCursors = {
      ...cursors,
      [cursorKey]: listed.nextPageToken ?? null,
    };
    const nextHasMoreByLabel = {
      ...hasMoreByLabel,
      [cursorKey]: hasMore,
    };
    await updateAccountStatus(account.id, input.ownerId, {
      status: "connected",
      error: null,
      last_synced_at: new Date().toISOString(),
      sync_state: {
        ...syncState,
        ...(profile.historyId ? { historyId: profile.historyId } : {}),
        gmailCursors: nextCursors,
        gmailHasMoreByLabel: nextHasMoreByLabel,
        lastSyncProviderFolderId: providerFolderId,
        recentMessageCount: parsedCount,
      },
    });
  } catch (err) {
    await updateAccountStatus(account.id, input.ownerId, {
      status: "error",
      error: err instanceof Error ? err.message : "Sync failed",
    });
    throw err;
  }

  return {
    workspace: await listMailWorkspace(input.ownerId),
    loadedCount: parsedCount,
    hasMore,
    providerFolderId,
  };
}

async function gmailModify(
  accessToken: string,
  providerMessageId: string,
  body: { addLabelIds?: string[]; removeLabelIds?: string[] },
) {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(
      providerMessageId,
    )}/modify`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    throw new Error(data?.error?.message || `Gmail modify failed (${res.status})`);
  }
}

async function gmailTrash(accessToken: string, providerMessageId: string) {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(
      providerMessageId,
    )}/trash`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}` },
    },
  );
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    throw new Error(data?.error?.message || `Gmail trash failed (${res.status})`);
  }
}

async function gmailBatchDeleteMessages(
  accessToken: string,
  providerMessageIds: string[],
) {
  if (providerMessageIds.length === 0) return;
  const res = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/batchDelete",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ ids: providerMessageIds }),
    },
  );
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    throw new Error(
      data?.error?.message || `Gmail batch delete failed (${res.status})`,
    );
  }
}

function hasFullGmailScope(account: MailAccountRow): boolean {
  return (account.scopes ?? []).includes(FULL_GMAIL_SCOPE);
}

async function listGmailTrashMessageIds(
  accessToken: string,
): Promise<{ ids: string[]; hasMore: boolean }> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      labelIds: "TRASH",
      maxResults: "100",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const page = await googleJson<GmailMessageList>(
      accessToken,
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`,
    );
    ids.push(...(page.messages ?? []).map((message) => message.id));
    pageToken = page.nextPageToken;
  } while (pageToken && ids.length < MAX_EMPTY_TRASH_MESSAGES);

  return {
    ids: ids.slice(0, MAX_EMPTY_TRASH_MESSAGES),
    hasMore: Boolean(pageToken),
  };
}

async function deleteGmailMessagesInBatches(
  accessToken: string,
  providerMessageIds: string[],
): Promise<void> {
  for (
    let index = 0;
    index < providerMessageIds.length;
    index += GMAIL_BATCH_DELETE_CHUNK_SIZE
  ) {
    await gmailBatchDeleteMessages(
      accessToken,
      providerMessageIds.slice(index, index + GMAIL_BATCH_DELETE_CHUNK_SIZE),
    );
  }
}

async function refreshOrRemoveThread(input: {
  ownerId: string;
  threadId: string;
}): Promise<void> {
  const db = createAdminClient();
  const { data: remaining, error: remainingError } = await db
    .from("mail_messages")
    .select("*")
    .eq("owner_id", input.ownerId)
    .eq("thread_id", input.threadId)
    .order("received_at", { ascending: false, nullsFirst: false })
    .limit(1);
  if (remainingError) throw remainingError;

  const latest = (remaining as MailMessageRow[])[0];
  if (!latest) {
    const { error: deleteThreadError } = await db
      .from("mail_threads")
      .delete()
      .eq("id", input.threadId)
      .eq("owner_id", input.ownerId);
    if (deleteThreadError) throw deleteThreadError;
    return;
  }

  const { error: updateThreadError } = await db
    .from("mail_threads")
    .update({
      folder_id: latest.folder_id,
      subject: latest.subject,
      snippet: latest.snippet,
      last_message_at: latest.received_at,
      unread: latest.unread,
      starred: latest.starred,
      labels: latest.labels,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.threadId)
    .eq("owner_id", input.ownerId);
  if (updateThreadError) throw updateThreadError;
}

async function removeLocalDeletedMessages(input: {
  ownerId: string;
  accountId: string;
  providerMessageIds: string[];
}): Promise<void> {
  if (input.providerMessageIds.length === 0) return;
  const db = createAdminClient();
  const affectedThreadIds = new Set<string>();

  for (let i = 0; i < input.providerMessageIds.length; i += 100) {
    const ids = input.providerMessageIds.slice(i, i + 100);
    const { data: localRows, error: selectError } = await db
      .from("mail_messages")
      .select("id, thread_id")
      .eq("owner_id", input.ownerId)
      .eq("account_id", input.accountId)
      .in("provider_message_id", ids);
    if (selectError) throw selectError;
    for (const row of localRows as { id: string; thread_id: string | null }[]) {
      if (row.thread_id) affectedThreadIds.add(row.thread_id);
    }

    const { error: deleteMessagesError } = await db
      .from("mail_messages")
      .delete()
      .eq("owner_id", input.ownerId)
      .eq("account_id", input.accountId)
      .in("provider_message_id", ids);
    if (deleteMessagesError) throw deleteMessagesError;
  }

  for (const threadId of affectedThreadIds) {
    await refreshOrRemoveThread({ ownerId: input.ownerId, threadId });
  }
}

export type MailMessageActionResult = {
  message: MailMessage;
  thread: MailThread | null;
};

async function updateLocalMessageAfterAction(input: {
  ownerId: string;
  accountId: string;
  message: MailMessageRow;
  action: MailMessageAction;
}): Promise<MailMessageActionResult> {
  const db = createAdminClient();
  const folderIds = await listMailFolderIds({
    ownerId: input.ownerId,
    accountId: input.accountId,
  });
  const next = applyMailActionToLabels(
    stringArray(input.message.labels),
    input.action,
  );
  const now = new Date().toISOString();

  const { data: updatedMessage, error: updateMessageError } = await db
    .from("mail_messages")
    .update({
      folder_id: primaryFolderId(next.labels, folderIds),
      unread: next.unread,
      starred: next.starred,
      labels: next.labels,
      updated_at: now,
    })
    .eq("id", input.message.id)
    .eq("owner_id", input.ownerId)
    .select("*")
    .single();
  if (updateMessageError) throw updateMessageError;

  let thread: MailThread | null = null;
  if (input.message.thread_id) {
    await refreshOrRemoveThread({
      ownerId: input.ownerId,
      threadId: input.message.thread_id,
    });
    const { data: updatedThread, error: updatedThreadError } = await db
      .from("mail_threads")
      .select("*")
      .eq("id", input.message.thread_id)
      .eq("owner_id", input.ownerId)
      .maybeSingle();
    if (updatedThreadError) throw updatedThreadError;
    thread = updatedThread ? mapThread(updatedThread as MailThreadRow) : null;
  }

  return {
    message: mapMessage(updatedMessage as MailMessageRow),
    thread,
  };
}

export async function applyMailMessageAction(input: {
  ownerId: string;
  messageId: string;
  action: MailMessageAction;
}): Promise<MailMessageActionResult> {
  const db = createAdminClient();
  const { data: messageData, error: messageError } = await db
    .from("mail_messages")
    .select("*")
    .eq("id", input.messageId)
    .eq("owner_id", input.ownerId)
    .maybeSingle();
  if (messageError) throw messageError;
  if (!messageData) throw new Error("Message not found");

  const message = messageData as MailMessageRow;
  const account = await getPrivateAccount(input.ownerId, message.account_id);
  if (!account || account.provider !== "gmail") {
    throw new Error("Mail account not found");
  }
  const accessToken = await gmailAccessToken(account);

  if (input.action === "mark_read") {
    await gmailModify(accessToken, message.provider_message_id, {
      removeLabelIds: ["UNREAD"],
    });
  } else if (input.action === "mark_unread") {
    await gmailModify(accessToken, message.provider_message_id, {
      addLabelIds: ["UNREAD"],
    });
  } else if (input.action === "archive") {
    await gmailModify(accessToken, message.provider_message_id, {
      removeLabelIds: ["INBOX"],
    });
  } else if (input.action === "trash") {
    await gmailTrash(accessToken, message.provider_message_id);
  } else if (input.action === "star") {
    await gmailModify(accessToken, message.provider_message_id, {
      addLabelIds: ["STARRED"],
    });
  } else if (input.action === "unstar") {
    await gmailModify(accessToken, message.provider_message_id, {
      removeLabelIds: ["STARRED"],
    });
  }

  return updateLocalMessageAfterAction({
    ownerId: input.ownerId,
    accountId: account.id,
    message,
    action: input.action,
  });
}

export async function emptyGmailTrash(input: {
  ownerId: string;
  accountId: string;
}): Promise<{ deletedCount: number; hasMore: boolean }> {
  const account = await getPrivateAccount(input.ownerId, input.accountId);
  if (!account || account.provider !== "gmail") {
    throw new Error("Mail account not found");
  }
  if (!hasFullGmailScope(account)) {
    throw new Error(
      "Reconnect this Gmail account to grant permanent delete access.",
    );
  }

  const accessToken = await gmailAccessToken(account);
  const trash = await listGmailTrashMessageIds(accessToken);
  await deleteGmailMessagesInBatches(accessToken, trash.ids);
  await removeLocalDeletedMessages({
    ownerId: input.ownerId,
    accountId: account.id,
    providerMessageIds: trash.ids,
  });
  return { deletedCount: trash.ids.length, hasMore: trash.hasMore };
}

export async function deleteMailAccount(input: {
  ownerId: string;
  accountId: string;
}): Promise<void> {
  const db = createAdminClient();
  const { error } = await db
    .from("mail_accounts")
    .delete()
    .eq("id", input.accountId)
    .eq("owner_id", input.ownerId);
  if (error) throw error;
}
