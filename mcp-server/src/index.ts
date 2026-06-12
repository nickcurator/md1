#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  createDoc,
  docUrl,
  editorUrl,
  listDocs,
  titleFromMarkdown,
  updateDoc,
} from "./md1-client.js";

const server = new Server(
  { name: "md1", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "md1_list_docs",
      description:
        "List markdown notes in md1. Returns id, title, slug, and short metadata.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "md1_create_doc",
      description:
        "Create a new markdown note in md1. Title defaults from first # heading or 'Untitled'.",
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
          isPublished: {
            type: "boolean",
            description: "Publish to a public /d/slug link",
          },
        },
        required: ["content"],
      },
    },
    {
      name: "md1_create_from_file",
      description:
        "Read a local markdown/text file and create a note in md1. Use when the user says 'send to md1' or 'отправь в md1' for a file path.",
      inputSchema: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Absolute or workspace-relative path to .md or .txt",
          },
          title: { type: "string" },
          isPublished: { type: "boolean" },
        },
        required: ["path"],
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
          isPublished: { type: "boolean" },
        },
        required: ["id"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;
    const a = (args ?? {}) as Record<string, unknown>;

    if (name === "md1_list_docs") {
      const docs = await listDocs();
      const summary = docs.map((d) => ({
        id: d.id,
        title: d.title,
        slug: d.slug,
        isPublished: d.isPublished,
        updatedAt: d.updatedAt,
        url: d.isPublished ? docUrl(d.slug) : editorUrl(),
      }));
      return {
        content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
      };
    }

    if (name === "md1_create_doc") {
      const content = String(a.content ?? "");
      if (!content.trim()) {
        throw new Error("content is required");
      }
      const title =
        (typeof a.title === "string" && a.title.trim()) ||
        titleFromMarkdown(content, "Untitled");
      const doc = await createDoc({
        title,
        content,
        description:
          typeof a.description === "string" ? a.description : undefined,
        isPublished: a.isPublished === true,
      });
      const lines = [
        `Created note "${doc.title}"`,
        `Editor: ${editorUrl()}`,
        doc.isPublished ? `Public: ${docUrl(doc.slug)}` : `Id: ${doc.id}`,
      ];
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }

    if (name === "md1_create_from_file") {
      const path = String(a.path ?? "").trim();
      if (!path) throw new Error("path is required");
      const content = await readFile(path, "utf8");
      const fallback = basename(path).replace(/\.(md|markdown|txt)$/i, "");
      const title =
        (typeof a.title === "string" && a.title.trim()) ||
        titleFromMarkdown(content, fallback || "Untitled");
      const doc = await createDoc({
        title,
        content,
        isPublished: a.isPublished === true,
      });
      const lines = [
        `Imported ${path} → "${doc.title}"`,
        `Editor: ${editorUrl()}`,
        doc.isPublished ? `Public: ${docUrl(doc.slug)}` : `Id: ${doc.id}`,
      ];
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }

    if (name === "md1_update_doc") {
      const id = String(a.id ?? "").trim();
      if (!id) throw new Error("id is required");
      const doc = await updateDoc(id, {
        ...(typeof a.title === "string" ? { title: a.title } : {}),
        ...(typeof a.content === "string" ? { content: a.content } : {}),
        ...(typeof a.isPublished === "boolean"
          ? { isPublished: a.isPublished }
          : {}),
      });
      return {
        content: [
          {
            type: "text",
            text: `Updated "${doc.title}" (${doc.id})`,
          },
        ],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
