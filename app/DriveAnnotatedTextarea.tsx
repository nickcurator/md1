"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { DocComment } from "@/lib/shared-docs";
import { commentIsAnchored, sortCommentsByPosition } from "./drive-comments";
import type { MarkdownActionId } from "./drive-markdown-edit";
import DriveSlashMenu from "./DriveSlashMenu";
import {
  filterSlashCommands,
  type SlashCommand,
} from "./drive-slash-commands";
import { getCaretCoords } from "./textarea-caret";

const MIN_HEIGHT_CLASS = "min-h-[calc(100dvh-14rem)]";

// A "/" command is active when the caret sits right after a `/token` that began
// at line start or after whitespace, with no spaces in the token yet. Returns
// the position of the `/` and the query typed so far, or null.
function detectSlash(
  value: string,
  caret: number | null,
): { start: number; query: string } | null {
  if (caret == null) return null;
  const lineStart = value.lastIndexOf("\n", caret - 1) + 1;
  const before = value.slice(lineStart, caret);
  const match = /(^|\s)\/(\S*)$/.exec(before);
  if (!match) return null;
  const query = match[2];
  return { start: caret - query.length - 1, query };
}

function buildHighlightParts(content: string, comments: DocComment[]) {
  const anchored = sortCommentsByPosition(comments).filter((c) =>
    commentIsAnchored(content, c),
  );
  const parts: Array<
    | { type: "text"; text: string }
    | { type: "highlight"; text: string; commentId: string }
  > = [];
  let pos = 0;

  for (const comment of anchored) {
    if (comment.start > pos) {
      parts.push({ type: "text", text: content.slice(pos, comment.start) });
    }
    parts.push({
      type: "highlight",
      text: content.slice(comment.start, comment.end),
      commentId: comment.id,
    });
    pos = comment.end;
  }

  if (pos < content.length) {
    parts.push({ type: "text", text: content.slice(pos) });
  }

  return parts;
}

function isHistoryEditKey(event: React.KeyboardEvent<HTMLTextAreaElement>) {
  if (!(event.metaKey || event.ctrlKey)) return false;
  const key = event.key.toLowerCase();
  return key === "z" || key === "y";
}

export default function DriveAnnotatedTextarea({
  value,
  documentKey,
  comments,
  activeCommentId,
  textareaRef,
  onChange,
  onSelect,
  onKeyDown,
  onPaste,
  onDrop,
  onDragOver,
  onApplyAction,
  onInsertImage,
  onAnchorPositions,
  placeholder,
}: {
  value: string;
  documentKey: string;
  comments: DocComment[];
  activeCommentId: string | null;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onChange: (value: string) => void;
  onSelect: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onPaste?: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  onDrop?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver?: (e: React.DragEvent<HTMLDivElement>) => void;
  onApplyAction?: (action: MarkdownActionId) => void;
  onInsertImage?: () => void;
  onAnchorPositions: (positions: Record<string, number>) => void;
  placeholder: string;
}) {
  const localRef = useRef<HTMLTextAreaElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const taRef = textareaRef;
  const backdropRef = useRef<HTMLDivElement>(null);
  const inputValueRef = useRef(value);
  const [displayContent, setDisplayContent] = useState(value);
  const parts = useMemo(
    () => buildHighlightParts(displayContent, comments),
    [displayContent, comments],
  );

  const [slash, setSlash] = useState<{ start: number; query: string } | null>(
    null,
  );
  const [slashIndex, setSlashIndex] = useState(0);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const slashCommands = useMemo(
    () => (slash ? filterSlashCommands(slash.query) : []),
    [slash],
  );
  // Reset the highlighted item whenever the query changes.
  useEffect(() => {
    setSlashIndex(0);
  }, [slash?.query]);

  const assignRef = useCallback(
    (el: HTMLTextAreaElement | null) => {
      localRef.current = el;
      taRef.current = el;
      if (el) {
        inputValueRef.current = el.value;
        setDisplayContent(el.value);
      }
    },
    [taRef],
  );

  const publishContent = useCallback(
    (next: string) => {
      if (next === inputValueRef.current) return;
      inputValueRef.current = next;
      setDisplayContent(next);
      onChange(next);
    },
    [onChange],
  );

  const syncScroll = useCallback(() => {
    const ta = localRef.current;
    const backdrop = backdropRef.current;
    if (!ta || !backdrop) return;
    backdrop.scrollTop = ta.scrollTop;
    backdrop.scrollLeft = ta.scrollLeft;
  }, []);

  const measureAnchors = useCallback(() => {
    const wrapper = wrapperRef.current;
    const backdrop = backdropRef.current;
    if (!wrapper || !backdrop) return;

    const containerTop = wrapper.getBoundingClientRect().top;
    const positions: Record<string, number> = {};
    backdrop.querySelectorAll<HTMLElement>("[data-comment-anchor]").forEach((el) => {
      const id = el.dataset.commentAnchor;
      if (!id) return;
      positions[id] =
        el.getBoundingClientRect().top - containerTop + backdrop.scrollTop;
    });
    onAnchorPositions(positions);
  }, [onAnchorPositions]);

  // Toolbar / programmatic edits: sync backdrop only when prop matches textarea.
  useLayoutEffect(() => {
    const ta = localRef.current;
    if (!ta || ta.value !== value) return;
    if (value === inputValueRef.current) return;
    inputValueRef.current = value;
    setDisplayContent(value);
  }, [value]);

  useEffect(() => {
    syncScroll();
    measureAnchors();
  }, [displayContent, comments, syncScroll, measureAnchors]);

  useEffect(() => {
    const onResize = () => {
      syncScroll();
      measureAnchors();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [syncScroll, measureAnchors]);

  // Recompute the "/" command state (and the menu's caret anchor) from the
  // live textarea. Called after input, caret moves and key-ups.
  const refreshSlash = useCallback((ta: HTMLTextAreaElement) => {
    const detected = detectSlash(ta.value, ta.selectionStart);
    if (!detected) {
      setSlash(null);
      return;
    }
    const coords = getCaretCoords(ta, ta.selectionStart);
    setMenuPos({
      top: coords.top - ta.scrollTop + coords.height + 4,
      left: Math.max(0, coords.left - ta.scrollLeft),
    });
    setSlash(detected);
  }, []);

  const selectSlashCommand = useCallback(
    (cmd: SlashCommand) => {
      const ta = localRef.current;
      if (!ta || !slash) return;
      const caret = ta.selectionStart;
      // Strip the typed "/query" before applying the command.
      const next = ta.value.slice(0, slash.start) + ta.value.slice(caret);
      ta.value = next;
      publishContent(next);
      ta.setSelectionRange(slash.start, slash.start);
      ta.focus();
      setSlash(null);
      if (cmd.kind === "image") onInsertImage?.();
      else onApplyAction?.(cmd.action);
    },
    [slash, publishContent, onApplyAction, onInsertImage],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (slash && slashCommands.length > 0) {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setSlashIndex((i) => (i + 1) % slashCommands.length);
          return;
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          setSlashIndex(
            (i) => (i - 1 + slashCommands.length) % slashCommands.length,
          );
          return;
        }
        if (event.key === "Enter" || event.key === "Tab") {
          event.preventDefault();
          selectSlashCommand(slashCommands[slashIndex] ?? slashCommands[0]);
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          setSlash(null);
          return;
        }
      }
      onKeyDown?.(event);
    },
    [slash, slashCommands, slashIndex, selectSlashCommand, onKeyDown],
  );

  const handleKeyUp = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      onSelect();
      refreshSlash(event.currentTarget);
      if (!isHistoryEditKey(event)) return;
      requestAnimationFrame(() => {
        const ta = localRef.current;
        if (!ta) return;
        publishContent(ta.value);
      });
    },
    [onSelect, refreshSlash, publishContent],
  );

  return (
    <div
      ref={wrapperRef}
      className={`relative ${MIN_HEIGHT_CLASS}`}
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      <div
        ref={backdropRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words font-mono text-[15px] leading-8 text-[var(--fg)]"
      >
        {displayContent ? (
          parts.map((part, index) => {
            if (part.type === "text") {
              return <span key={`t-${index}`}>{part.text}</span>;
            }
            const active = part.commentId === activeCommentId;
            return (
              <mark
                key={`h-${part.commentId}`}
                data-comment-anchor={part.commentId}
                className={`rounded-sm px-0 text-[var(--fg)] ${
                  active
                    ? "bg-amber-300/70 ring-1 ring-amber-500/50 dark:bg-amber-400/35"
                    : "bg-amber-200/60 dark:bg-amber-400/25"
                }`}
              >
                {part.text}
              </mark>
            );
          })
        ) : (
          <span className="text-[var(--muted)]">{placeholder}</span>
        )}
      </div>

      <textarea
        key={documentKey}
        ref={assignRef}
        defaultValue={value}
        onInput={(e) => {
          publishContent(e.currentTarget.value);
          refreshSlash(e.currentTarget);
        }}
        onSelect={(e) => {
          onSelect();
          refreshSlash(e.currentTarget);
        }}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onPaste={onPaste}
        onBlur={() => setSlash(null)}
        onMouseUp={onSelect}
        onScroll={() => {
          syncScroll();
          measureAnchors();
          setSlash(null);
        }}
        spellCheck={false}
        placeholder={placeholder}
        className={`no-scrollbar relative z-10 ${MIN_HEIGHT_CLASS} w-full resize-none overflow-y-auto border-none bg-transparent font-mono text-[15px] leading-8 text-transparent caret-[var(--fg)] outline-none placeholder:text-transparent selection:bg-amber-300/40`}
      />

      {slash && slashCommands.length > 0 && (
        <DriveSlashMenu
          commands={slashCommands}
          activeIndex={slashIndex}
          position={menuPos}
          onSelect={selectSlashCommand}
          onHover={setSlashIndex}
        />
      )}
    </div>
  );
}
