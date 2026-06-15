#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { buildPreview, readJson } from "./preview-fable-import.mjs";

const IMPORT_SOURCE = "fable";
const MAX_DOC_CONTENT_CHARS = 200_000;
const DEFAULT_LIMIT = 20;

function usage() {
  return `Usage:
  npm run import:fable -- --snapshot /path/to/fable-notes-snapshot.json
  npm run import:fable -- --snapshot /path/to/fable-notes-snapshot.json --owner-email you@example.com --execute --allow-secret-like

Options:
  --snapshot <path>       Required. Snapshot created from Fable notes/folders.
  --owner-email <email>   MD1 Drive user email. Required for --execute/--check-db unless --owner-id is set.
  --owner-id <uuid>       MD1 drive_users.id. Required for --execute/--check-db unless --owner-email is set.
  --execute               Actually write to Supabase. Omit for dry-run.
  --check-db              Read Supabase state in dry-run to show existing imported docs/folders.
  --allow-secret-like     Allow importing notes that match secret-like patterns.
  --skip-secret-like      Exclude secret-like notes from this import.
  --include-deleted       Include notes with deletedAt. Default skips deleted notes.
  --limit <n>             Number of docs to show in human output (default ${DEFAULT_LIMIT}).
  --json                  Print machine-readable JSON summary.
  --no-titles             Hide titles in human output.
  --help                  Show this help.

Default mode is dry-run and performs no writes.`;
}

function parseArgs(argv) {
  const opts = {
    allowSecretLike: false,
    checkDb: false,
    execute: false,
    includeDeleted: false,
    json: false,
    limit: DEFAULT_LIMIT,
    ownerEmail: "",
    ownerId: "",
    showTitles: true,
    skipSecretLike: false,
    snapshot: "",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      opts.help = true;
    } else if (arg === "--snapshot") {
      opts.snapshot = argv[i + 1] ?? "";
      i += 1;
    } else if (arg === "--owner-email") {
      opts.ownerEmail = argv[i + 1] ?? "";
      i += 1;
    } else if (arg === "--owner-id") {
      opts.ownerId = argv[i + 1] ?? "";
      i += 1;
    } else if (arg === "--execute") {
      opts.execute = true;
    } else if (arg === "--check-db") {
      opts.checkDb = true;
    } else if (arg === "--allow-secret-like") {
      opts.allowSecretLike = true;
    } else if (arg === "--skip-secret-like") {
      opts.skipSecretLike = true;
    } else if (arg === "--include-deleted") {
      opts.includeDeleted = true;
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

  if (opts.allowSecretLike && opts.skipSecretLike) {
    throw new Error("--allow-secret-like and --skip-secret-like are mutually exclusive");
  }
  return opts;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}

function loadLocalEnv() {
  loadEnvFile(path.resolve(".env.local"));
  loadEnvFile(path.resolve(".env"));
}

function createSupabaseClient() {
  loadLocalEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing Supabase env: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for --execute/--check-db",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function assertSupabaseOk(result, context) {
  if (result.error) {
    throw new Error(`${context}: ${result.error.message}`);
  }
  return result.data;
}

function sha256(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function noteImportId(note, index) {
  const id = typeof note?.id === "string" && note.id.trim() ? note.id.trim() : "";
  const content = typeof note?.text === "string" ? note.text : "";
  return id ? `${IMPORT_SOURCE}:${id}` : `${IMPORT_SOURCE}:missing-id:${index}:${sha256(content).slice(0, 12)}`;
}

function isDeleted(note) {
  return Boolean(note?.deletedAt);
}

function contentByImportId(snapshot, includeDeleted) {
  const out = new Map();
  const notes = Array.isArray(snapshot.notes) ? snapshot.notes : [];
  const selected = includeDeleted ? notes : notes.filter((note) => !isDeleted(note));
  selected.forEach((note, index) => {
    out.set(noteImportId(note, index), typeof note?.text === "string" ? note.text : "");
  });
  return out;
}

function newSlug() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

function isoOrNow(value) {
  if (typeof value !== "string") return new Date().toISOString();
  const t = Date.parse(value);
  return Number.isFinite(t) ? new Date(t).toISOString() : new Date().toISOString();
}

function makePlan(snapshot, opts) {
  const preview = buildPreview(snapshot, {
    includeDeleted: opts.includeDeleted,
  });
  const contentMap = contentByImportId(snapshot, opts.includeDeleted);
  const blockedSecretLike = preview.docs.filter((doc) => doc.secretLike);
  const oversizedDocs = preview.docs.filter((doc) => doc.contentChars > MAX_DOC_CONTENT_CHARS);
  const skippedSecretLike = opts.skipSecretLike ? blockedSecretLike : [];
  const docs = preview.docs
    .filter((doc) => !(opts.skipSecretLike && doc.secretLike))
    .map((doc) => ({
      ...doc,
      content: contentMap.get(doc.importId) ?? "",
    }));
  const folderNames = [...new Set(docs.map((doc) => doc.folder))].sort((a, b) => a.localeCompare(b));

  return {
    blockedSecretLike,
    docs,
    folderNames,
    oversizedDocs,
    preview,
    skippedSecretLike,
  };
}

async function resolveOwner(db, opts) {
  if (opts.ownerId) {
    return { id: opts.ownerId, email: opts.ownerEmail || null };
  }
  if (!opts.ownerEmail) {
    throw new Error("--owner-email or --owner-id is required for --execute/--check-db");
  }
  const result = await db
    .from("drive_users")
    .select("id,email")
    .ilike("email", opts.ownerEmail.trim())
    .limit(2);
  const users = assertSupabaseOk(result, "resolve owner");
  if (!users?.length) throw new Error(`No MD1 drive user found for ${opts.ownerEmail}`);
  if (users.length > 1) throw new Error(`Multiple MD1 drive users matched ${opts.ownerEmail}`);
  return users[0];
}

async function fetchDbState(db, ownerId) {
  const folders = assertSupabaseOk(
    await db.from("drive_folders").select("id,name").eq("owner_id", ownerId),
    "fetch folders; has migration 031_drive_folders.sql been applied?",
  );
  const importedDocs = assertSupabaseOk(
    await db
      .from("shared_docs")
      .select("id,title,import_id,folder_id")
      .eq("owner_id", ownerId)
      .eq("import_source", IMPORT_SOURCE),
    "fetch imported docs; has migration 032_shared_docs_import_identity.sql been applied?",
  );
  return {
    folderByName: new Map((folders ?? []).map((folder) => [folder.name, folder])),
    importedDocByImportId: new Map((importedDocs ?? []).map((doc) => [doc.import_id, doc])),
  };
}

async function createFolder(db, ownerId, name) {
  const inserted = await db
    .from("drive_folders")
    .insert({
      owner_id: ownerId,
      name,
    })
    .select("id,name")
    .single();
  if (!inserted.error) return inserted.data;
  if (inserted.error.code !== "23505") {
    throw new Error(`create folder "${name}": ${inserted.error.message}`);
  }
  const existing = assertSupabaseOk(
    await db
      .from("drive_folders")
      .select("id,name")
      .eq("owner_id", ownerId)
      .eq("name", name)
      .single(),
    `load existing folder "${name}"`,
  );
  return existing;
}

async function insertDoc(db, ownerId, folderId, doc) {
  const now = new Date().toISOString();
  const createdAt = doc.createdAt ? isoOrNow(doc.createdAt) : now;
  const updatedAt = doc.updatedAt ? isoOrNow(doc.updatedAt) : createdAt;
  const result = await db
    .from("shared_docs")
    .insert({
      owner_id: ownerId,
      folder_id: folderId,
      slug: newSlug(),
      title: doc.title,
      description: "",
      content: doc.content,
      is_published: false,
      is_public: false,
      comments: [],
      import_source: IMPORT_SOURCE,
      import_id: doc.importId,
      created_at: createdAt,
      updated_at: updatedAt,
    })
    .select("id,title,import_id,folder_id")
    .single();
  if (!result.error) return { inserted: result.data, skippedExisting: null };
  if (result.error.code !== "23505") {
    throw new Error(`insert doc ${doc.importId}: ${result.error.message}`);
  }
  const existing = assertSupabaseOk(
    await db
      .from("shared_docs")
      .select("id,title,import_id,folder_id")
      .eq("owner_id", ownerId)
      .eq("import_source", IMPORT_SOURCE)
      .eq("import_id", doc.importId)
      .single(),
    `load existing doc ${doc.importId}`,
  );
  return { inserted: null, skippedExisting: existing };
}

function buildSummary(plan, dbState, opts, owner) {
  const existingFolders = dbState ? plan.folderNames.filter((name) => dbState.folderByName.has(name)) : [];
  const missingFolders = dbState ? plan.folderNames.filter((name) => !dbState.folderByName.has(name)) : plan.folderNames;
  const existingDocs = dbState
    ? plan.docs.filter((doc) => dbState.importedDocByImportId.has(doc.importId))
    : [];
  const missingDocs = dbState
    ? plan.docs.filter((doc) => !dbState.importedDocByImportId.has(doc.importId))
    : plan.docs;
  return {
    dbChecked: Boolean(dbState),
    mode: opts.execute ? "execute" : "dry-run",
    owner: owner ? { id: owner.id, email: owner.email ?? opts.ownerEmail ?? null } : null,
    readOnly: !opts.execute,
    source: IMPORT_SOURCE,
    totals: {
      docsInSnapshotPlan: plan.preview.totals.plannedDocs,
      docsSelectedForImport: plan.docs.length,
      foldersSelectedForImport: plan.folderNames.length,
      existingImportedDocs: dbState ? existingDocs.length : null,
      existingFolders: dbState ? existingFolders.length : null,
      oversizedDocs: plan.oversizedDocs.length,
      secretLikeDocs: plan.blockedSecretLike.length,
      skippedSecretLike: plan.skippedSecretLike.length,
      wouldCreateDocs: missingDocs.length,
      wouldCreateFolders: missingFolders.length,
    },
    folders: plan.folderNames.map((name) => ({
      name,
      exists: dbState ? dbState.folderByName.has(name) : null,
    })),
    docs: plan.docs.map((doc) => ({
      contentChars: doc.contentChars,
      exists: dbState ? dbState.importedDocByImportId.has(doc.importId) : null,
      folder: doc.folder,
      importId: doc.importId,
      noteId: doc.noteId,
      secretLike: doc.secretLike,
      title: doc.title,
    })),
  };
}

async function executeImport(db, ownerId, plan, dbState) {
  const folderByName = new Map(dbState.folderByName);
  const importedDocByImportId = new Map(dbState.importedDocByImportId);
  const createdFolders = [];
  const createdDocs = [];
  const skippedDocs = [];

  for (const name of plan.folderNames) {
    if (folderByName.has(name)) continue;
    const folder = await createFolder(db, ownerId, name);
    folderByName.set(name, folder);
    createdFolders.push(folder);
  }

  for (const doc of plan.docs) {
    const existing = importedDocByImportId.get(doc.importId);
    if (existing) {
      skippedDocs.push(existing);
      continue;
    }
    const folder = folderByName.get(doc.folder);
    if (!folder) throw new Error(`Folder missing after creation: ${doc.folder}`);
    const result = await insertDoc(db, ownerId, folder.id, doc);
    if (result.inserted) {
      importedDocByImportId.set(doc.importId, result.inserted);
      createdDocs.push(result.inserted);
    } else if (result.skippedExisting) {
      importedDocByImportId.set(doc.importId, result.skippedExisting);
      skippedDocs.push(result.skippedExisting);
    }
  }

  return {
    createdDocs,
    createdFolders,
    skippedDocs,
  };
}

function printHuman(summary, opts, execution = null) {
  const out = [];
  out.push(`Fable import ${summary.mode === "execute" ? "execute" : "dry-run"}`);
  out.push(`Source: ${summary.source}`);
  if (summary.owner) {
    out.push(`Owner: ${summary.owner.email ?? "unknown"} (${summary.owner.id})`);
  }
  out.push("");
  out.push("Totals");
  out.push(`  DB checked:            ${summary.dbChecked ? "yes" : "no"}`);
  out.push(`  Snapshot planned docs:  ${summary.totals.docsInSnapshotPlan}`);
  out.push(`  Selected docs:          ${summary.totals.docsSelectedForImport}`);
  out.push(`  Selected folders:       ${summary.totals.foldersSelectedForImport}`);
  out.push(`  Secret-like docs:       ${summary.totals.secretLikeDocs}`);
  out.push(`  Secret-like skipped:    ${summary.totals.skippedSecretLike}`);
  out.push(`  Oversized docs:         ${summary.totals.oversizedDocs}`);
  out.push(`  Existing folders:       ${summary.totals.existingFolders ?? "not checked"}`);
  out.push(`  Existing imported docs: ${summary.totals.existingImportedDocs ?? "not checked"}`);
  out.push(
    `  Would create folders:   ${summary.dbChecked ? summary.totals.wouldCreateFolders : `up to ${summary.totals.wouldCreateFolders}`}`,
  );
  out.push(
    `  Would create docs:      ${summary.dbChecked ? summary.totals.wouldCreateDocs : `up to ${summary.totals.wouldCreateDocs}`}`,
  );

  if (execution) {
    out.push("");
    out.push("Executed");
    out.push(`  Created folders: ${execution.createdFolders.length}`);
    out.push(`  Created docs:    ${execution.createdDocs.length}`);
    out.push(`  Skipped docs:    ${execution.skippedDocs.length}`);
  }

  const visibleDocs = summary.docs.slice(0, opts.limit);
  if (visibleDocs.length) {
    out.push("");
    out.push(`Docs (showing ${visibleDocs.length} of ${summary.docs.length})`);
    for (const doc of visibleDocs) {
      const title = opts.showTitles ? ` | title="${doc.title}"` : "";
      const exists = doc.exists === null ? "" : doc.exists ? " | exists" : " | new";
      const secret = doc.secretLike ? " | secret-like" : "";
      out.push(`  [${doc.folder}]${title} | id=${doc.importId} | chars=${doc.contentChars}${exists}${secret}`);
    }
  }

  out.push("");
  out.push(summary.mode === "execute" ? "Writes completed." : "No writes performed.");
  console.log(out.join("\n"));
}

async function main() {
  try {
    const opts = parseArgs(process.argv.slice(2));
    if (opts.help) {
      console.log(usage());
      return;
    }
    if (!opts.snapshot) throw new Error("--snapshot is required");
    if ((opts.execute || opts.checkDb) && !opts.ownerEmail && !opts.ownerId) {
      throw new Error("--owner-email or --owner-id is required for --execute/--check-db");
    }

    const snapshot = readJson(path.resolve(opts.snapshot));
    const plan = makePlan(snapshot, opts);

    if (plan.oversizedDocs.length) {
      throw new Error(`${plan.oversizedDocs.length} docs exceed ${MAX_DOC_CONTENT_CHARS} characters`);
    }
    if (opts.execute && plan.blockedSecretLike.length && !opts.allowSecretLike && !opts.skipSecretLike) {
      throw new Error(
        `${plan.blockedSecretLike.length} secret-like docs found. Re-run with --allow-secret-like or --skip-secret-like.`,
      );
    }

    let db = null;
    let owner = null;
    let dbState = null;
    if (opts.execute || opts.checkDb) {
      db = createSupabaseClient();
      owner = await resolveOwner(db, opts);
      dbState = await fetchDbState(db, owner.id);
    }

    const summary = buildSummary(plan, dbState, opts, owner);
    let execution = null;
    if (opts.execute) {
      execution = await executeImport(db, owner.id, plan, dbState);
      summary.totals.existingFolders =
        (summary.totals.existingFolders ?? 0) + execution.createdFolders.length;
      summary.totals.existingImportedDocs =
        (summary.totals.existingImportedDocs ?? 0) + execution.createdDocs.length;
      summary.totals.wouldCreateFolders = 0;
      summary.totals.wouldCreateDocs = 0;
    }

    if (opts.json) {
      console.log(JSON.stringify({ ...summary, execution }, null, 2));
    } else {
      printHuman(summary, opts, execution);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error("");
    console.error(usage());
    process.exitCode = 1;
  }
}

await main();
