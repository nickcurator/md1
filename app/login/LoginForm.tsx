"use client";

import AppLogo from "@/components/AppLogo";

export default function LoginForm({
  nextPath,
  error,
}: {
  nextPath?: string;
  error?: string;
}) {
  const googleHref = nextPath
    ? `/api/auth/google?next=${encodeURIComponent(nextPath)}`
    : "/api/auth/google";

  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-sm flex-col justify-center">
      <div className="mb-8 text-center">
        <AppLogo
          iconSize={22}
          className="mx-auto justify-center text-[var(--muted)]"
          labelClassName="text-sm font-semibold tracking-wide text-[var(--muted)]"
        />
        <h1 className="mt-2 text-2xl font-semibold">Sign in</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Continue with Google to open your space. New accounts are created
          automatically.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-500">
          {error}
        </div>
      )}

      <a
        href={googleHref}
        className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm font-medium hover:bg-[var(--border)]/30"
      >
        <GoogleIcon />
        Continue with Google
      </a>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
