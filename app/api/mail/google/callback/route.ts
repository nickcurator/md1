import { NextResponse, type NextRequest } from "next/server";
import { getDriveUserFromRequest } from "@/lib/drive-auth-server";
import {
  exchangeGmailOAuthCode,
  syncGmailAccount,
  upsertGmailAccountFromOAuth,
} from "@/lib/mail-server";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "md1-mail-oauth-state";

function redirectToMail(origin: string, params: Record<string, string>) {
  const url = new URL("/mail", origin);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = request.cookies.get(STATE_COOKIE)?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectToMail(origin, { error: "Invalid Gmail callback" });
  }

  const user = await getDriveUserFromRequest(request);
  if (!user) return redirectToMail(origin, { error: "auth" });

  try {
    const tokens = await exchangeGmailOAuthCode({ origin, code });
    const account = await upsertGmailAccountFromOAuth({
      ownerId: user.id,
      tokens,
    });
    try {
      await syncGmailAccount({ ownerId: user.id, accountId: account.id });
    } catch {
      // The account is still connected; /mail will show the sync error stored
      // on the account if the first pull fails.
    }
    const response = redirectToMail(origin, { account: account.id });
    response.cookies.delete(STATE_COOKIE);
    return response;
  } catch (err) {
    return redirectToMail(origin, {
      error: err instanceof Error ? err.message : "Gmail connect failed",
    });
  }
}
