import { NextResponse } from "next/server";
import { getDriveUserFromRequest } from "@/lib/drive-auth-server";
import { deleteDoc, getDocById, updateDoc } from "@/lib/shared-docs-server";
import {
  MAX_DOC_CONTENT_CHARS,
  MAX_DOC_TITLE_CHARS,
  parseDocComments,
} from "@/lib/shared-docs";

export const dynamic = "force-dynamic";

function notFound() {
  return new NextResponse("Not found", {
    status: 404,
    headers: { "content-type": "text/plain" },
  });
}

type PatchBody = {
  title?: string;
  description?: string;
  content?: string;
  folderId?: string | null;
  isPublished?: boolean;
  isPublic?: boolean;
  comments?: unknown;
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getDriveUserFromRequest(req);
  if (!user) return notFound();
  const { id } = await params;
  const doc = await getDocById(user.id, id);
  if (!doc) return notFound();
  return NextResponse.json({ doc });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getDriveUserFromRequest(req);
  if (!user) return notFound();
  const { id } = await params;

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.title !== undefined && body.title.length > MAX_DOC_TITLE_CHARS) {
    return NextResponse.json({ error: "Title too long" }, { status: 400 });
  }
  if (
    body.content !== undefined &&
    body.content.length > MAX_DOC_CONTENT_CHARS
  ) {
    return NextResponse.json(
      { error: `Content too long (max ${MAX_DOC_CONTENT_CHARS} chars)` },
      { status: 400 },
    );
  }
  const folderId =
    body.folderId === undefined
      ? undefined
      : body.folderId === null
        ? null
        : typeof body.folderId === "string"
          ? body.folderId.trim() || null
          : undefined;
  if (body.folderId !== undefined && folderId === undefined) {
    return NextResponse.json({ error: "Invalid folderId" }, { status: 400 });
  }

  try {
    const doc = await updateDoc(user.id, id, {
      ...(body.title !== undefined ? { title: body.title.trim() || "Untitled" } : {}),
      ...(body.description !== undefined
        ? { description: body.description.trim() }
        : {}),
      ...(body.content !== undefined ? { content: body.content } : {}),
      ...(folderId !== undefined ? { folderId } : {}),
      ...(body.isPublished !== undefined
        ? { isPublished: body.isPublished }
        : {}),
      ...(body.isPublic !== undefined ? { isPublic: body.isPublic } : {}),
      ...(body.comments !== undefined
        ? { comments: parseDocComments(body.comments) }
        : {}),
    });
    return NextResponse.json({ doc });
  } catch {
    return notFound();
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getDriveUserFromRequest(req);
  if (!user) return notFound();
  const { id } = await params;
  await deleteDoc(user.id, id);
  return NextResponse.json({ ok: true });
}
