import { NextResponse } from "next/server";
import { getDriveUserFromRequest } from "@/lib/drive-auth-server";
import { emptyGmailTrash, listMailWorkspace } from "@/lib/mail-server";

export const dynamic = "force-dynamic";

function notFound() {
  return new NextResponse("Not found", {
    status: 404,
    headers: { "content-type": "text/plain" },
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getDriveUserFromRequest(req);
  if (!user) return notFound();
  const { id } = await params;

  try {
    const result = await emptyGmailTrash({ ownerId: user.id, accountId: id });
    const workspace = await listMailWorkspace(user.id);
    return NextResponse.json({ ...result, workspace });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Could not empty Gmail Trash",
      },
      { status: 400 },
    );
  }
}
