import { NextResponse, type NextRequest } from "next/server";
import {
  applyCookiesToResponse,
  createDriveRouteClient,
} from "@/lib/drive-supabase";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;
  const response = NextResponse.redirect(new URL("/login", origin));
  const supabase = createDriveRouteClient(request, (cookies) => {
    applyCookiesToResponse(response, cookies);
  });
  await supabase.auth.signOut();
  return response;
}
