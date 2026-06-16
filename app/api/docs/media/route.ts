import { NextResponse } from "next/server";
import { getDriveUserFromRequest } from "@/lib/drive-auth-server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import {
  isAllowedMediaType,
  MAX_MEDIA_BYTES,
  MEDIA_BUCKET,
  mediaExtension,
} from "@/lib/shared-docs";

export const dynamic = "force-dynamic";

function notFound() {
  return new NextResponse("Not found", {
    status: 404,
    headers: { "content-type": "text/plain" },
  });
}

// Upload inline document media (images) to the public `doc-media` bucket and
// return its public URL. The editor inserts `![alt](url)` into the markdown
// body, so the document content stays plain markdown. Writes go through the
// service-role client (the bucket has no anon write policy); reads are public.
export async function POST(req: Request) {
  const user = await getDriveUserFromRequest(req);
  if (!user) return notFound();

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (!isAllowedMediaType(file.type)) {
    return NextResponse.json(
      { error: "Unsupported file type" },
      { status: 415 },
    );
  }
  if (file.size > MAX_MEDIA_BYTES) {
    return NextResponse.json(
      {
        error: `File too large (max ${Math.round(MAX_MEDIA_BYTES / 1024 / 1024)} MB)`,
      },
      { status: 413 },
    );
  }

  const path = `${user.id}/${crypto.randomUUID()}.${mediaExtension(file.type)}`;
  const supabase = createAdminClient();
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: false });
  if (error) {
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
}
