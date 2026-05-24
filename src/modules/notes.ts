import { el, escapeHtml } from "../utils/dom";
import { genId } from "../utils/id";
import { formatDate } from "../utils/date";
import { state, saveNotes } from "../state";
import { registerShortcut } from "./keyboard";
import { showToast } from "./toast";
import type { StorageAdapter } from "../types";

/* ─── Render ─────────────────────────────────────────────────── */

export function renderNotes(storage: StorageAdapter): void {
  const list = el("notesList");
  const empty = el("notesEmpty");
  list.innerHTML = "";

  if (state.notes.length === 0) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  [...state.notes].reverse().forEach((note) => {
    const div = document.createElement("div");
    div.className = "note-card";
    div.innerHTML = `
      <p class="note-text">${escapeHtml(note.text)}</p>
      <span class="note-meta">${formatDate(note.date)}</span>
      <button class="note-delete" data-id="${note.id}" title="Remove">Delete</button>
    `;

    div
      .querySelector<HTMLButtonElement>(".note-delete")!
      .addEventListener("click", async () => {
        state.notes = state.notes.filter((n) => n.id !== note.id);
        try {
          await saveNotes(storage);
          renderNotes(storage);
        } catch {
          showToast("Failed to delete note", "error");
        }
      });

    list.appendChild(div);
  });
}

/* ─── CRUD ───────────────────────────────────────────────────── */

export function initNotes(storage: StorageAdapter): void {
  const form = el("formNote");
  const textarea = el<HTMLTextAreaElement>("noteText");
  const btnAdd = el("btnAddNote");
  const btnSave = el("saveNoteBtn");
  const btnCancel = el("cancelNoteBtn");

  function openForm(): void {
    form.classList.remove("hidden");
    form.classList.add("flex");
    textarea.focus();
  }

  function closeForm(): void {
    form.classList.add("hidden");
    form.classList.remove("flex");
    textarea.value = "";
  }

  async function saveNote(): Promise<void> {
    const text = textarea.value.trim();
    if (!text) return;

    state.notes.push({ id: genId(), text, date: new Date().toISOString() });
    try {
      await saveNotes(storage);
      renderNotes(storage);
      closeForm();
    } catch {
      showToast("Failed to save note", "error");
    }
  }

  btnAdd.addEventListener("click", () => {
    if (form.classList.contains("hidden")) openForm();
    else closeForm();
  });

  btnCancel.addEventListener("click", closeForm);
  btnSave.addEventListener("click", saveNote);

  textarea.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) saveNote();
    if (e.key === "Escape") closeForm();
  });

  registerShortcut({
    key: "a",
    requiresSection: "section-notes",
    handler: () => openForm(),
  });

  registerShortcut({
    key: "A",
    requiresSection: "section-notes",
    handler: () => openForm(),
  });
}
