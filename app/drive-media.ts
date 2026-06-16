import { isAllowedMediaType } from "@/lib/shared-docs";

export type UploadedMedia = { url: string; name: string };

export function isImageFile(file: File): boolean {
  return isAllowedMediaType(file.type);
}

// Pull image files out of a paste/drop payload (clipboard or drag transfer).
export function imageFilesFrom(list: FileList | File[] | null | undefined): File[] {
  if (!list) return [];
  return Array.from(list).filter(isImageFile);
}

// Build the markdown image syntax, deriving a clean alt text from the filename.
export function imageMarkdown(name: string, url: string): string {
  const alt = name.replace(/\.[^.]+$/, "").replace(/[[\]]/g, "").trim();
  return `![${alt || "image"}](${url})`;
}

export async function uploadMedia(file: File): Promise<UploadedMedia> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch("/api/docs/media", { method: "POST", body });
  const data = (await res.json().catch(() => ({}))) as {
    url?: string;
    error?: string;
  };
  if (!res.ok || !data.url) {
    throw new Error(data.error || `Upload failed (${res.status})`);
  }
  return { url: data.url, name: file.name };
}
