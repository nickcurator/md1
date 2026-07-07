import { NextResponse } from "next/server";
import { getDriveUserFromRequest } from "@/lib/drive-auth-server";
import type { MailMessageAction } from "@/lib/mail";
import { applyBulkMailMessageAction } from "@/lib/mail-server";

export const dynamic = "force-dynamic";

function notFound() {
  return new NextResponse("Not found", {
    status: 404,
    headers: { "content-type": "text/plain" },
  });
}

const ACTIONS = new Set<MailMessageAction>([
  "mark_read",
  "mark_unread",
  "archive",
  "trash",
  "delete_forever",
  "star",
  "unstar",
]);

type BulkActionBody = {
  action?: unknown;
  messageIds?: unknown;
};

export async function POST(req: Request) {
  const user = await getDriveUserFromRequest(req);
  if (!user) return notFound();

  let body: BulkActionBody;
  try {
    body = (await req.json()) as BulkActionBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.action !== "string" || !ACTIONS.has(body.action as MailMessageAction)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
  if (!Array.isArray(body.messageIds)) {
    return NextResponse.json({ error: "messageIds is required" }, { status: 400 });
  }

  try {
    const result = await applyBulkMailMessageAction({
      ownerId: user.id,
      action: body.action as MailMessageAction,
      messageIds: body.messageIds.filter(
        (value): value is string => typeof value === "string",
      ),
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Bulk action failed" },
      { status: 400 },
    );
  }
}
