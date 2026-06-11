import { titleFromMarkdown } from "@/lib/shared-docs";

export function isMarkdownFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    name.endsWith(".md") ||
    name.endsWith(".markdown") ||
    name.endsWith(".txt") ||
    file.type === "text/markdown" ||
    file.type === "text/plain"
  );
}

export function titleFromFile(file: File, content: string): string {
  const fallback = file.name.replace(/\.(md|markdown|txt)$/i, "");
  return titleFromMarkdown(content, fallback);
}

export function readMarkdownFiles(files: FileList | File[]): File[] {
  return Array.from(files).filter(isMarkdownFile);
}
