// Route-level fallback — shown on first entry into /admin/analytics and when
// navigating here from another admin page. (Section / time-window switches are
// searchParams-only, so those are covered by the in-page <Suspense> instead.)

import { Box, MetricsGridSkeleton } from "./skeletons";

export default function Loading() {
  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <Box className="h-6 w-32" />
          <Box className="mt-2 h-3 w-64" />
        </div>
        <Box className="h-8 w-32" />
      </div>
      <div className="lg:flex lg:gap-8">
        {/* Sidebar placeholder */}
        <div className="hidden shrink-0 flex-col gap-2 lg:flex lg:w-52">
          <Box className="h-3 w-16" />
          <Box className="h-7 w-full" />
          <Box className="h-7 w-full" />
          <Box className="h-7 w-full" />
          <Box className="mt-3 h-3 w-16" />
          <Box className="h-7 w-full" />
        </div>
        <div className="mt-6 min-w-0 flex-1 lg:mt-0">
          <Box className="mb-3 h-4 w-40" />
          <MetricsGridSkeleton count={2} />
        </div>
      </div>
    </div>
  );
}
