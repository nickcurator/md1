"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  EditorState,
  Prec,
  type Range,
  StateEffect,
  StateField,
} from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  keymap,
  placeholder as cmPlaceholder,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import type { DocComment } from "@/lib/shared-docs";
import { imagePreview } from "./cm/images";
import { resolveCommentRange } from "./drive-comments";
import {
  detectSlash,
  filterSlashCommands,
  type SlashCommand,
} from "./drive-slash-commands";
import { imageFilesFrom } from "./drive-media";
import type { MarkdownActionId } from "./drive-markdown-edit";
import DriveSlashMenu from "./DriveSlashMenu";

const MIN_HEIGHT_CLASS = "min-h-[calc(100dvh-14rem)]";

export type EditorSelectionInfo = {
  start: number;
  end: number;
  quote: string;
  top: number;
};

// --- Comment highlight decorations (fed from React via effects) ---
const setCommentsEffect = StateEffect.define<DocComment[]>();
const setActiveEffect = StateEffect.define<string | null>();

const commentsField = StateField.define<DocComment[]>({
  create: () => [],
  update(value, tr) {
    for (const e of tr.effects) if (e.is(setCommentsEffect)) return e.value;
    return value;
  },
});

const activeField = StateField.define<string | null>({
  create: () => null,
  update(value, tr) {
    for (const e of tr.effects) if (e.is(setActiveEffect)) return e.value;
    return value;
  },
});

function buildCommentDeco(state: EditorState): DecorationSet {
  const content = state.doc.toString();
  const comments = state.field(commentsField);
  const active = state.field(activeField);
  const ranges: Range<Decoration>[] = [];
  for (const c of comments) {
    const r = resolveCommentRange(content, c);
    if (!r || r.start >= r.end) continue;
    ranges.push(
      Decoration.mark({
        class:
          c.id === active
            ? "cm-comment-mark cm-comment-mark-active"
            : "cm-comment-mark",
        attributes: { "data-comment-anchor": c.id },
      }).range(r.start, r.end),
    );
  }
  return Decoration.set(ranges, true);
}

const commentDecoPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildCommentDeco(view.state);
    }
    update(u: ViewUpdate) {
      if (
        u.docChanged ||
        u.startState.field(commentsField) !== u.state.field(commentsField) ||
        u.startState.field(activeField) !== u.state.field(activeField)
      ) {
        this.decorations = buildCommentDeco(u.state);
      }
    }
  },
  { decorations: (v) => v.decorations },
);

const editorTheme = EditorView.theme({
  "&": { backgroundColor: "transparent", color: "var(--fg)", fontSize: "15px" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": {
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    lineHeight: "2rem",
    overflow: "visible",
  },
  ".cm-content": {
    padding: "0",
    caretColor: "var(--fg)",
    minHeight: "calc(100dvh - 14rem)",
  },
  ".cm-line": { padding: "0" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--fg)" },
  ".cm-placeholder": { color: "var(--muted)" },
  ".cm-image-widget": {
    position: "relative",
    display: "inline-block",
    maxWidth: "100%",
    verticalAlign: "top",
  },
  ".cm-image-widget-img": {
    display: "block",
    maxWidth: "100%",
    height: "auto",
    borderRadius: "8px",
    border: "1px solid var(--border)",
  },
  ".cm-image-resize-handle": {
    position: "absolute",
    right: "6px",
    bottom: "6px",
    width: "14px",
    height: "14px",
    borderRadius: "3px",
    border: "2px solid var(--bg)",
    backgroundColor: "var(--fg)",
    opacity: "0.55",
    cursor: "nwse-resize",
  },
  ".cm-image-resize-handle:hover": { opacity: "0.9" },
});

export default function DriveCodeEditor({
  value,
  documentKey,
  comments,
  activeCommentId,
  placeholder,
  editorViewRef,
  onChange,
  onSelectionChange,
  onAnchorPositions,
  onApplyAction,
  onInsertImage,
  onInsertImageFiles,
}: {
  value: string;
  documentKey: string;
  comments: DocComment[];
  activeCommentId: string | null;
  placeholder: string;
  editorViewRef: React.RefObject<EditorView | null>;
  onChange: (value: string) => void;
  onSelectionChange: (selection: EditorSelectionInfo | null) => void;
  onAnchorPositions: (positions: Record<string, number>) => void;
  onApplyAction: (action: MarkdownActionId) => void;
  onInsertImage: () => void;
  onInsertImageFiles: (files: File[]) => void;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [slash, setSlash] = useState<{
    query: string;
    from: number;
    top: number;
    left: number;
  } | null>(null);
  const [slashIndex, setSlashIndex] = useState(0);
  const slashCommands = useMemo(
    () => (slash ? filterSlashCommands(slash.query) : []),
    [slash],
  );

  // Latest props/state mirrored into refs so the (once-created) CM6
  // extensions read current values without rebuilding the editor.
  const propsRef = useRef({
    onChange,
    onSelectionChange,
    onAnchorPositions,
    onApplyAction,
    onInsertImage,
    onInsertImageFiles,
    comments,
  });
  propsRef.current = {
    onChange,
    onSelectionChange,
    onAnchorPositions,
    onApplyAction,
    onInsertImage,
    onInsertImageFiles,
    comments,
  };
  const valueRef = useRef(value);
  valueRef.current = value;
  const slashRef = useRef<{
    slash: typeof slash;
    commands: SlashCommand[];
    index: number;
  }>({ slash, commands: slashCommands, index: slashIndex });
  slashRef.current = { slash, commands: slashCommands, index: slashIndex };

  const selectSlashCommand = useCallback(
    (cmd: SlashCommand) => {
      const view = editorViewRef.current;
      const current = slashRef.current.slash;
      if (!view || !current) return;
      const head = view.state.selection.main.head;
      // Remove the typed "/query", then apply the command at that spot.
      view.dispatch({
        changes: { from: current.from, to: head, insert: "" },
        selection: { anchor: current.from },
      });
      setSlash(null);
      view.focus();
      if (cmd.kind === "image") propsRef.current.onInsertImage();
      else propsRef.current.onApplyAction(cmd.action);
    },
    [editorViewRef],
  );

  // Push the rendered React selection/slash/anchor state from the live view.
  const syncFromView = useCallback(
    (view: EditorView) => {
      const p = propsRef.current;
      const wrapTop = wrapperRef.current?.getBoundingClientRect().top ?? 0;
      const wrapLeft = wrapperRef.current?.getBoundingClientRect().left ?? 0;
      const sel = view.state.selection.main;
      const content = view.state.doc.toString();

      if (sel.empty) {
        p.onSelectionChange(null);
      } else {
        const quote = content.slice(sel.from, sel.to);
        if (!quote.trim()) {
          p.onSelectionChange(null);
        } else {
          const coords = view.coordsAtPos(sel.from);
          p.onSelectionChange({
            start: sel.from,
            end: sel.to,
            quote,
            top: coords ? coords.top - wrapTop : 0,
          });
        }
      }

      const det = sel.empty ? detectSlash(content, sel.head) : null;
      if (!det) {
        setSlash(null);
      } else {
        const coords = view.coordsAtPos(det.start);
        setSlash({
          query: det.query,
          from: det.start,
          top: coords ? coords.bottom - wrapTop + 4 : 0,
          left: coords ? coords.left - wrapLeft : 0,
        });
      }

      const positions: Record<string, number> = {};
      for (const c of p.comments) {
        const r = resolveCommentRange(content, c);
        if (!r) continue;
        const coords = view.coordsAtPos(r.start);
        if (coords) positions[c.id] = coords.top - wrapTop;
      }
      p.onAnchorPositions(positions);
    },
    [],
  );

  // Create the editor once per document.
  useEffect(() => {
    const parent = containerRef.current;
    if (!parent) return;

    const slashKeymap = Prec.highest(
      keymap.of([
        {
          key: "ArrowDown",
          run: () => {
            const s = slashRef.current;
            if (!s.slash || s.commands.length === 0) return false;
            setSlashIndex((i) => (i + 1) % s.commands.length);
            return true;
          },
        },
        {
          key: "ArrowUp",
          run: () => {
            const s = slashRef.current;
            if (!s.slash || s.commands.length === 0) return false;
            setSlashIndex(
              (i) => (i - 1 + s.commands.length) % s.commands.length,
            );
            return true;
          },
        },
        {
          key: "Enter",
          run: () => {
            const s = slashRef.current;
            if (!s.slash || s.commands.length === 0) return false;
            selectSlashCommand(s.commands[s.index] ?? s.commands[0]);
            return true;
          },
        },
        {
          key: "Tab",
          run: () => {
            const s = slashRef.current;
            if (!s.slash || s.commands.length === 0) return false;
            selectSlashCommand(s.commands[s.index] ?? s.commands[0]);
            return true;
          },
        },
        {
          key: "Escape",
          run: () => {
            if (!slashRef.current.slash) return false;
            setSlash(null);
            return true;
          },
        },
      ]),
    );

    const state = EditorState.create({
      doc: valueRef.current,
      extensions: [
        history(),
        slashKeymap,
        keymap.of([...defaultKeymap, ...historyKeymap]),
        markdown(),
        EditorView.lineWrapping,
        cmPlaceholder(placeholder),
        editorTheme,
        commentsField,
        activeField,
        commentDecoPlugin,
        imagePreview,
        EditorView.updateListener.of((u) => {
          if (u.docChanged) propsRef.current.onChange(u.state.doc.toString());
          if (u.docChanged || u.selectionSet || u.geometryChanged) {
            syncFromView(u.view);
          }
        }),
        EditorView.domEventHandlers({
          paste: (event) => {
            const files = imageFilesFrom(event.clipboardData?.files);
            if (files.length === 0) return false;
            event.preventDefault();
            propsRef.current.onInsertImageFiles(files);
            return true;
          },
          drop: (event) => {
            const files = imageFilesFrom(event.dataTransfer?.files);
            if (files.length === 0) return false;
            event.preventDefault();
            event.stopPropagation();
            propsRef.current.onInsertImageFiles(files);
            return true;
          },
        }),
      ],
    });

    const view = new EditorView({ state, parent });
    editorViewRef.current = view;
    view.dispatch({
      effects: [
        setCommentsEffect.of(propsRef.current.comments),
        setActiveEffect.of(null),
      ],
    });

    return () => {
      view.destroy();
      editorViewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentKey]);

  // Feed comments / active id into the editor when they change.
  useEffect(() => {
    const view = editorViewRef.current;
    if (!view) return;
    view.dispatch({ effects: setCommentsEffect.of(comments) });
    // Effect-only transactions don't trip the updateListener's resync, so
    // refresh the margin anchor positions for the new comment set.
    syncFromView(view);
  }, [comments, editorViewRef, syncFromView]);

  useEffect(() => {
    editorViewRef.current?.dispatch({
      effects: setActiveEffect.of(activeCommentId),
    });
  }, [activeCommentId, editorViewRef]);

  // Safety net: sync external value changes not made through the view.
  useEffect(() => {
    const view = editorViewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (value === current) return;
    view.dispatch({
      changes: { from: 0, to: current.length, insert: value },
    });
  }, [value, editorViewRef]);

  // Reset the highlighted slash item when the query changes.
  useEffect(() => {
    setSlashIndex(0);
  }, [slash?.query]);

  return (
    <div ref={wrapperRef} className={`relative ${MIN_HEIGHT_CLASS}`}>
      <div ref={containerRef} className="no-scrollbar" />
      {slash && slashCommands.length > 0 && (
        <DriveSlashMenu
          commands={slashCommands}
          activeIndex={slashIndex}
          position={{ top: slash.top, left: slash.left }}
          onSelect={selectSlashCommand}
          onHover={setSlashIndex}
        />
      )}
    </div>
  );
}
