import { el, escapeHtml } from "../utils/dom";
import { genId } from "../utils/id";
import { formatDate } from "../utils/date";
import { state, saveNotes } from "../state";
import { registerShortcut } from "./keyboard";
import { showToast } from "./toast";
import type { Note, NoteColor, StorageAdapter } from "../types";

/* ─── Reminders (chrome.alarms) ──────────────────────────────── */

const NOTE_ALARM_PREFIX = "note-reminder-";
const hasAlarms = typeof chrome !== "undefined" && !!chrome.alarms;

export function scheduleReminder(noteId: string, reminderAt: string): void {
  if (!hasAlarms) return;
  chrome.alarms.create(`${NOTE_ALARM_PREFIX}${noteId}`, {
    when: new Date(reminderAt).getTime(),
  });
}

export function clearReminder(noteId: string): void {
  if (!hasAlarms) return;
  chrome.alarms.clear(`${NOTE_ALARM_PREFIX}${noteId}`);
}

/**
 * Brings scheduled chrome.alarms fully in sync with `notes`: schedules
 * a future reminder for each note that has one, and clears every
 * existing note-reminder alarm that no longer corresponds to one.
 */
export async function reconcileReminders(
  notes: { id: string; reminderAt?: string }[],
): Promise<void> {
  if (!hasAlarms) return;

  const wantedIds = new Set(
    notes.filter((n) => n.reminderAt).map((n) => n.id),
  );

  const existingAlarms = await chrome.alarms.getAll();
  await Promise.all(
    existingAlarms
      .filter(
        (a) =>
          a.name.startsWith(NOTE_ALARM_PREFIX) &&
          !wantedIds.has(a.name.slice(NOTE_ALARM_PREFIX.length)),
      )
      .map((a) => chrome.alarms.clear(a.name)),
  );

  notes.forEach((n) => {
    if (n.reminderAt && new Date(n.reminderAt).getTime() > Date.now()) {
      scheduleReminder(n.id, n.reminderAt);
    }
  });
}

/* ─── Date helpers ───────────────────────────────────────────── */

function toDatetimeLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function roundUpTo15(d: Date): Date {
  const ms = 15 * 60 * 1000;
  return new Date(Math.ceil(d.getTime() / ms) * ms);
}

function defaultToday(): Date {
  return roundUpTo15(new Date(Date.now() + 60 * 60 * 1000));
}

function defaultTomorrow(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

function formatReminder(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/* ─── Shared form HTML ───────────────────────────────────────── */
/*
 * Used for the inline edit form inside each card.
 * The static add form in index.html uses the same visual structure
 * but with id= attributes; here we use nf-* classes to avoid
 * duplicate IDs on the page.
 */

const SWATCHES: { color: NoteColor; cssVar: string }[] = [
  { color: "blue",   cssVar: "var(--note-blue)" },
  { color: "green",  cssVar: "var(--note-green)" },
  { color: "yellow", cssVar: "var(--note-yellow)" },
  { color: "red",    cssVar: "var(--note-red)" },
  { color: "purple", cssVar: "var(--note-purple)" },
];

function noteFormHtml(initial: { text: string; color: NoteColor; reminderAt?: string }): string {
  return `
    <textarea
      class="nf-text w-full py-2.5 px-4 rounded-xl font-sans text-[13px] text-text-1 outline-none resize-y min-h-24 leading-[1.65] bg-bg border border-border-mid placeholder:text-text-3 focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-glow)] transition-[border-color,box-shadow] duration-[180ms]"
      rows="4"
      placeholder="Start writing..."
    >${escapeHtml(initial.text)}</textarea>

    <div class="flex items-center justify-between gap-3 flex-wrap">
      <div class="flex items-center gap-1.5 flex-wrap">
        <button type="button" class="nf-today note-reminder-btn">Today</button>
        <button type="button" class="nf-tomorrow note-reminder-btn">Tomorrow</button>
        <button type="button" class="nf-picker-toggle note-reminder-btn note-reminder-icon-btn" title="Custom date &amp; time">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 3" />
          </svg>
        </button>
        <input
          class="nf-reminder hidden py-1.5 px-2.5 rounded-lg font-sans text-[12px] text-text-1 outline-none bg-bg border border-border-mid focus:border-accent transition-[border-color] duration-[180ms]"
          type="datetime-local"
        />
        <button type="button" class="nf-clear hidden font-sans text-[13px] leading-none text-text-3 hover:text-danger cursor-pointer bg-transparent border-0 px-1 transition-colors duration-[150ms]">×</button>
      </div>

      <div class="nf-color-picker flex items-center gap-2">
        ${SWATCHES.map(({ color, cssVar }) => `
          <button
            type="button"
            data-color="${color}"
            title="${color[0].toUpperCase() + color.slice(1)}"
            class="note-color-swatch${initial.color === color ? " active" : ""}"
            style="--swatch-color: ${cssVar}"
          ></button>
        `).join("")}
      </div>
    </div>

    <div class="flex gap-2 pt-1">
      <button type="button" class="nf-save py-[9px] px-[22px] rounded-full font-sans text-[13px] font-semibold cursor-pointer border-0 bg-accent text-[#111] hover:brightness-105 hover:-translate-y-px active:translate-y-0 transition-[filter,transform] duration-[180ms]">Save</button>
      <button type="button" class="nf-cancel py-[9px] px-[18px] rounded-full font-sans text-[13px] cursor-pointer bg-transparent border border-border-mid text-text-2 hover:bg-surface-3 hover:text-text-1 transition-[background,color] duration-[180ms]">Cancel</button>
    </div>
  `;
}

/* ─── Shared form wiring ─────────────────────────────────────── */
/*
 * Works with both the static add form (queried by id) and the dynamic
 * edit form (queried by nf-* classes inside a card).
 */

interface FormRefs {
  textarea:        HTMLTextAreaElement;
  btnToday:        HTMLButtonElement;
  btnTomorrow:     HTMLButtonElement;
  btnPickerToggle: HTMLButtonElement;
  reminderInput:   HTMLInputElement;
  btnClear:        HTMLButtonElement;
  colorPicker:     HTMLElement;
  btnSave:         HTMLButtonElement;
  btnCancel:       HTMLButtonElement;
}

interface FormInitial {
  text:       string;
  color:      NoteColor;
  reminderAt?: string;
}

interface FormCallbacks {
  onSave:   (values: { text: string; color: NoteColor; reminderAt?: string }) => Promise<void>;
  onCancel: () => void;
}

function wireFormControls(refs: FormRefs, initial: FormInitial, cb: FormCallbacks): void {
  const { textarea, btnToday, btnTomorrow, btnPickerToggle,
          reminderInput, btnClear, colorPicker, btnSave, btnCancel } = refs;

  let selectedColor: NoteColor = initial.color;
  let quickPick: "today" | "tomorrow" | "custom" | null = null;

  /* ── color ── */
  function setColor(color: NoteColor): void {
    selectedColor = color;
    colorPicker.querySelectorAll<HTMLButtonElement>(".note-color-swatch")
      .forEach((b) => b.classList.toggle("active", b.dataset.color === color));
  }

  colorPicker.querySelectorAll<HTMLButtonElement>(".note-color-swatch")
    .forEach((btn) => btn.addEventListener("click", () => setColor(btn.dataset.color as NoteColor ?? "blue")));

  /* ── reminder ── */
  function setActiveQuick(pick: typeof quickPick): void {
    quickPick = pick;
    btnToday.classList.toggle("active", pick === "today");
    btnTomorrow.classList.toggle("active", pick === "tomorrow");
    btnPickerToggle.classList.toggle("active", pick === "custom");
  }

  function clearReminderUI(): void {
    reminderInput.value = "";
    setActiveQuick(null);
    reminderInput.classList.add("hidden");
    btnClear.classList.add("hidden");
  }

  function applyReminderValue(value: string): void {
    reminderInput.value = value;
    reminderInput.classList.remove("hidden");
    btnClear.classList.remove("hidden");
  }

  /* Pre-fill reminder if provided */
  if (initial.reminderAt) {
    setActiveQuick("custom");
    applyReminderValue(toDatetimeLocal(new Date(initial.reminderAt)));
  }

  btnToday.addEventListener("click", () => {
    if (quickPick === "today") { clearReminderUI(); return; }
    setActiveQuick("today");
    applyReminderValue(toDatetimeLocal(defaultToday()));
  });

  btnTomorrow.addEventListener("click", () => {
    if (quickPick === "tomorrow") { clearReminderUI(); return; }
    setActiveQuick("tomorrow");
    applyReminderValue(toDatetimeLocal(defaultTomorrow()));
  });

  btnPickerToggle.addEventListener("click", () => {
    const isOpen = !reminderInput.classList.contains("hidden");
    if (isOpen && quickPick === "custom") {
      clearReminderUI();
    } else {
      setActiveQuick("custom");
      reminderInput.classList.remove("hidden");
      btnClear.classList.toggle("hidden", !reminderInput.value);
      reminderInput.focus();
    }
  });

  reminderInput.addEventListener("change", () => {
    if (reminderInput.value) {
      btnClear.classList.remove("hidden");
      if (quickPick !== "custom") setActiveQuick("custom");
    } else {
      btnClear.classList.add("hidden");
    }
  });

  btnClear.addEventListener("click", clearReminderUI);

  /* ── save / cancel ── */
  async function handleSave(): Promise<void> {
    const text = textarea.value.trim();
    if (!text) {
      showToast("Note text cannot be empty", "error");
      return;
    }

    const reminderAt = reminderInput.value
      ? new Date(reminderInput.value).toISOString()
      : undefined;

    if (reminderAt && new Date(reminderAt).getTime() <= Date.now()) {
      showToast("Reminder time must be in the future", "error");
      return;
    }

    await cb.onSave({ text, color: selectedColor, reminderAt });
  }

  btnSave.addEventListener("click", handleSave);
  btnCancel.addEventListener("click", cb.onCancel);
  textarea.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); cb.onCancel(); }
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleSave(); }
  });
}

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
    const card = document.createElement("div");
    card.className = `note-card note-color-${note.color}`;
    renderCardView(card, note, storage);
    list.appendChild(card);
  });
}

function renderCardView(card: HTMLElement, note: Note, storage: StorageAdapter): void {
  const isPast = note.reminderAt
    ? new Date(note.reminderAt).getTime() <= Date.now()
    : false;

  card.innerHTML = `
    <p class="note-text">${escapeHtml(note.text)}</p>
    ${note.reminderAt ? `
      <span class="note-reminder-badge${isPast ? " past" : ""}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3 h-3">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 3" />
        </svg>
        ${formatReminder(note.reminderAt)}
      </span>` : ""}
    <span class="note-meta">${formatDate(note.date)}</span>
    <button class="note-delete" data-id="${note.id}" title="Remove">Delete</button>
  `;

  /* Click card body → open edit form */
  card.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest(".note-delete")) return;
    renderEditForm(card, note, storage);
  });

  card.querySelector<HTMLButtonElement>(".note-delete")!
    .addEventListener("click", async (e) => {
      e.stopPropagation();
      state.notes = state.notes.filter((n) => n.id !== note.id);
      clearReminder(note.id);
      try {
        await saveNotes(storage);
        renderNotes(storage);
      } catch {
        showToast("Failed to delete note", "error");
      }
    });
}

function renderEditForm(card: HTMLElement, note: Note, storage: StorageAdapter): void {
  card.classList.add("editing");
  card.innerHTML = noteFormHtml({ text: note.text, color: note.color, reminderAt: note.reminderAt });

  const refs: FormRefs = {
    textarea:        card.querySelector<HTMLTextAreaElement>(".nf-text")!,
    btnToday:        card.querySelector<HTMLButtonElement>(".nf-today")!,
    btnTomorrow:     card.querySelector<HTMLButtonElement>(".nf-tomorrow")!,
    btnPickerToggle: card.querySelector<HTMLButtonElement>(".nf-picker-toggle")!,
    reminderInput:   card.querySelector<HTMLInputElement>(".nf-reminder")!,
    btnClear:        card.querySelector<HTMLButtonElement>(".nf-clear")!,
    colorPicker:     card.querySelector<HTMLElement>(".nf-color-picker")!,
    btnSave:         card.querySelector<HTMLButtonElement>(".nf-save")!,
    btnCancel:       card.querySelector<HTMLButtonElement>(".nf-cancel")!,
  };

  /* Auto-size textarea to content */
  refs.textarea.style.height = "auto";
  refs.textarea.style.height = `${refs.textarea.scrollHeight}px`;
  refs.textarea.focus();
  refs.textarea.setSelectionRange(refs.textarea.value.length, refs.textarea.value.length);
  refs.textarea.addEventListener("input", () => {
    refs.textarea.style.height = "auto";
    refs.textarea.style.height = `${refs.textarea.scrollHeight}px`;
  });

  wireFormControls(refs, { text: note.text, color: note.color, reminderAt: note.reminderAt }, {
    onSave: async ({ text, color, reminderAt }) => {
      const target = state.notes.find((n) => n.id === note.id);
      if (target) {
        target.text  = text;
        target.color = color;
        /* Sync reminder alarm */
        if (reminderAt) {
          target.reminderAt = reminderAt;
          scheduleReminder(note.id, reminderAt);
        } else {
          delete target.reminderAt;
          clearReminder(note.id);
        }
        /* Update card color class immediately */
        card.className = `note-card note-color-${color}`;
      }
      try {
        await saveNotes(storage);
        renderNotes(storage);
      } catch {
        showToast("Failed to save note", "error");
      }
    },
    onCancel: () => {
      card.classList.remove("editing");
      renderCardView(card, note, storage);
    },
  });
}

/* ─── Add-note form (static HTML in index.html) ─────────────── */

export function initNotes(storage: StorageAdapter): void {
  const form     = el("formNote");
  const btnAdd   = el("btnAddNote");

  const refs: FormRefs = {
    textarea:        el<HTMLTextAreaElement>("noteText"),
    btnToday:        el("noteReminderToday"),
    btnTomorrow:     el("noteReminderTomorrow"),
    btnPickerToggle: el("noteReminderPickerToggle"),
    reminderInput:   el<HTMLInputElement>("noteReminder"),
    btnClear:        el("noteReminderClear"),
    colorPicker:     el("noteColorPicker"),
    btnSave:         el("saveNoteBtn"),
    btnCancel:       el("cancelNoteBtn"),
  };

  function openForm(): void {
    form.classList.remove("hidden");
    form.classList.add("flex");
    refs.textarea.focus();
  }

  function closeForm(): void {
    form.classList.add("hidden");
    form.classList.remove("flex");
    /* Reset all controls by re-wiring with defaults */
    refs.textarea.value = "";
    refs.reminderInput.value = "";
    refs.reminderInput.classList.add("hidden");
    refs.btnClear.classList.add("hidden");
    ["noteReminderToday", "noteReminderTomorrow", "noteReminderPickerToggle"].forEach((id) =>
      el(id).classList.remove("active"),
    );
    el("noteColorPicker").querySelectorAll<HTMLButtonElement>(".note-color-swatch")
      .forEach((b) => b.classList.toggle("active", b.dataset.color === "blue"));
    /* Re-wire so internal state (selectedColor, quickPick) is reset */
    wireAddForm();
  }

  function wireAddForm(): void {
    wireFormControls(
      refs,
      { text: "", color: "blue" },
      {
        onSave: async ({ text, color, reminderAt }) => {
          const id = genId();
          state.notes.push({ id, text, date: new Date().toISOString(), color,
            ...(reminderAt ? { reminderAt } : {}) });
          try {
            await saveNotes(storage);
            if (reminderAt) scheduleReminder(id, reminderAt);
            renderNotes(storage);
            closeForm();
          } catch {
            showToast("Failed to save note", "error");
          }
        },
        onCancel: closeForm,
      },
    );
  }

  wireAddForm();

  btnAdd.addEventListener("click", () => {
    if (form.classList.contains("hidden")) openForm();
    else closeForm();
  });

  registerShortcut({ key: "a", requiresSection: "section-notes", handler: openForm });
  registerShortcut({ key: "A", requiresSection: "section-notes", handler: openForm });
}
