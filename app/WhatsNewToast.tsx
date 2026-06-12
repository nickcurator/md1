"use client";

import { Sparkles, X } from "lucide-react";
import { CHANGELOG } from "@/lib/changelog";

export default function WhatsNewToast({
  onOpen,
  onClose,
}: {
  onOpen: () => void;
  onClose: () => void;
}) {
  const latest = CHANGELOG[0];
  if (!latest) return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-40 w-[calc(100%-2rem)] max-w-md animate-sheet-up-center">
      <div className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 shadow-xl">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--card)] text-[var(--muted)]">
          <Sparkles size={14} />
        </div>
        <div className="min-w-0 flex-1 text-sm">
          <div className="font-medium">
            {latest.emoji ? `${latest.emoji} ` : ""}
            {latest.title}
          </div>
          <div className="mt-0.5 text-xs text-[var(--muted)]">
            We&apos;ve shipped some updates.
          </div>
          <button
            type="button"
            onClick={onOpen}
            className="mt-2 text-xs font-semibold text-[var(--fg)] underline underline-offset-2 hover:opacity-80"
          >
            See what&apos;s new
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="-m-1 shrink-0 p-1 text-[var(--muted)] transition-colors hover:text-[var(--fg)]"
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
