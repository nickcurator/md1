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

// Upper bound on a document body. Comfortably fits long context docs while
// keeping a single paste from pushing an unbounded blob through the function
// body and into the table.
export const MAX_DOC_CONTENT_CHARS = 200_000;
export const MAX_DOC_TITLE_CHARS = 200;
export const MAX_DOC_COMMENTS = 200;

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
