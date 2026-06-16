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
  Table,
  type LucideIcon,
} from "lucide-react";
import type { MarkdownActionId } from "./drive-markdown-edit";

// A "/" command. `kind: "action"` reuses an existing markdown edit; `kind:
// "image"` triggers the upload picker — so the slash menu is just a faster
// surface over the existing editor plumbing, no new editing logic.
// `group` drives the section headers; `badge` shows the markdown shorthand
// (Notion-style) on the right.
export type SlashCommand = {
  id: string;
  label: string;
  icon: LucideIcon;
  keywords: string[];
  group: string;
  badge?: string;
} & ({ kind: "action"; action: MarkdownActionId } | { kind: "image" });

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: "h1",
    label: "Heading 1",
    icon: Heading1,
    keywords: ["h1", "heading", "title"],
    group: "Headings",
    badge: "#",
    kind: "action",
    action: "h1",
  },
  {
    id: "h2",
    label: "Heading 2",
    icon: Heading2,
    keywords: ["h2", "heading", "subtitle"],
    group: "Headings",
    badge: "##",
    kind: "action",
    action: "h2",
  },
  {
    id: "h3",
    label: "Heading 3",
    icon: Heading3,
    keywords: ["h3", "heading"],
    group: "Headings",
    badge: "###",
    kind: "action",
    action: "h3",
  },
  {
    id: "task",
    label: "Checklist",
    icon: ListChecks,
    keywords: ["todo", "task", "checklist", "check", "checkbox"],
    group: "Basic blocks",
    badge: "[ ]",
    kind: "action",
    action: "task",
  },
  {
    id: "ul",
    label: "Bulleted list",
    icon: List,
    keywords: ["bullet", "list", "unordered"],
    group: "Basic blocks",
    badge: "-",
    kind: "action",
    action: "ul",
  },
  {
    id: "ol",
    label: "Numbered list",
    icon: ListOrdered,
    keywords: ["number", "numbered", "ordered", "list"],
    group: "Basic blocks",
    badge: "1.",
    kind: "action",
    action: "ol",
  },
  {
    id: "quote",
    label: "Quote",
    icon: Quote,
    keywords: ["quote", "blockquote", "citation"],
    group: "Basic blocks",
    badge: ">",
    kind: "action",
    action: "quote",
  },
  {
    id: "code",
    label: "Code block",
    icon: Code2,
    keywords: ["code", "snippet", "block"],
    group: "Basic blocks",
    badge: "```",
    kind: "action",
    action: "codeBlock",
  },
  {
    id: "table",
    label: "Table",
    icon: Table,
    keywords: ["table", "grid", "rows", "columns"],
    group: "Basic blocks",
    kind: "action",
    action: "table",
  },
  {
    id: "hr",
    label: "Divider",
    icon: Minus,
    keywords: ["divider", "rule", "separator", "line", "hr"],
    group: "Basic blocks",
    badge: "---",
    kind: "action",
    action: "hr",
  },
  {
    id: "image",
    label: "Image",
    icon: ImageIcon,
    keywords: ["image", "img", "picture", "photo", "media", "upload"],
    group: "Media",
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

// A "/" command is active when the caret sits right after a `/token` that began
// at line start or after whitespace, with no spaces in the token yet. Returns
// the position of the `/` and the query typed so far, or null. Pure string
// logic, shared by both editor surfaces (textarea and CodeMirror).
export function detectSlash(
  value: string,
  caret: number | null,
): { start: number; query: string } | null {
  if (caret == null) return null;
  const lineStart = value.lastIndexOf("\n", caret - 1) + 1;
  const before = value.slice(lineStart, caret);
  const match = /(^|\s)\/(\S*)$/.exec(before);
  if (!match) return null;
  const query = match[2];
  return { start: caret - query.length - 1, query };
}
