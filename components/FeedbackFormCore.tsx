"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ImagePlus, MessageCircle, X } from "lucide-react";
import type { FeedbackLabels } from "@/lib/feedback-labels";
import { fileToCompressedDataUrl } from "@/lib/image";

export type FeedbackSource = "product" | "drive" | "md1";

export default function FeedbackFormCore({
  labels,
  source,
  email: presetEmail,
  userId,
  language,
  showEmailField,
  onClose,
  embedded = false,
  onSent,
}: {
  labels: FeedbackLabels;
  source: FeedbackSource;
  email?: string;
  userId?: string;
  language?: string;
  showEmailField: boolean;
  onClose?: () => void;
  embedded?: boolean;
  onSent?: (meta: { hasImage: boolean }) => void;
}) {
  const pathname = usePathname();
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState(presetEmail ?? "");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragDepth = useRef(0);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    if (presetEmail) setEmail(presetEmail);
  }, [presetEmail]);

  const trimmed = message.trim();
  const busy = status === "sending" || status === "sent";
  const canSend = trimmed.length > 0 && status !== "sending";

  const processFile = async (file: File) => {
    setImageError(null);
    if (!file.type.startsWith("image/")) {
      setImageError(labels.imageType);
      return;
    }
    try {
      setImage(await fileToCompressedDataUrl(file));
    } catch (err) {
      setImageError(
        err instanceof Error ? err.message : labels.imageError,
      );
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) await processFile(file);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    if (busy) return;
    if (!Array.from(e.dataTransfer.types).includes("Files")) return;
    e.preventDefault();
    dragDepth.current += 1;
    setDragActive(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (busy) return;
    if (!Array.from(e.dataTransfer.types).includes("Files")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragActive(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDragActive(false);
    if (busy) return;
    const file = e.dataTransfer.files?.[0];
    if (file) await processFile(file);
  };

  const handleSend = async () => {
    if (!canSend) return;
    setStatus("sending");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          email: presetEmail ?? (email.trim() || undefined),
          userId,
          path: pathname,
          language,
          image: image ?? undefined,
          source,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(
          data.error ?? labels.requestFailed(res.status),
        );
      }
      onSent?.({ hasImage: !!image });
      setStatus("sent");
      if (embedded) {
        setTimeout(() => {
          setStatus("idle");
          setMessage("");
          setImage(null);
        }, 2500);
      } else {
        setTimeout(() => onClose?.(), 1400);
      }
    } catch (e) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : labels.genericError);
    }
  };

  return (
    <div
      className={
        embedded
          ? "relative w-full"
          : "relative w-full overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg)] shadow-2xl"
      }
      role={embedded ? undefined : "dialog"}
      aria-labelledby={embedded ? undefined : "feedback-title"}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {dragActive && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[var(--fg)] bg-[var(--bg)]/85 px-6 text-center backdrop-blur-sm">
          <ImagePlus size={24} className="text-[var(--fg)]" />
          <p className="text-sm font-medium">{labels.drop}</p>
        </div>
      )}

      {!embedded && (
        <div className="flex items-center gap-2 px-5 pb-3 pt-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)] text-[var(--muted)]">
            <MessageCircle size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="feedback-title" className="text-base font-semibold">
              {labels.title}
            </h2>
            <p className="text-xs text-[var(--muted)]">{labels.subtitle}</p>
          </div>
          <button
            onClick={() => onClose?.()}
            className="-m-2 p-2 text-[var(--muted)] transition-colors hover:text-[var(--fg)]"
            aria-label={labels.close}
          >
            <X size={18} />
          </button>
        </div>
      )}

      <div className={embedded ? "space-y-3" : "space-y-3 px-5 pb-5"}>
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={labels.placeholder}
          rows={5}
          maxLength={4000}
          disabled={busy}
          className="w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-[var(--fg)]/20 disabled:opacity-60"
        />

        {showEmailField && (
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={labels.emailPlaceholder}
            disabled={busy}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--fg)]/20 disabled:opacity-60"
          />
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
          disabled={busy}
        />

        {image ? (
          <div className="relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image}
              alt={labels.previewAlt}
              className="max-h-40 rounded-lg border border-[var(--border)]"
            />
            <button
              type="button"
              onClick={() => {
                setImage(null);
                setImageError(null);
              }}
              disabled={busy}
              aria-label={labels.removeAttachment}
              className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--fg)] text-[var(--bg)] shadow disabled:opacity-50"
            >
              <X size={13} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className="inline-flex items-center gap-2 text-sm text-[var(--muted)] transition-colors hover:text-[var(--fg)] disabled:opacity-50"
          >
            <ImagePlus size={16} />
            {labels.attach}
          </button>
        )}

        {imageError && (
          <div className="text-xs text-red-600 dark:text-red-400">
            {imageError}
          </div>
        )}

        {status === "error" && errorMsg && (
          <div className="text-xs text-red-600 dark:text-red-400">
            {errorMsg}
          </div>
        )}
        {status === "sent" && (
          <div className="text-xs text-green-600 dark:text-green-400">
            {labels.thanks}
          </div>
        )}

        <div
          className={`flex items-center gap-2 pt-1 ${
            embedded ? "justify-start" : "justify-end"
          }`}
        >
          {!embedded && (
            <button
              type="button"
              onClick={() => onClose?.()}
              className="rounded-md px-4 py-2 text-sm text-[var(--muted)] transition-colors hover:bg-[var(--card)] hover:text-[var(--fg)]"
              disabled={status === "sending"}
            >
              {labels.cancel}
            </button>
          )}
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend || status === "sent"}
            className="rounded-md bg-[var(--fg)] px-4 py-2 text-sm font-medium text-[var(--bg)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === "sending"
              ? labels.sending
              : status === "sent"
                ? labels.sent
                : labels.send}
          </button>
        </div>
      </div>
    </div>
  );
}
