import { createAdminClient } from "@/lib/supabaseAdmin";
import { INTERNAL_EMAILS } from "@/lib/admin-analytics/internal";
import type { MetricResult } from "@/lib/admin-analytics/types";

export type AnalyticsEventRow = {
  id: string;
  user_id: string | null;
  user_email: string | null;
  event: string;
  pathname: string | null;
  properties: Record<string, unknown>;
  created_at: string;
};

const INTERNAL = new Set(INTERNAL_EMAILS);

function isExternalEmail(email: string | null | undefined): boolean {
  if (!email) return true;
  return !INTERNAL.has(email.toLowerCase());
}

export async function recordAnalyticsEvent(input: {
  userId: string;
  userEmail: string;
  event: string;
  pathname?: string;
  properties?: Record<string, unknown>;
}): Promise<void> {
  if (!isExternalEmail(input.userEmail)) return;
  const db = createAdminClient();
  const { error } = await db.from("analytics_events").insert({
    user_id: input.userId,
    user_email: input.userEmail.toLowerCase(),
    event: input.event.slice(0, 80),
    pathname: input.pathname?.slice(0, 500) ?? null,
    properties: input.properties ?? {},
  });
  if (error) {
    console.error("[analytics] insert failed:", error.message);
  }
}

type StoredEvent = {
  userId: string | null;
  event: string;
  createdAt: string;
  pathname: string | null;
  properties: Record<string, unknown>;
};

async function fetchEventsSince(since: Date): Promise<StoredEvent[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("analytics_events")
    .select("user_id, user_email, event, pathname, properties, created_at")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: true })
    .limit(100000);
  if (error) throw new Error(error.message);
  const out: StoredEvent[] = [];
  for (const row of data ?? []) {
    if (!isExternalEmail(row.user_email)) continue;
    if (row.pathname?.startsWith("/admin")) continue;
    out.push({
      userId: row.user_id,
      event: row.event,
      createdAt: row.created_at,
      pathname: row.pathname,
      properties: (row.properties as Record<string, unknown>) ?? {},
    });
  }
  return out;
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function msDays(n: number): number {
  return n * 24 * 60 * 60 * 1000;
}

export async function activeUsersSnapshot(): Promise<MetricResult> {
  const now = Date.now();
  const events = await fetchEventsSince(new Date(now - msDays(30)));
  const dau = new Set<string>();
  const wau = new Set<string>();
  const mau = new Set<string>();
  for (const e of events) {
    if (!e.userId) continue;
    const t = Date.parse(e.createdAt);
    if (!Number.isFinite(t)) continue;
    const age = now - t;
    if (age <= msDays(1)) dau.add(e.userId);
    if (age <= msDays(7)) wau.add(e.userId);
    if (age <= msDays(30)) mau.add(e.userId);
  }
  return {
    columns: ["dau", "wau", "mau"],
    rows: [[dau.size, wau.size, mau.size]],
  };
}

export async function activeUsersDaily(days: number): Promise<MetricResult> {
  const events = await fetchEventsSince(new Date(Date.now() - msDays(days)));
  const byDay = new Map<string, Set<string>>();
  for (const e of events) {
    if (!e.userId) continue;
    const d = dayKey(e.createdAt);
    if (!byDay.has(d)) byDay.set(d, new Set());
    byDay.get(d)!.add(e.userId);
  }
  const rows = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, users]) => [day, users.size] as [string, number]);
  return { columns: ["day", "active_users"], rows };
}

const CORE_EVENTS = new Set([
  "pageview",
  "signup",
  "doc_created",
  "doc_deleted",
  "doc_published",
  "api_token_created",
  "feedback_sent",
]);

export async function coreActionsDaily(days: number): Promise<MetricResult> {
  const events = await fetchEventsSince(new Date(Date.now() - msDays(days)));
  const byDay = new Map<
    string,
    {
      doc_created: number;
      doc_deleted: number;
      doc_published: number;
      api_tokens: number;
      feedback: number;
      signup: number;
    }
  >();
  for (const e of events) {
    if (!CORE_EVENTS.has(e.event) || e.event === "pageview") continue;
    const d = dayKey(e.createdAt);
    if (!byDay.has(d)) {
      byDay.set(d, {
        doc_created: 0,
        doc_deleted: 0,
        doc_published: 0,
        api_tokens: 0,
        feedback: 0,
        signup: 0,
      });
    }
    const bucket = byDay.get(d)!;
    if (e.event === "doc_created") bucket.doc_created++;
    else if (e.event === "doc_deleted") bucket.doc_deleted++;
    else if (e.event === "doc_published") bucket.doc_published++;
    else if (e.event === "api_token_created") bucket.api_tokens++;
    else if (e.event === "feedback_sent") bucket.feedback++;
    else if (e.event === "signup") bucket.signup++;
  }
  const rows = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, b]) => [
      day,
      b.doc_created,
      b.doc_deleted,
      b.doc_published,
      b.api_tokens,
      b.feedback,
    ]);
  return {
    columns: [
      "day",
      "doc_created",
      "doc_deleted",
      "doc_published",
      "api_tokens",
      "feedback",
    ],
    rows,
  };
}

export async function signupsEventDaily(days: number): Promise<MetricResult> {
  const events = await fetchEventsSince(new Date(Date.now() - msDays(days)));
  const byDay = new Map<string, number>();
  for (const e of events) {
    if (e.event !== "signup") continue;
    const d = dayKey(e.createdAt);
    byDay.set(d, (byDay.get(d) ?? 0) + 1);
  }
  const rows = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, n]) => [day, n] as [string, number]);
  return { columns: ["day", "signups"], rows };
}

export async function analyticsDataCoverage(): Promise<{
  firstEvent: string | null;
}> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("analytics_events")
    .select("created_at")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error || !data) return { firstEvent: null };
  return { firstEvent: dayKey(data.created_at) };
}

export async function userEventTrail(userId: string, limit = 50) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("analytics_events")
    .select("event, pathname, properties, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    timestamp: r.created_at as string,
    event: r.event as string,
    pathname: (r.pathname as string | null) ?? "",
    properties: (r.properties as Record<string, unknown>) ?? {},
  }));
}

export async function userEventCounts(userId: string) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("analytics_events")
    .select("event")
    .eq("user_id", userId)
    .limit(5000);
  if (error) throw new Error(error.message);
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const ev = row.event as string;
    counts.set(ev, (counts.get(ev) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([event, n]) => ({ event, n }))
    .sort((a, b) => b.n - a.n);
}
