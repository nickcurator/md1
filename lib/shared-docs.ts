// Client-safe types + helpers for the internal markdown drive (markdown files
// shared via an unlisted /d/{slug} link). No secrets here — safe to import
// from client components. All DB access lives in lib/shared-docs-server.ts
// (service-role only).

export type DocComment = {
  id: string;
  quote: string;
  start: number;
  end: number;
  text: string;
  createdAt: string;
};

export type SharedDoc = {
  id: string;
  ownerId: string;
  folderId: string | null;
  slug: string;
  title: string;
  description: string;
  content: string;
  comments: DocComment[];
  isPublished: boolean;
  // When true, /d/{slug} opens with no login (shareable externally) and hides
  // the "Drive" link. When false, only the owner can open it, with a "Drive"
  // link back to /drive.
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DriveFolder = {
  id: string;
  ownerId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

// Upper bound on a document body. Comfortably fits long context docs while
// keeping a single paste from pushing an unbounded blob through the function
// body and into the table.
export const MAX_DOC_CONTENT_CHARS = 200_000;
export const MAX_DOC_TITLE_CHARS = 200;
export const MAX_DOC_COMMENTS = 200;
export const MAX_FOLDER_NAME_CHARS = 80;

// Inline media (images pasted / dropped / uploaded in the editor) is uploaded
// to a public Supabase Storage bucket and referenced from the markdown body as
// `![alt](url)` — so the document content stays plain markdown.
export const MEDIA_BUCKET = "doc-media";
export const MAX_MEDIA_BYTES = 10 * 1024 * 1024; // 10 MB
export const ALLOWED_MEDIA_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
] as const;

export function isAllowedMediaType(type: string): boolean {
  return (ALLOWED_MEDIA_TYPES as readonly string[]).includes(type);
}

export function mediaExtension(type: string): string {
  switch (type) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/gif":
      return "gif";
    case "image/webp":
      return "webp";
    default:
      return "bin";
  }
}

export function normalizeFolderName(raw: unknown): string {
  return typeof raw === "string" ? raw.trim() : "";
}

export function parseDocComments(raw: unknown): DocComment[] {
  if (!Array.isArray(raw)) return [];
  const out: DocComment[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const c = item as Record<string, unknown>;
    if (
      typeof c.id !== "string" ||
      typeof c.quote !== "string" ||
      typeof c.text !== "string" ||
      typeof c.createdAt !== "string" ||
      typeof c.start !== "number" ||
      typeof c.end !== "number"
    ) {
      continue;
    }
    out.push({
      id: c.id,
      quote: c.quote.slice(0, 500),
      start: c.start,
      end: c.end,
      text: c.text.slice(0, 4000),
      createdAt: c.createdAt,
    });
    if (out.length >= MAX_DOC_COMMENTS) break;
  }
  return out;
}

// Public, login-free path for a shared doc.
export function shareDocPath(slug: string): string {
  return `/d/${slug}`;
}

// Pull a human title out of pasted/uploaded markdown: the first level-1
// heading, falling back to a provided default (e.g. the file name). Keeps the
// admin upload flow one-click — the title is inferred, not retyped.
export function titleFromMarkdown(md: string, fallback = "Untitled"): string {
  for (const line of md.split("\n")) {
    const m = /^#\s+(.+?)\s*$/.exec(line);
    if (m) return m[1].slice(0, MAX_DOC_TITLE_CHARS);
    if (line.trim()) break; // first non-empty line isn't an h1 → give up
  }
  return fallback.slice(0, MAX_DOC_TITLE_CHARS) || "Untitled";
}
