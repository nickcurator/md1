"use client";

import {
  Bold,
  Code,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Quote,
  Strikethrough,
} from "lucide-react";
import type { MarkdownActionId } from "./drive-markdown-edit";
import { markdownShortcutHint } from "./drive-markdown-edit";

function ToolButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--card)] hover:text-[var(--fg)]"
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-0.5 h-5 w-px bg-[var(--border)]" />;
}

export default function DriveMarkdownToolbar({
  onAction,
  onInsertImage,
}: {
  onAction: (action: MarkdownActionId) => void;
  onInsertImage: () => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-0.5 border-b border-[var(--border)] pb-3">
      <ToolButton
        label={`Bold (${markdownShortcutHint("mod", "B")})`}
        onClick={() => onAction("bold")}
      >
        <Bold size={16} />
      </ToolButton>
      <ToolButton
        label={`Italic (${markdownShortcutHint("mod", "I")})`}
        onClick={() => onAction("italic")}
      >
        <Italic size={16} />
      </ToolButton>
      <ToolButton
        label={`Strikethrough (${markdownShortcutHint("modShift", "X")})`}
        onClick={() => onAction("strikethrough")}
      >
        <Strikethrough size={16} />
      </ToolButton>
      <ToolButton
        label={`Inline code (${markdownShortcutHint("mod", "E")})`}
        onClick={() => onAction("code")}
      >
        <Code size={16} />
      </ToolButton>
      <ToolButton
        label={`Link (${markdownShortcutHint("mod", "K")})`}
        onClick={() => onAction("link")}
      >
        <Link size={16} />
      </ToolButton>

      <Divider />

      <ToolButton
        label={`Heading 1 (${markdownShortcutHint("modAlt", "1")})`}
        onClick={() => onAction("h1")}
      >
        <Heading1 size={16} />
      </ToolButton>
      <ToolButton
        label={`Heading 2 (${markdownShortcutHint("modAlt", "2")})`}
        onClick={() => onAction("h2")}
      >
        <Heading2 size={16} />
      </ToolButton>
      <ToolButton
        label={`Heading 3 (${markdownShortcutHint("modAlt", "3")})`}
        onClick={() => onAction("h3")}
      >
        <Heading3 size={16} />
      </ToolButton>

      <Divider />

      <ToolButton
        label={`Bullet list (${markdownShortcutHint("modShift", "8")})`}
        onClick={() => onAction("ul")}
      >
        <List size={16} />
      </ToolButton>
      <ToolButton
        label={`Numbered list (${markdownShortcutHint("modShift", "7")})`}
        onClick={() => onAction("ol")}
      >
        <ListOrdered size={16} />
      </ToolButton>
      <ToolButton
        label={`Checklist (${markdownShortcutHint("modShift", "0")})`}
        onClick={() => onAction("task")}
      >
        <ListChecks size={16} />
      </ToolButton>
      <ToolButton
        label={`Quote (${markdownShortcutHint("modShift", "9")})`}
        onClick={() => onAction("quote")}
      >
        <Quote size={16} />
      </ToolButton>
      <ToolButton
        label={`Code block (${markdownShortcutHint("modShift", "K")})`}
        onClick={() => onAction("codeBlock")}
      >
        <Code2 size={16} />
      </ToolButton>
      <ToolButton
        label={`Divider (${markdownShortcutHint("modShift", "-")})`}
        onClick={() => onAction("hr")}
      >
        <Minus size={16} />
      </ToolButton>

      <Divider />

      <ToolButton label="Insert image" onClick={onInsertImage}>
        <ImageIcon size={16} />
      </ToolButton>
    </div>
  );
}
