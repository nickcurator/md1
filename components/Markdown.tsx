"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { parseImageWidth } from "@/app/drive-image-size";

// Render images at the width stored in their title (`![alt](url "w=400")`), so
// resized images keep their size in the preview and on the public page. The
// title is consumed (not shown as a tooltip).
const imageWithWidth: Components["img"] = ({ src, alt, title }) => {
  const width = parseImageWidth(typeof title === "string" ? title : null);
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={typeof src === "string" ? src : undefined}
      alt={alt ?? ""}
      loading="lazy"
      style={width ? { width: `${width}px`, maxWidth: "100%" } : undefined}
    />
  );
};

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
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{ img: imageWithWidth, ...components }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
