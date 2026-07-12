/* ─── Domain Types ───────────────────────────────────────────── */

export interface Link {
  id: string;
  title: string;
  url: string;
}

export type TodoStatus = "todo" | "inProgress" | "review" | "done";

export interface Todo {
  id: string;
  text: string;
  status: TodoStatus;
}

export type NoteColor = "blue" | "green" | "yellow" | "red" | "purple";

export interface Note {
  id: string;
  text: string;
  date: string;
  color: NoteColor;
  /** ISO timestamp for a one-time reminder notification, if set. */
  reminderAt?: string;
}

export interface Config {
  theme: "dark" | "light";
  linksLayout: "grid" | "list";
  linkOpenMode: "newTab" | "sameTab";
  todosView: "list" | "kanban";
}

export interface AppState {
  links: Link[];
  todos: Todo[];
  notes: Note[];
  config: Config;
}

export interface BackupFile {
  version: string;
  exportedAt: string;
  links: Link[];
  todos: Todo[];
  notes: Note[];
  config: Config;
}

/* ─── Storage Adapter Interface ──────────────────────────────── */

export interface StorageAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
}

/* ─── Shortcut Registry ──────────────────────────────────────── */

export interface ShortcutEntry {
  key: string;
  requiresSection?: string;
  allowInInput?: boolean;
  handler: (e: KeyboardEvent) => void;
}
