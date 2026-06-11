"use client";

import { useEffect, useRef, useState } from "react";
import { Trash2, X } from "lucide-react";
import type { DocComment } from "@/lib/shared-docs";
import { commentIsAnchored, sortCommentsByPosition } from "./drive-comments";

function formatTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

export default function DriveCommentMargin({
  content,
  comments,
  composing,
  commentOffsetTop,
  composeTop,
  selectionQuote,
  activeCommentId,
  anchorPositions,
  onActiveCommentChange,
  onSubmitCompose,
  onCancelCompose,
  onUpdateComment,
  onDeleteComment,
}: {
  content: string;
  comments: DocComment[];
  composing: boolean;
  commentOffsetTop: number;
  composeTop: number;
  selectionQuote: string;
  activeCommentId: string | null;
  anchorPositions: Record<string, number>;
  onActiveCommentChange: (id: string | null) => void;
  onSubmitCompose: (text: string) => void;
  onCancelCompose: () => void;
  onUpdateComment: (id: string, text: string) => void;
  onDeleteComment: (id: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const ordered = sortCommentsByPosition(comments);

  useEffect(() => {
    if (!composing) setDraft("");
  }, [composing]);

  useEffect(() => {
    if (composing) draftRef.current?.focus();
  }, [composing]);

  if (!composing && ordered.length === 0) return null;

  function submit() {
    const text = draft.trim();
    if (!text) return;
    onSubmitCompose(text);
    setDraft("");
  }

  return (
    <div className="relative h-full min-h-[200px] w-full">
      {composing && (
        <div
          className="absolute left-0 right-0 z-20"
          style={{ top: Math.max(0, composeTop + commentOffsetTop) }}
        >
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3 shadow-lg">
            <div className="mb-2 flex items-start justify-between gap-2">
              <p className="line-clamp-2 text-xs leading-relaxed text-[var(--muted)]">
                &ldquo;{selectionQuote}&rdquo;
              </p>
              <button
                type="button"
                onClick={onCancelCompose}
                className="shrink-0 text-[var(--muted)] hover:text-[var(--fg)]"
                aria-label="Cancel"
              >
                <X size={14} />
              </button>
            </div>
            <textarea
              ref={draftRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Comment…"
              rows={3}
              className="mb-2 w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-2 text-sm outline-none focus:border-[var(--fg)]"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            <button
              type="button"
              onClick={submit}
              disabled={!draft.trim()}
              className="rounded-md bg-[var(--fg)] px-3 py-1.5 text-xs font-medium text-[var(--bg)] disabled:opacity-50"
            >
              Comment
            </button>
          </div>
        </div>
      )}

      {ordered.map((comment) => {
        const anchored = commentIsAnchored(content, comment);
        const active = comment.id === activeCommentId;
        const top = anchorPositions[comment.id] ?? 0;
        return (
          <div
            key={comment.id}
            id={`drive-comment-card-${comment.id}`}
            className="absolute left-0 right-0"
            style={{ top: Math.max(0, top + commentOffsetTop) }}
          >
            <div
              onClick={() => onActiveCommentChange(comment.id)}
              className={`cursor-pointer rounded-xl border bg-[var(--bg)] p-3 shadow-md transition-colors ${
                active
                  ? "border-amber-500/50 ring-1 ring-amber-500/30"
                  : "border-[var(--border)] hover:border-[var(--fg)]/30"
              }`}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[11px] text-[var(--muted)]">
                  {formatTime(comment.createdAt)}
                  {!anchored && " · moved"}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteComment(comment.id);
                  }}
                  className="text-[var(--muted)] hover:text-red-500"
                  aria-label="Delete comment"
                >
                  <Trash2 size={13} />
                </button>
              </div>
              <textarea
                value={comment.text}
                onChange={(e) => onUpdateComment(comment.id, e.target.value)}
                onClick={(e) => e.stopPropagation()}
                rows={2}
                className="w-full resize-none border-none bg-transparent p-0 text-sm leading-relaxed text-[var(--fg)] outline-none"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
