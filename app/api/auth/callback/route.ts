import { NextResponse, type NextRequest } from "next/server";
import {
  applyCookiesToResponse,
  createDriveRouteClient,
} from "@/lib/drive-supabase";
import { syncDriveUserFromAuth } from "@/lib/drive-auth-server";
import { DEFAULT_APP_PATH, safeAppPath } from "@/lib/app-path";

export const dynamic = "force-dynamic";

function loginError(message: string, origin: string) {
  const url = new URL("/login", origin);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const nextPath = url.searchParams.get("next");
  const destination = safeAppPath(nextPath) ?? DEFAULT_APP_PATH;

  if (!code) {
    return loginError("Sign-in failed. Try again.", origin);
  }

  const response = NextResponse.redirect(new URL(destination, origin));
  const supabase = createDriveRouteClient(request, (cookies) => {
    applyCookiesToResponse(response, cookies);
  });

  try {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return loginError(error.message, origin);
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) {
      return loginError("Sign-in failed. Try again.", origin);
    }

    await syncDriveUserFromAuth(user);
    return response;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Sign-in failed. Try again.";
    return loginError(message, origin);
  }
}
