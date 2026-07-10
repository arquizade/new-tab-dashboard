import { el } from "../utils/dom";
import { state, saveConfig } from "../state";
import { renderLinks } from "./links";
import type { StorageAdapter } from "../types";

/* ─── Link Open Mode ─────────────────────────────────────────── */
/* Controls whether clicking a saved link opens it in a new tab   */
/* or redirects the current (new-tab) page to that link.          */

export function applyLinkOpenMode(mode: "newTab" | "sameTab"): void {
  const btnNewTab = el("openModeNewTab");
  const btnSameTab = el("openModeSameTab");

  if (mode === "sameTab") {
    btnSameTab.classList.add("active");
    btnNewTab.classList.remove("active");
  } else {
    btnNewTab.classList.add("active");
    btnSameTab.classList.remove("active");
  }
}

export function initLinkOpenMode(storage: StorageAdapter): void {
  applyLinkOpenMode(state.config.linkOpenMode ?? "newTab");

  el("openModeNewTab").addEventListener("click", async () => {
    state.config.linkOpenMode = "newTab";
    applyLinkOpenMode("newTab");
    renderLinks(storage);
    await saveConfig(storage);
  });

  el("openModeSameTab").addEventListener("click", async () => {
    state.config.linkOpenMode = "sameTab";
    applyLinkOpenMode("sameTab");
    renderLinks(storage);
    await saveConfig(storage);
  });
}
