"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

// Shared markdown renderer. GFM enables tables, task lists, strikethrough and
// autolinks — the things our internal docs actually use. Styling comes from
// Tailwind's typography plugin via the `prose` class on the wrapper, so
// callers just pass a `className` (e.g. "prose prose-neutral max-w-none").
// `components` lets a caller override how specific nodes render — e.g. the
// editor preview wires interactive task-list checkboxes.
export default function Markdown({
  content,
  className,
  components,
}: {
  content: string;
  className?: string;
  components?: Components;
}) {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
