import {
  activeUsersSnapshot,
  activeUsersDaily,
  coreActionsDaily,
  signupsEventDaily,
  analyticsDataCoverage,
} from "@/lib/analytics-events-server";
import { usersOverview, signupsDaily, notesPerUser } from "./supabase";
import type { MetricGroup, MetricMeta, MetricResult, MetricTab } from "./types";

export const DEFAULT_DAYS = 30;
export const DAY_OPTIONS = [1, 7, 30, 90] as const;

const GROUP_TAB: Record<MetricGroup, MetricTab> = {
  users: "product",
  engagement: "product",
};

function clampDays(days: number | undefined): number {
  const n = Math.floor(Number(days));
  if (!Number.isFinite(n) || n < 1) return DEFAULT_DAYS;
  return Math.min(n, 365);
}

type MetricDefMeta = Omit<MetricMeta, "tab">;

type MetricDef = {
  meta: MetricDefMeta;
  run: (days: number) => Promise<MetricResult>;
};

const DEFS: MetricDef[] = [
  {
    meta: {
      key: "users_overview",
      title: "Users & notes (snapshot)",
      description: "Totals from drive_users, shared_docs, and API tokens.",
      group: "users",
      source: "supabase",
      render: "scalars",
      windowed: false,
    },
    run: () => usersOverview(),
  },
  {
    meta: {
      key: "signups_daily",
      title: "Signups per day",
      description: "New drive_users rows by created_at (Google sign-in).",
      group: "users",
      source: "supabase",
      render: "timeseries",
      windowed: true,
    },
    run: (days) => signupsDaily(days),
  },
  {
    meta: {
      key: "notes_per_user",
      title: "Notes per user",
      description: "How many users have 0, 1–3, 4–10, or 11+ notes.",
      group: "users",
      source: "supabase",
      render: "bars",
      windowed: false,
    },
    run: () => notesPerUser(),
  },
  {
    meta: {
      key: "active_users_snapshot",
      title: "Active users (DAU / WAU / MAU)",
      description: "Users with any tracked event in the rolling window.",
      group: "engagement",
      source: "events",
      render: "scalars",
      windowed: false,
    },
    run: () => activeUsersSnapshot(),
  },
  {
    meta: {
      key: "active_users_daily",
      title: "Daily active users",
      description: "Distinct users with any event per day.",
      group: "engagement",
      source: "events",
      render: "timeseries",
      windowed: true,
    },
    run: (days) => activeUsersDaily(days),
  },
  {
    meta: {
      key: "core_actions_daily",
      title: "Core actions per day",
      description:
        "doc_created, doc_deleted, doc_published, api_token_created, feedback_sent.",
      group: "engagement",
      source: "events",
      render: "timeseries",
      windowed: true,
    },
    run: (days) => coreActionsDaily(days),
  },
  {
    meta: {
      key: "signups_event_daily",
      title: "Signups (events)",
      description: "signup events per day — cross-check with Supabase signups.",
      group: "engagement",
      source: "events",
      render: "timeseries",
      windowed: true,
    },
    run: (days) => signupsEventDaily(days),
  },
];

export type DataCoverage = { firstEvent: string | null };

export async function dataCoverage(): Promise<DataCoverage> {
  try {
    return await analyticsDataCoverage();
  } catch {
    return { firstEvent: null };
  }
}

const BY_KEY = new Map(DEFS.map((d) => [d.meta.key, d]));

function withTab(meta: MetricDefMeta): MetricMeta {
  return { ...meta, tab: GROUP_TAB[meta.group] };
}

export const METRICS: MetricMeta[] = DEFS.map((d) => withTab(d.meta));

export function getMetricMeta(key: string): MetricMeta | undefined {
  const def = BY_KEY.get(key);
  return def ? withTab(def.meta) : undefined;
}

export async function runMetric(
  key: string,
  opts: { days?: number } = {},
): Promise<MetricResult> {
  const def = BY_KEY.get(key);
  if (!def) {
    throw new Error(
      `Unknown metric "${key}". Known: ${METRICS.map((m) => m.key).join(", ")}`,
    );
  }
  return def.run(clampDays(opts.days));
}
