/* ─── Domain Types ───────────────────────────────────────────── */

export interface Link {
  id: string;
  title: string;
  url: string;
}

export type TodoStatus = "todo" | "inProgress" | "review" | "done";

/** A shelf beside the status pipeline; absent = "active". */
export type TodoBucket = "active" | "backlog" | "parked";

export interface Todo {
  id: string;
  text: string;
  status: TodoStatus;
  bucket?: TodoBucket;
}

export interface Notebook {
  id: string;
  name: string;
  createdAt: string;
}

export type NoteColor = "blue" | "green" | "yellow" | "red" | "purple";

export interface Note {
  id: string;
  text: string;
  date: string;
  color: NoteColor;
  /** ISO timestamp for a one-time reminder notification, if set. */
  reminderAt?: string;
  /** Notebook this note belongs to; absent = unfiled. */
  notebookId?: string;
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
  notebooks: Notebook[];
  config: Config;
}

export interface BackupFile {
  version: string;
  exportedAt: string;
  links: Link[];
  todos: Todo[];
  notes: Note[];
  /** Absent in backups exported before notebooks shipped. */
  notebooks?: Notebook[];
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
