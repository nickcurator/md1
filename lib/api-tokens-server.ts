import { createHash, randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { getDriveUserById, type DriveUser } from "@/lib/drive-users-server";
import { API_TOKEN_PREFIX, type ApiTokenMeta } from "@/lib/api-tokens";

type Row = {
  id: string;
  user_id: string;
  name: string;
  token_hash: string;
  token_prefix: string;
  last_used_at: string | null;
  created_at: string;
};

function mapRow(r: Row): ApiTokenMeta {
  return {
    id: r.id,
    name: r.name,
    tokenPrefix: r.token_prefix,
    lastUsedAt: r.last_used_at,
    createdAt: r.created_at,
  };
}

export function hashApiToken(plain: string): string {
  return createHash("sha256").update(plain).digest("hex");
}

export function generateApiToken(): {
  plain: string;
  hash: string;
  prefix: string;
} {
  const secret = randomBytes(32).toString("base64url");
  const plain = `${API_TOKEN_PREFIX}${secret}`;
  return {
    plain,
    hash: hashApiToken(plain),
    prefix: plain.slice(0, 12),
  };
}

export async function listApiTokens(userId: string): Promise<ApiTokenMeta[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("drive_api_tokens")
    .select("id, user_id, name, token_prefix, last_used_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) =>
    mapRow({ ...(r as Row), token_hash: "" }),
  );
}

export async function createApiToken(
  userId: string,
  name: string,
): Promise<{ token: ApiTokenMeta; plain: string }> {
  const db = createAdminClient();
  const trimmed = name.trim() || "API token";
  const { plain, hash, prefix } = generateApiToken();
  const { data, error } = await db
    .from("drive_api_tokens")
    .insert({
      user_id: userId,
      name: trimmed.slice(0, 80),
      token_hash: hash,
      token_prefix: prefix,
    })
    .select("id, user_id, name, token_prefix, last_used_at, created_at")
    .single();
  if (error) throw error;
  return {
    token: mapRow({ ...(data as Row), token_hash: hash }),
    plain,
  };
}

export async function deleteApiToken(
  userId: string,
  tokenId: string,
): Promise<void> {
  const db = createAdminClient();
  const { error } = await db
    .from("drive_api_tokens")
    .delete()
    .eq("id", tokenId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function getDriveUserFromApiToken(
  plain: string,
): Promise<DriveUser | null> {
  if (!plain.startsWith(API_TOKEN_PREFIX) || plain.length < 20) return null;
  const db = createAdminClient();
  const hash = hashApiToken(plain);
  const { data, error } = await db
    .from("drive_api_tokens")
    .select("id, user_id")
    .eq("token_hash", hash)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const now = new Date().toISOString();
  await db
    .from("drive_api_tokens")
    .update({ last_used_at: now })
    .eq("id", data.id);

  return getDriveUserById(data.user_id);
}
