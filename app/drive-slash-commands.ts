import {
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Quote,
  type LucideIcon,
} from "lucide-react";
import type { MarkdownActionId } from "./drive-markdown-edit";

// A "/" command. `kind: "action"` reuses an existing markdown edit; `kind:
// "image"` triggers the upload picker — so the slash menu is just a faster
// surface over the Stage 1 plumbing, no new editing logic.
export type SlashCommand = {
  id: string;
  label: string;
  icon: LucideIcon;
  keywords: string[];
} & ({ kind: "action"; action: MarkdownActionId } | { kind: "image" });

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: "h1",
    label: "Heading 1",
    icon: Heading1,
    keywords: ["h1", "heading", "title"],
    kind: "action",
    action: "h1",
  },
  {
    id: "h2",
    label: "Heading 2",
    icon: Heading2,
    keywords: ["h2", "heading", "subtitle"],
    kind: "action",
    action: "h2",
  },
  {
    id: "h3",
    label: "Heading 3",
    icon: Heading3,
    keywords: ["h3", "heading"],
    kind: "action",
    action: "h3",
  },
  {
    id: "task",
    label: "Checklist",
    icon: ListChecks,
    keywords: ["todo", "task", "checklist", "check", "checkbox"],
    kind: "action",
    action: "task",
  },
  {
    id: "ul",
    label: "Bulleted list",
    icon: List,
    keywords: ["bullet", "list", "unordered"],
    kind: "action",
    action: "ul",
  },
  {
    id: "ol",
    label: "Numbered list",
    icon: ListOrdered,
    keywords: ["number", "numbered", "ordered", "list"],
    kind: "action",
    action: "ol",
  },
  {
    id: "quote",
    label: "Quote",
    icon: Quote,
    keywords: ["quote", "blockquote", "citation"],
    kind: "action",
    action: "quote",
  },
  {
    id: "code",
    label: "Code block",
    icon: Code2,
    keywords: ["code", "snippet", "block"],
    kind: "action",
    action: "codeBlock",
  },
  {
    id: "hr",
    label: "Divider",
    icon: Minus,
    keywords: ["divider", "rule", "separator", "line", "hr"],
    kind: "action",
    action: "hr",
  },
  {
    id: "image",
    label: "Image",
    icon: ImageIcon,
    keywords: ["image", "img", "picture", "photo", "media", "upload"],
    kind: "image",
  },
];

export function filterSlashCommands(query: string): SlashCommand[] {
  const q = query.trim().toLowerCase();
  if (!q) return SLASH_COMMANDS;
  return SLASH_COMMANDS.filter(
    (cmd) =>
      cmd.label.toLowerCase().includes(q) ||
      cmd.keywords.some((kw) => kw.includes(q)),
  );
}
