import { requireDriveUser } from "@/lib/drive-auth-server";
import { listDocs } from "@/lib/shared-docs-server";
import DriveManager from "./DriveManager";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await requireDriveUser();
  const docs = await listDocs(user.id);
  return (
    <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden">
      <DriveManager initialDocs={docs} user={user} />
    </div>
  );
}
