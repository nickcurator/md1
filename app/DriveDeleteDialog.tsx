"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

export default function DriveDeleteDialog({
  title,
  open,
  busy,
  onCancel,
  onConfirm,
}: {
  title: string;
  open: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onCancel, open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drive-delete-title"
    >
      <div
        className="absolute inset-0 bg-black/45 backdrop-blur-[1px]"
        onClick={() => !busy && onCancel()}
      />
      <div className="relative w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-6 shadow-2xl">
        <h2 id="drive-delete-title" className="text-lg font-semibold">
          Delete note?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          Delete &ldquo;{title}&rdquo;? This can&apos;t be undone.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--muted)] transition-colors hover:bg-[var(--card)] hover:text-[var(--fg)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500 disabled:opacity-50 dark:bg-red-500 dark:hover:bg-red-400"
          >
            {busy ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
