import { NextResponse } from "next/server";
import { getDriveUserFromRequest } from "@/lib/drive-auth-server";
import { deleteMailAccount, listMailWorkspace } from "@/lib/mail-server";

export const dynamic = "force-dynamic";

function notFound() {
  return new NextResponse("Not found", {
    status: 404,
    headers: { "content-type": "text/plain" },
  });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getDriveUserFromRequest(req);
  if (!user) return notFound();
  const { id } = await params;
  await deleteMailAccount({ ownerId: user.id, accountId: id });
  const workspace = await listMailWorkspace(user.id);
  return NextResponse.json({ workspace });
}
