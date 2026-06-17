import { Extension } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { DocComment } from "@/lib/shared-docs";

// Comments are anchored by their quoted TEXT (offsets are meaningless in a
// ProseMirror doc). We flatten the doc into characters with their PM positions,
// find the quote, and map back to a PM range — mirroring the markdown
// quote-anchoring, but over the rich document.
export function findQuoteRange(
  doc: PMNode,
  quote: string,
): { from: number; to: number } | null {
  if (!quote) return null;
  const positions: number[] = [];
  let text = "";
  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      for (let i = 0; i < node.text.length; i += 1) {
        text += node.text[i];
        positions.push(pos + i);
      }
    }
    return true;
  });
  const idx = text.indexOf(quote);
  if (idx === -1) return null;
  const from = positions[idx];
  const last = positions[idx + quote.length - 1];
  if (from == null || last == null) return null;
  return { from, to: last + 1 };
}

type CommentsState = {
  comments: DocComment[];
  activeId: string | null;
  deco: DecorationSet;
};

export const commentsPluginKey = new PluginKey<CommentsState>("driveComments");

function buildDeco(
  doc: PMNode,
  comments: DocComment[],
  activeId: string | null,
): DecorationSet {
  const decos: Decoration[] = [];
  for (const c of comments) {
    const range = findQuoteRange(doc, c.quote);
    if (!range) continue;
    decos.push(
      Decoration.inline(range.from, range.to, {
        class:
          c.id === activeId
            ? "comment-hl comment-hl-active"
            : "comment-hl",
        "data-comment-anchor": c.id,
      }),
    );
  }
  return DecorationSet.create(doc, decos);
}

// Re-locate every comment in the current doc (used for margin positioning).
export function commentRanges(
  doc: PMNode,
  comments: DocComment[],
): Record<string, { from: number; to: number }> {
  const out: Record<string, { from: number; to: number }> = {};
  for (const c of comments) {
    const r = findQuoteRange(doc, c.quote);
    if (r) out[c.id] = r;
  }
  return out;
}

export const CommentsExtension = Extension.create({
  name: "driveComments",
  addProseMirrorPlugins() {
    return [
      new Plugin<CommentsState>({
        key: commentsPluginKey,
        state: {
          init: () => ({
            comments: [],
            activeId: null,
            deco: DecorationSet.empty,
          }),
          apply(tr, value, _oldState, newState) {
            const meta = tr.getMeta(commentsPluginKey) as
              | { comments: DocComment[]; activeId: string | null }
              | undefined;
            const comments = meta ? meta.comments : value.comments;
            const activeId = meta ? meta.activeId : value.activeId;
            if (meta || tr.docChanged) {
              return {
                comments,
                activeId,
                deco: buildDeco(newState.doc, comments, activeId),
              };
            }
            return value;
          },
        },
        props: {
          decorations(state) {
            return commentsPluginKey.getState(state)?.deco;
          },
        },
      }),
    ];
  },
});
