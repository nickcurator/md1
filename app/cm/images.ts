import { type Range } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { findImages, imageMarkdownWithWidth } from "../drive-image-size";

// Renders an image link inline in place of its `![alt](url)` markdown, with a
// drag handle that rewrites the width into the markdown title on release.
class ImageWidget extends WidgetType {
  constructor(
    readonly url: string,
    readonly alt: string,
    readonly width: number | null,
    readonly from: number,
    readonly to: number,
  ) {
    super();
  }

  eq(other: ImageWidget) {
    return (
      other.url === this.url &&
      other.alt === this.alt &&
      other.width === this.width &&
      other.from === this.from &&
      other.to === this.to
    );
  }

  toDOM(view: EditorView): HTMLElement {
    const wrap = document.createElement("span");
    wrap.className = "cm-image-widget";

    const img = document.createElement("img");
    img.src = this.url;
    img.alt = this.alt;
    img.loading = "lazy";
    img.className = "cm-image-widget-img";
    if (this.width) img.style.width = `${this.width}px`;
    wrap.appendChild(img);

    const handle = document.createElement("span");
    handle.className = "cm-image-resize-handle";
    handle.setAttribute("aria-hidden", "true");
    wrap.appendChild(handle);

    let dragging = false;
    let startX = 0;
    let startW = 0;
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const w = Math.max(40, Math.round(startW + (e.clientX - startX)));
      img.style.width = `${w}px`;
    };
    const onUp = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const w = Math.max(40, Math.round(startW + (e.clientX - startX)));
      view.dispatch({
        changes: {
          from: this.from,
          to: this.to,
          insert: imageMarkdownWithWidth(this.alt, this.url, w),
        },
      });
    };
    handle.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragging = true;
      startX = e.clientX;
      startW = img.getBoundingClientRect().width;
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    });

    // Click the image → put the caret right after it; the reveal-on-edit rule
    // then shows the raw markdown so the URL/alt can be edited.
    wrap.addEventListener("mousedown", (e) => {
      if (e.target === handle) return;
      e.preventDefault();
      view.dispatch({ selection: { anchor: this.to } });
      view.focus();
    });

    return wrap;
  }

  ignoreEvent() {
    return true;
  }
}

function buildImageDeco(view: EditorView): DecorationSet {
  const text = view.state.doc.toString();
  const sel = view.state.selection.main;
  const ranges: Range<Decoration>[] = [];
  for (const img of findImages(text)) {
    if (img.url.startsWith("uploading:")) continue; // upload placeholder
    // Reveal-on-edit: if the selection touches the match, show raw markdown.
    if (sel.from <= img.to && sel.to >= img.from) continue;
    ranges.push(
      Decoration.replace({
        widget: new ImageWidget(img.url, img.alt, img.width, img.from, img.to),
      }).range(img.from, img.to),
    );
  }
  return Decoration.set(ranges, true);
}

export const imagePreview = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildImageDeco(view);
    }
    update(u: ViewUpdate) {
      if (u.docChanged || u.selectionSet) {
        this.decorations = buildImageDeco(u.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
    // Skip the cursor over rendered images (they reveal raw markdown on click).
    provide: (plugin) =>
      EditorView.atomicRanges.of(
        (view) => view.plugin(plugin)?.decorations ?? Decoration.none,
      ),
  },
);
