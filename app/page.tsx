import { requireDriveUser } from "@/lib/drive-auth-server";
import { isAdminEmail } from "@/lib/admin";
import { listDocs, listFolders } from "@/lib/shared-docs-server";
import DriveManager from "./DriveManager";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await requireDriveUser();
  const [docs, folders] = await Promise.all([
    listDocs(user.id),
    listFolders(user.id),
  ]);
  return (
    <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden">
      <DriveManager
        initialDocs={docs}
        initialFolders={folders}
        user={user}
        isAdmin={isAdminEmail(user.email)}
      />
    </div>
  );
}
