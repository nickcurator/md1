import { NextResponse } from "next/server";
import { getDriveUserFromRequest } from "@/lib/drive-auth-server";
import { moveMailMessages } from "@/lib/mail-server";

export const dynamic = "force-dynamic";

function notFound() {
  return new NextResponse("Not found", {
    status: 404,
    headers: { "content-type": "text/plain" },
  });
}

type MoveBody = {
  messageIds?: unknown;
  targetProviderFolderId?: unknown;
};

export async function POST(req: Request) {
  const user = await getDriveUserFromRequest(req);
  if (!user) return notFound();

  let body: MoveBody;
  try {
    body = (await req.json()) as MoveBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.messageIds)) {
    return NextResponse.json({ error: "messageIds is required" }, { status: 400 });
  }
  if (
    typeof body.targetProviderFolderId !== "string" ||
    !body.targetProviderFolderId.trim()
  ) {
    return NextResponse.json(
      { error: "targetProviderFolderId is required" },
      { status: 400 },
    );
  }

  try {
    const result = await moveMailMessages({
      ownerId: user.id,
      targetProviderFolderId: body.targetProviderFolderId,
      messageIds: body.messageIds.filter(
        (value): value is string => typeof value === "string",
      ),
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Move failed" },
      { status: 400 },
    );
  }
}
