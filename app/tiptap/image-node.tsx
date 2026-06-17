"use client";

import { useEffect, useRef, useState } from "react";
import Image from "@tiptap/extension-image";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { parseImageWidth } from "../drive-image-size";

// Inline image with a drag-to-resize handle. Width is persisted in the image
// title as `w=<px>` (CommonMark-valid), so it round-trips through tiptap-
// markdown's default image serializer and is honoured by the preview/public
// renderer (components/Markdown.tsx).
function ImageNodeView({ node, updateAttributes, selected }: NodeViewProps) {
  const src = typeof node.attrs.src === "string" ? node.attrs.src : "";
  const alt = typeof node.attrs.alt === "string" ? node.attrs.alt : "";
  const storedWidth = parseImageWidth(
    typeof node.attrs.title === "string" ? node.attrs.title : null,
  );
  const [width, setWidth] = useState<number | null>(storedWidth);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setWidth(storedWidth);
  }, [storedWidth]);

  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = imgRef.current?.getBoundingClientRect().width ?? 0;
    const onMove = (ev: PointerEvent) => {
      setWidth(Math.max(40, Math.round(startW + (ev.clientX - startX))));
    };
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const w = Math.max(40, Math.round(startW + (ev.clientX - startX)));
      updateAttributes({ title: `w=${w}` });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <NodeViewWrapper className="tt-image">
      <span className="relative inline-block max-w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          draggable={false}
          loading="lazy"
          className={`block max-w-full rounded-lg border ${
            selected ? "border-amber-500/70" : "border-[var(--border)]"
          }`}
          style={width ? { width: `${width}px` } : undefined}
        />
        <span
          onPointerDown={startResize}
          aria-hidden
          className="absolute bottom-1.5 right-1.5 h-3.5 w-3.5 cursor-nwse-resize rounded-sm border-2 border-[var(--bg)] bg-[var(--fg)] opacity-60 hover:opacity-90"
        />
      </span>
    </NodeViewWrapper>
  );
}

export const ResizableImage = Image.extend({
  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },
});
