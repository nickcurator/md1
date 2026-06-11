"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Shared markdown renderer. GFM enables tables, task lists, strikethrough and
// autolinks — the things our internal docs actually use. Styling comes from
// Tailwind's typography plugin via the `prose` class on the wrapper, so
// callers just pass a `className` (e.g. "prose prose-neutral max-w-none").
export default function Markdown({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
