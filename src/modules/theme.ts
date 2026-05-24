import { el } from "../utils/dom";
import { state, saveConfig } from "../state";
import type { StorageAdapter } from "../types";

/* ─── Theme ──────────────────────────────────────────────────── */

export function applyTheme(theme: "dark" | "light"): void {
  document.documentElement.setAttribute("data-theme", theme);
  const label = el<HTMLSpanElement>("themeLabel");
  if (label) label.textContent = theme === "dark" ? "Dark" : "Light";
}

export function initTheme(storage: StorageAdapter): void {
  applyTheme(state.config.theme);

  el("themeToggle").addEventListener("click", async () => {
    state.config.theme = state.config.theme === "dark" ? "light" : "dark";
    applyTheme(state.config.theme);
    await saveConfig(storage);
  });
}
