import { NextResponse } from "next/server";
import { getDriveUserFromRequest } from "@/lib/drive-auth-server";
import { createFolder, listFolders } from "@/lib/shared-docs-server";
import { MAX_FOLDER_NAME_CHARS, normalizeFolderName } from "@/lib/shared-docs";

export const dynamic = "force-dynamic";

function notFound() {
  return new NextResponse("Not found", {
    status: 404,
    headers: { "content-type": "text/plain" },
  });
}

type CreateBody = {
  name?: string;
};

export async function GET(req: Request) {
  const user = await getDriveUserFromRequest(req);
  if (!user) return notFound();
  const folders = await listFolders(user.id);
  return NextResponse.json({ folders });
}

export async function POST(req: Request) {
  const user = await getDriveUserFromRequest(req);
  if (!user) return notFound();

  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = normalizeFolderName(body.name);
  if (!name) {
    return NextResponse.json({ error: "Folder name is required" }, { status: 400 });
  }
  if (name.length > MAX_FOLDER_NAME_CHARS) {
    return NextResponse.json({ error: "Folder name too long" }, { status: 400 });
  }

  const folder = await createFolder(user.id, name);
  return NextResponse.json({ folder });
}
