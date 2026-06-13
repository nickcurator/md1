import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireDriveUser } from "@/lib/drive-auth-server";
import AppLogo from "@/components/AppLogo";
import ApiTokensPanel from "./ApiTokensPanel";
import ApiAccessPanel from "./ApiAccessPanel";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireDriveUser();

  return (
    <div className="min-h-[100dvh] bg-[var(--bg)] text-[var(--fg)]">
      <header className="border-b border-[var(--border)] px-4 py-4">
        <div className="mx-auto flex max-w-2xl items-center gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--fg)]"
          >
            <ArrowLeft size={16} />
            Back to notes
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <div className="mb-2">
          <AppLogo />
          <h1 className="mt-4 text-2xl font-semibold">Settings</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Create a token, then connect via API or MCP below.
          </p>
        </div>

        <ApiTokensPanel />
        <ApiAccessPanel />
      </main>
    </div>
  );
}
