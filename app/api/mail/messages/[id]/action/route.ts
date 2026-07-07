import { NextResponse } from "next/server";
import { getDriveUserFromRequest } from "@/lib/drive-auth-server";
import {
  applyMailMessageAction,
  listMailWorkspace,
  type MailMessageAction,
} from "@/lib/mail-server";

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
  "star",
  "unstar",
]);

type ActionBody = {
  action?: string;
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getDriveUserFromRequest(req);
  if (!user) return notFound();

  let body: ActionBody;
  try {
    body = (await req.json()) as ActionBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.action || !ACTIONS.has(body.action as MailMessageAction)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const { id } = await params;
  try {
    await applyMailMessageAction({
      ownerId: user.id,
      messageId: id,
      action: body.action as MailMessageAction,
    });
    const workspace = await listMailWorkspace(user.id);
    return NextResponse.json({ workspace });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Action failed" },
      { status: 400 },
    );
  }
}
