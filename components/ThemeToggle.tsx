"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { setTheme } from "@/lib/theme";

// Light/dark toggle for the standalone share surfaces (/d and /d/*). Reuses
// the app-wide theme switch (lib/theme.ts) so it flips the same `.dark` /
// `.light` class — for a logged-out visitor it just controls their own view.
export default function ThemeToggle() {
  const [mode, setMode] = useState<"light" | "dark">("light");

  useEffect(() => {
    const root = document.documentElement;
    const isDark =
      root.classList.contains("dark") ||
      (!root.classList.contains("light") &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    setMode(isDark ? "dark" : "light");
  }, []);

  function toggle() {
    const next = mode === "dark" ? "light" : "dark";
    setTheme(next);
    setMode(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={mode === "dark" ? "Switch to light" : "Switch to dark"}
      title={mode === "dark" ? "Light mode" : "Dark mode"}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg)]/80 text-[var(--muted)] backdrop-blur hover:text-[var(--fg)]"
    >
      {mode === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
