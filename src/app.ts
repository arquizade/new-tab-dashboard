/* ─── Types ──────────────────────────────────────────────────── */

interface Link {
  id: string;
  title: string;
  url: string;
}

interface Todo {
  id: string;
  text: string;
  completed: boolean;
}

interface Note {
  id: string;
  text: string;
  date: string;
}

interface Config {
  theme: "dark" | "light";
  linksLayout: "grid" | "list";
}

interface AppState {
  links: Link[];
  todos: Todo[];
  notes: Note[];
  config: Config;
}

/* ─── Storage ───────────────────────────────────────────────── */

const isChromeExt = (): boolean =>
  typeof chrome !== "undefined" && !!chrome.storage;

const storage = {
  async get<T>(key: string): Promise<T | null> {
    return new Promise((resolve) => {
      if (isChromeExt()) {
        chrome.storage.local.get([key], (result) =>
          resolve((result[key] as T) ?? null),
        );
      } else {
        const val = localStorage.getItem(key);
        resolve(val ? (JSON.parse(val) as T) : null);
      }
    });
  },

  async set<T>(key: string, value: T): Promise<void> {
    return new Promise((resolve) => {
      if (isChromeExt()) {
        chrome.storage.local.set({ [key]: value }, () => resolve());
      } else {
        localStorage.setItem(key, JSON.stringify(value));
        resolve();
      }
    });
  },
};

/* ─── State ─────────────────────────────────────────────────── */

const state: AppState = {
  links: [],
  todos: [],
  notes: [],
  config: { theme: "dark", linksLayout: "grid" },
};

async function loadState(): Promise<void> {
  const links = await storage.get<Link[]>("ntd-links");
  const todos = await storage.get<Todo[]>("ntd-todos");
  const notes = await storage.get<Note[]>("ntd-notes");
  const config = await storage.get<Config>("ntd-config");
  state.links = links ?? [];
  state.todos = todos ?? [];
  state.notes = notes ?? [];
  state.config = config ?? { theme: "dark", linksLayout: "grid" };
}

async function saveLinks(): Promise<void> {
  await storage.set("ntd-links", state.links);
}
async function saveTodos(): Promise<void> {
  await storage.set("ntd-todos", state.todos);
}
async function saveNotes(): Promise<void> {
  await storage.set("ntd-notes", state.notes);
}
async function saveConfig(): Promise<void> {
  await storage.set("ntd-config", state.config);
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/* ─── Helpers ───────────────────────────────────────────────── */

function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* ─── Theme ─────────────────────────────────────────────────── */

function applyTheme(theme: "dark" | "light"): void {
  document.documentElement.setAttribute("data-theme", theme);
  const label = el<HTMLSpanElement>("themeLabel");
  if (label) label.textContent = theme === "dark" ? "Dark" : "Light";
}

function initTheme(): void {
  applyTheme(state.config.theme);

  el("themeToggle").addEventListener("click", async () => {
    state.config.theme = state.config.theme === "dark" ? "light" : "dark";
    applyTheme(state.config.theme);
    await saveConfig();
  });
}

/* ─── Links Layout ───────────────────────────────────────────── */

function applyLinksLayout(layout: "grid" | "list"): void {
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

function initLinksLayout(): void {
  applyLinksLayout(state.config.linksLayout ?? "grid");

  el("layoutGrid").addEventListener("click", async () => {
    state.config.linksLayout = "grid";
    applyLinksLayout("grid");
    await saveConfig();
  });

  el("layoutList").addEventListener("click", async () => {
    state.config.linksLayout = "list";
    applyLinksLayout("list");
    await saveConfig();
  });
}

/* ─── Sidebar Navigation ────────────────────────────────────── */

function hideAllForms(): void {
  ["formLink", "formTodo", "formNote"].forEach((id) => {
    el(id).classList.add("hidden");
  });
}

function initNav(): void {
  document.querySelectorAll<HTMLButtonElement>(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.section;

      document
        .querySelectorAll(".nav-btn")
        .forEach((b) => b.classList.remove("active"));
      document
        .querySelectorAll(".section")
        .forEach((s) => s.classList.remove("active"));

      btn.classList.add("active");
      if (target) el(`section-${target}`).classList.add("active");

      hideAllForms();
    });
  });
}

/* ─── Clock ─────────────────────────────────────────────────── */

function updateClock(): void {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  el("timeDisplay").textContent = `${h}:${m}`;

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  el("dateDisplay").textContent =
    `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}`;
}

function initClock(): void {
  updateClock();
  setInterval(updateClock, 30_000);
}

/* ─── Links ─────────────────────────────────────────────────── */

function getFavicon(url: string): string | null {
  try {
    new URL(url);
    if (typeof chrome !== "undefined" && chrome.runtime?.id) {
      return `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(url)}&size=32`;
    }
    const { hostname } = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
  } catch {
    return null;
  }
}

/* ─── Drag-to-Reorder ───────────────────────────────────────── */

let dragSrcId: string | null = null;

const DRAG_HANDLE_SVG = `
  <span class="drag-handle" aria-hidden="true">
    <svg viewBox="0 0 8 14" fill="currentColor">
      <circle cx="2" cy="2"  r="1.4"/>
      <circle cx="6" cy="2"  r="1.4"/>
      <circle cx="2" cy="7"  r="1.4"/>
      <circle cx="6" cy="7"  r="1.4"/>
      <circle cx="2" cy="12" r="1.4"/>
      <circle cx="6" cy="12" r="1.4"/>
    </svg>
  </span>`;

function clearDropIndicators(): void {
  document
    .querySelectorAll<HTMLElement>(".link-card, .todo-item")
    .forEach((c) => {
      c.classList.remove("drag-over-before", "drag-over-after");
    });
}

function addDragHandlers(card: HTMLAnchorElement, linkId: string): void {
  card.draggable = true;

  card.addEventListener("dragstart", (e) => {
    dragSrcId = linkId;
    // Defer adding class so the browser snapshot isn't blank
    requestAnimationFrame(() => card.classList.add("dragging"));
    e.dataTransfer!.effectAllowed = "move";
    e.dataTransfer!.setData("text/plain", linkId);
  });

  card.addEventListener("dragend", () => {
    dragSrcId = null;
    card.classList.remove("dragging");
    clearDropIndicators();
  });

  card.addEventListener("dragover", (e) => {
    e.preventDefault();
    if (!dragSrcId || dragSrcId === linkId) return;
    e.dataTransfer!.dropEffect = "move";

    const rect = card.getBoundingClientRect();
    const inTopHalf = e.clientY < rect.top + rect.height / 2;
    card.classList.toggle("drag-over-before", inTopHalf);
    card.classList.toggle("drag-over-after", !inTopHalf);
  });

  card.addEventListener("dragleave", (e) => {
    // Only clear if truly leaving this card (not entering a child)
    if (!card.contains(e.relatedTarget as Node)) {
      card.classList.remove("drag-over-before", "drag-over-after");
    }
  });

  card.addEventListener("drop", async (e) => {
    e.preventDefault();
    const targetId = linkId;
    clearDropIndicators();
    if (!dragSrcId || dragSrcId === targetId) return;

    const rect = card.getBoundingClientRect();
    const insertBefore = e.clientY < rect.top + rect.height / 2;

    // Remove dragged item from array, then insert at new position
    const dragged = state.links.find((l) => l.id === dragSrcId)!;
    const filtered = state.links.filter((l) => l.id !== dragSrcId);
    const targetIdx = filtered.findIndex((l) => l.id === targetId);
    filtered.splice(insertBefore ? targetIdx : targetIdx + 1, 0, dragged);

    state.links = filtered;
    await saveLinks();
    renderLinks();
  });
}

function renderLinks(): void {
  const grid = el("linksGrid");
  const empty = el("linksEmpty");
  grid.innerHTML = "";

  if (state.links.length === 0) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  state.links.forEach((link) => {
    const a = document.createElement("a");
    a.className = "link-card";
    a.href = link.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";

    const favicon = getFavicon(link.url);
    const faviconHtml = favicon
      ? `<img class="link-card-favicon" src="${favicon}" alt="" onerror="this.style.display='none'" />`
      : "";

    let displayUrl = "";
    try {
      displayUrl = new URL(link.url).hostname.replace("www.", "");
    } catch {
      displayUrl = link.url;
    }

    a.innerHTML = `
      ${DRAG_HANDLE_SVG}
      ${faviconHtml}
      <span class="link-card-title">${escapeHtml(link.title)}</span>
      <span class="link-card-url">${escapeHtml(displayUrl)}</span>
      <button class="card-delete" data-id="${link.id}" title="Remove">×</button>
    `;

    a.querySelector<HTMLButtonElement>(".card-delete")!.addEventListener(
      "click",
      async (e) => {
        e.preventDefault();
        e.stopPropagation();
        state.links = state.links.filter((l) => l.id !== link.id);
        await saveLinks();
        renderLinks();
      },
    );

    addDragHandlers(a, link.id);
    grid.appendChild(a);
  });
}

function initLinks(): void {
  const btnAdd = el("btnAddLink");
  const form = el("formLink");
  const inputTitle = el<HTMLInputElement>("linkTitle");
  const inputUrl = el<HTMLInputElement>("linkUrl");
  const btnSave = el("saveLinkBtn");
  const btnCancel = el("cancelLinkBtn");

  btnAdd.addEventListener("click", () => {
    form.classList.toggle("hidden");
    if (!form.classList.contains("hidden")) inputTitle.focus();
  });

  btnCancel.addEventListener("click", () => {
    form.classList.add("hidden");
    inputTitle.value = "";
    inputUrl.value = "";
  });

  async function saveLink(): Promise<void> {
    const title = inputTitle.value.trim();
    const rawUrl = inputUrl.value.trim();
    if (!title || !rawUrl) return;

    let url = rawUrl;
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;

    state.links.push({ id: genId(), title, url });
    await saveLinks();
    renderLinks();

    inputTitle.value = "";
    inputUrl.value = "";
    form.classList.add("hidden");
  }

  btnSave.addEventListener("click", saveLink);

  [inputTitle, inputUrl].forEach((input) => {
    input.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter") saveLink();
      if (e.key === "Escape") btnCancel.click();
    });
  });
}

/* ─── Todos ─────────────────────────────────────────────────── */

function renderTodos(): void {
  const list = el("todoList");
  const empty = el("todosEmpty");
  list.innerHTML = "";

  if (state.todos.length === 0) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  state.todos.forEach((todo) => {
    const li = document.createElement("li");
    li.className = `todo-item${todo.completed ? " completed" : ""}`;
    li.innerHTML = `
      ${DRAG_HANDLE_SVG}
      <input type="checkbox" class="todo-checkbox" ${todo.completed ? "checked" : ""} />
      <span class="todo-text">${escapeHtml(todo.text)}</span>
      <button class="todo-delete" data-id="${todo.id}" title="Remove">×</button>
    `;

    li.querySelector<HTMLInputElement>(".todo-checkbox")!.addEventListener(
      "change",
      async (e) => {
        const item = state.todos.find((t) => t.id === todo.id);
        if (item) item.completed = (e.target as HTMLInputElement).checked;
        await saveTodos();
        renderTodos();
      },
    );

    li.querySelector<HTMLButtonElement>(".todo-delete")!.addEventListener(
      "click",
      async () => {
        state.todos = state.todos.filter((t) => t.id !== todo.id);
        await saveTodos();
        renderTodos();
      },
    );

    addTodoDragHandlers(li, todo.id);
    list.appendChild(li);
  });
}

function addTodoDragHandlers(item: HTMLLIElement, todoId: string): void {
  item.draggable = true;

  item.addEventListener("dragstart", (e) => {
    dragSrcId = todoId;
    requestAnimationFrame(() => item.classList.add("dragging"));
    e.dataTransfer!.effectAllowed = "move";
    e.dataTransfer!.setData("text/plain", todoId);
  });

  item.addEventListener("dragend", () => {
    dragSrcId = null;
    item.classList.remove("dragging");
    clearDropIndicators();
  });

  item.addEventListener("dragover", (e) => {
    e.preventDefault();
    if (!dragSrcId || dragSrcId === todoId) return;
    e.dataTransfer!.dropEffect = "move";
    const rect = item.getBoundingClientRect();
    const inTopHalf = e.clientY < rect.top + rect.height / 2;
    item.classList.toggle("drag-over-before", inTopHalf);
    item.classList.toggle("drag-over-after", !inTopHalf);
  });

  item.addEventListener("dragleave", (e) => {
    if (!item.contains(e.relatedTarget as Node)) {
      item.classList.remove("drag-over-before", "drag-over-after");
    }
  });

  item.addEventListener("drop", async (e) => {
    e.preventDefault();
    clearDropIndicators();
    if (!dragSrcId || dragSrcId === todoId) return;

    const dragged = state.todos.find((t) => t.id === dragSrcId);
    if (!dragged) return;

    const rect = item.getBoundingClientRect();
    const insertBefore = e.clientY < rect.top + rect.height / 2;

    const filtered = state.todos.filter((t) => t.id !== dragSrcId);
    const targetIdx = filtered.findIndex((t) => t.id === todoId);
    filtered.splice(insertBefore ? targetIdx : targetIdx + 1, 0, dragged);

    state.todos = filtered;
    await saveTodos();
    renderTodos();
  });
}

function initTodos(): void {
  const btnAdd = el("btnAddTodo");
  const form = el("formTodo");
  const input = el<HTMLInputElement>("todoText");
  const btnSave = el("saveTodoBtn");
  const btnCancel = el("cancelTodoBtn");

  btnAdd.addEventListener("click", () => {
    form.classList.toggle("hidden");
    if (!form.classList.contains("hidden")) input.focus();
  });

  btnCancel.addEventListener("click", () => {
    form.classList.add("hidden");
    input.value = "";
  });

  async function saveTodo(): Promise<void> {
    const text = input.value.trim();
    if (!text) return;

    state.todos.push({ id: genId(), text, completed: false });
    await saveTodos();
    renderTodos();

    input.value = "";
    form.classList.add("hidden");
  }

  btnSave.addEventListener("click", saveTodo);
  input.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Enter") saveTodo();
    if (e.key === "Escape") btnCancel.click();
  });
}

/* ─── Notes ─────────────────────────────────────────────────── */

function formatDate(isoString: string): string {
  const d = new Date(isoString);
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function renderNotes(): void {
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
        await saveNotes();
        renderNotes();
      });

    list.appendChild(div);
  });
}

function initNotes(): void {
  const btnAdd = el("btnAddNote");
  const form = el("formNote");
  const textarea = el<HTMLTextAreaElement>("noteText");
  const btnSave = el("saveNoteBtn");
  const btnCancel = el("cancelNoteBtn");

  btnAdd.addEventListener("click", () => {
    form.classList.toggle("hidden");
    if (!form.classList.contains("hidden")) textarea.focus();
  });

  btnCancel.addEventListener("click", () => {
    form.classList.add("hidden");
    textarea.value = "";
  });

  async function saveNote(): Promise<void> {
    const text = textarea.value.trim();
    if (!text) return;

    state.notes.push({ id: genId(), text, date: new Date().toISOString() });
    await saveNotes();
    renderNotes();

    textarea.value = "";
    form.classList.add("hidden");
  }

  btnSave.addEventListener("click", saveNote);
  textarea.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) saveNote();
    if (e.key === "Escape") btnCancel.click();
  });
}

/* ─── Toast ─────────────────────────────────────────────────── */

let toastTimer: ReturnType<typeof setTimeout> | null = null;

function showToast(
  message: string,
  type: "success" | "error" = "success",
): void {
  const toast = el("toast");
  toast.textContent = message;
  toast.className = `toast toast--${type} toast--visible`;

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("toast--visible");
  }, 3000);
}

/* ─── Export / Import ───────────────────────────────────────── */

interface BackupFile {
  version: string;
  exportedAt: string;
  links: Link[];
  todos: Todo[];
  notes: Note[];
  config: Config;
}

function exportBackup(): void {
  const backup: BackupFile = {
    version: "0.2.0",
    exportedAt: new Date().toISOString(),
    links: state.links,
    todos: state.todos,
    notes: state.notes,
    config: state.config,
  };

  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const date = new Date().toISOString().slice(0, 10);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ntd-backup-${date}.json`;
  a.click();

  URL.revokeObjectURL(url);
  showToast("Backup exported successfully");
}

function isValidBackup(data: unknown): data is BackupFile {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    Array.isArray(d.links) &&
    Array.isArray(d.todos) &&
    Array.isArray(d.notes) &&
    typeof d.config === "object" &&
    d.config !== null
  );
}

function initBackup(): void {
  const btnExport = el("btnExport");
  const btnImport = el("btnImport");
  const fileInput = el<HTMLInputElement>("importFileInput");
  const confirmBox = el("importConfirm");
  const btnConfirm = el("btnConfirmImport");
  const btnCancel = el("btnCancelImport");

  let pendingBackup: BackupFile | null = null;

  btnExport.addEventListener("click", exportBackup);

  btnImport.addEventListener("click", () => {
    fileInput.value = "";
    fileInput.click();
  });

  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string) as unknown;
        if (!isValidBackup(parsed)) {
          showToast("Invalid backup file", "error");
          return;
        }
        pendingBackup = parsed;
        confirmBox.classList.remove("hidden");
      } catch {
        showToast("Could not read file", "error");
      }
    };
    reader.readAsText(file);
  });

  btnConfirm.addEventListener("click", async () => {
    if (!pendingBackup) return;

    state.links = pendingBackup.links;
    state.todos = pendingBackup.todos;
    state.notes = pendingBackup.notes;
    state.config = pendingBackup.config;

    await Promise.all([saveLinks(), saveTodos(), saveNotes(), saveConfig()]);

    applyTheme(state.config.theme);
    applyLinksLayout(state.config.linksLayout ?? "grid");
    renderLinks();
    renderTodos();
    renderNotes();

    pendingBackup = null;
    confirmBox.classList.add("hidden");
    showToast("Backup imported successfully");
  });

  btnCancel.addEventListener("click", () => {
    pendingBackup = null;
    confirmBox.classList.add("hidden");
  });
}

/* ─── Boot ──────────────────────────────────────────────────── */

async function init(): Promise<void> {
  await loadState();

  initTheme();
  initLinksLayout();
  initClock();
  initNav();
  initLinks();
  initTodos();
  initNotes();
  initBackup();

  renderLinks();
  renderTodos();
  renderNotes();
}

document.addEventListener("DOMContentLoaded", init);
