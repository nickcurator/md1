"use client";

import { Fragment, useEffect, useRef } from "react";
import type {
  DefaultReactSuggestionItem,
  SuggestionMenuProps,
} from "@blocknote/react";

// Notion-style "/" command menu for the block editor: compact rows (icon +
// title + optional shortcut badge), grouped section headers and a soft
// selection highlight, themed with the app's CSS variables. Replaces
// BlockNote's bulky default menu (big descriptions + heavy blue selection).
export default function DriveBlockSlashMenu({
  items,
  selectedIndex,
  onItemClick,
}: SuggestionMenuProps<DefaultReactSuggestionItem>) {
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  let lastGroup: string | undefined;

  return (
    <div className="max-h-[330px] w-[300px] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--bg)] p-1.5 text-sm shadow-xl">
      {items.length === 0 && (
        <div className="px-2 py-2 text-[var(--muted)]">No results</div>
      )}
      {items.map((item, index) => {
        const header =
          item.group && item.group !== lastGroup ? item.group : null;
        lastGroup = item.group;
        const selected = index === selectedIndex;
        return (
          <Fragment key={`${item.title}-${index}`}>
            {header && (
              <div className="px-2 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
                {header}
              </div>
            )}
            <button
              type="button"
              ref={selected ? selectedRef : undefined}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onItemClick?.(item)}
              className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-[var(--card)] ${
                selected ? "bg-[var(--card)]" : ""
              }`}
            >
              {item.icon && (
                <span className="flex h-5 w-5 shrink-0 items-center justify-center text-[var(--muted)]">
                  {item.icon}
                </span>
              )}
              <span className="flex-1 truncate text-[var(--fg)]">
                {item.title}
              </span>
              {item.badge && (
                <span className="ml-2 shrink-0 rounded border border-[var(--border)] px-1.5 py-0.5 text-[11px] text-[var(--muted)]">
                  {item.badge}
                </span>
              )}
            </button>
          </Fragment>
        );
      })}
    </div>
  );
}
