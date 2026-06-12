// Route-level fallback for first entry into /admin/analytics/user. Sorting,
// searching and opening a user are searchParams navigations, handled by the
// in-page <Suspense> in page.tsx.

import { Box, UsersTableSkeleton } from "../skeletons";

export default function Loading() {
  return (
    <div>
      <div className="mb-5">
        <Box className="h-6 w-40" />
        <Box className="mt-2 h-3 w-80" />
      </div>
      <div className="mb-6 flex gap-2">
        <Box className="h-10 max-w-xl flex-1" />
        <Box className="h-10 w-24" />
      </div>
      <UsersTableSkeleton />
    </div>
  );
}
