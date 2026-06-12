import { createAdminClient } from "@/lib/supabaseAdmin";
import {
  parseDocComments,
  type DocComment,
  type SharedDoc,
} from "@/lib/shared-docs";

// SERVER ONLY. All reads/writes for the internal markdown drive go through the
// service-role client — the `shared_docs` table has RLS enabled with no
// policies, so it's unreachable with the anon/auth keys. Access is scoped in
// application code: CRUD is per-owner (drive_users.id), and the public read
// page only ever calls getDocBySlug() (published-only).

type Row = {
  id: string;
  owner_id: string;
  slug: string;
  title: string;
  description: string;
  content: string;
  is_published: boolean;
  is_public: boolean;
  comments: unknown;
  created_at: string;
  updated_at: string;
};

function mapRow(r: Row): SharedDoc {
  return {
    id: r.id,
    ownerId: r.owner_id,
    slug: r.slug,
    title: r.title,
    description: r.description,
    content: r.content,
    comments: parseDocComments(r.comments),
    isPublished: r.is_published,
    isPublic: r.is_public,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function newSlug(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

export function canViewDoc(
  doc: Pick<SharedDoc, "isPublished" | "ownerId">,
  viewerId: string | null,
): boolean {
  if (doc.isPublished) return true;
  return viewerId !== null && doc.ownerId === viewerId;
}

export async function listDocs(ownerId: string): Promise<SharedDoc[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("shared_docs")
    .select("*")
    .eq("owner_id", ownerId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data as Row[]).map(mapRow);
}

export async function getDocById(
  ownerId: string,
  id: string,
): Promise<SharedDoc | null> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("shared_docs")
    .select("*")
    .eq("id", id)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRow(data as Row) : null;
}

export async function getDocBySlug(slug: string): Promise<SharedDoc | null> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("shared_docs")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (error) throw error;
  if (!data || !(data as Row).owner_id) return null;
  return mapRow(data as Row);
}

export async function createDoc(
  ownerId: string,
  input: {
    title: string;
    description?: string;
    content: string;
    isPublished?: boolean;
    isPublic?: boolean;
    comments?: DocComment[];
  },
): Promise<SharedDoc> {
  const db = createAdminClient();
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await db
      .from("shared_docs")
      .insert({
        owner_id: ownerId,
        slug: newSlug(),
        title: input.title,
        description: input.description ?? "",
        content: input.content,
        is_published: input.isPublished ?? false,
        is_public:
          input.isPublished === true
            ? true
            : (input.isPublic ?? false),
        comments: input.comments ?? [],
      })
      .select("*")
      .single();
    if (!error) return mapRow(data as Row);
    if (error.code !== "23505") throw error;
  }
  throw new Error("Could not generate a unique slug");
}

export async function updateDoc(
  ownerId: string,
  id: string,
  patch: Partial<{
    title: string;
    description: string;
    content: string;
    isPublished: boolean;
    isPublic: boolean;
    comments: DocComment[];
  }>,
): Promise<SharedDoc> {
  const db = createAdminClient();
  const row: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.description !== undefined) row.description = patch.description;
  if (patch.content !== undefined) row.content = patch.content;
  if (patch.isPublished !== undefined) {
    row.is_published = patch.isPublished;
    if (patch.isPublic === undefined) {
      row.is_public = patch.isPublished;
    }
  }
  if (patch.isPublic !== undefined) row.is_public = patch.isPublic;
  if (patch.comments !== undefined) row.comments = patch.comments;

  const { data, error } = await db
    .from("shared_docs")
    .update(row)
    .eq("id", id)
    .eq("owner_id", ownerId)
    .select("*")
    .single();
  if (error) throw error;
  return mapRow(data as Row);
}

export async function deleteDoc(ownerId: string, id: string): Promise<void> {
  const db = createAdminClient();
  const { error } = await db
    .from("shared_docs")
    .delete()
    .eq("id", id)
    .eq("owner_id", ownerId);
  if (error) throw error;
}
