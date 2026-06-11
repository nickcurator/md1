import { NextResponse } from "next/server";
import { getDriveUser } from "@/lib/drive-auth-server";
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

export async function GET() {
  const user = await getDriveUser();
  if (!user) return notFound();
  const docs = await listDocs(user.id);
  return NextResponse.json({ docs });
}

type CreateBody = {
  title?: string;
  description?: string;
  content?: string;
  isPublished?: boolean;
  isPublic?: boolean;
  comments?: unknown;
};

export async function POST(req: Request) {
  const user = await getDriveUser();
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

  const doc = await createDoc(user.id, {
    title,
    description: (body.description ?? "").trim(),
    content,
    isPublished: body.isPublished ?? false,
    isPublic: body.isPublic,
    comments: parseDocComments(body.comments ?? []),
  });
  return NextResponse.json({ doc });
}
