import { NextResponse } from "next/server";
import { getDriveUserFromRequest } from "@/lib/drive-auth-server";
import { syncGmailAccount } from "@/lib/mail-server";

export const dynamic = "force-dynamic";

function notFound() {
  return new NextResponse("Not found", {
    status: 404,
    headers: { "content-type": "text/plain" },
  });
}

type SyncBody = {
  accountId?: string;
};

export async function POST(req: Request) {
  const user = await getDriveUserFromRequest(req);
  if (!user) return notFound();

  let body: SyncBody;
  try {
    body = (await req.json()) as SyncBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.accountId || typeof body.accountId !== "string") {
    return NextResponse.json({ error: "accountId is required" }, { status: 400 });
  }

  try {
    const workspace = await syncGmailAccount({
      ownerId: user.id,
      accountId: body.accountId,
    });
    return NextResponse.json({ workspace });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 400 },
    );
  }
}
