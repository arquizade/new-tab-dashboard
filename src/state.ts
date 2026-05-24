import type {
  AppState,
  Config,
  Link,
  Note,
  StorageAdapter,
  Todo,
} from "./types";

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
};

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
  state.todos = todos ?? [];
  state.notes = notes ?? [];
  state.config = config ?? { ...DEFAULT_CONFIG };
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
