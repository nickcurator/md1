"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle } from "lucide-react";
import { FEEDBACK_LABELS_EN } from "@/lib/feedback-labels";
import FeedbackFormCore from "@/components/FeedbackFormCore";

const EXIT_MS = 180;

export default function DriveFeedbackWidget({
  email,
  userId,
}: {
  email: string;
  userId: string;
}) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [render, setRender] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setRender(true);
      setClosing(false);
      return;
    }
    if (!render) return;
    setClosing(true);
    const t = setTimeout(() => {
      setRender(false);
      setClosing(false);
    }, EXIT_MS);
    return () => clearTimeout(t);
  }, [open, render]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const t = setTimeout(
      () => document.addEventListener("mousedown", onClick),
      0,
    );
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <div className="fixed bottom-6 right-4 z-40 md:right-6">
      {render ? (
        <div
          ref={panelRef}
          className={`max-h-[calc(100vh-7rem)] w-[calc(100vw-2rem)] max-w-sm origin-bottom-right overflow-y-auto rounded-2xl ${
            closing ? "animate-sheet-down" : "animate-sheet-up"
          }`}
        >
          <FeedbackFormCore
            labels={FEEDBACK_LABELS_EN}
            source="md1"
            email={email}
            userId={userId}
            showEmailField={false}
            onClose={() => setOpen(false)}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={FEEDBACK_LABELS_EN.title}
          title={FEEDBACK_LABELS_EN.launcherTitle}
          className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] py-2.5 pl-3 pr-4 text-sm font-medium text-[var(--fg)] shadow-lg transition hover:border-[var(--fg)] active:scale-95"
        >
          <MessageCircle size={16} />
          <span>{FEEDBACK_LABELS_EN.button}</span>
        </button>
      )}
    </div>
  );
}
