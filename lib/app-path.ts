export const DEFAULT_APP_PATH = "/";

/** Safe in-app redirect target after login (no open redirects). */
export function safeAppPath(path: string | null | undefined): string | null {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return null;
  if (path.startsWith("/api") || path.startsWith("/login")) return null;
  return path;
}
