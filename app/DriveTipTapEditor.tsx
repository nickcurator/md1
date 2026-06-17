"use client";

import { useEffect, useRef } from "react";
import type { Editor } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { Markdown, type MarkdownStorage } from "tiptap-markdown";
import { imageFilesFrom } from "./drive-media";

function getMarkdown(editor: Editor): string {
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
  onChange,
  editorRef,
  onInsertImageFiles,
}: {
  value: string;
  documentKey: string;
  onChange: (markdown: string) => void;
  editorRef: React.RefObject<Editor | null>;
  onInsertImageFiles: (files: File[]) => void;
}) {
  // Latest callbacks via ref so the editor (created once) reads current props.
  const cbRef = useRef({ onChange, onInsertImageFiles });
  cbRef.current = { onChange, onInsertImageFiles };

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: true }),
      Image.configure({ inline: false }),
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
        const files = imageFilesFrom(
          (event as DragEvent).dataTransfer?.files,
        );
        if (files.length === 0) return false;
        event.preventDefault();
        cbRef.current.onInsertImageFiles(files);
        return true;
      },
    },
    onUpdate: ({ editor }) => {
      cbRef.current.onChange(getMarkdown(editor));
    },
  });

  useEffect(() => {
    editorRef.current = editor;
    return () => {
      if (editorRef.current === editor) editorRef.current = null;
    };
  }, [editor, editorRef]);

  return <EditorContent editor={editor} />;
}
