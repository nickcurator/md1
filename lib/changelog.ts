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
    id: "2026-06-13-api-mcp",
    date: "2026-06-13",
    emoji: "🔌",
    title: "API and MCP access",
    body: [
      "Personal API tokens in Settings — one token for scripts and AI agents.",
      "HTTP API on /api/docs: list, read, create, update, delete, and publish notes. Share link: /d/slug when published.",
      "MCP for agents: paste the hosted config from Settings → MCP (/mcp + Bearer token). Stdio via npx is under «Host needs stdio» if your app requires it.",
      "MCP tools: list and read notes, create markdown, share in one step (share: true or md1_share_doc).",
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
