import type { StorageAdapter } from "./types";

/* ─── Chrome Extension Storage ───────────────────────────────── */

export class ChromeStorageAdapter implements StorageAdapter {
  async get<T>(key: string): Promise<T | null> {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) =>
        resolve((result[key] as T) ?? null),
      );
    });
  }

  async set<T>(key: string, value: T): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [key]: value }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }
}

/* ─── Local Storage (dev / non-extension) ────────────────────── */

export class LocalStorageAdapter implements StorageAdapter {
  async get<T>(key: string): Promise<T | null> {
    const val = localStorage.getItem(key);
    return val ? (JSON.parse(val) as T) : null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    localStorage.setItem(key, JSON.stringify(value));
  }
}

/* ─── Factory ────────────────────────────────────────────────── */

export function createStorageAdapter(): StorageAdapter {
  if (typeof chrome !== "undefined" && !!chrome.storage) {
    return new ChromeStorageAdapter();
  }
  return new LocalStorageAdapter();
}
