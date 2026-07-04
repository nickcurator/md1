import { NextResponse, type NextRequest } from "next/server";
import { createDriveMiddlewareClient } from "@/lib/drive-supabase";
import { API_TOKEN_PREFIX } from "@/lib/api-tokens";
import { isAdminEmail } from "@/lib/admin";

function hasApiToken(request: NextRequest): boolean {
  const auth = request.headers.get("authorization");
  return (
    !!auth?.startsWith("Bearer ") &&
    auth.slice(7).trim().startsWith(API_TOKEN_PREFIX)
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/docs") && hasApiToken(request)) {
    return NextResponse.next();
  }

  if (pathname === "/mcp" && hasApiToken(request)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin")) {
    let response = NextResponse.next({ request });
    const supabase = createDriveMiddlewareClient(request, response);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!isAdminEmail(user?.email)) {
      return new NextResponse("Not found", {
        status: 404,
        headers: { "content-type": "text/plain" },
      });
    }
    return response;
  }

  let response = NextResponse.next({ request });
  const supabase = createDriveMiddlewareClient(request, response);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    if (pathname.startsWith("/api/")) {
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
  matcher: [
    "/",
    "/settings",
    "/mail/:path*",
    "/whats-new",
    "/mcp",
    "/admin/:path*",
    "/api/docs/:path*",
    "/api/mail/:path*",
    "/api/tokens/:path*",
  ],
};
