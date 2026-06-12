import type { Metadata, Viewport } from "next";
import { getDriveUser } from "@/lib/drive-auth-server";
import AppProviders from "./AppProviders";
import DriveFeedbackWidget from "./DriveFeedbackWidget";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0f0f" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://md1.space",
  ),
  title: { default: "md1", template: "%s · md1" },
  description: "Your markdown space.",
  robots: { index: false, follow: false },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getDriveUser();
  const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
    : null;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {supabaseOrigin && (
          <>
            <link rel="preconnect" href={supabaseOrigin} crossOrigin="" />
            <link rel="dns-prefetch" href={supabaseOrigin} />
          </>
        )}
        <script
          dangerouslySetInnerHTML={{
            __html: `
          (function(){
            var t = localStorage.getItem('grip.theme');
            if (t === 'dark' || t === 'light') document.documentElement.classList.add(t);
          })();
        `,
          }}
        />
      </head>
      <body className="bg-[var(--bg)] text-[var(--fg)] antialiased">
        <AppProviders loggedIn={!!user}>
          {children}
        </AppProviders>
        {user && (
          <DriveFeedbackWidget email={user.email} userId={user.id} />
        )}
      </body>
    </html>
  );
}
