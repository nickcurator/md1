const NAMED_HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  hellip: "...",
  laquo: "\"",
  ldquo: "\"",
  lrm: "",
  lsquo: "'",
  lt: "<",
  mdash: "-",
  ndash: "-",
  nbsp: " ",
  quot: "\"",
  raquo: "\"",
  rdquo: "\"",
  rlm: "",
  rsquo: "'",
  zwj: "",
  zwnj: "",
};

function safeCodePoint(codePoint: number, fallback: string): string {
  if (
    !Number.isInteger(codePoint) ||
    codePoint < 0 ||
    codePoint > 0x10ffff
  ) {
    return fallback;
  }
  return String.fromCodePoint(codePoint);
}

export function decodeHtmlEntities(input: string): string {
  return input.replace(
    /&(#\d+|#x[\da-f]+|[a-z][a-z0-9]+);/gi,
    (match, entity) => {
      const normalized = String(entity).toLowerCase();
      if (normalized.startsWith("#x")) {
        const codePoint = Number.parseInt(normalized.slice(2), 16);
        return safeCodePoint(codePoint, match);
      }
      if (normalized.startsWith("#")) {
        const codePoint = Number.parseInt(normalized.slice(1), 10);
        return safeCodePoint(codePoint, match);
      }
      return NAMED_HTML_ENTITIES[normalized] ?? match;
    },
  );
}

export function cleanMailText(input: string): string {
  return decodeHtmlEntities(input)
    .replace(/&(?:zwnj|zwj|lrm|rlm);/gi, "")
    .replace(/[\u200B-\u200F\uFEFF]/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
