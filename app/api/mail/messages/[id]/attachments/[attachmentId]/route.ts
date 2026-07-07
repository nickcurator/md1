import { NextResponse } from "next/server";
import { getDriveUserFromRequest } from "@/lib/drive-auth-server";
import { downloadMailAttachment } from "@/lib/mail-server";

export const dynamic = "force-dynamic";

function notFound() {
  return new NextResponse("Not found", {
    status: 404,
    headers: { "content-type": "text/plain" },
  });
}

function contentDispositionFilename(filename: string): string {
  const fallback = filename
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/["\\]/g, "_")
    .trim() || "attachment";
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(
    filename || "attachment",
  )}`;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  const user = await getDriveUserFromRequest(req);
  if (!user) return notFound();

  const { id, attachmentId } = await params;
  try {
    const attachment = await downloadMailAttachment({
      ownerId: user.id,
      messageId: id,
      attachmentId: decodeURIComponent(attachmentId),
    });
    return new Response(new Uint8Array(attachment.bytes), {
      headers: {
        "content-type": attachment.mimeType || "application/octet-stream",
        "content-length": String(attachment.bytes.length),
        "content-disposition": contentDispositionFilename(attachment.filename),
        "cache-control": "private, max-age=300",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Attachment download failed" },
      { status: 400 },
    );
  }
}
