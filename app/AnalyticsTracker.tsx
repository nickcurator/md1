"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { analytics } from "@/lib/analytics";

function AnalyticsTrackerInner({ loggedIn }: { loggedIn: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!loggedIn || pathname.startsWith("/admin")) return;
    const qs = searchParams?.toString();
    const path = pathname + (qs ? `?${qs}` : "");
    analytics.pageview(pathname, window.location.origin + path);
  }, [pathname, searchParams, loggedIn]);

  return null;
}

export default function AnalyticsTracker({ loggedIn }: { loggedIn: boolean }) {
  return (
    <Suspense fallback={null}>
      <AnalyticsTrackerInner loggedIn={loggedIn} />
    </Suspense>
  );
}
