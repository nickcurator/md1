import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[100dvh] bg-[var(--bg)] text-[var(--fg)]">
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--bg)]">
        <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-4">
            <Link href="/admin/analytics" className="text-sm font-semibold">
              md1 · Admin
            </Link>
            <nav className="flex items-center gap-3 text-sm text-[var(--muted)]">
              <Link href="/admin/analytics" className="hover:text-[var(--fg)]">
                Analytics
              </Link>
              <Link
                href="/admin/analytics/user"
                className="hover:text-[var(--fg)]"
              >
                User lookup
              </Link>
            </nav>
          </div>
          <Link
            href="/"
            className="text-xs text-[var(--muted)] hover:text-[var(--fg)]"
          >
            ← Back to app
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 md:px-6">{children}</main>
    </div>
  );
}
