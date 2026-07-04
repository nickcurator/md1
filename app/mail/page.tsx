import { requireDriveUser } from "@/lib/drive-auth-server";
import { isAdminEmail } from "@/lib/admin";
import { listMailWorkspace } from "@/lib/mail-server";
import MailClient from "./MailClient";

export const dynamic = "force-dynamic";

export default async function MailPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireDriveUser();
  const params = await searchParams;
  const workspace = await listMailWorkspace(user.id);
  const initialAccountId =
    typeof params.account === "string" ? params.account : null;
  const oauthError = typeof params.error === "string" ? params.error : null;

  return (
    <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden">
      <MailClient
        user={user}
        isAdmin={isAdminEmail(user.email)}
        workspace={workspace}
        initialAccountId={initialAccountId}
        oauthError={oauthError}
      />
    </div>
  );
}
