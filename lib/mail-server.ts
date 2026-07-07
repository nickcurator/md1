import { createAdminClient } from "@/lib/supabaseAdmin";
import {
  decryptMailSecret,
  encryptMailSecret,
} from "@/lib/mail-crypto-server";
import type {
  MailAccount,
  MailAccountStatus,
  MailFolder,
  MailFolderKind,
  MailMessage,
  MailProvider,
  MailRecipient,
  MailThread,
  MailWorkspace,
} from "@/lib/mail";

export const GMAIL_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
] as const;

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
        .limit(100),
      db
        .from("mail_messages")
        .select("*")
        .eq("owner_id", ownerId)
        .order("received_at", { ascending: true, nullsFirst: true })
        .limit(500),
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
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
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
  const bodyText = decodeGmailData(textPart?.body?.data).trim();
  const bodyHtml = decodeGmailData(htmlPart?.body?.data).trim();

  return {
    providerMessageId: message.id,
    providerThreadId: message.threadId,
    folderId: primaryFolderId(labels, folderIdByProviderId),
    subject,
    snippet: message.snippet ?? "",
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

async function listRecentGmailMessages(
  accessToken: string,
): Promise<GmailMessageList> {
  const params = new URLSearchParams({
    maxResults: "50",
    q: "newer_than:180d",
  });
  return googleJson<GmailMessageList>(
    accessToken,
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`,
  );
}

export async function syncGmailAccount(input: {
  ownerId: string;
  accountId: string;
}): Promise<MailWorkspace> {
  const account = await getPrivateAccount(input.ownerId, input.accountId);
  if (!account || account.provider !== "gmail") {
    throw new Error("Mail account not found");
  }
  await updateAccountStatus(account.id, input.ownerId, {
    status: "syncing",
    error: null,
  });

  try {
    const accessToken = await gmailAccessToken(account);
    const folderIdByProviderId = await syncGmailFolders({
      ownerId: input.ownerId,
      accountId: account.id,
      accessToken,
    });
    const listed = await listRecentGmailMessages(accessToken);
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
    await updateAccountStatus(account.id, input.ownerId, {
      status: "connected",
      error: null,
      last_synced_at: new Date().toISOString(),
      sync_state: {
        ...(profile.historyId ? { historyId: profile.historyId } : {}),
        recentMessageCount: parsed.length,
      },
    });
  } catch (err) {
    await updateAccountStatus(account.id, input.ownerId, {
      status: "error",
      error: err instanceof Error ? err.message : "Sync failed",
    });
    throw err;
  }

  return listMailWorkspace(input.ownerId);
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

export type MailMessageAction =
  | "mark_read"
  | "mark_unread"
  | "archive"
  | "trash"
  | "star"
  | "unstar";

export async function applyMailMessageAction(input: {
  ownerId: string;
  messageId: string;
  action: MailMessageAction;
}): Promise<void> {
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
  const labels = new Set(message.labels ?? []);
  const patch: Partial<MailMessageRow> = {
    updated_at: new Date().toISOString(),
  };

  if (input.action === "mark_read") {
    await gmailModify(accessToken, message.provider_message_id, {
      removeLabelIds: ["UNREAD"],
    });
    labels.delete("UNREAD");
    patch.unread = false;
  } else if (input.action === "mark_unread") {
    await gmailModify(accessToken, message.provider_message_id, {
      addLabelIds: ["UNREAD"],
    });
    labels.add("UNREAD");
    patch.unread = true;
  } else if (input.action === "archive") {
    await gmailModify(accessToken, message.provider_message_id, {
      removeLabelIds: ["INBOX"],
    });
    labels.delete("INBOX");
    patch.folder_id = null;
  } else if (input.action === "trash") {
    await gmailTrash(accessToken, message.provider_message_id);
    labels.add("TRASH");
    labels.delete("INBOX");
    const trash = await db
      .from("mail_folders")
      .select("id")
      .eq("account_id", account.id)
      .eq("provider_folder_id", "TRASH")
      .maybeSingle();
    if (trash.error) throw trash.error;
    patch.folder_id = trash.data ? (trash.data as { id: string }).id : null;
  } else if (input.action === "star") {
    await gmailModify(accessToken, message.provider_message_id, {
      addLabelIds: ["STARRED"],
    });
    labels.add("STARRED");
    patch.starred = true;
  } else if (input.action === "unstar") {
    await gmailModify(accessToken, message.provider_message_id, {
      removeLabelIds: ["STARRED"],
    });
    labels.delete("STARRED");
    patch.starred = false;
  }

  patch.labels = Array.from(labels);
  const { error: updateMessageError } = await db
    .from("mail_messages")
    .update(patch)
    .eq("id", message.id)
    .eq("owner_id", input.ownerId);
  if (updateMessageError) throw updateMessageError;

  if (message.thread_id) {
    const threadPatch: Partial<MailThreadRow> = {
      updated_at: new Date().toISOString(),
    };
    if (patch.unread !== undefined) threadPatch.unread = patch.unread;
    if (patch.starred !== undefined) threadPatch.starred = patch.starred;
    if (patch.folder_id !== undefined) threadPatch.folder_id = patch.folder_id;
    threadPatch.labels = Array.from(labels);
    const { error: updateThreadError } = await db
      .from("mail_threads")
      .update(threadPatch)
      .eq("id", message.thread_id)
      .eq("owner_id", input.ownerId);
    if (updateThreadError) throw updateThreadError;
  }
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
