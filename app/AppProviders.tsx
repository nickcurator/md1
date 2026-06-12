"use client";

import { Suspense } from "react";
import AnalyticsTracker from "@/app/AnalyticsTracker";
import WhatsNewProvider from "@/app/WhatsNewProvider";

export default function AppProviders({
  children,
  loggedIn,
}: {
  children: React.ReactNode;
  loggedIn: boolean;
}) {
  return (
    <WhatsNewProvider loggedIn={loggedIn}>
      <Suspense fallback={null}>
        <AnalyticsTracker loggedIn={loggedIn} />
      </Suspense>
      {children}
    </WhatsNewProvider>
  );
}
