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
  findDoc,
  listDocs,
  publishFlags,
  shareDoc,
  shareLines,
  titleFromMarkdown,
  updateDoc,
} from "./md1-client.js";

const server = new Server(
  { name: "md1", version: "1.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
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
            description: "Publish to a public /d/slug link (use share=true instead for the usual flow)",
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
        shareUrl: d.isPublished ? docUrl(d.slug) : null,
        editorUrl: editorUrl(),
      }));
      return {
        content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
      };
    }

    if (name === "md1_get_doc") {
      const query = String(a.query ?? "").trim();
      if (!query) throw new Error("query is required");
      const doc = await findDoc(query);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                id: doc.id,
                title: doc.title,
                slug: doc.slug,
                description: doc.description,
                isPublished: doc.isPublished,
                isPublic: doc.isPublic,
                shareUrl: doc.isPublished ? docUrl(doc.slug) : null,
                updatedAt: doc.updatedAt,
                content: doc.content,
              },
              null,
              2,
            ),
          },
        ],
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
      const flags = publishFlags(
        a.share === true,
        typeof a.isPublished === "boolean" ? a.isPublished : undefined,
      );
      const doc = await createDoc({
        title,
        content,
        description:
          typeof a.description === "string" ? a.description : undefined,
        ...flags,
      });
      const prefix = doc.isPublished ? "Created and shared" : "Created note";
      return {
        content: [
          {
            type: "text",
            text: [`${prefix} "${doc.title}"`, ...shareLines(doc)].join("\n"),
          },
        ],
      };
    }

    if (name === "md1_create_from_file") {
      const path = String(a.path ?? "").trim();
      if (!path) throw new Error("path is required");
      const content = await readFile(path, "utf8");
      const fallback = basename(path).replace(/\.(md|markdown|txt)$/i, "");
      const title =
        (typeof a.title === "string" && a.title.trim()) ||
        titleFromMarkdown(content, fallback || "Untitled");
      const flags = publishFlags(
        a.share === true,
        typeof a.isPublished === "boolean" ? a.isPublished : undefined,
      );
      const doc = await createDoc({
        title,
        content,
        ...flags,
      });
      const prefix = doc.isPublished ? "Imported and shared" : "Imported";
      return {
        content: [
          {
            type: "text",
            text: [
              `${prefix} ${path} → "${doc.title}"`,
              ...shareLines(doc),
            ].join("\n"),
          },
        ],
      };
    }

    if (name === "md1_share_doc") {
      const query = String(a.query ?? "").trim();
      if (!query) throw new Error("query is required");
      const found = await findDoc(query);
      const doc = found.isPublished
        ? found
        : await shareDoc(found.id);
      return {
        content: [
          {
            type: "text",
            text: [`Shared "${doc.title}"`, ...shareLines(doc)].join("\n"),
          },
        ],
      };
    }

    if (name === "md1_update_doc") {
      const id = String(a.id ?? "").trim();
      if (!id) throw new Error("id is required");
      const share = a.share === true;
      const doc = await updateDoc(id, {
        ...(typeof a.title === "string" ? { title: a.title } : {}),
        ...(typeof a.content === "string" ? { content: a.content } : {}),
        ...(share
          ? { isPublished: true, isPublic: true }
          : typeof a.isPublished === "boolean"
            ? { isPublished: a.isPublished }
            : {}),
      });
      return {
        content: [
          {
            type: "text",
            text: [`Updated "${doc.title}"`, ...shareLines(doc)].join("\n"),
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
