"use client";

import type { SlashCommand } from "./drive-slash-commands";

// Popup list of "/" commands, positioned at the caret by the parent. Mouse
// selection uses onMouseDown + preventDefault so the textarea keeps focus and
// its caret/selection survive the click.
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
  if (commands.length === 0) return null;
  return (
    <div
      role="listbox"
      className="absolute z-30 max-h-72 w-60 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--bg)] p-1 shadow-lg"
      style={{ top: position.top, left: position.left }}
    >
      {commands.map((cmd, index) => {
        const Icon = cmd.icon;
        const active = index === activeIndex;
        return (
          <button
            key={cmd.id}
            type="button"
            role="option"
            aria-selected={active}
            onMouseDown={(event) => {
              event.preventDefault();
              onSelect(cmd);
            }}
            onMouseEnter={() => onHover(index)}
            className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors ${
              active ? "bg-[var(--card)]" : ""
            }`}
          >
            <Icon size={16} className="shrink-0 text-[var(--muted)]" />
            <span className="flex-1 text-[var(--fg)]">{cmd.label}</span>
          </button>
        );
      })}
    </div>
  );
}
