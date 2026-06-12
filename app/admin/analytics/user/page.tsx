import { Suspense } from "react";
import Link from "next/link";
import { revalidateTag } from "next/cache";
import { requireAdmin } from "@/lib/admin-server";
import {
  cachedUserList,
  cachedUserReport,
  ADMIN_CACHE_TAG,
} from "@/lib/admin-analytics/cache";
import { formatNumber } from "@/lib/admin-analytics/format";
import type { UserListRow, UserReport } from "@/lib/admin-analytics/user";
import { UsersTableSkeleton, UserDetailSkeleton } from "../skeletons";

export const dynamic = "force-dynamic";

async function refreshUsers() {
  "use server";
  await requireAdmin();
  revalidateTag(ADMIN_CACHE_TAG);
}

function firstParam(raw: string | string[] | undefined): string {
  return (Array.isArray(raw) ? raw[0] : raw) ?? "";
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

async function UsersTable({ q }: { q: string }) {
  const rows = await cachedUserList();
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-[var(--border)] bg-[var(--card)] text-xs text-[var(--muted)]">
          <tr>
            <th className="px-3 py-2 font-medium">Email</th>
            <th className="px-3 py-2 font-medium">Notes</th>
            <th className="px-3 py-2 font-medium">API tokens</th>
            <th className="px-3 py-2 font-medium">Signed up</th>
            <th className="px-3 py-2 font-medium">Last login</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              className="border-b border-[var(--border)] last:border-0"
            >
              <td className="px-3 py-2">
                <Link
                  href={`/admin/analytics/user?q=${encodeURIComponent(r.email)}`}
                  className="font-medium hover:underline"
                >
                  {r.email}
                </Link>
              </td>
              <td className="px-3 py-2 tabular-nums">{r.notes}</td>
              <td className="px-3 py-2 tabular-nums">{r.apiTokens}</td>
              <td className="px-3 py-2 text-[var(--muted)]">
                {fmtDate(r.createdAt)}
              </td>
              <td className="px-3 py-2 text-[var(--muted)]">
                {fmtDate(r.lastLoginAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UserDetail({ report }: { report: UserReport }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Notes", report.notes],
          ["API tokens", report.apiTokens],
          ["Signed up", fmtDate(report.createdAt)],
          ["Last login", fmtDate(report.lastLoginAt)],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5"
          >
            <div className="text-[11px] text-[var(--muted)]">{label}</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">
              {value}
            </div>
          </div>
        ))}
      </div>

      {report.recentNotes.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold">Recent notes</h3>
          <ul className="space-y-1 text-sm text-[var(--muted)]">
            {report.recentNotes.map((n, i) => (
              <li key={i}>
                {n.title}{" "}
                <span className="text-xs">
                  · {fmtDate(n.createdAt)}
                  {n.isPublished ? " · published" : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="mb-2 text-sm font-semibold">Event trail</h3>
        {report.eventsError && (
          <p className="mb-2 text-xs text-red-500">{report.eventsError}</p>
        )}
        {report.eventCounts.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No events yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ul className="space-y-1 text-sm">
              {report.eventCounts.map((e) => (
                <li key={e.event} className="flex justify-between gap-4">
                  <span>{e.event}</span>
                  <span className="tabular-nums text-[var(--muted)]">
                    {formatNumber(e.n)}
                  </span>
                </li>
              ))}
            </ul>
            <ul className="max-h-64 space-y-1 overflow-y-auto text-xs text-[var(--muted)]">
              {report.events.map((e, i) => (
                <li key={i}>
                  {e.timestamp.slice(0, 16).replace("T", " ")} · {e.event}
                  {e.detail ? ` · ${e.detail}` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

async function UserDetailAsync({ q }: { q: string }) {
  const report = await cachedUserReport(q);
  if (!report) {
    return (
      <p className="text-sm text-[var(--muted)]">No user found for “{q}”.</p>
    );
  }
  return <UserDetail report={report} />;
}

export default async function UserAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const q = firstParam(sp?.q).trim();

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">User lookup</h1>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            Browse users or search by email.
          </p>
        </div>
        <form action={refreshUsers}>
          <button
            type="submit"
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted)] hover:text-[var(--fg)]"
          >
            Refresh
          </button>
        </form>
      </div>

      <form className="mb-6 flex gap-2" method="get">
        <input
          name="q"
          type="search"
          defaultValue={q}
          placeholder="email@example.com"
          className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium"
        >
          Search
        </button>
      </form>

      {q ? (
        <Suspense key={q} fallback={<UserDetailSkeleton />}>
          <UserDetailAsync q={q} />
        </Suspense>
      ) : (
        <Suspense fallback={<UsersTableSkeleton />}>
          <UsersTable q={q} />
        </Suspense>
      )}
    </div>
  );
}
