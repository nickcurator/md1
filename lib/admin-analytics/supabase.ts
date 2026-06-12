import { createAdminClient } from "@/lib/supabaseAdmin";
import { INTERNAL_EMAILS } from "./internal";
import type { MetricResult } from "./types";

type DriveUserRow = {
  id: string;
  email: string;
  name: string;
  created_at: string;
  last_login_at: string | null;
};

async function fetchDriveUsers(): Promise<DriveUserRow[]> {
  const db = createAdminClient();
  const internal = new Set(INTERNAL_EMAILS);
  const { data, error } = await db.from("drive_users").select("*").limit(50000);
  if (error) throw new Error(`drive_users query failed: ${error.message}`);
  return ((data ?? []) as DriveUserRow[]).filter(
    (u) => !internal.has(u.email.toLowerCase()),
  );
}

async function docCountByOwner(): Promise<Map<string, number>> {
  const db = createAdminClient();
  const { data, error } = await db.from("shared_docs").select("owner_id");
  if (error) throw new Error(`shared_docs query failed: ${error.message}`);
  const m = new Map<string, number>();
  for (const row of data ?? []) {
    const id = (row as { owner_id: string }).owner_id;
    m.set(id, (m.get(id) ?? 0) + 1);
  }
  return m;
}

async function tokenCountByUser(): Promise<Map<string, number>> {
  const db = createAdminClient();
  const { data, error } = await db.from("drive_api_tokens").select("user_id");
  if (error) {
    // Table may not exist on old deploys — treat as zero tokens.
    return new Map();
  }
  const m = new Map<string, number>();
  for (const row of data ?? []) {
    const id = (row as { user_id: string }).user_id;
    m.set(id, (m.get(id) ?? 0) + 1);
  }
  return m;
}

export async function usersOverview(): Promise<MetricResult> {
  const users = await fetchDriveUsers();
  const docs = await docCountByOwner();
  const tokens = await tokenCountByUser();
  const totalDocs = [...docs.values()].reduce((a, b) => a + b, 0);
  const withDocs = users.filter((u) => (docs.get(u.id) ?? 0) > 0).length;
  const withTokens = users.filter((u) => (tokens.get(u.id) ?? 0) > 0).length;
  const avgDocs =
    users.length > 0 ? Math.round((totalDocs / users.length) * 10) / 10 : 0;
  return {
    columns: [
      "Users",
      "Total notes",
      "Users with notes",
      "Users with API tokens",
      "Avg notes / user",
    ],
    rows: [[users.length, totalDocs, withDocs, withTokens, avgDocs]],
  };
}

export async function signupsDaily(days: number): Promise<MetricResult> {
  const users = await fetchDriveUsers();
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const byDay = new Map<string, number>();
  for (const u of users) {
    const t = Date.parse(u.created_at);
    if (!Number.isFinite(t) || t < cutoff) continue;
    const day = u.created_at.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }
  const rows = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, n]) => [day, n] as [string, number]);
  return { columns: ["day", "signups"], rows };
}

export async function notesPerUser(): Promise<MetricResult> {
  const users = await fetchDriveUsers();
  const docs = await docCountByOwner();
  const buckets = new Map<string, number>();
  for (const u of users) {
    const n = docs.get(u.id) ?? 0;
    const label =
      n === 0 ? "0" : n <= 3 ? "1–3" : n <= 10 ? "4–10" : "11+";
    buckets.set(label, (buckets.get(label) ?? 0) + 1);
  }
  const order = ["0", "1–3", "4–10", "11+"];
  return {
    columns: ["bucket", "users"],
    rows: order
      .filter((k) => buckets.has(k))
      .map((k) => [k, buckets.get(k)!]),
  };
}
