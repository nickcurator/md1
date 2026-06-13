/** Public site origin for share/editor links in MCP tool output. */
export function md1PublicOrigin(): string {
  if (process.env.MD1_PUBLIC_URL) {
    return process.env.MD1_PUBLIC_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "https://md1.space";
}

export function docPublicUrl(slug: string): string {
  return `${md1PublicOrigin()}/d/${slug}`;
}

export function editorPublicUrl(): string {
  return `${md1PublicOrigin()}/`;
}
