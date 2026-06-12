import { Suspense } from "react";
import Link from "next/link";
import { revalidateTag } from "next/cache";
import {
  METRICS,
  DAY_OPTIONS,
  DEFAULT_DAYS,
} from "@/lib/admin-analytics/metrics";
import {
  cachedMetric,
  cachedCoverage,
  ADMIN_CACHE_TAG,
} from "@/lib/admin-analytics/cache";
import { requireAdmin } from "@/lib/admin-server";
import type { MetricGroup, MetricMeta, MetricResult } from "@/lib/admin-analytics/types";
import { MetricCard, MetricBody, ErrorBox } from "./views";
import { CardSkeleton } from "./skeletons";

export const dynamic = "force-dynamic";

async function refreshAnalytics() {
  "use server";
  await requireAdmin();
  revalidateTag(ADMIN_CACHE_TAG);
}

const GROUP_ORDER: MetricGroup[] = ["users", "engagement"];
const GROUP_TITLES: Record<MetricGroup, string> = {
  users: "Users & content",
  engagement: "Engagement",
};
const DEFAULT_SECTION: MetricGroup = "users";

type Loaded = { result?: MetricResult; error?: string };

async function load(meta: MetricMeta, days: number): Promise<Loaded> {
  try {
    return { result: await cachedMetric(meta.key, days) };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

async function MetricCardAsync({
  meta,
  days,
}: {
  meta: MetricMeta;
  days: number;
}) {
  const { result, error } = await load(meta, days);
  return (
    <MetricCard
      title={meta.title}
      description={meta.description}
      source={meta.source}
      windowLabel={
        meta.windowed ? (days === 1 ? "last 24h" : `last ${days}d`) : "snapshot"
      }
      note={result?.note}
    >
      {error ? (
        <ErrorBox message={error} />
      ) : result ? (
        <MetricBody render={meta.render} result={result} />
      ) : null}
    </MetricCard>
  );
}

function SectionCards({
  section,
  days,
}: {
  section: MetricGroup;
  days: number;
}) {
  const items = METRICS.filter((m) => m.group === section);
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {items.map((meta) => (
        <Suspense key={meta.key} fallback={<CardSkeleton />}>
          <MetricCardAsync meta={meta} days={days} />
        </Suspense>
      ))}
    </div>
  );
}

function parseDays(raw: string | string[] | undefined): number {
  const v = Array.isArray(raw) ? raw[0] : raw;
  const n = parseInt(v ?? "", 10);
  return DAY_OPTIONS.includes(n as (typeof DAY_OPTIONS)[number])
    ? n
    : DEFAULT_DAYS;
}

function parseSection(raw: string | string[] | undefined): MetricGroup {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return (GROUP_ORDER as string[]).includes(v ?? "")
    ? (v as MetricGroup)
    : DEFAULT_SECTION;
}

async function CoverageNote() {
  const cov = await cachedCoverage();
  if (!cov.firstEvent) return null;
  return (
    <p className="mb-3 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-[11px] leading-snug text-[var(--muted)]">
      <span className="font-medium text-[var(--fg)]">Data coverage · </span>
      Event tracking started {cov.firstEvent} — windows reaching before then
      show partial history.
    </p>
  );
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{
    days?: string | string[];
    section?: string | string[];
  }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const days = parseDays(sp?.days);
  const section = parseSection(sp?.section);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Analytics</h1>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            Tracked events + Supabase user/note counts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] p-0.5">
            {DAY_OPTIONS.map((d) => {
              const active = d === days;
              return (
                <Link
                  key={d}
                  href={`/admin/analytics?section=${section}&days=${d}`}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                    active
                      ? "bg-[var(--card)] text-[var(--fg)]"
                      : "text-[var(--muted)] hover:text-[var(--fg)]"
                  }`}
                >
                  {d === 1 ? "24h" : `${d}d`}
                </Link>
              );
            })}
          </div>
          <form action={refreshAnalytics}>
            <button
              type="submit"
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted)] transition-colors hover:border-[var(--fg)] hover:text-[var(--fg)]"
            >
              Refresh
            </button>
          </form>
        </div>
      </div>

      <div className="lg:flex lg:gap-8">
        <aside className="mb-6 lg:mb-0 lg:w-52 lg:shrink-0">
          <nav className="flex flex-col gap-0.5">
            {GROUP_ORDER.map((group) => {
              const on = group === section;
              return (
                <Link
                  key={group}
                  href={`/admin/analytics?section=${group}&days=${days}`}
                  aria-current={on ? "page" : undefined}
                  className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                    on
                      ? "bg-[var(--card)] font-medium text-[var(--fg)]"
                      : "text-[var(--muted)] hover:bg-[var(--card)] hover:text-[var(--fg)]"
                  }`}
                >
                  {GROUP_TITLES[group]}
                </Link>
              );
            })}
          </nav>
        </aside>
        <div key={`${section}:${days}`} className="min-w-0 flex-1">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold">{GROUP_TITLES[section]}</h2>
            <p className="text-[11px] text-[var(--muted)]">
              cached ~5 min
            </p>
          </div>
          <Suspense fallback={null}>
            <CoverageNote />
          </Suspense>
          <SectionCards section={section} days={days} />
        </div>
      </div>
    </div>
  );
}
