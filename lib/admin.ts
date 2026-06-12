const ADMIN_EMAILS = ["antipov.work@gmail.com"];

export function adminEmails(): string[] {
  return ADMIN_EMAILS;
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}
