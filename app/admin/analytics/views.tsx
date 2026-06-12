// Server-rendered, dependency-free metric views. Each takes a normalised
// MetricResult and renders it per the metric's `render` hint. No client JS,
// no charting library — just Tailwind + a few inline widths/heights, which
// keeps the dashboard a pure server component that loads instantly.

import { formatNumber } from "@/lib/admin-analytics/format";
import type { MetricResult, RenderHint } from "@/lib/admin-analytics/types";
import { InfoTip } from "./InfoTip";

// snake_case / lowerCamel column → "Title Case" label for headings.
function prettyLabel(s: string): string {
  return s
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bPct\b/i, "%");
}

function num(v: string | number | null): number {
  return typeof v === "number" ? v : Number(v) || 0;
}

// Fill for bars — monochrome, varying opacity so multiple series stay
// distinguishable without introducing colour.
function fgFill(opacityPct: number): string {
  return `color-mix(in srgb, var(--fg) ${opacityPct}%, transparent)`;
}

// ─── Card wrapper ───────────────────────────────────────────────────────────

export function MetricCard({
  title,
  description,
  note,
  source,
  windowLabel,
  children,
}: {
  title: string;
  description: string;
  note?: string;
  source: string;
  // Small pill telling the reader whether this card honours the time-window
  // toggle (e.g. "last 30d") or ignores it ("snapshot"). Makes the toggle's
  // effect legible at a glance.
  windowLabel?: string;
  children: React.ReactNode;
}) {
  const hasInfo = Boolean(description || note);
  return (
    <section className="flex flex-col rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 md:p-5">
      {/* Fixed header: title + info tooltip on the left, source/window on the
          right. Description and note moved into the tooltip so every card has
          the same structure (title row → body) and the bodies line up — no
          variable-length caption text pushing things around. */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <h3 className="truncate text-sm font-semibold text-[var(--fg)]">
            {title}
          </h3>
          {hasInfo && (
            <InfoTip title={title} description={description} note={note} />
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--muted)]">
            {source}
          </span>
          {windowLabel && (
            <span className="text-[10px] tabular-nums text-[var(--muted)]">
              {windowLabel}
            </span>
          )}
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--bg)] p-3 text-xs text-[var(--muted)]">
      <span className="font-medium text-[var(--fg)]">Couldn’t load: </span>
      {message}
    </div>
  );
}

function EmptyState() {
  return (
    <p className="text-xs text-[var(--muted)] italic py-2">
      No data in this window.
    </p>
  );
}

// ─── Scalars ────────────────────────────────────────────────────────────────

function Scalars({ result }: { result: MetricResult }) {
  const row = result.rows[0];
  if (!row) return <EmptyState />;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {result.columns.map((col, i) => (
        <div key={col} className="rounded-lg bg-[var(--bg)] border border-[var(--border)] px-3 py-2.5">
          <div className="text-[11px] text-[var(--muted)] leading-tight">
            {prettyLabel(col)}
          </div>
          <div className="mt-1 text-xl font-semibold tabular-nums text-[var(--fg)]">
            {formatNumber(row[i])}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Funnel ─────────────────────────────────────────────────────────────────

function Funnel({ result }: { result: MetricResult }) {
  const row = result.rows[0];
  if (!row) return <EmptyState />;
  const base = num(row[0]) || 0;
  return (
    <div className="space-y-2">
      {result.columns.map((col, i) => {
        const v = num(row[i]);
        const pct = base > 0 ? (v / base) * 100 : 0;
        const fromPrev =
          i > 0 && num(row[i - 1]) > 0 ? (v / num(row[i - 1])) * 100 : null;
        return (
          <div key={col}>
            <div className="flex items-baseline justify-between text-xs mb-1">
              <span className="text-[var(--fg)] font-medium">
                {prettyLabel(col)}
              </span>
              <span className="text-[var(--muted)] tabular-nums">
                {formatNumber(v)}
                {i > 0 && (
                  <span className="ml-1">· {pct.toFixed(0)}% of top</span>
                )}
                {fromPrev !== null && (
                  <span className="ml-1">({fromPrev.toFixed(0)}% step)</span>
                )}
              </span>
            </div>
            <div className="h-3 rounded-full bg-[var(--bg)] overflow-hidden border border-[var(--border)]">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(pct, 1.5)}%`,
                  backgroundColor: fgFill(70),
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Bar list ───────────────────────────────────────────────────────────────

function BarList({ result }: { result: MetricResult }) {
  if (result.rows.length === 0) return <EmptyState />;
  const valueIdx = 1; // columns[0] = label, columns[1] = primary value
  const max = Math.max(...result.rows.map((r) => num(r[valueIdx])), 1);
  const extraCols = result.columns.slice(2);
  return (
    <div className="space-y-2">
      {result.rows.map((r, ri) => {
        const v = num(r[valueIdx]);
        const pct = (v / max) * 100;
        return (
          <div key={ri}>
            <div className="flex items-baseline justify-between text-xs mb-1">
              <span className="text-[var(--fg)] font-medium truncate">
                {r[0] ?? "—"}
              </span>
              <span className="text-[var(--muted)] tabular-nums">
                {formatNumber(v)}
                {extraCols.map((col, ci) => (
                  <span key={col} className="ml-2">
                    {prettyLabel(col)}: {formatNumber(r[ci + 2])}
                  </span>
                ))}
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-[var(--bg)] overflow-hidden border border-[var(--border)]">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(pct, 1.5)}%`, backgroundColor: fgFill(60) }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Time series (sparkbars per numeric series) ─────────────────────────────

function TimeSeries({ result }: { result: MetricResult }) {
  if (result.rows.length === 0) return <EmptyState />;
  const days = result.rows.map((r) => String(r[0] ?? ""));
  const seriesCols = result.columns.slice(1);
  const opacities = [70, 45, 28, 18];
  return (
    <div className="space-y-4">
      {seriesCols.map((col, si) => {
        const vals = result.rows.map((r) => num(r[si + 1]));
        const max = Math.max(...vals, 1);
        const total = vals.reduce((a, b) => a + b, 0);
        const latest = vals[vals.length - 1] ?? 0;
        return (
          <div key={col}>
            <div className="flex items-baseline justify-between text-xs mb-1.5">
              <span className="text-[var(--fg)] font-medium">
                {prettyLabel(col)}
              </span>
              <span className="text-[var(--muted)] tabular-nums">
                latest {formatNumber(latest)} · total {formatNumber(total)}
              </span>
            </div>
            <div className="flex items-end gap-px h-20">
              {vals.map((v, i) => {
                // Identities behind this specific bar (e.g. who was active /
                // who was new that day), shown under the value. Prefer per-series
                // cellMeta so each series names only its own people; fall back to
                // per-day rowMeta for single-series graphs. Capped for compactness.
                const who = result.cellMeta?.[i]?.[si] ?? result.rowMeta?.[i] ?? null;
                const CAP = 12;
                return (
                  // The wrapper is the full-height hover target (the bar itself
                  // can be 2px tall / a few px wide), so the tooltip is easy to
                  // trigger. Pure CSS group-hover — no client JS on this RSC.
                  <div
                    key={i}
                    className="group relative flex h-full min-w-0 flex-1 items-end"
                  >
                    <div
                      className="w-full rounded-sm"
                      style={{
                        height: `${Math.max((v / max) * 100, 2)}%`,
                        backgroundColor: fgFill(opacities[si] ?? 18),
                      }}
                    />
                    {/* Same floating-panel look as InfoTip (border + shadow +
                        fade), so every tooltip on the dashboard matches. */}
                    <div
                      className={`pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 -translate-x-1/2 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-center opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100 ${
                        who ? "w-48 max-w-[12rem]" : "whitespace-nowrap"
                      }`}
                    >
                      <span className="block text-[10px] leading-tight text-[var(--muted)]">
                        {days[i]}
                      </span>
                      <span className="block text-[11px] font-semibold leading-tight tabular-nums text-[var(--fg)]">
                        {formatNumber(v)}
                      </span>
                      {who && (
                        <span className="mt-1 block border-t border-[var(--border)] pt-1 text-left text-[10px] leading-snug text-[var(--muted)]">
                          {who.slice(0, CAP).map((e, k) => (
                            <span key={k} className="block truncate">
                              {e}
                            </span>
                          ))}
                          {who.length > CAP && (
                            <span className="block italic">
                              +{who.length - CAP} more
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[10px] text-[var(--muted)] mt-1">
              <span>{days[0]}</span>
              <span>{days[days.length - 1]}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Plain table ────────────────────────────────────────────────────────────

function DataTable({ result }: { result: MetricResult }) {
  if (result.rows.length === 0) return <EmptyState />;
  const numeric = result.columns.map((_, c) =>
    result.rows.every((r) => r[c] === null || typeof r[c] === "number"),
  );
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-[var(--muted)] border-b border-[var(--border)]">
            {result.columns.map((col, c) => (
              <th
                key={col}
                className={`py-1.5 px-2 font-medium ${numeric[c] ? "text-right" : "text-left"}`}
              >
                {prettyLabel(col)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((r, ri) => (
            <tr key={ri} className="border-b border-[var(--border)] last:border-0">
              {r.map((cell, c) => (
                <td
                  key={c}
                  className={`py-1.5 px-2 tabular-nums text-[var(--fg)] ${numeric[c] ? "text-right" : "text-left"}`}
                >
                  {formatNumber(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Retention matrix (heat table) ──────────────────────────────────────────

function Matrix({ result }: { result: MetricResult }) {
  if (result.rows.length === 0) return <EmptyState />;
  // Columns 0,1 are Cohort + Size; the rest are weekly percentages.
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-xs border-separate border-spacing-0.5">
        <thead>
          <tr className="text-[var(--muted)]">
            {result.columns.map((col, c) => (
              <th
                key={col}
                className={`py-1 px-2 font-medium ${c < 2 ? "text-left" : "text-center"}`}
              >
                {prettyLabel(col)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((r, ri) => (
            <tr key={ri}>
              {r.map((cell, c) => {
                if (c < 2) {
                  return (
                    <td key={c} className="py-1 px-2 text-[var(--fg)] tabular-nums whitespace-nowrap">
                      {formatNumber(cell)}
                    </td>
                  );
                }
                // Cells arrive pre-formatted as "pct% · n" (percent + absolute
                // headcount). Pull the leading percent out for the heat shade;
                // show the whole string so the absolute number is visible too.
                const pct = cell === null ? NaN : parseFloat(String(cell));
                const hasPct = Number.isFinite(pct);
                return (
                  <td
                    key={c}
                    className="py-1 px-2 text-center tabular-nums rounded whitespace-nowrap"
                    style={{
                      backgroundColor: hasPct
                        ? fgFill(Math.min(pct, 100) * 0.6)
                        : "transparent",
                      color: hasPct && pct > 70 ? "var(--bg)" : "var(--fg)",
                    }}
                  >
                    {cell === null ? "" : String(cell)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Dispatcher ─────────────────────────────────────────────────────────────

export function MetricBody({
  render,
  result,
}: {
  render: RenderHint;
  result: MetricResult;
}) {
  switch (render) {
    case "scalars":
      return <Scalars result={result} />;
    case "funnel":
      return <Funnel result={result} />;
    case "bars":
      return <BarList result={result} />;
    case "timeseries":
      return <TimeSeries result={result} />;
    case "matrix":
      return <Matrix result={result} />;
    case "table":
    default:
      return <DataTable result={result} />;
  }
}
