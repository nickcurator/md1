import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";
import { DRIVE_AUTH_COOKIE } from "@/lib/drive-auth-constants";

export { DRIVE_AUTH_COOKIE } from "@/lib/drive-auth-constants";

// Separate Supabase auth cookie namespace so Drive sign-in never shares a
// session with the main app, even though both use the same Supabase project.

export type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

export function createDriveRouteClient(
  request: NextRequest,
  applyCookies: (cookies: CookieToSet[]) => void,
) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { name: DRIVE_AUTH_COOKIE },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          applyCookies(cookiesToSet);
        },
      },
    },
  );
}

export function createDriveMiddlewareClient(
  request: NextRequest,
  response: NextResponse,
) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { name: DRIVE_AUTH_COOKIE },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );
}

export async function createDriveServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { name: DRIVE_AUTH_COOKIE },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // Read-only in server components.
        },
      },
    },
  );
}

export function applyCookiesToResponse(
  response: NextResponse,
  cookiesToSet: CookieToSet[],
) {
  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });
}
