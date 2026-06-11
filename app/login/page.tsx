import { redirect } from "next/navigation";
import { getDriveUser } from "@/lib/drive-auth-server";
import { safeAppPath } from "@/lib/app-path";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const user = await getDriveUser();
  if (user) redirect("/");

  const { next, error } = await searchParams;
  const nextPath = safeAppPath(next) ?? undefined;

  return (
    <div className="flex min-h-[100dvh] flex-col overflow-hidden px-6">
      <LoginForm nextPath={nextPath} error={error} />
    </div>
  );
}
