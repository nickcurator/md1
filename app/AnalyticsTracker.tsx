"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createBrowserClient } from "@supabase/ssr";
import { DRIVE_AUTH_COOKIE } from "@/lib/drive-supabase";
import { analytics } from "@/lib/analytics";

const SIGNUP_FRESH_MS = 60 * 60 * 1000;

function maybeTrackSignup(user: User) {
  if (typeof window === "undefined") return;
  try {
    const createdMs = user.created_at ? Date.parse(user.created_at) : NaN;
    if (!Number.isFinite(createdMs)) return;
    if (Date.now() - createdMs > SIGNUP_FRESH_MS) return;
    const key = `md1.signupTracked.${user.id}`;
    if (localStorage.getItem(key)) return;
    analytics.signup({ method: user.app_metadata?.provider ?? "google" });
    localStorage.setItem(key, "1");
  } catch {
    // noop
  }
}

function AnalyticsTrackerInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    analytics.init();
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookieOptions: { name: DRIVE_AUTH_COOKIE } },
    );
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || pathname.startsWith("/admin")) return;
    const qs = searchParams?.toString();
    const path = pathname + (qs ? `?${qs}` : "");
    analytics.pageview(pathname, window.location.origin + path);
  }, [pathname, searchParams, user]);

  useEffect(() => {
    if (user) maybeTrackSignup(user);
  }, [user?.id]);

  return null;
}

export default function AnalyticsTracker() {
  return (
    <Suspense fallback={null}>
      <AnalyticsTrackerInner />
    </Suspense>
  );
}
