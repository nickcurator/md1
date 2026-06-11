import { NextResponse, type NextRequest } from "next/server";
import { createDriveMiddlewareClient } from "@/lib/drive-supabase";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  let response = NextResponse.next({ request });
  const supabase = createDriveMiddlewareClient(request, response);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    if (pathname.startsWith("/api/docs")) {
      return new NextResponse("Not found", {
        status: 404,
        headers: { "content-type": "text/plain" },
      });
    }
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  return response;
}

export const config = {
  matcher: ["/", "/api/docs/:path*"],
};
