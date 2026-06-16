"use client";

import "@blocknote/core/fonts/inter.css";
import "@blocknote/ariakit/style.css";

import { useEffect, useRef, useState } from "react";
import { filterSuggestionItems } from "@blocknote/core/extensions";
import { BlockNoteView } from "@blocknote/ariakit";
import {
  getDefaultReactSlashMenuItems,
  SuggestionMenuController,
  useCreateBlockNote,
} from "@blocknote/react";
import DriveBlockSlashMenu from "./DriveBlockSlashMenu";
import { uploadMedia } from "./drive-media";

// Stage 3 (beta): a Notion-style block editor on BlockNote. The document is
// still stored as Markdown — we parse the body into blocks on mount and
// serialize back to Markdown on every change (lossy round-trip). Image uploads
// reuse the Stage 1 endpoint via uploadFile. Rendered behind a feature toggle
// and dynamically imported with ssr:false (BlockNote needs the DOM).
function prefersDark(): boolean {
  if (typeof document === "undefined") return false;
  const root = document.documentElement;
  if (root.classList.contains("dark")) return true;
  if (root.classList.contains("light")) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export default function DriveBlockEditor({
  content,
  onChange,
  onSelectionText,
}: {
  content: string;
  onChange: (markdown: string) => void;
  onSelectionText?: (text: string) => void;
}) {
  const editor = useCreateBlockNote({
    uploadFile: async (file: File) => (await uploadMedia(file)).url,
  });
  const ready = useRef(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [dark, setDark] = useState(prefersDark);

  // Report the current text selection (for commenting) when it lands inside the
  // editor. BlockNote uses ProseMirror positions, not Markdown offsets, so we
  // capture the selected string and let the comment layer re-anchor by quote.
  const reportSelection = () => {
    if (!onSelectionText) return;
    const sel = typeof window !== "undefined" ? window.getSelection() : null;
    const text = sel?.toString() ?? "";
    const inside = !!sel?.anchorNode && !!wrapperRef.current?.contains(sel.anchorNode);
    onSelectionText(inside ? text.trim() : "");
  };

  // Parse the stored Markdown into blocks once, then allow change tracking.
  useEffect(() => {
    const blocks = editor.tryParseMarkdownToBlocks(content);
    if (blocks.length > 0) {
      editor.replaceBlocks(editor.document, blocks);
    }
    const raf = requestAnimationFrame(() => {
      ready.current = true;
    });
    return () => cancelAnimationFrame(raf);
    // Load once per mount; the caller remounts (via key) when the doc changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  // Follow the OS colour scheme while open (class-based override is read once).
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setDark(prefersDark());
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return (
    <div ref={wrapperRef} onMouseUp={reportSelection} onKeyUp={reportSelection}>
      <BlockNoteView
        editor={editor}
        theme={dark ? "dark" : "light"}
        slashMenu={false}
        onChange={() => {
          if (!ready.current) return;
          onChange(editor.blocksToMarkdownLossy());
        }}
      >
        <SuggestionMenuController
          triggerCharacter="/"
          suggestionMenuComponent={DriveBlockSlashMenu}
          getItems={async (query) =>
            filterSuggestionItems(getDefaultReactSlashMenuItems(editor), query)
          }
        />
      </BlockNoteView>
    </div>
  );
}
