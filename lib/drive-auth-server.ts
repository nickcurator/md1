import { notFound } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createDriveServerClient } from "@/lib/drive-supabase";
import {
  getDriveUserByEmail,
  upsertDriveUserOnLogin,
  type DriveUser,
} from "@/lib/drive-users-server";

function profileFromAuthUser(user: User) {
  const meta = user.user_metadata ?? {};
  const googleSub =
    user.identities?.find((i) => i.provider === "google")?.id ??
    (typeof meta.sub === "string" ? meta.sub : user.id);
  return {
    email: user.email!,
    name:
      (typeof meta.full_name === "string" && meta.full_name) ||
      (typeof meta.name === "string" && meta.name) ||
      "",
    avatarUrl:
      (typeof meta.avatar_url === "string" && meta.avatar_url) ||
      (typeof meta.picture === "string" && meta.picture) ||
      "",
    googleSub,
  };
}

async function driveUserFromAuthUser(user: User): Promise<DriveUser | null> {
  if (!user.email) return null;
  const existing = await getDriveUserByEmail(user.email);
  if (existing) return existing;
  return upsertDriveUserOnLogin(profileFromAuthUser(user));
}

export async function getDriveAuthUser(): Promise<User | null> {
  const supabase = await createDriveServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
}

export async function getDriveUser(): Promise<DriveUser | null> {
  const authUser = await getDriveAuthUser();
  if (!authUser?.email) return null;
  return driveUserFromAuthUser(authUser);
}

/** Cookie session or `Authorization: Bearer m1_…` API token. */
export async function getDriveUserFromRequest(
  req: Request,
): Promise<DriveUser | null> {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const { getDriveUserFromApiToken } = await import("@/lib/api-tokens-server");
    return getDriveUserFromApiToken(auth.slice(7).trim());
  }
  return getDriveUser();
}

export async function requireDriveUser(): Promise<DriveUser> {
  const user = await getDriveUser();
  if (!user) notFound();
  return user;
}

export async function isRequestDriveUser(): Promise<boolean> {
  return (await getDriveUser()) !== null;
}

export async function syncDriveUserFromAuth(user: User): Promise<DriveUser> {
  return upsertDriveUserOnLogin(profileFromAuthUser(user));
}
