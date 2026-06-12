"use client";

import WhatsNewProvider from "@/app/WhatsNewProvider";

export default function AppProviders({
  children,
  loggedIn,
}: {
  children: React.ReactNode;
  loggedIn: boolean;
}) {
  return <WhatsNewProvider loggedIn={loggedIn}>{children}</WhatsNewProvider>;
}
