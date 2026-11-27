import { useSyncExternalStore } from "react";
import { Icon } from "./icons";

type Theme = "light" | "dark";
const STORAGE_KEY = "mxh:theme";
const isTheme = (value: string | null): value is Theme => value === "light" || value === "dark";
function readPreference(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return isTheme(value) ? value : null;
  } catch {
    return null;
  }
}
let preference = readPreference();
const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
const getTheme = (): Theme => preference ?? (systemTheme.matches ? "dark" : "light");
const listeners = new Set<() => void>();
function syncTheme() {
  if (preference) document.documentElement.dataset.theme = preference;
  else document.documentElement.removeAttribute("data-theme");
  const background = getComputedStyle(document.documentElement).backgroundColor;
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    meta.setAttribute("content", background);
  }
  for (const listener of listeners) listener();
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  const onSystem = () => syncTheme();
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    preference = readPreference();
    syncTheme();
  };
  systemTheme.addEventListener("change", onSystem);
  window.addEventListener("storage", onStorage);
  syncTheme();
  return () => {
    listeners.delete(listener);
    systemTheme.removeEventListener("change", onSystem);
    window.removeEventListener("storage", onStorage);
  };
}
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getTheme);
  const next = theme === "dark" ? "light" : "dark";
  const label = `Chuyển sang giao diện ${next === "dark" ? "tối" : "sáng"}`;
  return (
    <button
      className="icon-button theme-toggle"
      type="button"
      aria-label={label}
      title={label}
      onClick={() => {
        preference = next;
        try {
          localStorage.setItem(STORAGE_KEY, next);
        } catch {
          // Keep the selection for this visit when storage is unavailable.
        }
        syncTheme();
      }}
    >
      <Icon name={theme === "dark" ? "moon" : "sun"} size={20} />
    </button>
  );
}
