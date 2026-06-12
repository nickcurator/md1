// Small formatting helpers shared by the CLI (ASCII tables) and the
// dashboard (number formatting). No dependencies — plain string work.

import type { MetricResult } from "./types";

// Thousands-separated integer; one-decimal for non-integers. Keeps big
// counts readable ("12,480") without dragging in Intl-heavy formatting.
export function formatNumber(value: string | number | null): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  if (!Number.isFinite(value)) return "—";
  const rounded = Math.round(value * 10) / 10;
  const isInt = Number.isInteger(rounded);
  return rounded.toLocaleString("en-US", {
    minimumFractionDigits: isInt ? 0 : 1,
    maximumFractionDigits: 1,
  });
}

function cellText(value: string | number | null): string {
  return formatNumber(value);
}

// Render a MetricResult as a monospaced ASCII table for terminal output.
export function renderAsciiTable(result: MetricResult): string {
  const { columns, rows } = result;
  if (columns.length === 0) return "(no columns)";
  if (rows.length === 0) return "(no rows)";

  const widths = columns.map((col, c) => {
    const cells = rows.map((r) => cellText(r[c] ?? null));
    return Math.max(col.length, ...cells.map((s) => s.length));
  });

  // Right-align numeric columns (string cells left-aligned).
  const numeric = columns.map((_, c) =>
    rows.every((r) => r[c] === null || typeof r[c] === "number"),
  );

  const pad = (s: string, w: number, right: boolean) =>
    right ? s.padStart(w) : s.padEnd(w);

  const header = columns
    .map((col, c) => pad(col, widths[c], numeric[c]))
    .join("  ");
  const divider = widths.map((w) => "─".repeat(w)).join("  ");
  const body = rows
    .map((r) =>
      r
        .map((cell, c) => pad(cellText(cell ?? null), widths[c], numeric[c]))
        .join("  "),
    )
    .join("\n");

  return `${header}\n${divider}\n${body}`;
}
