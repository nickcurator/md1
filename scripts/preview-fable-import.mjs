#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const DEFAULT_LIMIT = 20;

function usage() {
  return `Usage:
  npm run import:fable:preview -- --snapshot /path/to/fable-notes-snapshot.json

Options:
  --snapshot <path>     Required. Snapshot created from Fable notes/folders.
  --include-deleted     Include notes with deletedAt in the preview.
  --all                 Print every planned doc in human output.
  --limit <n>           Number of planned docs to show (default ${DEFAULT_LIMIT}).
  --json                Print machine-readable JSON summary.
  --no-titles           Hide titles in human output.
  --help                Show this help.

This command is read-only. It does not write to MD1, Supabase, or Fable.`;
}

function parseArgs(argv) {
  const opts = {
    all: false,
    includeDeleted: false,
    json: false,
    limit: DEFAULT_LIMIT,
    showTitles: true,
    snapshot: "",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      opts.help = true;
    } else if (arg === "--snapshot") {
      opts.snapshot = argv[i + 1] ?? "";
      i += 1;
    } else if (arg === "--include-deleted") {
      opts.includeDeleted = true;
    } else if (arg === "--all") {
      opts.all = true;
    } else if (arg === "--json") {
      opts.json = true;
    } else if (arg === "--no-titles") {
      opts.showTitles = false;
    } else if (arg === "--limit") {
      const n = Number.parseInt(argv[i + 1] ?? "", 10);
      if (!Number.isFinite(n) || n < 0) throw new Error("--limit must be >= 0");
      opts.limit = n;
      i += 1;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return opts;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sha256(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function firstNonEmptyLine(content) {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
}

function titleFromMarkdown(content, fallback) {
  for (const line of content.split(/\r?\n/)) {
    const h1 = /^#\s+(.+?)\s*$/.exec(line);
    if (h1?.[1]) return compactTitle(h1[1]);
    if (line.trim()) break;
  }
  const first = firstNonEmptyLine(content);
  return compactTitle(first || fallback || "Untitled");
}

function compactTitle(raw) {
  const stripped = String(raw)
    .replace(/^[-*+]\s+/, "")
    .replace(/^#+\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.slice(0, 120) || "Untitled";
}

function normalizeFolder(raw) {
  const folder = typeof raw === "string" ? raw.trim() : "";
  return folder || "Other";
}

function isDeleted(note) {
  return Boolean(note?.deletedAt);
}

function secretLike(content) {
  return /\b(sk-[A-Za-z0-9_-]{20,}|api[_ -]?key|token|password|secret|client[_ -]?secret|BEGIN (RSA |OPENSSH |EC |DSA )?PRIVATE KEY)\b/i.test(
    content,
  );
}

function countBy(items, getKey) {
  const out = new Map();
  for (const item of items) {
    const key = getKey(item);
    out.set(key, (out.get(key) ?? 0) + 1);
  }
  return out;
}

function sortByFolderAndTitle(a, b) {
  const folder = a.folder.localeCompare(b.folder);
  if (folder !== 0) return folder;
  return a.title.localeCompare(b.title);
}

function buildPreview(snapshot, opts) {
  const notes = Array.isArray(snapshot.notes) ? snapshot.notes : [];
  const settings =
    snapshot.notesFolderSettings && typeof snapshot.notesFolderSettings === "object"
      ? snapshot.notesFolderSettings
      : {};
  const hiddenFolders = Array.isArray(settings.hiddenFolders)
    ? settings.hiddenFolders.filter((f) => typeof f === "string")
    : [];
  const customFolders = Array.isArray(settings.customFolders)
    ? settings.customFolders.filter((f) => typeof f === "string")
    : [];

  const skippedDeleted = notes.filter(isDeleted).length;
  const selectedNotes = opts.includeDeleted ? notes : notes.filter((note) => !isDeleted(note));

  const docs = selectedNotes.map((note, index) => {
    const id = typeof note?.id === "string" && note.id.trim() ? note.id.trim() : "";
    const content = typeof note?.text === "string" ? note.text : "";
    const folder = normalizeFolder(note?.folder);
    return {
      contentChars: content.length,
      contentSha256: sha256(content),
      createdAt: typeof note?.createdAt === "string" ? note.createdAt : null,
      deletedAt: typeof note?.deletedAt === "string" ? note.deletedAt : null,
      done: note?.done === true,
      dueDate: typeof note?.dueDate === "string" ? note.dueDate : null,
      empty: content.trim().length === 0,
      folder,
      importId: id ? `fable:${id}` : `fable:missing-id:${index}:${sha256(content).slice(0, 12)}`,
      noteId: id || null,
      pinned: note?.pinned === true,
      secretLike: secretLike(content),
      tags: Array.isArray(note?.tags) ? note.tags.filter((t) => typeof t === "string") : [],
      title: titleFromMarkdown(content, id ? `Fable note ${id.slice(0, 8)}` : `Fable note ${index + 1}`),
      updatedAt: typeof note?.updatedAt === "string" ? note.updatedAt : null,
    };
  });

  docs.sort(sortByFolderAndTitle);

  const folderNames = [...new Set([...customFolders.map(normalizeFolder), ...docs.map((d) => d.folder)])]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  const docCountByFolder = countBy(docs, (doc) => doc.folder);
  const duplicateIds = [...countBy(docs.filter((d) => d.noteId), (doc) => doc.noteId).entries()]
    .filter(([, count]) => count > 1)
    .map(([id, count]) => ({ id, count }));
  const duplicateTitles = [
    ...countBy(docs, (doc) => `${doc.folder}\u0000${doc.title.toLowerCase()}`).entries(),
  ]
    .filter(([, count]) => count > 1)
    .map(([key, count]) => {
      const [folder, title] = key.split("\u0000");
      return { folder, title, count };
    });

  const hiddenFoldersWithDocs = hiddenFolders
    .map(normalizeFolder)
    .filter((folder) => (docCountByFolder.get(folder) ?? 0) > 0)
    .sort((a, b) => a.localeCompare(b));
  const hiddenFoldersWithoutDocs = hiddenFolders
    .map(normalizeFolder)
    .filter((folder) => (docCountByFolder.get(folder) ?? 0) === 0)
    .sort((a, b) => a.localeCompare(b));

  return {
    command: "preview-fable-import",
    generatedAt: new Date().toISOString(),
    readOnly: true,
    snapshot: {
      checksum: snapshot.checksum ?? null,
      createdAt: snapshot.createdAt ?? null,
      kind: snapshot.kind ?? null,
      source: snapshot.source ?? null,
    },
    options: {
      includeDeleted: opts.includeDeleted,
    },
    totals: {
      notesInSnapshot: notes.length,
      plannedDocs: docs.length,
      skippedDeleted: opts.includeDeleted ? 0 : skippedDeleted,
      targetFolders: folderNames.length,
    },
    folders: folderNames.map((name) => ({
      name,
      plannedDocs: docCountByFolder.get(name) ?? 0,
      icon: settings.icons && typeof settings.icons === "object" ? settings.icons[name] ?? null : null,
    })),
    checks: {
      duplicateIds,
      duplicateTitles,
      emptyDocs: docs.filter((d) => d.empty).length,
      missingIds: docs.filter((d) => !d.noteId).length,
      secretLikeDocs: docs.filter((d) => d.secretLike).length,
      hiddenFoldersWithDocs,
      hiddenFoldersWithoutDocs,
    },
    docs,
  };
}

function printHuman(preview, opts) {
  const out = [];
  out.push("Fable import preview");
  out.push(`Snapshot: ${preview.snapshot.createdAt ?? "unknown"} (${preview.snapshot.kind ?? "unknown"})`);
  if (preview.snapshot.checksum) out.push(`Checksum: ${preview.snapshot.checksum}`);
  out.push("");
  out.push("Totals");
  out.push(`  Notes in snapshot: ${preview.totals.notesInSnapshot}`);
  out.push(`  Planned MD1 docs:  ${preview.totals.plannedDocs}`);
  out.push(`  Deleted skipped:    ${preview.totals.skippedDeleted}`);
  out.push(`  Target folders:     ${preview.totals.targetFolders}`);
  out.push("");
  out.push("Folders");
  for (const folder of preview.folders) {
    out.push(`  ${folder.name}: ${folder.plannedDocs}`);
  }
  out.push("");
  out.push("Checks");
  out.push(`  Missing note ids:       ${preview.checks.missingIds}`);
  out.push(`  Empty docs:             ${preview.checks.emptyDocs}`);
  out.push(`  Duplicate note ids:     ${preview.checks.duplicateIds.length}`);
  out.push(`  Duplicate titles:       ${preview.checks.duplicateTitles.length}`);
  out.push(`  Secret-like docs:       ${preview.checks.secretLikeDocs}`);
  if (preview.checks.hiddenFoldersWithDocs.length) {
    out.push(`  Hidden folders with docs: ${preview.checks.hiddenFoldersWithDocs.join(", ")}`);
  }
  if (preview.checks.hiddenFoldersWithoutDocs.length) {
    out.push(`  Hidden folders without docs: ${preview.checks.hiddenFoldersWithoutDocs.join(", ")}`);
  }

  const visibleDocs = opts.all ? preview.docs : preview.docs.slice(0, opts.limit);
  if (visibleDocs.length) {
    out.push("");
    out.push(`Planned docs${opts.all ? "" : ` (showing ${visibleDocs.length} of ${preview.docs.length})`}`);
    for (const doc of visibleDocs) {
      const title = opts.showTitles ? ` | title="${doc.title}"` : "";
      const flags = [
        doc.pinned ? "pinned" : "",
        doc.done ? "done" : "",
        doc.secretLike ? "secret-like" : "",
      ].filter(Boolean);
      out.push(
        `  [${doc.folder}]${title} | chars=${doc.contentChars} | id=${doc.noteId ?? "missing"}${
          flags.length ? ` | ${flags.join(",")}` : ""
        }`,
      );
    }
  }

  out.push("");
  out.push("No writes performed.");
  console.log(out.join("\n"));
}

function main() {
  try {
    const opts = parseArgs(process.argv.slice(2));
    if (opts.help) {
      console.log(usage());
      return;
    }
    if (!opts.snapshot) throw new Error("--snapshot is required");

    const snapshotPath = path.resolve(opts.snapshot);
    const snapshot = readJson(snapshotPath);
    const preview = buildPreview(snapshot, opts);
    preview.snapshot.path = snapshotPath;

    if (opts.json) {
      console.log(JSON.stringify(preview, null, 2));
    } else {
      printHuman(preview, opts);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error("");
    console.error(usage());
    process.exitCode = 1;
  }
}

main();
