import { el } from "../utils/dom";
import { state, saveConfig } from "../state";
import type { StorageAdapter } from "../types";

/* ─── Links Layout ───────────────────────────────────────────── */

export function applyLinksLayout(layout: "grid" | "list"): void {
  const grid = el("linksGrid");
  const btnGrid = el("layoutGrid");
  const btnList = el("layoutList");

  if (layout === "list") {
    grid.classList.add("layout-list");
    btnList.classList.add("active");
    btnGrid.classList.remove("active");
  } else {
    grid.classList.remove("layout-list");
    btnGrid.classList.add("active");
    btnList.classList.remove("active");
  }
}

export function initLinksLayout(storage: StorageAdapter): void {
  applyLinksLayout(state.config.linksLayout ?? "grid");

  el("layoutGrid").addEventListener("click", async () => {
    state.config.linksLayout = "grid";
    applyLinksLayout("grid");
    await saveConfig(storage);
  });

  el("layoutList").addEventListener("click", async () => {
    state.config.linksLayout = "list";
    applyLinksLayout("list");
    await saveConfig(storage);
  });
}
