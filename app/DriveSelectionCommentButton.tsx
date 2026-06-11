"use client";

import { MessageSquarePlus } from "lucide-react";

export default function DriveSelectionCommentButton({
  top,
  onClick,
}: {
  top: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Add comment"
      aria-label="Add comment"
      className="absolute z-20 flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg)] text-[var(--muted)] shadow-md transition-colors hover:border-[var(--fg)] hover:text-[var(--fg)]"
      style={{ top: Math.max(0, top - 4), right: -44 }}
    >
      <MessageSquarePlus size={16} />
    </button>
  );
}
