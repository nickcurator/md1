export type MarkdownActionId =
  | "bold"
  | "italic"
  | "strikethrough"
  | "code"
  | "link"
  | "h1"
  | "h2"
  | "h3"
  | "ul"
  | "ol"
  | "task"
  | "quote"
  | "codeBlock"
  | "hr";

type EditResult = {
  value: string;
  selectionStart: number;
  selectionEnd: number;
};

function lineBounds(text: string, pos: number): { start: number; end: number } {
  const start = text.lastIndexOf("\n", Math.max(0, pos - 1)) + 1;
  let end = text.indexOf("\n", pos);
  if (end === -1) end = text.length;
  return { start, end };
}

function selectedLineBounds(
  text: string,
  selStart: number,
  selEnd: number,
): { start: number; end: number } {
  const first = lineBounds(text, selStart);
  const last = lineBounds(text, selEnd > 0 ? selEnd - 1 : selStart);
  return { start: first.start, end: last.end };
}

function wrap(
  value: string,
  start: number,
  end: number,
  before: string,
  after: string,
  placeholder = "text",
): EditResult {
  const selected = value.slice(start, end);
  if (start === end) {
    const insert = before + placeholder + after;
    const next = value.slice(0, start) + insert + value.slice(end);
    const selStart = start + before.length;
    return {
      value: next,
      selectionStart: selStart,
      selectionEnd: selStart + placeholder.length,
    };
  }

  if (selected.startsWith(before) && selected.endsWith(after)) {
    const inner = selected.slice(before.length, selected.length - after.length);
    const next = value.slice(0, start) + inner + value.slice(end);
    return {
      value: next,
      selectionStart: start,
      selectionEnd: start + inner.length,
    };
  }

  const wrapped = before + selected + after;
  const next = value.slice(0, start) + wrapped + value.slice(end);
  return {
    value: next,
    selectionStart: start,
    selectionEnd: start + wrapped.length,
  };
}

function linePrefix(
  value: string,
  selStart: number,
  selEnd: number,
  prefix: string,
  ordered = false,
): EditResult {
  const { start, end } = selectedLineBounds(value, selStart, selEnd);
  const block = value.slice(start, end);
  const lines = block.split("\n");
  const nonEmpty = lines.filter((line) => line.trim().length > 0);

  const allPrefixed = nonEmpty.every((line) => {
    if (ordered) return /^\d+\.\s/.test(line);
    return line.startsWith(prefix);
  });

  let orderedIndex = 1;
  const nextLines = lines.map((line) => {
    if (!line.trim()) return line;
    if (ordered) {
      if (allPrefixed) return line.replace(/^\d+\.\s/, "");
      const next = `${orderedIndex}. ${line.replace(/^\d+\.\s/, "")}`;
      orderedIndex += 1;
      return next;
    }
    if (allPrefixed && line.startsWith(prefix)) {
      return line.slice(prefix.length);
    }
    return prefix + line;
  });

  const nextBlock = nextLines.join("\n");
  const next = value.slice(0, start) + nextBlock + value.slice(end);
  const delta = nextBlock.length - block.length;
  return {
    value: next,
    selectionStart: selStart,
    selectionEnd: selEnd + delta,
  };
}

// Matches an existing GFM task-list item, capturing the leading indent.
const TASK_LINE_RE = /^(\s*)[-*+] \[[ xX]\] /;
// Strips whatever list marker a line already has (bullet, number or task) so we
// can re-prefix it cleanly.
const LIST_MARKER_RE = /^([-*+] \[[ xX]\] |[-*+] |\d+\. )/;

function taskList(
  value: string,
  selStart: number,
  selEnd: number,
): EditResult {
  const { start, end } = selectedLineBounds(value, selStart, selEnd);
  const block = value.slice(start, end);
  const lines = block.split("\n");
  const nonEmpty = lines.filter((line) => line.trim().length > 0);

  // Collapsed cursor on a blank line — just drop in a fresh unchecked item.
  if (nonEmpty.length === 0) {
    const marker = "- [ ] ";
    const next = value.slice(0, start) + marker + value.slice(start);
    const pos = start + marker.length;
    return { value: next, selectionStart: pos, selectionEnd: pos };
  }

  const allTasks = nonEmpty.every((line) => TASK_LINE_RE.test(line));
  const nextLines = lines.map((line) => {
    if (!line.trim()) return line;
    const indent = /^\s*/.exec(line)?.[0] ?? "";
    const body = line.slice(indent.length).replace(LIST_MARKER_RE, "");
    return allTasks ? indent + body : `${indent}- [ ] ${body}`;
  });

  const nextBlock = nextLines.join("\n");
  const next = value.slice(0, start) + nextBlock + value.slice(end);
  const delta = nextBlock.length - block.length;
  return {
    value: next,
    selectionStart: selStart,
    selectionEnd: selEnd + delta,
  };
}

/**
 * Flip the Nth GFM checkbox in document order between `[ ]` and `[x]`. The index
 * matches the render order of task checkboxes (react-markdown walks the tree in
 * source order), so the preview can toggle a box without tracking offsets.
 */
export function toggleTaskByIndex(content: string, index: number): string {
  const re = /^([ \t]*[-*+] +)\[([ xX])\]/gm;
  let i = 0;
  return content.replace(re, (match, prefix: string, mark: string) => {
    if (i++ !== index) return match;
    return `${prefix}[${mark === " " ? "x" : " "}]`;
  });
}

function heading(
  value: string,
  selStart: number,
  selEnd: number,
  level: 1 | 2 | 3,
): EditResult {
  const { start, end } = lineBounds(value, selStart);
  const line = value.slice(start, end);
  const stripped = line.replace(/^#{1,6}\s+/, "");
  const prefix = "#".repeat(level) + " ";
  const hasSame = line.startsWith(prefix);
  const nextLine = hasSame ? stripped : prefix + stripped;
  const next = value.slice(0, start) + nextLine + value.slice(end);
  const delta = nextLine.length - line.length;
  return {
    value: next,
    selectionStart: selStart,
    selectionEnd: selEnd + delta,
  };
}

function link(value: string, start: number, end: number): EditResult {
  const selected = value.slice(start, end);
  const label = selected || "text";
  const insert = `[${label}](url)`;
  const next = value.slice(0, start) + insert + value.slice(end);
  const urlStart = start + label.length + 3;
  return {
    value: next,
    selectionStart: urlStart,
    selectionEnd: urlStart + 3,
  };
}

function codeBlock(value: string, start: number, end: number): EditResult {
  const selected = value.slice(start, end);
  const inner = selected || "\n";
  const block = `\`\`\`\n${inner.replace(/^\n+|\n+$/g, "")}\n\`\`\``;
  const next = value.slice(0, start) + block + value.slice(end);
  return {
    value: next,
    selectionStart: start + 4,
    selectionEnd: start + 4 + inner.replace(/^\n+|\n+$/g, "").length,
  };
}

function horizontalRule(value: string, start: number, end: number): EditResult {
  const { start: lineStart } = lineBounds(value, start);
  const insert = start === end && lineStart === start ? "---\n" : "\n\n---\n\n";
  const next = value.slice(0, start) + insert + value.slice(end);
  const pos = start + insert.length;
  return {
    value: next,
    selectionStart: pos,
    selectionEnd: pos,
  };
}

export function applyMarkdownEdit(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  action: MarkdownActionId,
): EditResult {
  const start = selectionStart;
  const end = selectionEnd;

  switch (action) {
    case "bold":
      return wrap(value, start, end, "**", "**", "bold");
    case "italic":
      return wrap(value, start, end, "*", "*", "italic");
    case "strikethrough":
      return wrap(value, start, end, "~~", "~~", "text");
    case "code":
      return wrap(value, start, end, "`", "`", "code");
    case "link":
      return link(value, start, end);
    case "h1":
      return heading(value, start, end, 1);
    case "h2":
      return heading(value, start, end, 2);
    case "h3":
      return heading(value, start, end, 3);
    case "ul":
      return linePrefix(value, start, end, "- ");
    case "ol":
      return linePrefix(value, start, end, "", true);
    case "task":
      return taskList(value, start, end);
    case "quote":
      return linePrefix(value, start, end, "> ");
    case "codeBlock":
      return codeBlock(value, start, end);
    case "hr":
      return horizontalRule(value, start, end);
    default:
      return { value, selectionStart: start, selectionEnd: end };
  }
}

/** Undo, redo, clipboard, select-all — leave to the browser / native textarea. */
export function isNativeEditorShortcut(event: {
  metaKey: boolean;
  ctrlKey: boolean;
  code: string;
}): boolean {
  if (!(event.metaKey || event.ctrlKey)) return false;
  switch (event.code) {
    case "KeyZ":
    case "KeyY":
    case "KeyC":
    case "KeyV":
    case "KeyX":
    case "KeyA":
      return true;
    default:
      return false;
  }
}

function shortcutKey(event: { key: string; code: string }): string {
  switch (event.code) {
    case "KeyB":
      return "b";
    case "KeyI":
      return "i";
    case "KeyE":
      return "e";
    case "KeyK":
      return "k";
    case "KeyX":
      return "x";
    case "Digit0":
      return "0";
    case "Digit1":
      return "1";
    case "Digit2":
      return "2";
    case "Digit3":
      return "3";
    case "Digit7":
      return "7";
    case "Digit8":
      return "8";
    case "Digit9":
      return "9";
    case "Minus":
    case "NumpadSubtract":
      return "-";
    default:
      return event.key.length === 1 ? event.key.toLowerCase() : "";
  }
}

export function markdownShortcutAction(event: {
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  key: string;
  code: string;
}): MarkdownActionId | null {
  if (!(event.metaKey || event.ctrlKey)) return null;

  const key = shortcutKey(event);
  if (!key) return null;

  if (event.altKey && !event.shiftKey) {
    if (key === "1") return "h1";
    if (key === "2") return "h2";
    if (key === "3") return "h3";
    return null;
  }

  if (event.altKey) return null;

  if (event.shiftKey) {
    if (key === "x") return "strikethrough";
    if (key === "0") return "task";
    if (key === "7") return "ol";
    if (key === "8") return "ul";
    if (key === "9") return "quote";
    if (key === "k") return "codeBlock";
    if (key === "-") return "hr";
    return null;
  }

  if (key === "b") return "bold";
  if (key === "i") return "italic";
  if (key === "e") return "code";
  if (key === "k") return "link";
  return null;
}

export function markdownShortcutHint(
  kind: "mod" | "modShift" | "modAlt",
  key: string,
): string {
  const isMac =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
  const mod = isMac ? "⌘" : "Ctrl+";
  const alt = isMac ? "⌥" : "Alt+";
  if (kind === "modShift") return `${mod}⇧${key}`;
  if (kind === "modAlt") return `${mod}${alt}${key}`;
  return `${mod}${key}`;
}
