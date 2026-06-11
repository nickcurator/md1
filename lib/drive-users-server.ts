import { createAdminClient } from "@/lib/supabaseAdmin";

export type DriveUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string;
  googleSub: string | null;
  createdAt: string;
  lastLoginAt: string | null;
};

type Row = {
  id: string;
  email: string;
  name: string;
  avatar_url: string;
  google_sub: string | null;
  created_at: string;
  last_login_at: string | null;
};

function mapRow(r: Row): DriveUser {
  return {
    id: r.id,
    email: r.email,
    name: r.name,
    avatarUrl: r.avatar_url,
    googleSub: r.google_sub,
    createdAt: r.created_at,
    lastLoginAt: r.last_login_at,
  };
}

export async function getDriveUserById(id: string): Promise<DriveUser | null> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("drive_users")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRow(data as Row) : null;
}

export async function getDriveUserByEmail(email: string): Promise<DriveUser | null> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("drive_users")
    .select("*")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();
  if (error) throw error;
  return data ? mapRow(data as Row) : null;
}

export async function upsertDriveUserOnLogin(input: {
  email: string;
  name: string;
  avatarUrl: string;
  googleSub: string;
}): Promise<DriveUser> {
  const db = createAdminClient();
  const email = input.email.trim().toLowerCase();
  const now = new Date().toISOString();
  const { data, error } = await db
    .from("drive_users")
    .upsert(
      {
        email,
        name: input.name.trim(),
        avatar_url: input.avatarUrl.trim(),
        google_sub: input.googleSub,
        last_login_at: now,
      },
      { onConflict: "email" },
    )
    .select("*")
    .single();
  if (error) throw error;
  return mapRow(data as Row);
}
