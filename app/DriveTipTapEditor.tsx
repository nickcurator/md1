"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Editor } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import { Markdown, type MarkdownStorage } from "tiptap-markdown";
import type { DocComment } from "@/lib/shared-docs";
import { imageFilesFrom } from "./drive-media";
import { ResizableImage } from "./tiptap/image-node";
import { createSlashExtension } from "./tiptap/slash";
import {
  CommentsExtension,
  commentRanges,
  commentsPluginKey,
} from "./tiptap/comments";

export type EditorSelectionInfo = {
  start: number;
  end: number;
  quote: string;
  top: number;
};

export function getMarkdown(editor: Editor): string {
  return (editor.storage as unknown as { markdown: MarkdownStorage }).markdown.getMarkdown();
}

// WYSIWYG editor (TipTap/ProseMirror). The document is rich content; Markdown is
// imported into it on mount and serialized back out on every change, so storage
// stays Markdown while the user never sees the syntax. Styled with the same
// `prose` classes as the preview so the editor looks like the rendered doc.
const PROSE_CLASS =
  "prose prose-neutral dark:prose-invert max-w-none prose-headings:font-semibold prose-pre:bg-[var(--bg)] prose-pre:text-[var(--fg)] prose-img:rounded-lg focus:outline-none min-h-[calc(100dvh-14rem)]";

export default function DriveTipTapEditor({
  value,
  comments,
  activeCommentId,
  onChange,
  editorRef,
  onInsertImage,
  onInsertImageFiles,
  onSelectionChange,
  onAnchorPositions,
  onCommentClick,
}: {
  value: string;
  documentKey: string;
  comments: DocComment[];
  activeCommentId: string | null;
  onChange: (markdown: string) => void;
  editorRef: React.RefObject<Editor | null>;
  onInsertImage: () => void;
  onInsertImageFiles: (files: File[]) => void;
  onSelectionChange: (selection: EditorSelectionInfo | null) => void;
  onAnchorPositions: (positions: Record<string, number>) => void;
  onCommentClick: (id: string) => void;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  // Latest props via ref so the editor (created once) reads current values.
  const cbRef = useRef({
    onChange,
    onInsertImage,
    onInsertImageFiles,
    onSelectionChange,
    onAnchorPositions,
    onCommentClick,
    comments,
  });
  cbRef.current = {
    onChange,
    onInsertImage,
    onInsertImageFiles,
    onSelectionChange,
    onAnchorPositions,
    onCommentClick,
    comments,
  };

  // Push selection (for the comment button) + comment anchor positions (for the
  // margin) from the live editor up to the parent.
  const syncFromEditor = useCallback((ed: Editor) => {
    const cb = cbRef.current;
    const wrapTop = wrapperRef.current?.getBoundingClientRect().top ?? 0;
    try {
      const sel = ed.state.selection;
      if (sel.empty) {
        cb.onSelectionChange(null);
      } else {
        const quote = ed.state.doc.textBetween(sel.from, sel.to, "", "");
        if (!quote.trim()) {
          cb.onSelectionChange(null);
        } else {
          const coords = ed.view.coordsAtPos(sel.from);
          cb.onSelectionChange({
            start: sel.from,
            end: sel.to,
            quote,
            top: coords.top - wrapTop,
          });
        }
      }
      const positions: Record<string, number> = {};
      const ranges = commentRanges(ed.state.doc, cb.comments);
      for (const [id, r] of Object.entries(ranges)) {
        positions[id] = ed.view.coordsAtPos(r.from).top - wrapTop;
      }
      cb.onAnchorPositions(positions);
    } catch {
      /* view not ready */
    }
  }, []);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: true }),
      ResizableImage.configure({ inline: false }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      createSlashExtension(() => cbRef.current.onInsertImage()),
      CommentsExtension,
      Markdown.configure({
        html: false,
        linkify: true,
        breaks: false,
        transformPastedText: true,
      }),
    ],
    content: value,
    editorProps: {
      attributes: { class: PROSE_CLASS },
      handlePaste: (_view, event) => {
        const files = imageFilesFrom(event.clipboardData?.files);
        if (files.length === 0) return false;
        cbRef.current.onInsertImageFiles(files);
        return true;
      },
      handleDrop: (_view, event) => {
        const files = imageFilesFrom((event as DragEvent).dataTransfer?.files);
        if (files.length === 0) return false;
        event.preventDefault();
        cbRef.current.onInsertImageFiles(files);
        return true;
      },
    },
    onUpdate: ({ editor }) => {
      cbRef.current.onChange(getMarkdown(editor));
      syncFromEditor(editor);
    },
    onSelectionUpdate: ({ editor }) => {
      syncFromEditor(editor);
    },
  });

  useEffect(() => {
    editorRef.current = editor;
    return () => {
      if (editorRef.current === editor) editorRef.current = null;
    };
  }, [editor, editorRef]);

  // Feed comments / active id into the decoration plugin, then refresh anchors.
  useEffect(() => {
    if (!editor) return;
    editor.view.dispatch(
      editor.state.tr.setMeta(commentsPluginKey, {
        comments,
        activeId: activeCommentId,
      }),
    );
    syncFromEditor(editor);
  }, [editor, comments, activeCommentId, syncFromEditor]);

  const handleClick = (e: React.MouseEvent) => {
    const anchor = (e.target as HTMLElement).closest<HTMLElement>(
      "[data-comment-anchor]",
    );
    const id = anchor?.dataset.commentAnchor;
    if (id) cbRef.current.onCommentClick(id);
  };

  return (
    <div ref={wrapperRef} onClick={handleClick}>
      <EditorContent editor={editor} />
    </div>
  );
}
