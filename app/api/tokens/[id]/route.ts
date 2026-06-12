import { NextResponse } from "next/server";
import { getDriveUser } from "@/lib/drive-auth-server";
import { deleteApiToken } from "@/lib/api-tokens-server";

export const dynamic = "force-dynamic";

function notFound() {
  return new NextResponse("Not found", {
    status: 404,
    headers: { "content-type": "text/plain" },
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getDriveUser();
  if (!user) return notFound();
  const { id } = await params;
  await deleteApiToken(user.id, id);
  return NextResponse.json({ ok: true });
}
