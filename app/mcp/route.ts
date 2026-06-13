import { handleHostedMcpRequest } from "@/lib/mcp/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handler(req: Request): Promise<Response> {
  return handleHostedMcpRequest(req);
}

export { handler as GET, handler as POST, handler as DELETE, handler as OPTIONS };
