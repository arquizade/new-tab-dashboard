import type { AppState, Config, Link, Notebook, Note, StorageAdapter, Todo } from "./types";

/* ─── Storage Keys ───────────────────────────────────────────── */

const KEYS = {
  links: "ntd-links",
  todos: "ntd-todos",
  notes: "ntd-notes",
  notebooks: "ntd-notebooks",
  config: "ntd-config",
} as const;

const DEFAULT_CONFIG: Config = {
  theme: "dark",
  linksLayout: "grid",
  linkOpenMode: "newTab",
  todosView: "list",
};

/* ─── Migration ──────────────────────────────────────────────── */

const VALID_STATUSES = new Set(["todo", "inProgress", "review", "done"]);
const VALID_BUCKETS = new Set(["backlog", "parked"]);

/**
 * Older backups/storage may contain todos with a boolean `completed`
 * field instead of `status`. Normalize everything to the new shape,
 * storing a bucket only for the non-default shelves.
 */
function migrateTodos(rawTodos: unknown[]): Todo[] {
  return rawTodos.map((raw) => {
    const t = raw as Partial<Todo> & { completed?: boolean };
    const status = VALID_STATUSES.has(t.status as string)
      ? (t.status as Todo["status"])
      : t.completed
        ? "done"
        : "todo";
    const bucket = VALID_BUCKETS.has(t.bucket as string)
      ? (t.bucket as Todo["bucket"])
      : undefined;
    return {
      id: t.id ?? "",
      text: t.text ?? "",
      status,
      ...(bucket ? { bucket } : {}),
    };
  });
}

const VALID_NOTE_COLORS = new Set(["blue", "green", "yellow", "red", "purple"]);

/**
 * Older backups/storage may contain notes without a `color`. Normalize
 * everything to the new shape and drop any invalid `reminderAt` value.
 */
function migrateNotes(rawNotes: unknown[]): Note[] {
  return rawNotes.map((raw) => {
    const n = raw as Partial<Note>;
    const color = VALID_NOTE_COLORS.has(n.color as string) ? (n.color as Note["color"]) : "blue";
    const reminderAt =
      typeof n.reminderAt === "string" && !isNaN(Date.parse(n.reminderAt))
        ? n.reminderAt
        : undefined;
    const notebookId =
      typeof n.notebookId === "string" && n.notebookId ? n.notebookId : undefined;
    return {
      id: n.id ?? "",
      text: n.text ?? "",
      date: n.date ?? new Date().toISOString(),
      color,
      ...(reminderAt ? { reminderAt } : {}),
      ...(notebookId ? { notebookId } : {}),
    };
  });
}

/**
 * Drops entries that cannot be rendered (missing id or name) and any
 * duplicate ids, so the chip row and note filters stay consistent.
 * Shared with backup import.
 */
export function sanitizeNotebooks(rawNotebooks: unknown): Notebook[] {
  if (!Array.isArray(rawNotebooks)) return [];

  const seen = new Set<string>();
  const notebooks: Notebook[] = [];

  rawNotebooks.forEach((raw) => {
    if (typeof raw !== "object" || raw === null) return;
    const nb = raw as Partial<Notebook>;
    if (typeof nb.id !== "string" || !nb.id || seen.has(nb.id)) return;
    const name = typeof nb.name === "string" ? nb.name.trim() : "";
    if (!name) return;

    seen.add(nb.id);
    notebooks.push({
      id: nb.id,
      name,
      createdAt: typeof nb.createdAt === "string" ? nb.createdAt : new Date().toISOString(),
    });
  });

  return notebooks;
}

/* ─── State Singleton ────────────────────────────────────────── */

export const state: AppState = {
  links: [],
  todos: [],
  notes: [],
  notebooks: [],
  config: { ...DEFAULT_CONFIG },
};

/* ─── Load ───────────────────────────────────────────────────── */

export async function loadState(storage: StorageAdapter): Promise<void> {
  const [links, todos, notes, notebooks, config] = await Promise.all([
    storage.get<Link[]>(KEYS.links),
    storage.get<Todo[]>(KEYS.todos),
    storage.get<Note[]>(KEYS.notes),
    storage.get<Notebook[]>(KEYS.notebooks),
    storage.get<Config>(KEYS.config),
  ]);

  state.links = links ?? [];
  state.todos = migrateTodos(todos ?? []);
  state.notes = migrateNotes(notes ?? []);
  state.notebooks = sanitizeNotebooks(notebooks);
  state.config = { ...DEFAULT_CONFIG, ...config };
}

/* ─── Persist ────────────────────────────────────────────────── */

export async function saveLinks(storage: StorageAdapter): Promise<void> {
  try {
    await storage.set(KEYS.links, state.links);
  } catch (err) {
    console.error("[ntd] Failed to save links:", err);
    throw err;
  }
}

export async function saveTodos(storage: StorageAdapter): Promise<void> {
  try {
    await storage.set(KEYS.todos, state.todos);
  } catch (err) {
    console.error("[ntd] Failed to save todos:", err);
    throw err;
  }
}

export async function saveNotes(storage: StorageAdapter): Promise<void> {
  try {
    await storage.set(KEYS.notes, state.notes);
  } catch (err) {
    console.error("[ntd] Failed to save notes:", err);
    throw err;
  }
}

export async function saveNotebooks(storage: StorageAdapter): Promise<void> {
  try {
    await storage.set(KEYS.notebooks, state.notebooks);
  } catch (err) {
    console.error("[ntd] Failed to save notebooks:", err);
    throw err;
  }
}

export async function saveConfig(storage: StorageAdapter): Promise<void> {
  try {
    await storage.set(KEYS.config, state.config);
  } catch (err) {
    console.error("[ntd] Failed to save config:", err);
    throw err;
  }
}
