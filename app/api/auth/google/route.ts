import { NextResponse, type NextRequest } from "next/server";
import {
  applyCookiesToResponse,
  createDriveRouteClient,
} from "@/lib/drive-supabase";
import { safeAppPath } from "@/lib/app-path";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const origin = url.origin;
  const next = url.searchParams.get("next");
  const callback = new URL("/api/auth/callback", origin);
  const nextPath = safeAppPath(next);
  if (nextPath) {
    callback.searchParams.set("next", nextPath);
  }

  const pendingCookies: Parameters<typeof applyCookiesToResponse>[1] = [];
  const supabase = createDriveRouteClient(request, (cookies) => {
    pendingCookies.push(...cookies);
  });

  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callback.toString(),
        skipBrowserRedirect: true,
      },
    });

    if (error || !data.url) {
      const login = new URL("/login", origin);
      login.searchParams.set(
        "error",
        error?.message ?? "Could not start Google sign-in.",
      );
      return NextResponse.redirect(login);
    }

    const res = NextResponse.redirect(data.url);
    applyCookiesToResponse(res, pendingCookies);
    return res;
  } catch (err) {
    const login = new URL("/login", origin);
    login.searchParams.set(
      "error",
      err instanceof Error ? err.message : "Could not start Google sign-in.",
    );
    return NextResponse.redirect(login);
  }
}
