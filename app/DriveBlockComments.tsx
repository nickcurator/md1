"use client";

import { useEffect, useRef, useState } from "react";
import { Trash2, X } from "lucide-react";
import type { DocComment } from "@/lib/shared-docs";
import { resolveCommentRange, sortCommentsByPosition } from "./drive-comments";

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

// Comments sidebar for the block editor. Unlike DriveCommentMargin (which
// pixel-aligns cards to highlighted <mark>s in the textarea/preview), the block
// editor renders its own DOM with no offset anchors, so this is a simple flow
// list. A compose box appears at the top whenever text is selected in the
// editor; comments are re-located by quote (see resolveCommentRange).
export default function DriveBlockComments({
  content,
  comments,
  activeCommentId,
  pendingQuote,
  onActiveCommentChange,
  onSubmit,
  onClearPending,
  onUpdateComment,
  onDeleteComment,
}: {
  content: string;
  comments: DocComment[];
  activeCommentId: string | null;
  pendingQuote: string;
  onActiveCommentChange: (id: string | null) => void;
  onSubmit: (text: string) => void;
  onClearPending: () => void;
  onUpdateComment: (id: string, text: string) => void;
  onDeleteComment: (id: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const ordered = sortCommentsByPosition(comments);

  useEffect(() => {
    if (!pendingQuote) setDraft("");
  }, [pendingQuote]);

  useEffect(() => {
    if (pendingQuote) draftRef.current?.focus();
  }, [pendingQuote]);

  function submit() {
    const text = draft.trim();
    if (!text) return;
    onSubmit(text);
    setDraft("");
  }

  if (!pendingQuote && ordered.length === 0) {
    return (
      <p className="px-1 text-xs leading-relaxed text-[var(--muted)]">
        Select text in the editor to add a comment.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {pendingQuote && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3 shadow-lg">
          <div className="mb-2 flex items-start justify-between gap-2">
            <p className="line-clamp-2 text-xs leading-relaxed text-[var(--muted)]">
              &ldquo;{pendingQuote}&rdquo;
            </p>
            <button
              type="button"
              onClick={onClearPending}
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
      )}

      {ordered.map((comment) => {
        const anchored = resolveCommentRange(content, comment) !== null;
        const active = comment.id === activeCommentId;
        return (
          <div
            key={comment.id}
            id={`drive-comment-card-${comment.id}`}
            onClick={() => onActiveCommentChange(comment.id)}
            className={`cursor-pointer rounded-xl border bg-[var(--bg)] p-3 shadow-md transition-colors ${
              active
                ? "border-amber-500/50 ring-1 ring-amber-500/30"
                : "border-[var(--border)] hover:border-[var(--fg)]/30"
            }`}
          >
            <p className="mb-1.5 line-clamp-2 text-xs italic leading-relaxed text-[var(--muted)]">
              &ldquo;{comment.quote}&rdquo;
            </p>
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
        );
      })}
    </div>
  );
}
