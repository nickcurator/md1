"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Info } from "lucide-react";

// The little "i" affordance next to a metric title that reveals the metric's
// description + caveat note on hover/tap. Styled to match the product's own
// popovers (GroundedBadge, the profile menu): a floating bg-panel with border
// + shadow, Escape / click-outside to dismiss, and a short close delay so you
// can move the cursor onto the popover without it vanishing.
//
// This is the one client island on the otherwise server-rendered dashboard —
// worth it for a tooltip that actually feels good instead of a raw CSS hover.
export function InfoTip({
  title,
  description,
  note,
}: {
  title: string;
  description?: string;
  note?: string;
}) {
  const [open, setOpen] = useState(false);
  const [shift, setShift] = useState(0);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const show = () => {
    cancelClose();
    setOpen(true);
  };
  // Small grace period so crossing the gap between the icon and the popover
  // doesn't close it.
  const hideSoon = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };

  // Nudge the popover left if it would run off the right edge of the viewport
  // (cards near the right column / long titles push the anchor over).
  useLayoutEffect(() => {
    if (!open || !wrapRef.current) return;
    const left = wrapRef.current.getBoundingClientRect().left;
    const width = Math.min(288, window.innerWidth - 16); // w-72, clamped
    const overflow = left + width - (window.innerWidth - 8);
    setShift(overflow > 0 ? -overflow : 0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  useEffect(() => () => cancelClose(), []);

  return (
    <span
      ref={wrapRef}
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hideSoon}
    >
      <button
        type="button"
        aria-label={`About ${title}`}
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : show())}
        onFocus={show}
        onBlur={hideSoon}
        className="inline-flex cursor-help text-[var(--muted)] opacity-70 transition-all hover:text-[var(--fg)] hover:opacity-100 focus:text-[var(--fg)] focus:opacity-100 focus:outline-none"
      >
        <Info size={14} strokeWidth={2} aria-hidden="true" />
      </button>

      <div
        role="tooltip"
        style={{ transform: `translate(${shift}px, ${open ? "0" : "-4px"})` }}
        className={`absolute left-0 top-full z-30 mt-2 w-72 max-w-[calc(100vw-1rem)] rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3 text-left shadow-xl transition-[opacity,transform] duration-150 ease-out ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div className="text-[12px] font-semibold text-[var(--fg)]">
          {title}
        </div>
        {description && (
          <div className="mt-1 text-[11px] leading-snug text-[var(--muted)]">
            {description}
          </div>
        )}
        {note && (
          <div className="mt-2 border-t border-[var(--border)] pt-2 text-[11px] leading-snug text-[var(--muted)]">
            {note}
          </div>
        )}
      </div>
    </span>
  );
}
