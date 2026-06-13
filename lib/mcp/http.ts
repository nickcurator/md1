import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { getDriveUserFromRequest } from "@/lib/drive-auth-server";
import { createMd1McpServer } from "@/lib/mcp/server";

const MCP_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, Accept, MCP-Protocol-Version, mcp-session-id, Last-Event-ID",
};

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(MCP_CORS_HEADERS)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function unauthorized(): Response {
  return withCors(
    new Response("Not found", {
      status: 404,
      headers: { "content-type": "text/plain" },
    }),
  );
}

export async function handleHostedMcpRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: MCP_CORS_HEADERS });
  }

  const user = await getDriveUserFromRequest(req);
  if (!user) return unauthorized();

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  const server = createMd1McpServer(user);
  await server.connect(transport);

  try {
    return withCors(await transport.handleRequest(req));
  } finally {
    await transport.close();
    await server.close();
  }
}
