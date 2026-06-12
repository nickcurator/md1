"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DriveUser } from "@/lib/drive-users-server";
import { shareDocPath, type DocComment, type SharedDoc } from "@/lib/shared-docs";
import ThemeToggle from "@/components/ThemeToggle";
import DriveDeleteDialog from "./DriveDeleteDialog";
import DriveEditor from "./DriveEditor";
import DriveSidebar from "./DriveSidebar";
import { analytics } from "@/lib/analytics";
import { readMarkdownFiles, titleFromFile } from "./drive-files";
import type { DriveEditorLiveReaders } from "./drive-editor-live";

type Form = {
  title: string;
  description: string;
  content: string;
  comments: DocComment[];
  isPublished: boolean;
  isPublic: boolean;
};

const EMPTY_FORM: Form = {
  title: "",
  description: "",
  content: "",
  comments: [],
  isPublished: false,
  isPublic: false,
};

const AUTOSAVE_MS = 1200;

function snapshot(id: string, form: Form): string {
  return JSON.stringify({ id, ...form });
}

export default function DriveManager({
  initialDocs,
  user,
  isAdmin = false,
}: {
  initialDocs: SharedDoc[];
  user: DriveUser;
  isAdmin?: boolean;
}) {
  const [docs, setDocs] = useState<SharedDoc[]>(initialDocs);
  const [editingId, setEditingId] = useState<string | null>(
    initialDocs[0]?.id ?? null,
  );
  const [form, setForm] = useState<Form>(() =>
    initialDocs[0]
      ? {
          title: initialDocs[0].title,
          description: initialDocs[0].description,
          content: initialDocs[0].content,
          comments: initialDocs[0].comments,
          isPublished: initialDocs[0].isPublished,
          isPublic: initialDocs[0].isPublic,
        }
      : EMPTY_FORM,
  );
  const [showPreview, setShowPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SharedDoc | null>(null);
  const dragDepth = useRef(0);
  const formRef = useRef(form);
  const editingIdRef = useRef(editingId);
  const lastSavedRef = useRef(
    initialDocs[0] ? snapshot(initialDocs[0].id, form) : "",
  );
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedFadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  const flushSaveRef = useRef<() => Promise<boolean>>(async () => true);
  const liveReadersRef = useRef<DriveEditorLiveReaders | null>(null);

  editingIdRef.current = editingId;

  const readLiveForm = useCallback((): Form => {
    const base = formRef.current;
    const content = liveReadersRef.current?.getContent();
    const title = liveReadersRef.current?.getTitle();
    return {
      ...base,
      content: content ?? base.content,
      title: title ?? base.title,
    };
  }, []);

  const selectedDoc =
    editingId !== null ? docs.find((d) => d.id === editingId) : undefined;

  const applySavedDoc = useCallback((saved: SharedDoc) => {
    setDocs((prev) => {
      const without = prev.filter((d) => d.id !== saved.id);
      return [saved, ...without];
    });
  }, []);

  const persist = useCallback(
    async (id: string, payload: Form): Promise<SharedDoc> => {
      const res = await fetch(`/api/docs/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { doc?: SharedDoc; error?: string };
      if (!res.ok || !data.doc) {
        throw new Error(data.error || `Save failed (${res.status})`);
      }
      return data.doc;
    },
    [],
  );

  const markSaved = useCallback(() => {
    setSaveStatus("saved");
    if (savedFadeTimerRef.current) clearTimeout(savedFadeTimerRef.current);
    savedFadeTimerRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
  }, []);

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void flushSaveRef.current();
    }, AUTOSAVE_MS);
  }, []);

  const flushSave = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const id = editingIdRef.current;
    if (!id) return true;

    const payload = readLiveForm();
    formRef.current = payload;
    const sentSnapshot = snapshot(id, payload);
    if (sentSnapshot === lastSavedRef.current) return true;
    if (savingRef.current) return true;

    savingRef.current = true;
    setSaveStatus("saving");
    setError(null);
    try {
      const saved = await persist(id, payload);
      applySavedDoc(saved);
      const currentSnapshot = snapshot(id, readLiveForm());
      if (currentSnapshot === sentSnapshot) {
        lastSavedRef.current = sentSnapshot;
        markSaved();
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setSaveStatus("error");
      return false;
    } finally {
      savingRef.current = false;
      const currentId = editingIdRef.current;
      if (
        currentId &&
        snapshot(currentId, readLiveForm()) !== lastSavedRef.current
      ) {
        scheduleSave();
      }
    }
  }, [applySavedDoc, markSaved, persist, readLiveForm, scheduleSave]);

  flushSaveRef.current = flushSave;

  const handleFormChange = useCallback(
    (patch: Partial<Form>) => {
      setForm((f) => {
        const next = { ...f, ...patch };
        formRef.current = next;
        return next;
      });
      if (editingIdRef.current) scheduleSave();
    },
    [scheduleSave],
  );

  const createDocOnServer = useCallback(async (payload: Form) => {
    const res = await fetch("/api/docs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as { doc?: SharedDoc; error?: string };
    if (!res.ok || !data.doc) {
      throw new Error(data.error || `Create failed (${res.status})`);
    }
    return data.doc;
  }, []);

  const openDoc = useCallback(
    async (doc: SharedDoc) => {
      await flushSave();
      setEditingId(doc.id);
      editingIdRef.current = doc.id;
      const next: Form = {
        title: doc.title,
        description: doc.description,
        content: doc.content,
        comments: doc.comments,
        isPublished: doc.isPublished,
        isPublic: doc.isPublic,
      };
      setForm(next);
      formRef.current = next;
      lastSavedRef.current = snapshot(doc.id, next);
      setShowPreview(false);
      setError(null);
      setSaveStatus("idle");
    },
    [flushSave],
  );

  const startNew = useCallback(async () => {
    await flushSave();
    setBusy(true);
    setError(null);
    try {
      const saved = await createDocOnServer({
        title: "Untitled",
        description: "",
        content: "",
        comments: [],
        isPublished: false,
        isPublic: false,
      });
      setDocs((prev) => [saved, ...prev]);
      setEditingId(saved.id);
      editingIdRef.current = saved.id;
      const next: Form = {
        title: saved.title,
        description: saved.description,
        content: saved.content,
        comments: saved.comments,
        isPublished: saved.isPublished,
        isPublic: saved.isPublic,
      };
      setForm(next);
      formRef.current = next;
      lastSavedRef.current = snapshot(saved.id, next);
      setShowPreview(false);
      setSaveStatus("idle");
      analytics.docCreated({ docId: saved.id, via: "ui" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }, [createDocOnServer, flushSave]);

  const importFiles = useCallback(
    async (files: FileList | File[]) => {
      const mdFiles = readMarkdownFiles(files);
      if (mdFiles.length === 0) return;

      await flushSave();
      setBusy(true);
      setError(null);
      const imported: SharedDoc[] = [];

      try {
        for (const file of mdFiles) {
          const content = await file.text();
          const saved = await createDocOnServer({
            title: titleFromFile(file, content),
            description: "",
            content,
            comments: [],
            isPublished: false,
            isPublic: false,
          });
          imported.push(saved);
          analytics.docCreated({ docId: saved.id, via: "ui" });
        }

        setDocs((prev) => {
          const ids = new Set(imported.map((d) => d.id));
          const rest = prev.filter((d) => !ids.has(d.id));
          return [...imported, ...rest];
        });

        if (imported[0]) await openDoc(imported[0]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Import failed");
      } finally {
        setBusy(false);
      }
    },
    [createDocOnServer, flushSave, openDoc],
  );

  const persistPatch = useCallback(
    async (patch: Partial<Form>) => {
      const id = editingIdRef.current;
      if (!id) return false;

      const next = { ...readLiveForm(), ...patch };
      setForm(next);
      formRef.current = next;

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }

      savingRef.current = true;
      setSaveStatus("saving");
      setError(null);
      try {
        const saved = await persist(id, next);
        applySavedDoc(saved);
        lastSavedRef.current = snapshot(id, next);
        markSaved();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
        setSaveStatus("error");
        return false;
      } finally {
        savingRef.current = false;
        const currentId = editingIdRef.current;
        if (
          currentId &&
          snapshot(currentId, readLiveForm()) !== lastSavedRef.current
        ) {
          scheduleSave();
        }
      }
    },
    [applySavedDoc, markSaved, persist, readLiveForm, scheduleSave],
  );

  const syncLiveFormToState = useCallback(() => {
    const live = readLiveForm();
    formRef.current = live;
    setForm(live);
  }, [readLiveForm]);

  const togglePreview = useCallback(() => {
    syncLiveFormToState();
    setShowPreview((p) => !p);
  }, [syncLiveFormToState]);

  async function publish() {
    const id = editingIdRef.current;
    const ok = await persistPatch({ isPublished: true, isPublic: true });
    if (ok && id) analytics.docPublished({ docId: id, isPublic: true });
  }

  async function unpublish() {
    await persistPatch({ isPublished: false, isPublic: false });
  }

  function requestDelete(doc: SharedDoc) {
    setDeleteTarget(doc);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const doc = deleteTarget;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/docs/${doc.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      analytics.docDeleted({ docId: doc.id });
      const remaining = docs.filter((d) => d.id !== doc.id);
      setDocs(remaining);
      setDeleteTarget(null);
      if (editingIdRef.current === doc.id) {
        if (remaining[0]) await openDoc(remaining[0]);
        else {
          setEditingId(null);
          editingIdRef.current = null;
          setForm(EMPTY_FORM);
          formRef.current = EMPTY_FORM;
          lastSavedRef.current = "";
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  function removeCurrent() {
    if (selectedDoc) requestDelete(selectedDoc);
  }

  async function copyLink() {
    if (!selectedDoc) return;
    const url = `${window.location.origin}${shareDocPath(selectedDoc.slug)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedSlug(selectedDoc.slug);
      setTimeout(
        () => setCopiedSlug((s) => (s === selectedDoc.slug ? null : s)),
        1500,
      );
    } catch {
      window.prompt("Copy link:", url);
    }
  }

  const hasFiles = (e: React.DragEvent) =>
    Array.from(e.dataTransfer.types).includes("Files");

  const onDragEnter = (e: React.DragEvent) => {
    if (busy || !hasFiles(e)) return;
    e.preventDefault();
    dragDepth.current += 1;
    setDragActive(true);
  };

  const onDragOver = (e: React.DragEvent) => {
    if (busy || !hasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragActive(false);
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDragActive(false);
    if (busy) return;
    const files = e.dataTransfer.files;
    if (files.length) await importFiles(files);
  };

  useEffect(() => {
    const onWindowDragEnd = () => {
      dragDepth.current = 0;
      setDragActive(false);
    };
    window.addEventListener("dragend", onWindowDragEnd);
    return () => window.removeEventListener("dragend", onWindowDragEnd);
  }, []);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (savedFadeTimerRef.current) clearTimeout(savedFadeTimerRef.current);
    };
  }, []);

  return (
    <div className="flex h-full min-h-0">
      <DriveSidebar
        user={user}
        isAdmin={isAdmin}
        docs={docs}
        selectedId={editingId}
        dragActive={dragActive}
        busy={busy}
        onSelect={(doc) => void openDoc(doc)}
        onDelete={requestDelete}
        onNew={() => void startNew()}
        onUploadFiles={(files) => void importFiles(files)}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      />
      <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col">
        <div className="pointer-events-none absolute right-3 top-3 z-20">
          <div className="pointer-events-auto">
            <ThemeToggle />
          </div>
        </div>
        <DriveEditor
          editingId={editingId}
          form={form}
          slug={selectedDoc?.slug}
          showPreview={showPreview}
          busy={busy}
          saveStatus={saveStatus}
          error={error}
          copiedSlug={copiedSlug}
          dragActive={dragActive}
          onFormChange={handleFormChange}
          onRegisterLiveReaders={(readers) => {
            liveReadersRef.current = readers;
          }}
          onTogglePreview={togglePreview}
          onPublish={() => void publish()}
          onUnpublish={() => void unpublish()}
          onDelete={() => void removeCurrent()}
          onCopyLink={() => void copyLink()}
          onDragEnter={onDragEnter}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        />
      </div>
      <DriveDeleteDialog
        title={deleteTarget?.title ?? ""}
        open={deleteTarget !== null}
        busy={busy}
        onCancel={() => !busy && setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
