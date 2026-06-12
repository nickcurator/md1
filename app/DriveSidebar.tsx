"use client";

import { Plus, Trash2, Upload } from "lucide-react";
import AppLogo from "@/components/AppLogo";
import type { DriveUser } from "@/lib/drive-users-server";
import type { SharedDoc } from "@/lib/shared-docs";
import DriveProfileButton from "./DriveProfileButton";

function formatUpdated(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

export default function DriveSidebar({
  user,
  isAdmin = false,
  docs,
  selectedId,
  dragActive,
  busy,
  onSelect,
  onDelete,
  onNew,
  onUploadFiles,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  user: DriveUser;
  isAdmin?: boolean;
  docs: SharedDoc[];
  selectedId: string | null;
  dragActive: boolean;
  busy: boolean;
  onSelect: (doc: SharedDoc) => void;
  onDelete: (doc: SharedDoc) => void;
  onNew: () => void;
  onUploadFiles: (files: FileList | File[]) => void;
  onDragEnter: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  return (
    <aside
      className="relative flex h-full w-[280px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg)]"
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {dragActive && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-[var(--fg)] bg-[var(--bg)]/90 px-4 text-center backdrop-blur-sm">
          <Upload size={22} className="text-[var(--fg)]" />
          <p className="text-sm font-medium">Drop markdown files here</p>
        </div>
      )}

      <div className="border-b border-[var(--border)] px-3 py-4">
        <AppLogo className="px-2" />
      </div>

      <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2.5">
        <h2 className="px-2 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
          Notes
        </h2>
        <div className="flex items-center gap-1">
          <label
            className={`inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--card)] hover:text-[var(--fg)] ${busy ? "pointer-events-none opacity-50" : ""}`}
            title="Upload .md"
          >
            <Upload size={16} />
            <input
              type="file"
              accept=".md,.markdown,.txt,text/markdown,text/plain"
              multiple
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const files = e.target.files;
                if (files?.length) onUploadFiles(files);
                e.target.value = "";
              }}
            />
          </label>
          <button
            type="button"
            onClick={onNew}
            disabled={busy}
            title="New note"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--card)] hover:text-[var(--fg)] disabled:opacity-50"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto p-2">
        {docs.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs leading-relaxed text-[var(--muted)]">
            No notes yet.
            <br />
            Create one, upload, or drop .md files here.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {docs.map((doc) => {
              const selected = selectedId === doc.id;
              return (
                <li key={doc.id}>
                  <div
                    className={`group flex items-center gap-0.5 rounded-lg transition-colors ${
                      selected
                        ? "bg-[var(--card)] ring-1 ring-[var(--border)]"
                        : "hover:bg-[var(--card)]/80"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(doc)}
                      className="min-w-0 flex-1 rounded-lg px-2.5 py-2 text-left"
                    >
                      <span className="block truncate text-sm font-medium">
                        {doc.title}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[var(--muted)]">
                        <span>{formatUpdated(doc.updatedAt)}</span>
                        {!doc.isPublished ? (
                          <span>· draft</span>
                        ) : (
                          <span>· published</span>
                        )}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(doc)}
                      disabled={busy}
                      title={`Delete "${doc.title}"`}
                      aria-label={`Delete "${doc.title}"`}
                      className={`mr-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--muted)] transition-all hover:bg-[var(--bg)] hover:text-red-500 disabled:opacity-50 ${
                        selected
                          ? "opacity-100"
                          : "opacity-0 group-hover:opacity-100"
                      }`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mt-auto border-t border-[var(--border)] p-3">
        <DriveProfileButton user={user} isAdmin={isAdmin} />
      </div>
    </aside>
  );
}
