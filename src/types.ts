/* ─── Domain Types ───────────────────────────────────────────── */

export interface Link {
  id: string;
  title: string;
  url: string;
}

export interface Todo {
  id: string;
  text: string;
  completed: boolean;
}

export interface Note {
  id: string;
  text: string;
  date: string;
}

export interface Config {
  theme: "dark" | "light";
  linksLayout: "grid" | "list";
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
