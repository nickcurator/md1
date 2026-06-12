import { notFound } from "next/navigation";
import { getDriveAuthUser } from "@/lib/drive-auth-server";
import { isAdminEmail } from "@/lib/admin";

export async function requireAdmin() {
  const user = await getDriveAuthUser();
  if (!isAdminEmail(user?.email)) {
    notFound();
  }
  return user;
}

export async function isRequestAdmin(): Promise<boolean> {
  const user = await getDriveAuthUser();
  return isAdminEmail(user?.email);
}
