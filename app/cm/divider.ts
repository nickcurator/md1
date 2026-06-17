import { type Range } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";

// Renders a thematic-break line (`---`, `***`, `___`) as a real divider inline,
// the way the preview shows it. Moving the caret onto the line (click or arrow)
// reveals the raw markdown again so it can be edited or removed.
const HR_RE = /^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/;
const DASH_RE = /^\s{0,3}-{3,}\s*$/;

class HrWidget extends WidgetType {
  eq() {
    return true;
  }
  toDOM(): HTMLElement {
    const el = document.createElement("div");
    el.className = "cm-hr-widget";
    el.setAttribute("aria-hidden", "true");
    return el;
  }
  ignoreEvent() {
    return false;
  }
}

function buildDividerDeco(view: EditorView): DecorationSet {
  const { doc, selection } = view.state;
  const sel = selection.main;
  const ranges: Range<Decoration>[] = [];
  for (let i = 1; i <= doc.lines; i += 1) {
    const line = doc.line(i);
    if (!HR_RE.test(line.text)) continue;
    // A `---` directly under a non-empty line is a setext heading underline,
    // not a divider — leave those raw.
    if (DASH_RE.test(line.text)) {
      const prev = i > 1 ? doc.line(i - 1).text.trim() : "";
      if (prev !== "") continue;
    }
    // Reveal-on-edit: show raw markdown while the caret is on the line.
    if (sel.from <= line.to && sel.to >= line.from) continue;
    ranges.push(
      Decoration.replace({ widget: new HrWidget() }).range(line.from, line.to),
    );
  }
  return Decoration.set(ranges, true);
}

export const dividerPreview = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildDividerDeco(view);
    }
    update(u: ViewUpdate) {
      if (u.docChanged || u.selectionSet) {
        this.decorations = buildDividerDeco(u.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);
