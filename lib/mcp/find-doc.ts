import { listDocs } from "@/lib/shared-docs-server";
import type { SharedDoc } from "@/lib/shared-docs";

export async function findDocForOwner(
  ownerId: string,
  query: string,
): Promise<SharedDoc> {
  const q = query.trim();
  if (!q) throw new Error("query is required");

  const docs = await listDocs(ownerId);
  const byId = docs.find((d) => d.id === q);
  if (byId) return byId;

  const bySlug = docs.find((d) => d.slug === q);
  if (bySlug) return bySlug;

  const needle = q.toLowerCase();
  const matches = docs.filter((d) => d.title.toLowerCase().includes(needle));
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    throw new Error(
      `Multiple notes match "${q}": ${matches
        .map((m) => `"${m.title}" (${m.id})`)
        .join(", ")}`,
    );
  }
  throw new Error(`No note found for "${q}"`);
}
