import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { DriveUser } from "@/lib/drive-users-server";
import { executeMd1Tool } from "@/lib/mcp/execute-tool";
import { MD1_MCP_TOOLS, MCP_SERVER_VERSION } from "@/lib/mcp/tools-schema";

export function createMd1McpServer(user: DriveUser): Server {
  const server = new Server(
    { name: "md1", version: MCP_SERVER_VERSION },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: MD1_MCP_TOOLS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    return executeMd1Tool(
      user,
      name,
      (args ?? {}) as Record<string, unknown>,
    );
  });

  return server;
}
