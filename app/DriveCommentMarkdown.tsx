"use client";

import { useLayoutEffect, useRef } from "react";
import Markdown from "@/components/Markdown";
import type { DocComment } from "@/lib/shared-docs";
import { buildCommentSegments } from "./drive-comments";

const proseClass =
  "prose prose-neutral dark:prose-invert max-w-none prose-headings:font-semibold prose-pre:bg-[var(--bg)] prose-pre:text-[var(--fg)]";

export default function DriveCommentMarkdown({
  content,
  comments,
  activeCommentId,
  onCommentClick,
  onAnchorPositions,
}: {
  content: string;
  comments: DocComment[];
  activeCommentId: string | null;
  onCommentClick: (id: string) => void;
  onAnchorPositions: (positions: Record<string, number>) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const segments = buildCommentSegments(content, comments);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const containerTop = container.getBoundingClientRect().top;
    const positions: Record<string, number> = {};
    container.querySelectorAll<HTMLElement>("[data-comment-anchor]").forEach((el) => {
      const id = el.dataset.commentAnchor;
      if (!id) return;
      positions[id] =
        el.getBoundingClientRect().top - containerTop + container.scrollTop;
    });
    onAnchorPositions(positions);
  }, [content, comments, onAnchorPositions]);

  if (segments.length === 0) {
    return (
      <div ref={containerRef}>
        <Markdown content={content} className={proseClass} />
      </div>
    );
  }

  return (
    <div ref={containerRef} className={proseClass}>
      {segments.map((segment, index) => {
        if (segment.type === "markdown") {
          if (!segment.text) return null;
          return (
            <Markdown key={`md-${index}`} content={segment.text} className="inline" />
          );
        }

        const active = segment.commentId === activeCommentId;
        return (
          <mark
            key={`hl-${segment.commentId}`}
            id={`drive-comment-${segment.commentId}`}
            data-comment-anchor={segment.commentId}
            onClick={() => onCommentClick(segment.commentId)}
            className={`cursor-pointer rounded-sm px-0.5 transition-colors ${
              active
                ? "bg-amber-300/70 text-[var(--fg)] ring-2 ring-amber-500/60 dark:bg-amber-400/35"
                : "bg-amber-200/60 text-[var(--fg)] dark:bg-amber-400/25"
            }`}
          >
            {segment.text}
          </mark>
        );
      })}
    </div>
  );
}
