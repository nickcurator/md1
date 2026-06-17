// Pure helpers for inline image sizing. The width is stored in the image's
// Markdown title as `w=<px>` — e.g. `![alt](url "w=400")` — which stays valid
// CommonMark (no raw HTML) and is honoured by the editor, the preview and the
// public page alike.

const IMAGE_RE = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g;

export type ImageMatch = {
  from: number;
  to: number;
  alt: string;
  url: string;
  title: string | null;
  width: number | null;
};

export function parseImageWidth(title: string | null | undefined): number | null {
  if (!title) return null;
  const m = /^\s*w=(\d+)\s*$/.exec(title);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Rebuild image markdown with (or without) a width title.
export function imageMarkdownWithWidth(
  alt: string,
  url: string,
  width: number | null,
): string {
  return width ? `![${alt}](${url} "w=${width}")` : `![${alt}](${url})`;
}

// Find every image link in the text with its source offsets and parsed width.
export function findImages(text: string): ImageMatch[] {
  const out: ImageMatch[] = [];
  IMAGE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = IMAGE_RE.exec(text)) !== null) {
    const title = m[3] ?? null;
    out.push({
      from: m.index,
      to: m.index + m[0].length,
      alt: m[1] ?? "",
      url: m[2] ?? "",
      title,
      width: parseImageWidth(title),
    });
  }
  return out;
}
