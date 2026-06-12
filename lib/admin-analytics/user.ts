import { createAdminClient } from "@/lib/supabaseAdmin";
import {
  userEventCounts,
  userEventTrail,
} from "@/lib/analytics-events-server";
import { INTERNAL_EMAILS } from "./internal";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type UserListRow = {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  lastLoginAt: string | null;
  notes: number;
  apiTokens: number;
};

export type UserEvent = {
  timestamp: string;
  event: string;
  detail: string;
};

export type UserReport = {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  lastLoginAt: string | null;
  notes: number;
  apiTokens: number;
  recentNotes: { title: string; createdAt: string; isPublished: boolean }[];
  eventCounts: { event: string; n: number }[];
  events: UserEvent[];
  eventsError?: string;
};

async function driveUserByQuery(query: string) {
  const db = createAdminClient();
  const q = query.trim();
  if (!q) return null;
  if (UUID_RE.test(q)) {
    const { data } = await db
      .from("drive_users")
      .select("*")
      .eq("id", q)
      .maybeSingle();
    return data;
  }
  const { data } = await db
    .from("drive_users")
    .select("*")
    .eq("email", q.toLowerCase())
    .maybeSingle();
  return data;
}

async function countsForUser(userId: string) {
  const db = createAdminClient();
  const { count: notes } = await db
    .from("shared_docs")
    .select("*", { count: "exact", head: true })
    .eq("owner_id", userId);
  const { count: apiTokens } = await db
    .from("drive_api_tokens")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);
  return { notes: notes ?? 0, apiTokens: apiTokens ?? 0 };
}

export async function listAllUsers(): Promise<UserListRow[]> {
  const db = createAdminClient();
  const internal = new Set(INTERNAL_EMAILS);
  const { data: users, error } = await db
    .from("drive_users")
    .select("id, email, name, created_at, last_login_at")
    .order("last_login_at", { ascending: false, nullsFirst: false });
  if (error) throw new Error(error.message);

  const rows: UserListRow[] = [];
  for (const u of users ?? []) {
    if (internal.has(u.email.toLowerCase())) continue;
    const { notes, apiTokens } = await countsForUser(u.id);
    rows.push({
      id: u.id,
      email: u.email,
      name: u.name,
      createdAt: u.created_at,
      lastLoginAt: u.last_login_at,
      notes,
      apiTokens,
    });
  }
  return rows;
}

function eventDetail(props: Record<string, unknown>): string {
  if (typeof props.docId === "string") return props.docId;
  if (typeof props.title === "string") return props.title;
  return "";
}

async function eventsForUser(userId: string) {
  try {
    const [eventCounts, trail] = await Promise.all([
      userEventCounts(userId),
      userEventTrail(userId, 40),
    ]);
    const events: UserEvent[] = trail.map((e) => ({
      timestamp: e.timestamp,
      event: e.event,
      detail: eventDetail(e.properties),
    }));
    return { eventCounts, events };
  } catch (e) {
    return {
      eventCounts: [] as { event: string; n: number }[],
      events: [] as UserEvent[],
      eventsError: (e as Error).message,
    };
  }
}

export async function lookupUser(query: string): Promise<UserReport | null> {
  const row = await driveUserByQuery(query);
  if (!row) return null;

  const db = createAdminClient();
  const { notes, apiTokens } = await countsForUser(row.id);
  const { data: recentNotes } = await db
    .from("shared_docs")
    .select("title, created_at, is_published")
    .eq("owner_id", row.id)
    .order("created_at", { ascending: false })
    .limit(8);

  const ev = await eventsForUser(row.id);

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
    notes,
    apiTokens,
    recentNotes: (recentNotes ?? []).map((n) => ({
      title: n.title,
      createdAt: n.created_at,
      isPublished: n.is_published,
    })),
    ...ev,
  };
}
