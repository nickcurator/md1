const DEFAULT_URL = "https://md1.space";

export type SharedDoc = {
  id: string;
  slug: string;
  title: string;
  description: string;
  content: string;
  isPublished: boolean;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
};

function apiUrl(): string {
  return (process.env.MD1_API_URL ?? DEFAULT_URL).replace(/\/$/, "");
}

function apiToken(): string {
  const token = process.env.MD1_API_TOKEN?.trim();
  if (!token) {
    throw new Error("MD1_API_TOKEN is not set in the MCP server environment");
  }
  return token;
}

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${apiUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiToken()}`,
      "content-type": "application/json",
      ...init?.headers,
    },
  });
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const err =
      data &&
      typeof data === "object" &&
      "error" in data &&
      typeof (data as { error: unknown }).error === "string"
        ? (data as { error: string }).error
        : text || `HTTP ${res.status}`;
    throw new Error(err);
  }
  return data as T;
}

export function titleFromMarkdown(md: string, fallback: string): string {
  for (const line of md.split("\n")) {
    const m = /^#\s+(.+?)\s*$/.exec(line);
    if (m) return m[1].slice(0, 200);
    if (line.trim()) break;
  }
  return fallback;
}

export async function listDocs(): Promise<SharedDoc[]> {
  const data = await request<{ docs: SharedDoc[] }>("/api/docs");
  return data.docs;
}

export async function createDoc(input: {
  title?: string;
  content: string;
  description?: string;
  isPublished?: boolean;
  isPublic?: boolean;
}): Promise<SharedDoc> {
  const data = await request<{ doc: SharedDoc }>("/api/docs", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return data.doc;
}

export async function updateDoc(
  id: string,
  input: {
    title?: string;
    content?: string;
    description?: string;
    isPublished?: boolean;
    isPublic?: boolean;
  },
): Promise<SharedDoc> {
  const data = await request<{ doc: SharedDoc }>(`/api/docs/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return data.doc;
}

export function docUrl(slug: string): string {
  return `${apiUrl()}/d/${slug}`;
}

export function editorUrl(): string {
  return `${apiUrl()}/`;
}
