export type MailProvider = "gmail" | "imap";

export type MailAccountStatus =
  | "connected"
  | "syncing"
  | "disconnected"
  | "error";

export type MailFolderKind =
  | "inbox"
  | "sent"
  | "drafts"
  | "archive"
  | "trash"
  | "spam"
  | "starred"
  | "custom";

export type MailMessageAction =
  | "mark_read"
  | "mark_unread"
  | "archive"
  | "trash"
  | "delete_forever"
  | "delete_draft"
  | "star"
  | "unstar";

export type MailRecipient = {
  email: string;
  name: string;
};

export type MailAttachment = {
  id: string;
  providerAttachmentId: string | null;
  partId: string | null;
  filename: string;
  mimeType: string;
  size: number | null;
  inline: boolean;
};

export type MailAccount = {
  id: string;
  ownerId: string;
  provider: MailProvider;
  providerAccountId: string | null;
  email: string;
  displayName: string;
  status: MailAccountStatus;
  error: string | null;
  scopes: string[];
  tokenExpiresAt: string | null;
  syncState: Record<string, unknown>;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MailFolder = {
  id: string;
  ownerId: string;
  accountId: string;
  providerFolderId: string;
  name: string;
  kind: MailFolderKind;
  unreadCount: number;
  totalCount: number;
  createdAt: string;
  updatedAt: string;
};

export type MailThread = {
  id: string;
  ownerId: string;
  accountId: string;
  folderId: string | null;
  providerThreadId: string;
  subject: string;
  participants: MailRecipient[];
  snippet: string;
  lastMessageAt: string | null;
  unread: boolean;
  starred: boolean;
  labels: string[];
  createdAt: string;
  updatedAt: string;
};

export type MailMessage = {
  id: string;
  ownerId: string;
  accountId: string;
  threadId: string | null;
  folderId: string | null;
  providerMessageId: string;
  fromEmail: string;
  fromName: string;
  toRecipients: MailRecipient[];
  ccRecipients: MailRecipient[];
  bccRecipients: MailRecipient[];
  subject: string;
  snippet: string;
  bodyText: string;
  bodyHtml: string;
  sentAt: string | null;
  receivedAt: string | null;
  unread: boolean;
  starred: boolean;
  hasAttachments: boolean;
  attachments: MailAttachment[];
  labels: string[];
  createdAt: string;
  updatedAt: string;
};

export type MailWorkspace = {
  accounts: MailAccount[];
  folders: MailFolder[];
  threads: MailThread[];
  messages: MailMessage[];
  setupError?: string;
};

export const MAIL_ACCOUNT_STATUSES: MailAccountStatus[] = [
  "connected",
  "syncing",
  "disconnected",
  "error",
];

export function providerLabel(provider: MailProvider): string {
  if (provider === "gmail") return "Gmail";
  return "IMAP";
}

export function folderKindLabel(kind: MailFolderKind): string {
  switch (kind) {
    case "inbox":
      return "Inbox";
    case "sent":
      return "Sent";
    case "drafts":
      return "Drafts";
    case "archive":
      return "Archive";
    case "trash":
      return "Trash";
    case "spam":
      return "Spam";
    case "starred":
      return "Starred";
    default:
      return "Folder";
  }
}

export function formatRecipient(recipient: MailRecipient): string {
  return recipient.name || recipient.email;
}

export function applyMailActionToLabels(
  labels: string[],
  action: MailMessageAction,
): {
  labels: string[];
  unread: boolean;
  starred: boolean;
} {
  const nextLabels = new Set(labels);

  if (action === "mark_read") {
    nextLabels.delete("UNREAD");
  } else if (action === "mark_unread") {
    nextLabels.add("UNREAD");
  } else if (action === "archive") {
    nextLabels.delete("INBOX");
  } else if (action === "trash") {
    nextLabels.delete("INBOX");
    nextLabels.add("TRASH");
  } else if (action === "delete_forever") {
    nextLabels.clear();
  } else if (action === "delete_draft") {
    nextLabels.delete("DRAFT");
  } else if (action === "star") {
    nextLabels.add("STARRED");
  } else if (action === "unstar") {
    nextLabels.delete("STARRED");
  }

  return {
    labels: [...nextLabels],
    unread: nextLabels.has("UNREAD"),
    starred: nextLabels.has("STARRED"),
  };
}
