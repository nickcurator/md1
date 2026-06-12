"use client";

import { type MouseEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  CHANGELOG,
  formatChangelogDate,
  LATEST_CHANGELOG_ID,
  type ChangelogEntry,
} from "@/lib/changelog";
import { useWhatsNew } from "@/app/WhatsNewProvider";
import AppLogo from "@/components/AppLogo";

type Group = { date: string; entries: ChangelogEntry[] };

function groupByDate(entries: ChangelogEntry[]): Group[] {
  const groups: Group[] = [];
  for (const e of entries) {
    const last = groups[groups.length - 1];
    if (last && last.date === e.date) last.entries.push(e);
    else groups.push({ date: e.date, entries: [e] });
  }
  return groups;
}

export default function WhatsNewPage() {
  const { markSeen } = useWhatsNew();
  const groups = useMemo(() => groupByDate(CHANGELOG), []);
  const [activeId, setActiveId] = useState<string | null>(
    CHANGELOG[0]?.id ?? null,
  );

  useEffect(() => {
    markSeen();
  }, [markSeen]);

  useEffect(() => {
    const els = CHANGELOG.map((e) => document.getElementById(e.id)).filter(
      (el): el is HTMLElement => el !== null,
    );
    if (els.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((en) => en.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
          );
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-15% 0px -70% 0px", threshold: 0 },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const jump = (id: string) => (e: MouseEvent) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveId(id);
  };

  return (
    <div className="min-h-[100dvh] bg-[var(--bg)] text-[var(--fg)]">
      <header className="border-b border-[var(--border)] px-4 py-4">
        <div className="mx-auto flex max-w-4xl items-center gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--fg)]"
          >
            <ArrowLeft size={16} />
            Back to notes
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <AppLogo />
        <header className="mb-12 mt-6 space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            What&apos;s new
          </h1>
          <p className="text-sm text-[var(--muted)]">Recent updates to md1.</p>
        </header>

        <div className="lg:flex lg:items-start lg:gap-12">
          <div className="min-w-0 flex-1 space-y-20 lg:max-w-2xl">
            {groups.map((group) => (
              <section key={group.date} className="space-y-10">
                <h2
                  id={`date-${group.date}`}
                  className="scroll-mt-24 text-2xl font-semibold tracking-tight"
                >
                  {formatChangelogDate(group.date)}
                </h2>
                {group.entries.map((entry) => (
                  <article
                    key={entry.id}
                    id={entry.id}
                    className="scroll-mt-24 space-y-3"
                  >
                    <h3 className="flex flex-wrap items-center gap-2 text-lg font-semibold">
                      {entry.emoji ? (
                        <span aria-hidden>{entry.emoji}</span>
                      ) : null}
                      {entry.title}
                      {entry.id === LATEST_CHANGELOG_ID && (
                        <span className="rounded bg-[var(--fg)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--bg)]">
                          New
                        </span>
                      )}
                    </h3>
                    <ul className="space-y-3">
                      {entry.body.map((line, i) => (
                        <li
                          key={i}
                          className="flex gap-2.5 text-[15px] leading-relaxed text-[var(--muted)]"
                        >
                          <span
                            aria-hidden
                            className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-[var(--muted)]"
                          />
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </section>
            ))}
          </div>

          <aside
            className="sticky top-10 hidden max-h-[calc(100vh-5rem)] shrink-0 self-start overflow-y-auto lg:block lg:w-56"
            aria-label="On this page"
          >
            <nav className="space-y-5 text-sm">
              {groups.map((group) => (
                <div key={group.date} className="space-y-2">
                  <a
                    href={`#date-${group.date}`}
                    onClick={jump(`date-${group.date}`)}
                    className="block text-[13px] font-semibold text-[var(--fg)]"
                  >
                    {formatChangelogDate(group.date)}
                  </a>
                  <ul className="space-y-2">
                    {group.entries.map((entry) => {
                      const on = activeId === entry.id;
                      return (
                        <li key={entry.id}>
                          <a
                            href={`#${entry.id}`}
                            onClick={jump(entry.id)}
                            className={`block leading-snug transition-colors ${
                              on
                                ? "font-medium text-[var(--fg)]"
                                : "text-[var(--muted)] hover:text-[var(--fg)]"
                            }`}
                          >
                            {entry.title}
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>
          </aside>
        </div>
      </main>
    </div>
  );
}
