import { NextResponse } from "next/server";
import { getDriveUserFromRequest } from "@/lib/drive-auth-server";
import { createDoc, listDocs } from "@/lib/shared-docs-server";
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

export async function GET(req: Request) {
  const user = await getDriveUserFromRequest(req);
  if (!user) return notFound();
  const docs = await listDocs(user.id);
  return NextResponse.json({ docs });
}

type CreateBody = {
  title?: string;
  description?: string;
  content?: string;
  folderId?: string | null;
  isPublished?: boolean;
  isPublic?: boolean;
  comments?: unknown;
};

export async function POST(req: Request) {
  const user = await getDriveUserFromRequest(req);
  if (!user) return notFound();

  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = (body.title ?? "").trim() || "Untitled";
  const content = body.content ?? "";
  if (title.length > MAX_DOC_TITLE_CHARS) {
    return NextResponse.json({ error: "Title too long" }, { status: 400 });
  }
  if (content.length > MAX_DOC_CONTENT_CHARS) {
    return NextResponse.json(
      { error: `Content too long (max ${MAX_DOC_CONTENT_CHARS} chars)` },
      { status: 400 },
    );
  }
  const folderId =
    body.folderId === undefined || body.folderId === null
      ? null
      : typeof body.folderId === "string"
        ? body.folderId.trim() || null
        : undefined;
  if (folderId === undefined) {
    return NextResponse.json({ error: "Invalid folderId" }, { status: 400 });
  }

  const viaApi = Boolean(req.headers.get("authorization")?.startsWith("Bearer "));
  const doc = await createDoc(user.id, {
    title,
    description: (body.description ?? "").trim(),
    content,
    folderId,
    isPublished: body.isPublished ?? false,
    isPublic: body.isPublic,
    comments: parseDocComments(body.comments ?? []),
  });
  if (viaApi) {
    const { captureServerEvent } = await import("@/lib/analytics-server");
    await captureServerEvent("doc_created", user.id, user.email, {
      docId: doc.id,
      via: "api",
    });
  }
  return NextResponse.json({ doc });
}
