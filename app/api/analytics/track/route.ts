import { NextResponse } from "next/server";
import { getDriveUserFromRequest } from "@/lib/drive-auth-server";
import { recordAnalyticsEvent } from "@/lib/analytics-events-server";

export const dynamic = "force-dynamic";

const ALLOWED = new Set([
  "pageview",
  "signup",
  "doc_created",
  "doc_deleted",
  "doc_published",
  "api_token_created",
  "feedback_sent",
]);

type Body = {
  event?: string;
  pathname?: string;
  properties?: Record<string, unknown>;
};

export async function POST(req: Request) {
  const user = await getDriveUserFromRequest(req);
  if (!user) {
    return new NextResponse("Not found", {
      status: 404,
      headers: { "content-type": "text/plain" },
    });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = (body.event ?? "").trim();
  if (!ALLOWED.has(event)) {
    return NextResponse.json({ error: "Unknown event" }, { status: 400 });
  }

  const pathname = (body.pathname ?? "").trim();
  if (pathname.startsWith("/admin")) {
    return NextResponse.json({ ok: true });
  }

  await recordAnalyticsEvent({
    userId: user.id,
    userEmail: user.email,
    event,
    pathname: pathname || undefined,
    properties: body.properties ?? {},
  });

  return NextResponse.json({ ok: true });
}
