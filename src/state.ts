import type { AppState, Config, Link, Note, StorageAdapter, Todo } from "./types";

/* ─── Storage Keys ───────────────────────────────────────────── */

const KEYS = {
  links: "ntd-links",
  todos: "ntd-todos",
  notes: "ntd-notes",
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

/**
 * Older backups/storage may contain todos with a boolean `completed`
 * field instead of `status`. Normalize everything to the new shape.
 */
function migrateTodos(rawTodos: unknown[]): Todo[] {
  return rawTodos.map((raw) => {
    const t = raw as Partial<Todo> & { completed?: boolean };
    const status = VALID_STATUSES.has(t.status as string)
      ? (t.status as Todo["status"])
      : t.completed
        ? "done"
        : "todo";
    return { id: t.id ?? "", text: t.text ?? "", status };
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
    return {
      id: n.id ?? "",
      text: n.text ?? "",
      date: n.date ?? new Date().toISOString(),
      color,
      ...(reminderAt ? { reminderAt } : {}),
    };
  });
}

/* ─── State Singleton ────────────────────────────────────────── */

export const state: AppState = {
  links: [],
  todos: [],
  notes: [],
  config: { ...DEFAULT_CONFIG },
};

/* ─── Load ───────────────────────────────────────────────────── */

export async function loadState(storage: StorageAdapter): Promise<void> {
  const [links, todos, notes, config] = await Promise.all([
    storage.get<Link[]>(KEYS.links),
    storage.get<Todo[]>(KEYS.todos),
    storage.get<Note[]>(KEYS.notes),
    storage.get<Config>(KEYS.config),
  ]);

  state.links = links ?? [];
  state.todos = migrateTodos(todos ?? []);
  state.notes = migrateNotes(notes ?? []);
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

export async function saveConfig(storage: StorageAdapter): Promise<void> {
  try {
    await storage.set(KEYS.config, state.config);
  } catch (err) {
    console.error("[ntd] Failed to save config:", err);
    throw err;
  }
}
