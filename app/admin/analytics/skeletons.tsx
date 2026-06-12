// Shared loading skeletons for the admin analytics pages. Used both by the
// route-level loading.tsx (first entry into a segment) and by the in-page
// <Suspense key={params}> fallbacks — which is what actually fires on
// tab / time-window / sort / user-select changes, since Next.js does NOT
// re-trigger loading.tsx for searchParams-only navigations.

export function Box({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-[color-mix(in_srgb,var(--fg)_10%,transparent)] ${className}`}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 md:p-5">
      <Box className="h-4 w-40" />
      <Box className="mt-2 h-3 w-56" />
      <div className="mt-5 space-y-2">
        <Box className="h-3 w-full" />
        <Box className="h-3 w-11/12" />
        <Box className="h-3 w-4/5" />
        <Box className="h-3 w-2/3" />
      </div>
    </div>
  );
}

export function MetricsGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

export function UsersTableSkeleton() {
  return (
    <div>
      <Box className="mb-3 h-3 w-64" />
      <div className="overflow-hidden rounded-xl border border-[var(--border)]">
        <div className="border-b border-[var(--border)] bg-[var(--card)] p-3">
          <Box className="h-4 w-full" />
        </div>
        <div className="divide-y divide-[var(--border)]">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-3 py-2.5">
              <Box className="h-4 flex-1" />
              <Box className="h-4 w-16" />
              <Box className="h-4 w-12" />
              <Box className="h-4 w-12" />
              <Box className="h-4 w-20" />
              <Box className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function UserDetailSkeleton() {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 md:p-5">
        <Box className="h-5 w-56" />
        <Box className="mt-2 h-3 w-72" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5"
          >
            <Box className="h-3 w-16" />
            <Box className="mt-2 h-5 w-12" />
          </div>
        ))}
      </div>
      <MetricsGridSkeleton count={2} />
    </div>
  );
}
