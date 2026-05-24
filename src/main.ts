import { createStorageAdapter } from "./storage";
import { loadState } from "./state";
import { initTheme } from "./modules/theme";
import { initLinksLayout } from "./modules/linksLayout";
import { initClock } from "./modules/clock";
import { initNav } from "./modules/nav";
import { initKeyboard } from "./modules/keyboard";
import { initSectionShortcuts } from "./modules/sectionShortcuts";
import {
  initLinksSearch,
  initLinks,
  renderLinks,
  resetLinksQuery,
} from "./modules/links";
import { initTodos, renderTodos } from "./modules/todos";
import { initNotes, renderNotes } from "./modules/notes";
import { initBackup } from "./modules/backup";

/* ─── Boot ───────────────────────────────────────────────────── */

async function init(): Promise<void> {
  const storage = createStorageAdapter();

  await loadState(storage);

  initTheme(storage);
  initLinksLayout(storage);
  initClock();
  initNav(resetLinksQuery);

  // Register all shortcuts before initKeyboard attaches the listener
  initSectionShortcuts();
  initLinksSearch(storage);
  initLinks(storage);
  initTodos(storage);
  initNotes(storage);

  // Attach the single global keydown listener with all registered shortcuts
  initKeyboard();

  initBackup(storage);

  renderLinks(storage);
  renderTodos(storage);
  renderNotes(storage);
}

document.addEventListener("DOMContentLoaded", init);
