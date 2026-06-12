const DEFAULT_INTERNAL_EMAILS = ["nick@curated.ws"];

export const INTERNAL_EMAILS: string[] = Array.from(
  new Set(
    [
      ...DEFAULT_INTERNAL_EMAILS,
      ...(process.env.ANALYTICS_EXCLUDE_EMAILS ?? "")
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean),
    ].map((e) => e.toLowerCase()),
  ),
);
