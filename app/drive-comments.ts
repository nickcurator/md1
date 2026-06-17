import type { DocComment } from "@/lib/shared-docs";

export type CommentSegment =
  | { type: "markdown"; text: string }
  | { type: "highlight"; text: string; commentId: string };

const MAX_QUOTE_OCCURRENCES = 200;

/**
 * Find a comment's current range in the content. The stored `start`/`end` are
 * only a hint: we anchor primarily by the quoted text so comments survive edits
 * elsewhere in the doc and the lossy Markdown round-trip of the block editor.
 *
 * 1. If the stored offsets still slice out the exact quote, keep them.
 * 2. Otherwise locate the quote and pick the occurrence nearest the old start.
 * 3. If the quote no longer appears at all, the comment is unanchored (null).
 */
export function resolveCommentRange(
  content: string,
  comment: DocComment,
): { start: number; end: number } | null {
  if (!comment.quote) return null;
  if (content.slice(comment.start, comment.end) === comment.quote) {
    return { start: comment.start, end: comment.end };
  }

  let best = -1;
  let idx = content.indexOf(comment.quote);
  for (let n = 0; idx !== -1 && n < MAX_QUOTE_OCCURRENCES; n += 1) {
    if (best === -1 || Math.abs(idx - comment.start) < Math.abs(best - comment.start)) {
      best = idx;
    }
    idx = content.indexOf(comment.quote, idx + 1);
  }
  if (best === -1) return null;
  return { start: best, end: best + comment.quote.length };
}

export function commentIsAnchored(content: string, comment: DocComment): boolean {
  return resolveCommentRange(content, comment) !== null;
}

export function sortCommentsByPosition(comments: DocComment[]): DocComment[] {
  return [...comments].sort((a, b) => a.start - b.start || a.createdAt.localeCompare(b.createdAt));
}

export function buildCommentSegments(
  content: string,
  comments: DocComment[],
): CommentSegment[] {
  const resolved = comments
    .map((comment) => ({ comment, range: resolveCommentRange(content, comment) }))
    .filter(
      (entry): entry is { comment: DocComment; range: { start: number; end: number } } =>
        entry.range !== null,
    )
    .sort(
      (a, b) =>
        a.range.start - b.range.start ||
        a.comment.createdAt.localeCompare(b.comment.createdAt),
    );

  const segments: CommentSegment[] = [];
  let pos = 0;

  for (const { comment, range } of resolved) {
    // Skip overlaps — keep the segment stream non-overlapping and in order.
    if (range.start < pos) continue;
    if (range.start > pos) {
      segments.push({ type: "markdown", text: content.slice(pos, range.start) });
    }
    segments.push({
      type: "highlight",
      text: content.slice(range.start, range.end),
      commentId: comment.id,
    });
    pos = range.end;
  }

  if (pos < content.length) {
    segments.push({ type: "markdown", text: content.slice(pos) });
  }

  return segments;
}

export function createDocComment(
  content: string,
  start: number,
  end: number,
  text: string,
): DocComment | null {
  const quote = content.slice(start, end);
  const body = text.trim();
  if (!quote.trim() || !body) return null;
  return {
    id: crypto.randomUUID(),
    quote,
    start,
    end,
    text: body,
    createdAt: new Date().toISOString(),
  };
}

// Create a comment from a quoted string (WYSIWYG editor: the selection text is
// known, but there's no meaningful Markdown offset). Anchoring is by quote;
// start/end are unused there.
export function createDocCommentFromQuote(
  quote: string,
  text: string,
): DocComment | null {
  const trimmedQuote = quote.trim();
  const body = text.trim();
  if (!trimmedQuote || !body) return null;
  return {
    id: crypto.randomUUID(),
    quote,
    start: 0,
    end: 0,
    text: body,
    createdAt: new Date().toISOString(),
  };
}
