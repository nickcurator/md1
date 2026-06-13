import type { Tool } from "@modelcontextprotocol/sdk/types.js";

export const MCP_SERVER_VERSION = "1.2.0";

export const MD1_MCP_TOOLS: Tool[] = [
  {
    name: "md1_list_docs",
    description:
      "List markdown notes in md1. Returns id, title, slug, publish state, and share URL when published.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "md1_get_doc",
    description:
      "Read a note by id, slug, or partial title match. Use to inspect content before sharing.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Note id, slug, or part of the title",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "md1_create_doc",
    description:
      "Create a markdown note in md1. Set share=true to publish immediately and get a public /d/slug link.",
    inputSchema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "Full markdown body",
        },
        title: {
          type: "string",
          description: "Optional title (overrides # heading inference)",
        },
        description: { type: "string" },
        share: {
          type: "boolean",
          description:
            "Publish immediately and return a shareable /d/slug link (recommended for chat handoff)",
        },
        isPublished: {
          type: "boolean",
          description:
            "Publish to a public /d/slug link (use share=true instead for the usual flow)",
        },
      },
      required: ["content"],
    },
  },
  {
    name: "md1_create_from_file",
    description:
      "Read a local markdown/text file and create a note (stdio MCP only — not on hosted /mcp).",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Absolute or workspace-relative path to .md or .txt",
        },
        title: { type: "string" },
        share: {
          type: "boolean",
          description: "Publish immediately and return a shareable /d/slug link",
        },
        isPublished: { type: "boolean" },
      },
      required: ["path"],
    },
  },
  {
    name: "md1_share_doc",
    description:
      "Publish an existing note and return its public share link. Accepts id, slug, or partial title.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Note id, slug, or part of the title",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "md1_update_doc",
    description: "Update an existing md1 note by id.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        content: { type: "string" },
        share: {
          type: "boolean",
          description: "Publish and make the note publicly viewable at /d/slug",
        },
        isPublished: { type: "boolean" },
      },
      required: ["id"],
    },
  },
];
