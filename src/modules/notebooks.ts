import { el } from "../utils/dom";
import { genId } from "../utils/id";
import { state, saveNotebooks, saveNotes } from "../state";
import { showToast } from "./toast";
import type { StorageAdapter } from "../types";

/* ─── Notebook Filter ────────────────────────────────────────── */
/*
 * The active filter is view state only: it is deliberately kept in
 * memory so a reload starts on "All notes" and backup import cannot
 * silently change which notes are visible.
 */

export const FILTER_ALL = "all";
export const FILTER_UNFILED = "unfiled";

let activeFilter: string = FILTER_ALL;
let storageRef: StorageAdapter | null = null;
let onChangeRef: () => void = () => {};
let creating = false;
let renamingId: string | null = null;

export function getNotebookFilter(): string {
  return activeFilter;
}

/** The selected notebook, or null for the "All notes" / "Unfiled" filters. */
export function getActiveNotebookId(): string | null {
  return activeFilter === FILTER_ALL || activeFilter === FILTER_UNFILED ? null : activeFilter;
}

/** Resolves a note's notebook, treating unknown ids as unfiled. */
export function resolveNotebookId(notebookId?: string): string | null {
  if (!notebookId) return null;
  return state.notebooks.some((nb) => nb.id === notebookId) ? notebookId : null;
}

export function noteMatchesFilter(note: { notebookId?: string }): boolean {
  const id = resolveNotebookId(note.notebookId);
  if (activeFilter === FILTER_ALL) return true;
  if (activeFilter === FILTER_UNFILED) return id === null;
  return id === activeFilter;
}

export function resetNotebookFilter(): void {
  activeFilter = FILTER_ALL;
  creating = false;
  renamingId = null;
  renderBar();
}

/* ─── Chip Row ───────────────────────────────────────────────── */

const PENCIL_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" class="w-3 h-3"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg>`;

function renderBar(): void {
  const bar = el("notebookBar");
  if (!bar) return;
  bar.innerHTML = "";

  bar.appendChild(chipGroup("All notes", FILTER_ALL, activeFilter === FILTER_ALL, false));
  bar.appendChild(chipGroup("Unfiled", FILTER_UNFILED, activeFilter === FILTER_UNFILED, false));

  state.notebooks.forEach((notebook) => {
    bar.appendChild(chipGroup(notebook.name, notebook.id, activeFilter === notebook.id, true));
  });

  if (creating) {
    bar.appendChild(createInput());
    return;
  }

  const add = document.createElement("button");
  add.type = "button";
  add.className = "notebook-add";
  add.title = "New notebook";
  add.textContent = "+";
  add.addEventListener("click", () => {
    creating = true;
    renamingId = null;
    renderBar();
  });
  bar.appendChild(add);
}

/* ─── Chips ──────────────────────────────────────────────────── */

function chipGroup(
  label: string,
  filterId: string,
  isActive: boolean,
  isNotebook: boolean,
): HTMLElement {
  const group = document.createElement("div");
  group.className = `notebook-chip-group${isActive ? " active" : ""}`;

  if (isNotebook && renamingId === filterId) {
    group.appendChild(renameInput(filterId, label));
    return group;
  }

  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = "notebook-chip";
  chip.textContent = label;
  chip.title = label;
  chip.addEventListener("click", () => selectFilter(filterId));
  group.appendChild(chip);

  if (isNotebook) {
    group.appendChild(
      iconButton("Rename notebook", "rename", PENCIL_SVG, () => {
        renamingId = filterId;
        creating = false;
        renderBar();
      }),
    );
    group.appendChild(
      iconButton("Delete notebook", "delete", "×", () => {
        void deleteNotebook(filterId);
      }),
    );
  }

  return group;
}

function iconButton(
  title: string,
  variant: "rename" | "delete",
  content: string,
  onClick: () => void,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `notebook-chip-icon ${variant}`;
  button.title = title;
  if (content.startsWith("<")) button.innerHTML = content;
  else button.textContent = content;
  button.addEventListener("click", onClick);
  return button;
}

function selectFilter(filterId: string): void {
  activeFilter = filterId;
  creating = false;
  renamingId = null;
  renderBar();
  onChangeRef();
}

/* ─── Inline Inputs ──────────────────────────────────────────── */

function renameInput(id: string, current: string): HTMLInputElement {
  const input = document.createElement("input");
  input.className = "notebook-input";
  input.value = current;
  input.maxLength = 40;
  input.setAttribute("aria-label", "Notebook name");

  let done = false;
  const finish = (commit: boolean): void => {
    if (done) return;
    done = true;
    renamingId = null;
    if (commit) void renameNotebook(id, input.value);
    else renderBar();
  };

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      finish(true);
    } else if (e.key === "Escape") {
      e.preventDefault();
      finish(false);
    }
  });
  input.addEventListener("blur", () => finish(true));
  requestAnimationFrame(() => {
    input.focus();
    input.select();
  });

  return input;
}

function createInput(): HTMLElement {
  const group = document.createElement("div");
  group.className = "notebook-chip-group active";

  const input = document.createElement("input");
  input.className = "notebook-input";
  input.placeholder = "Notebook name";
  input.maxLength = 40;
  input.setAttribute("aria-label", "New notebook name");

  let done = false;
  const finish = (commit: boolean): void => {
    if (done) return;
    done = true;
    creating = false;
    if (commit) void createNotebook(input.value);
    else renderBar();
  };

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      finish(true);
    } else if (e.key === "Escape") {
      e.preventDefault();
      finish(false);
    }
  });
  /* Clicking away cancels an unsaved name instead of creating one. */
  input.addEventListener("blur", () => finish(false));
  group.appendChild(input);

  requestAnimationFrame(() => input.focus());
  return group;
}

/* ─── Create / Rename / Delete ───────────────────────────────── */

async function createNotebook(rawName: string): Promise<void> {
  const name = rawName.trim();
  if (!name || !storageRef) {
    renderBar();
    return;
  }

  const notebook = { id: genId(), name, createdAt: new Date().toISOString() };
  state.notebooks.push(notebook);

  try {
    await saveNotebooks(storageRef);
    activeFilter = notebook.id;
  } catch {
    state.notebooks = state.notebooks.filter((nb) => nb.id !== notebook.id);
    showToast("Failed to create notebook", "error");
  }

  renderBar();
  onChangeRef();
}

async function renameNotebook(id: string, rawName: string): Promise<void> {
  const name = rawName.trim();
  const notebook = state.notebooks.find((nb) => nb.id === id);

  if (!notebook || !name || notebook.name === name || !storageRef) {
    renderBar();
    return;
  }

  const previousName = notebook.name;
  notebook.name = name;

  try {
    await saveNotebooks(storageRef);
  } catch {
    notebook.name = previousName;
    showToast("Failed to rename notebook", "error");
  }

  renderBar();
}

async function deleteNotebook(id: string): Promise<void> {
  const notebook = state.notebooks.find((nb) => nb.id === id);
  if (!notebook || !storageRef) return;

  state.notebooks = state.notebooks.filter((nb) => nb.id !== id);

  /* Deleting a notebook reassigns its notes to unfiled; never cascade. */
  let moved = 0;
  state.notes.forEach((note) => {
    if (note.notebookId === id) {
      delete note.notebookId;
      moved += 1;
    }
  });

  if (activeFilter === id) activeFilter = FILTER_ALL;

  try {
    await saveNotebooks(storageRef);
    if (moved > 0) await saveNotes(storageRef);
    showToast(moved > 0 ? "Notebook deleted, notes moved to Unfiled" : "Notebook deleted");
  } catch {
    showToast("Failed to delete notebook", "error");
  }

  renderBar();
  onChangeRef();
}

/* ─── Init ───────────────────────────────────────────────────── */

export function initNotebooks(storage: StorageAdapter, onChange: () => void): void {
  storageRef = storage;
  onChangeRef = onChange;
  renderBar();
}
