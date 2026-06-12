import { NextResponse } from "next/server";
import { getDriveUser } from "@/lib/drive-auth-server";
import { createApiToken, listApiTokens } from "@/lib/api-tokens-server";

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
  const tokens = await listApiTokens(user.id);
  return NextResponse.json({ tokens });
}

type CreateBody = { name?: string };

export async function POST(req: Request) {
  const user = await getDriveUser();
  if (!user) return notFound();

  let body: CreateBody = {};
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    // empty body is fine
  }

  const { token, plain } = await createApiToken(user.id, body.name ?? "");
  return NextResponse.json({ token, plain });
}
