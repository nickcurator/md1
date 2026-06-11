import type { DocComment } from "@/lib/shared-docs";

export type CommentSegment =
  | { type: "markdown"; text: string }
  | { type: "highlight"; text: string; commentId: string };

export function commentIsAnchored(content: string, comment: DocComment): boolean {
  return content.slice(comment.start, comment.end) === comment.quote;
}

export function sortCommentsByPosition(comments: DocComment[]): DocComment[] {
  return [...comments].sort((a, b) => a.start - b.start || a.createdAt.localeCompare(b.createdAt));
}

export function buildCommentSegments(
  content: string,
  comments: DocComment[],
): CommentSegment[] {
  const anchored = sortCommentsByPosition(comments).filter((c) =>
    commentIsAnchored(content, c),
  );
  const segments: CommentSegment[] = [];
  let pos = 0;

  for (const comment of anchored) {
    if (comment.start > pos) {
      segments.push({ type: "markdown", text: content.slice(pos, comment.start) });
    }
    segments.push({
      type: "highlight",
      text: comment.quote,
      commentId: comment.id,
    });
    pos = comment.end;
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
