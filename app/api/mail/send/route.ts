import { NextResponse } from "next/server";
import { getDriveUserFromRequest } from "@/lib/drive-auth-server";
import { sendGmailMessage } from "@/lib/mail-server";

export const dynamic = "force-dynamic";

function notFound() {
  return new NextResponse("Not found", {
    status: 404,
    headers: { "content-type": "text/plain" },
  });
}

type SendBody = {
  accountId?: unknown;
  to?: unknown;
  cc?: unknown;
  bcc?: unknown;
  subject?: unknown;
  bodyText?: unknown;
  attachments?: unknown;
  replyToMessageId?: unknown;
  draftMessageId?: unknown;
};

function stringField(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export async function POST(req: Request) {
  const user = await getDriveUserFromRequest(req);
  if (!user) return notFound();

  let body: SendBody;
  try {
    body = (await req.json()) as SendBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.accountId !== "string" || !body.accountId.trim()) {
    return NextResponse.json({ error: "accountId is required" }, { status: 400 });
  }

  try {
    const result = await sendGmailMessage({
      ownerId: user.id,
      accountId: body.accountId,
      to: stringField(body.to),
      cc: stringField(body.cc),
      bcc: stringField(body.bcc),
      subject: stringField(body.subject),
      bodyText: stringField(body.bodyText),
      attachments: body.attachments,
      replyToMessageId:
        typeof body.replyToMessageId === "string" && body.replyToMessageId
          ? body.replyToMessageId
          : null,
      draftMessageId:
        typeof body.draftMessageId === "string" && body.draftMessageId
          ? body.draftMessageId
          : null,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Send failed" },
      { status: 400 },
    );
  }
}
