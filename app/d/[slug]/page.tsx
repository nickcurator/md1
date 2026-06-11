import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { canViewDoc, getDocBySlug } from "@/lib/shared-docs-server";
import { getDriveUser } from "@/lib/drive-auth-server";
import DocView from "./DocView";

// Published docs are public: anyone with the link can read, no login.
// Unpublished docs are not reachable here. Always noindex.
export const dynamic = "force-dynamic";

const NOT_FOUND_META: Metadata = {
  title: "Not found",
  robots: { index: false, follow: false },
};

type Params = { slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const doc = await getDocBySlug(slug);
  if (!doc) return NOT_FOUND_META;
  const viewer = await getDriveUser();
  if (!canViewDoc(doc, viewer?.id ?? null)) return NOT_FOUND_META;
  return {
    title: doc.title,
    description: doc.description || undefined,
    robots: { index: false, follow: false },
  };
}

export default async function SharedDocPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const doc = await getDocBySlug(slug);
  if (!doc) notFound();

  const viewer = await getDriveUser();
  if (!canViewDoc(doc, viewer?.id ?? null)) notFound();

  return (
    <DocView title={doc.title} content={doc.content} showDrive={!doc.isPublished} />
  );
}
