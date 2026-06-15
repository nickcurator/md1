import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { DriveUser } from "@/lib/drive-users-server";
import {
  createDoc,
  listDocs,
  updateDoc,
} from "@/lib/shared-docs-server";
import { titleFromMarkdown } from "@/lib/shared-docs";
import { findDocForOwner } from "@/lib/mcp/find-doc";
import { docPublicUrl, editorPublicUrl } from "@/lib/mcp/urls";

export function publishFlags(
  share?: boolean,
  isPublished?: boolean,
): { isPublished: boolean; isPublic?: boolean } {
  if (share === true) {
    return { isPublished: true, isPublic: true };
  }
  return { isPublished: isPublished === true };
}

export function shareLines(doc: {
  id: string;
  title: string;
  slug: string;
  isPublished: boolean;
}): string[] {
  const lines = [`Title: ${doc.title}`, `Id: ${doc.id}`];
  if (doc.isPublished) {
    lines.unshift(`Share link: ${docPublicUrl(doc.slug)}`);
  } else {
    lines.push("Not published yet — call md1_share_doc to get a share link.");
  }
  lines.push(`Editor: ${editorPublicUrl()}`);
  return lines;
}

function toolError(message: string): CallToolResult {
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    isError: true,
  };
}

export async function executeMd1Tool(
  user: DriveUser,
  name: string,
  args: Record<string, unknown> | undefined,
): Promise<CallToolResult> {
  const a = args ?? {};

  try {
    if (name === "md1_list_docs") {
      const docs = await listDocs(user.id);
      const summary = docs.map((d) => ({
        id: d.id,
        title: d.title,
        folderId: d.folderId,
        slug: d.slug,
        isPublished: d.isPublished,
        updatedAt: d.updatedAt,
        shareUrl: d.isPublished ? docPublicUrl(d.slug) : null,
        editorUrl: editorPublicUrl(),
      }));
      return {
        content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
      };
    }

    if (name === "md1_get_doc") {
      const query = String(a.query ?? "").trim();
      if (!query) throw new Error("query is required");
      const doc = await findDocForOwner(user.id, query);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                id: doc.id,
                title: doc.title,
                slug: doc.slug,
                folderId: doc.folderId,
                description: doc.description,
                isPublished: doc.isPublished,
                isPublic: doc.isPublic,
                shareUrl: doc.isPublished ? docPublicUrl(doc.slug) : null,
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
      if (!content.trim()) throw new Error("content is required");
      const title =
        (typeof a.title === "string" && a.title.trim()) ||
        titleFromMarkdown(content, "Untitled");
      const flags = publishFlags(
        a.share === true,
        typeof a.isPublished === "boolean" ? a.isPublished : undefined,
      );
      const doc = await createDoc(user.id, {
        title,
        content,
        folderId:
          typeof a.folderId === "string" && a.folderId.trim()
            ? a.folderId.trim()
            : null,
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
      return toolError(
        "md1_create_from_file reads files on your machine — use md1_create_doc with content, or the stdio MCP server (npx md1-mcp).",
      );
    }

    if (name === "md1_share_doc") {
      const query = String(a.query ?? "").trim();
      if (!query) throw new Error("query is required");
      const found = await findDocForOwner(user.id, query);
      const doc = found.isPublished
        ? found
        : await updateDoc(user.id, found.id, {
            isPublished: true,
            isPublic: true,
          });
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
      const doc = await updateDoc(user.id, id, {
        ...(typeof a.title === "string" ? { title: a.title } : {}),
        ...(typeof a.content === "string" ? { content: a.content } : {}),
        ...(typeof a.folderId === "string"
          ? { folderId: a.folderId.trim() || null }
          : {}),
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
    return toolError(message);
  }
}
