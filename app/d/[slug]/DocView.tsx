"use client";

import Link from "next/link";
import { Download, Library } from "lucide-react";
import Markdown from "@/components/Markdown";
import ThemeToggle from "@/components/ThemeToggle";

// Standalone reader for a shared doc: nothing but the text, centered, full
// screen. Theme toggle + "download .md" sit top-right. The "Drive" link (back
// to /drive) sits top-left, but ONLY for internal docs — a public/login-free
// doc hides it so an outside reader can't discover or jump to the other files.
export default function DocView({
  title,
  content,
  showDrive,
}: {
  title: string;
  content: string;
  showDrive: boolean;
}) {
  function download() {
    const safe =
      title
        .trim()
        .replace(/[^\p{L}\p{N}\-_ ]/gu, "")
        .replace(/\s+/g, "-")
        .slice(0, 80) || "document";
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safe}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-[100dvh] bg-[var(--bg)] text-[var(--fg)]">
      {showDrive && (
        <Link
          href="/"
          className="fixed top-3 left-3 z-10 flex h-9 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg)]/80 px-3 text-sm font-medium text-[var(--muted)] backdrop-blur hover:text-[var(--fg)]"
        >
          <Library size={16} />
          md1
        </Link>
      )}

      <div className="fixed top-3 right-3 z-10 flex items-center gap-1.5">
        <ThemeToggle />
        <button
          type="button"
          onClick={download}
          aria-label="Download as Markdown"
          title="Download .md"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg)]/80 text-[var(--muted)] backdrop-blur hover:text-[var(--fg)]"
        >
          <Download size={16} />
        </button>
      </div>

      <main id="main-content" className="mx-auto max-w-3xl px-5 py-16 md:px-8 md:py-24">
        <Markdown
          content={content}
          className="prose prose-neutral dark:prose-invert max-w-none prose-headings:font-semibold prose-pre:bg-[var(--card)] prose-pre:text-[var(--fg)]"
        />
      </main>
    </div>
  );
}
