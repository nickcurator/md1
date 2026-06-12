// Client-safe API token metadata (never includes the secret).

export type ApiTokenMeta = {
  id: string;
  name: string;
  tokenPrefix: string;
  lastUsedAt: string | null;
  createdAt: string;
};

export const API_TOKEN_PREFIX = "m1_";
