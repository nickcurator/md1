// Product changelog — the "What's new" surface for md1.
//
// Entries live in code, newest first. Add a new entry in the same PR that
// ships the feature. Seen-state is per-device in localStorage.

export type ChangelogEntry = {
  id: string;
  date: string;
  title: string;
  emoji?: string;
  body: string[];
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    id: "2026-06-12-admin-analytics",
    date: "2026-06-12",
    emoji: "📊",
    title: "Admin analytics dashboard",
    body: [
      "/admin/analytics shows user counts, signups, note distribution, and engagement — DAU/WAU/MAU plus core actions per day.",
      "User lookup lists every account with note and API-token counts, plus a per-user event trail.",
      "Events are stored in Supabase (no third-party analytics). Set ADMIN_EMAILS in env to open the dashboard.",
    ],
  },
  {
    id: "2026-06-12-api-anywhere",
    date: "2026-06-12",
    emoji: "🔌",
    title: "API access for any tool",
    body: [
      "Personal API tokens in Settings work with curl, your own scripts, CI, Shortcuts, Raycast — any HTTP client, not just one editor.",
      "Bearer auth on /api/docs: list, create, update, and delete notes without opening the browser.",
      "Settings now shows copy-paste curl examples and every endpoint; Cursor MCP is an optional expandable section if you want it.",
    ],
  },
  {
    id: "2026-06-12-whats-new",
    date: "2026-06-12",
    emoji: "✨",
    title: "What's new in md1",
    body: [
      "When we ship an update, you'll get a short toast after sign-in and a dot on your profile avatar — open What's new from the sidebar menu to read the full changelog.",
      "The /whats-new page groups releases by date, with a table of contents on desktop so you can jump between updates.",
      "Acknowledging the toast or visiting the page clears the indicator on this device until the next release.",
    ],
  },
];

const FUTURE_TOLERANCE_MS = 36 * 60 * 60 * 1000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateChangelog(
  entries: ChangelogEntry[] = CHANGELOG,
  now: Date = new Date(),
): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();

  entries.forEach((e, i) => {
    if (!DATE_RE.test(e.date)) {
      problems.push(`"${e.id}": date "${e.date}" is not YYYY-MM-DD`);
    } else {
      const t = Date.parse(`${e.date}T00:00:00Z`);
      if (t - now.getTime() > FUTURE_TOLERANCE_MS) {
        problems.push(`"${e.id}": date "${e.date}" is in the future`);
      }
    }

    if (!e.id.startsWith(`${e.date}-`)) {
      problems.push(`"${e.id}": id must start with its date ("${e.date}-…")`);
    }

    if (seen.has(e.id)) problems.push(`duplicate id "${e.id}"`);
    seen.add(e.id);

    const next = entries[i + 1];
    if (next && e.date < next.date) {
      problems.push(
        `out of order: "${e.id}" (${e.date}) is listed above "${next.id}" (${next.date})`,
      );
    }
  });

  return problems;
}

const changelogProblems = validateChangelog();
if (changelogProblems.length > 0) {
  throw new Error(
    `Invalid CHANGELOG (lib/changelog.ts):\n- ${changelogProblems.join("\n- ")}`,
  );
}

export const LATEST_CHANGELOG_ID: string | null = CHANGELOG[0]?.id ?? null;

const SEEN_KEY = "md1.changelog.lastSeen";

export function getLastSeenId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
}

export function markChangelogSeen(): void {
  if (typeof window === "undefined" || !LATEST_CHANGELOG_ID) return;
  try {
    localStorage.setItem(SEEN_KEY, LATEST_CHANGELOG_ID);
  } catch {
    // storage disabled — worst case the dot stays on
  }
}

export function hasUnseenChangelog(): boolean {
  if (!LATEST_CHANGELOG_ID) return false;
  return getLastSeenId() !== LATEST_CHANGELOG_ID;
}

export function formatChangelogDate(iso: string, locale = "en"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
