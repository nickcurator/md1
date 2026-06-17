import type { Editor } from "@tiptap/core";
import type { MarkdownActionId } from "../drive-markdown-edit";

// Map a toolbar/slash action to the equivalent TipTap command. Keeps the
// existing action ids (and the toolbar/slash UI) while the WYSIWYG surface
// executes rich-text commands instead of markdown string edits.
export function runTipTapAction(editor: Editor, action: MarkdownActionId): void {
  const chain = editor.chain().focus();
  switch (action) {
    case "bold":
      chain.toggleBold().run();
      break;
    case "italic":
      chain.toggleItalic().run();
      break;
    case "strikethrough":
      chain.toggleStrike().run();
      break;
    case "code":
      chain.toggleCode().run();
      break;
    case "link": {
      const url =
        typeof window !== "undefined" ? window.prompt("Link URL") : null;
      if (url) chain.extendMarkRange("link").setLink({ href: url }).run();
      else chain.run();
      break;
    }
    case "h1":
      chain.toggleHeading({ level: 1 }).run();
      break;
    case "h2":
      chain.toggleHeading({ level: 2 }).run();
      break;
    case "h3":
      chain.toggleHeading({ level: 3 }).run();
      break;
    case "ul":
      chain.toggleBulletList().run();
      break;
    case "ol":
      chain.toggleOrderedList().run();
      break;
    case "task":
      chain.toggleTaskList().run();
      break;
    case "quote":
      chain.toggleBlockquote().run();
      break;
    case "codeBlock":
      chain.toggleCodeBlock().run();
      break;
    case "hr":
      chain.setHorizontalRule().run();
      break;
    case "table":
      // Table extension is wired in Stage 2.
      chain.run();
      break;
    default:
      chain.run();
  }
}
