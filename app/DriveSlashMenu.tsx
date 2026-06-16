"use client";

import { Fragment, useEffect, useRef } from "react";
import type { SlashCommand } from "./drive-slash-commands";

// Notion-style "/" command menu for the markdown editor, positioned at the
// caret by the parent. Compact rows (icon + label + shorthand badge), grouped
// section headers and a soft selection highlight, themed with the app's CSS
// variables. Mouse selection uses onMouseDown + preventDefault so the textarea
// keeps focus and its caret survive the click.
export default function DriveSlashMenu({
  commands,
  activeIndex,
  position,
  onSelect,
  onHover,
}: {
  commands: SlashCommand[];
  activeIndex: number;
  position: { top: number; left: number };
  onSelect: (cmd: SlashCommand) => void;
  onHover: (index: number) => void;
}) {
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (commands.length === 0) return null;

  let lastGroup: string | undefined;

  return (
    <div
      role="listbox"
      className="absolute z-30 max-h-80 w-72 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--bg)] p-1.5 text-sm shadow-xl"
      style={{ top: position.top, left: position.left }}
    >
      {commands.map((cmd, index) => {
        const Icon = cmd.icon;
        const active = index === activeIndex;
        const header = cmd.group !== lastGroup ? cmd.group : null;
        lastGroup = cmd.group;
        return (
          <Fragment key={cmd.id}>
            {header && (
              <div className="px-2 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
                {header}
              </div>
            )}
            <button
              type="button"
              role="option"
              aria-selected={active}
              ref={active ? selectedRef : undefined}
              onMouseDown={(event) => {
                event.preventDefault();
                onSelect(cmd);
              }}
              onMouseEnter={() => onHover(index)}
              className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors ${
                active ? "bg-[var(--card)]" : ""
              }`}
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center text-[var(--muted)]">
                <Icon size={16} />
              </span>
              <span className="flex-1 truncate text-[var(--fg)]">{cmd.label}</span>
              {cmd.badge && (
                <span className="ml-2 shrink-0 rounded border border-[var(--border)] px-1.5 py-0.5 text-[11px] text-[var(--muted)]">
                  {cmd.badge}
                </span>
              )}
            </button>
          </Fragment>
        );
      })}
    </div>
  );
}
