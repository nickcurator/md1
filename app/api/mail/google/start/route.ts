import { randomBytes } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getDriveUserFromRequest } from "@/lib/drive-auth-server";
import { gmailOAuthUrl } from "@/lib/mail-server";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "md1-mail-oauth-state";

function mailRedirect(origin: string, error: string) {
  const url = new URL("/mail", origin);
  url.searchParams.set("error", error);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;
  const user = await getDriveUserFromRequest(request);
  if (!user) return mailRedirect(origin, "auth");

  const state = randomBytes(24).toString("base64url");
  let authUrl: string;
  try {
    authUrl = gmailOAuthUrl({
      origin,
      state,
      loginHint: user.email,
    });
  } catch (err) {
    return mailRedirect(
      origin,
      err instanceof Error ? err.message : "Gmail OAuth is not configured",
    );
  }

  const response = NextResponse.redirect(authUrl);
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  });
  return response;
}
