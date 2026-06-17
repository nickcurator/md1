"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  Eye,
  Folder,
  Pencil,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { EditorView } from "@codemirror/view";
import type { Editor } from "@tiptap/core";
import { shareDocPath, type DocComment, type DriveFolder } from "@/lib/shared-docs";
import DriveCodeEditor, { type EditorSelectionInfo } from "./DriveCodeEditor";
import DriveTipTapEditor from "./DriveTipTapEditor";
import { runTipTapAction } from "./tiptap/commands";
import DriveCommentMargin from "./DriveCommentMargin";
import DriveCommentMarkdown from "./DriveCommentMarkdown";
import DriveMarkdownToolbar from "./DriveMarkdownToolbar";
import DriveSelectionCommentButton from "./DriveSelectionCommentButton";
import { createDocComment } from "./drive-comments";
import {
  applyMarkdownEdit,
  toggleTaskByIndex,
  type MarkdownActionId,
} from "./drive-markdown-edit";
import { imageFilesFrom, imageMarkdown, uploadMedia } from "./drive-media";
import type { DriveEditorLiveReaders } from "./drive-editor-live";

const EDITOR_PREF_KEY = "md1:editor";

type Form = {
  title: string;
  description: string;
  content: string;
  comments: DocComment[];
  folderId: string | null;
  isPublished: boolean;
  isPublic: boolean;
};

export default function DriveEditor({
  editingId,
  form,
  folders,
  slug,
  showPreview,
  busy,
  saveStatus,
  error,
  copiedSlug,
  dragActive,
  onFormChange,
  onRegisterLiveReaders,
  onTogglePreview,
  onPublish,
  onUnpublish,
  onDelete,
  onCopyLink,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  editingId: string | null;
  form: Form;
  folders: DriveFolder[];
  slug?: string;
  showPreview: boolean;
  busy: boolean;
  saveStatus: "idle" | "saving" | "saved" | "error";
  error: string | null;
  copiedSlug: string | null;
  dragActive: boolean;
  onFormChange: (patch: Partial<Form>) => void;
  onRegisterLiveReaders: (readers: DriveEditorLiveReaders | null) => void;
  onTogglePreview: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
  onDelete: () => void;
  onCopyLink: () => void;
  onDragEnter: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  const editorViewRef = useRef<EditorView | null>(null);
  const tiptapEditorRef = useRef<Editor | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const contentAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    onRegisterLiveReaders({
      getContent: () => editorViewRef.current?.state.doc.toString() ?? null,
      getTitle: () => titleInputRef.current?.value ?? null,
    });
    return () => onRegisterLiveReaders(null);
  }, [editingId, onRegisterLiveReaders]);
  const [selection, setSelection] = useState<{
    start: number;
    end: number;
    quote: string;
  } | null>(null);
  const [selectionTop, setSelectionTop] = useState(0);
  const [composing, setComposing] = useState(false);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [anchorPositions, setAnchorPositions] = useState<Record<string, number>>(
    {},
  );
  const [commentOffsetTop, setCommentOffsetTop] = useState(0);
  const [mediaError, setMediaError] = useState<string | null>(null);
  // WYSIWYG (TipTap) vs the CodeMirror markdown editor. Persisted; CM6 kept as a
  // fallback while the rich editor is validated.
  const [useTipTap, setUseTipTap] = useState(true);
  useEffect(() => {
    try {
      setUseTipTap(window.localStorage.getItem(EDITOR_PREF_KEY) !== "cm");
    } catch {
      /* ignore */
    }
  }, []);
  const toggleEditorEngine = useCallback(() => {
    setUseTipTap((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(EDITOR_PREF_KEY, next ? "tiptap" : "cm");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);
  const canShare = form.isPublished && !!editingId && !!slug;

  useLayoutEffect(() => {
    const el = contentAreaRef.current;
    if (!el) return;
    const update = () => setCommentOffsetTop(el.offsetTop);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [showPreview, form.title, form.isPublished, editingId]);

  const handleAnchorPositions = useCallback((positions: Record<string, number>) => {
    setAnchorPositions(positions);
  }, []);

  function focusComment(id: string | null) {
    setActiveCommentId(id);
    if (!id) return;
    document
      .getElementById(`drive-comment-card-${id}`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    if (showPreview) {
      document
        .getElementById(`drive-comment-${id}`)
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }

  function addComment(text: string) {
    if (!selection) return;
    const content = editorViewRef.current?.state.doc.toString() ?? form.content;
    const comment = createDocComment(
      content,
      selection.start,
      selection.end,
      text,
    );
    if (!comment) return;
    onFormChange({ comments: [...form.comments, comment] });
    setActiveCommentId(comment.id);
    setComposing(false);
    setSelection(null);
    const view = editorViewRef.current;
    if (view) {
      view.dispatch({ selection: { anchor: view.state.selection.main.to } });
    }
  }

  function updateComment(id: string, text: string) {
    onFormChange({
      comments: form.comments.map((c) =>
        c.id === id ? { ...c, text } : c,
      ),
    });
  }

  function deleteComment(id: string) {
    onFormChange({
      comments: form.comments.filter((c) => c.id !== id),
    });
    if (activeCommentId === id) setActiveCommentId(null);
  }

  const applyFormat = useCallback((action: MarkdownActionId) => {
    const tt = tiptapEditorRef.current;
    if (tt) {
      runTipTapAction(tt, action);
      return;
    }
    const view = editorViewRef.current;
    if (!view) return;
    const value = view.state.doc.toString();
    const { from, to } = view.state.selection.main;
    const result = applyMarkdownEdit(value, from, to, action);
    view.dispatch({
      changes: { from: 0, to: value.length, insert: result.value },
      selection: { anchor: result.selectionStart, head: result.selectionEnd },
    });
    view.focus();
  }, []);

  const handleToggleTask = useCallback(
    (index: number) => {
      onFormChange({ content: toggleTaskByIndex(form.content, index) });
    },
    [form.content, onFormChange],
  );

  // Insert text at the caret in the CodeMirror view.
  const insertAtCursor = useCallback((text: string) => {
    const view = editorViewRef.current;
    if (!view) return;
    const { from, to } = view.state.selection.main;
    view.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: from + text.length },
    });
    view.focus();
  }, []);

  const replaceInEditor = useCallback((token: string, replacement: string) => {
    const view = editorViewRef.current;
    if (!view) return;
    const value = view.state.doc.toString();
    const idx = value.indexOf(token);
    if (idx === -1) return;
    view.dispatch({
      changes: { from: idx, to: idx + token.length, insert: replacement },
    });
  }, []);

  // Drop a placeholder in immediately, then swap it for the real `![](url)`
  // once the upload resolves (or remove it on failure).
  const uploadAndInsert = useCallback(
    async (file: File) => {
      const tt = tiptapEditorRef.current;
      if (tt) {
        try {
          const { url, name } = await uploadMedia(file);
          tt.chain().focus().setImage({ src: url, alt: name }).run();
        } catch (err) {
          setMediaError(err instanceof Error ? err.message : "Upload failed");
        }
        return;
      }
      const placeholder = `![Uploading ${file.name}…](uploading:${crypto.randomUUID()})`;
      insertAtCursor(placeholder + "\n");
      try {
        const { url, name } = await uploadMedia(file);
        replaceInEditor(placeholder, imageMarkdown(name, url));
      } catch (err) {
        replaceInEditor(placeholder + "\n", "");
        setMediaError(err instanceof Error ? err.message : "Upload failed");
      }
    },
    [insertAtCursor, replaceInEditor],
  );

  const handleInsertImageFiles = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      setMediaError(null);
      for (const file of files) void uploadAndInsert(file);
    },
    [uploadAndInsert],
  );

  const handleEditorSelection = useCallback((sel: EditorSelectionInfo | null) => {
    if (!sel) {
      setSelection(null);
      return;
    }
    setSelection({ start: sel.start, end: sel.end, quote: sel.quote });
    setSelectionTop(sel.top);
  }, []);

  const handlePickImage = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const images = imageFilesFrom(event.target.files);
      event.target.value = "";
      if (images.length === 0) return;
      setMediaError(null);
      for (const file of images) void uploadAndInsert(file);
    },
    [uploadAndInsert],
  );

  if (editingId === null) {
    return (
      <div
        className="relative flex min-w-0 flex-1 flex-col items-center justify-center bg-[var(--bg)] px-8 text-center"
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {dragActive ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-[var(--fg)] px-10 py-14">
            <p className="text-base font-medium">Drop markdown files to import</p>
            <p className="text-sm text-[var(--muted)]">.md, .markdown, .txt</p>
          </div>
        ) : (
          <>
            <p className="text-base font-medium">Select a note to edit</p>
            <p className="mt-2 max-w-sm text-sm text-[var(--muted)]">
              Pick one from the sidebar, create a new note, or drag markdown
              files anywhere in Drive.
            </p>
          </>
        )}
      </div>
    );
  }

  const showCommentMargin =
    composing || form.comments.length > 0;

  return (
    <div
      className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col bg-[var(--bg)]"
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {dragActive && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-[var(--bg)]/85 backdrop-blur-sm">
          <div className="rounded-2xl border-2 border-dashed border-[var(--fg)] px-10 py-8 text-center">
            <p className="text-base font-medium">Drop to import markdown</p>
          </div>
        </div>
      )}

      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--border)] bg-[var(--bg)] py-2.5 pl-4 pr-14">
        <button
          type="button"
          onClick={onTogglePreview}
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-[var(--muted)] hover:bg-[var(--card)] hover:text-[var(--fg)]"
        >
          {showPreview ? <Pencil size={15} /> : <Eye size={15} />}
          {showPreview ? "Edit" : "Preview"}
        </button>

        {!showPreview && (
          <button
            type="button"
            onClick={toggleEditorEngine}
            title="Switch editor engine"
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-[var(--muted)] hover:bg-[var(--card)] hover:text-[var(--fg)]"
          >
            <Sparkles size={15} />
            {useTipTap ? "Markdown mode" : "Rich mode"}
          </button>
        )}

        <label
          title="Folder"
          className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-2 py-1.5 text-sm text-[var(--muted)]"
        >
          <Folder size={15} />
          <select
            aria-label="Folder"
            value={form.folderId ?? ""}
            disabled={busy}
            onChange={(e) =>
              onFormChange({ folderId: e.target.value || null })
            }
            className="max-w-40 bg-transparent text-[var(--fg)] outline-none disabled:opacity-50"
          >
            <option value="">My Drive</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
        </label>

        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {!form.isPublished ? (
            <button
              type="button"
              onClick={onPublish}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm font-medium hover:border-[var(--fg)] disabled:opacity-50"
            >
              Publish
            </button>
          ) : (
            <>
              <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                Published
              </span>
              <button
                type="button"
                onClick={onUnpublish}
                disabled={busy}
                className="text-sm text-[var(--muted)] hover:text-[var(--fg)] disabled:opacity-50"
              >
                Unpublish
              </button>
            </>
          )}

          {canShare && (
            <>
              <button
                type="button"
                onClick={onCopyLink}
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-[var(--muted)] hover:bg-[var(--card)] hover:text-[var(--fg)]"
              >
                {copiedSlug === slug ? (
                  <>
                    <Check size={15} /> Copied
                  </>
                ) : (
                  <>
                    <Copy size={15} /> Copy link
                  </>
                )}
              </button>
              <a
                href={shareDocPath(slug!)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-[var(--muted)] hover:bg-[var(--card)] hover:text-[var(--fg)]"
              >
                <ExternalLink size={15} />
                Open
              </a>
            </>
          )}

          {editingId && (
            <button
              type="button"
              onClick={onDelete}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-[var(--muted)] hover:bg-[var(--card)] hover:text-red-500 disabled:opacity-50"
            >
              <Trash2 size={15} />
            </button>
          )}

          {saveStatus !== "idle" && (
            <span
              className={`text-xs ${
                saveStatus === "error"
                  ? "text-red-500"
                  : "text-[var(--muted)]"
              }`}
            >
              {saveStatus === "saving"
                ? "Saving…"
                : saveStatus === "saved"
                  ? "Saved"
                  : "Save failed"}
            </span>
          )}
        </div>
      </div>

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto bg-[var(--bg)] py-6 pl-4 pr-5 md:pl-6">
        {error && (
          <div className="mb-4 max-w-[1280px] rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-500">
            {error}
          </div>
        )}

        <article className="grid w-full max-w-[1280px] grid-cols-1 gap-x-1 lg:grid-cols-[minmax(0,980px)_260px]">
          <div className="min-w-0 px-8 py-10 md:px-12 md:py-12">
            <input
              key={editingId}
              ref={titleInputRef}
              defaultValue={form.title}
              onChange={(e) => onFormChange({ title: e.target.value })}
              placeholder="Untitled"
              className="mb-4 w-full shrink-0 border-none bg-transparent text-3xl font-semibold leading-tight outline-none placeholder:text-[var(--muted)]"
            />

            {!form.isPublished && (
              <p className="mb-4 shrink-0 text-sm text-[var(--muted)]">
                Draft — publish to get a link anyone can open.
              </p>
            )}

            {!showPreview && (
              <DriveMarkdownToolbar
                onAction={applyFormat}
                onInsertImage={handlePickImage}
              />
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              multiple
              hidden
              onChange={handleFileInputChange}
            />
            {mediaError && (
              <p className="mb-3 text-sm text-red-500">{mediaError}</p>
            )}

            <div
              ref={contentAreaRef}
              className="relative flex flex-col"
            >
              {showPreview ? (
                <DriveCommentMarkdown
                  content={form.content}
                  comments={form.comments}
                  activeCommentId={activeCommentId}
                  onCommentClick={focusComment}
                  onAnchorPositions={handleAnchorPositions}
                  onToggleTask={handleToggleTask}
                />
              ) : useTipTap ? (
                <DriveTipTapEditor
                  key={editingId}
                  value={form.content}
                  documentKey={editingId}
                  onChange={(content) => onFormChange({ content })}
                  editorRef={tiptapEditorRef}
                  onInsertImageFiles={handleInsertImageFiles}
                />
              ) : (
                <DriveCodeEditor
                  key={editingId}
                  value={form.content}
                  documentKey={editingId}
                  comments={form.comments}
                  activeCommentId={activeCommentId}
                  placeholder="Start writing…"
                  editorViewRef={editorViewRef}
                  onChange={(content) => onFormChange({ content })}
                  onSelectionChange={handleEditorSelection}
                  onAnchorPositions={handleAnchorPositions}
                  onApplyAction={applyFormat}
                  onInsertImage={handlePickImage}
                  onInsertImageFiles={handleInsertImageFiles}
                />
              )}

              {!showPreview && !useTipTap && selection && !composing && (
                <DriveSelectionCommentButton
                  top={selectionTop}
                  onClick={() => setComposing(true)}
                />
              )}
            </div>
          </div>

          {showCommentMargin && !useTipTap && (
            <div className="relative hidden min-h-0 self-stretch lg:block">
              <DriveCommentMargin
                content={form.content}
                comments={form.comments}
                composing={composing}
                commentOffsetTop={commentOffsetTop}
                composeTop={selectionTop}
                selectionQuote={selection?.quote ?? ""}
                activeCommentId={activeCommentId}
                anchorPositions={anchorPositions}
                onActiveCommentChange={focusComment}
                onSubmitCompose={addComment}
                onCancelCompose={() => {
                  setComposing(false);
                }}
                onUpdateComment={updateComment}
                onDeleteComment={deleteComment}
              />
            </div>
          )}
        </article>
      </div>
    </div>
  );
}
