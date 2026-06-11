export type Theme = "system" | "light" | "dark";

const KEY = "grip.theme";

export function getTheme(): Theme {
  if (typeof window === "undefined") return "system";
  return (localStorage.getItem(KEY) as Theme) ?? "system";
}

export function setTheme(theme: Theme) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, theme);
  applyTheme(theme);
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  if (theme === "light" || theme === "dark") {
    root.classList.add(theme);
  }
}
