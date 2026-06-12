"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Key, LogOut, User } from "lucide-react";
import type { DriveUser } from "@/lib/drive-users-server";

function DriveAvatar({ user, size }: { user: DriveUser; size: number }) {
  const label = user.name.trim() || user.email;
  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt=""
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size, minWidth: size }}
      />
    );
  }
  return (
    <span
      className="flex items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)] text-[var(--muted)]"
      style={{ width: size, height: size, minWidth: size, fontSize: size * 0.45 }}
    >
      {label ? label[0].toUpperCase() : <User size={size * 0.55} />}
    </span>
  );
}

export default function DriveProfileButton({ user }: { user: DriveUser }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const displayName = user.name.trim() || user.email.split("@")[0] || user.email;

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-[var(--card)]"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Open profile menu"
      >
        <DriveAvatar user={user} size={32} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-[var(--fg)]">
            {displayName}
          </span>
          <span className="block truncate text-xs text-[var(--muted)]">
            {user.email}
          </span>
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="false"
          className="absolute bottom-full left-0 z-30 mb-1.5 w-[260px] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg)] shadow-xl"
        >
          <div className="flex items-center gap-3 px-4 py-3">
            <DriveAvatar user={user} size={32} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{displayName}</div>
              <div className="truncate text-xs text-[var(--muted)]">
                {user.email}
              </div>
            </div>
          </div>
          <div className="border-t border-[var(--border)]" />
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-[var(--card)]"
          >
            <Key size={18} />
            API tokens &amp; Cursor
          </Link>
          <a
            href="/api/auth/logout"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-3 px-3 py-2.5 text-sm text-red-600 transition-colors hover:bg-[var(--card)] dark:text-red-400"
          >
            <LogOut size={18} />
            Sign out
          </a>
        </div>
      )}
    </div>
  );
}
