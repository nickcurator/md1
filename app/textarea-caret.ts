// Pixel coordinates of a caret position inside a <textarea>, used to anchor the
// slash command menu. Works by mirroring the textarea's text and computed
// styles into an off-screen div and measuring a marker span — the well-known
// "textarea-caret-position" technique. Returns coordinates relative to the
// textarea's border-box origin (which, for our zero-padding/zero-border
// editor textarea, is also the wrapper origin).

const MIRRORED_PROPS = [
  "direction",
  "boxSizing",
  "width",
  "height",
  "overflowX",
  "overflowY",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "fontStyle",
  "fontVariant",
  "fontWeight",
  "fontStretch",
  "fontSize",
  "lineHeight",
  "fontFamily",
  "textAlign",
  "textTransform",
  "textIndent",
  "letterSpacing",
  "wordSpacing",
  "tabSize",
] as const;

export type CaretCoords = { top: number; left: number; height: number };

export function getCaretCoords(
  element: HTMLTextAreaElement,
  position: number,
): CaretCoords {
  const div = document.createElement("div");
  const style = div.style as unknown as Record<string, string>;
  const computed = window.getComputedStyle(element);

  style.position = "absolute";
  style.visibility = "hidden";
  style.whiteSpace = "pre-wrap";
  style.wordWrap = "break-word";
  style.overflow = "hidden";
  for (const prop of MIRRORED_PROPS) {
    const value = (computed as unknown as Record<string, string>)[prop];
    if (value != null) style[prop] = value;
  }

  div.textContent = element.value.slice(0, position);
  const span = document.createElement("span");
  // Non-empty content so the span has measurable layout at line end.
  span.textContent = element.value.slice(position) || ".";
  div.appendChild(span);

  document.body.appendChild(div);
  const coords: CaretCoords = {
    top: span.offsetTop + parseInt(computed.borderTopWidth, 10),
    left: span.offsetLeft + parseInt(computed.borderLeftWidth, 10),
    height:
      parseInt(computed.lineHeight, 10) || parseInt(computed.fontSize, 10) || 16,
  };
  document.body.removeChild(div);
  return coords;
}
