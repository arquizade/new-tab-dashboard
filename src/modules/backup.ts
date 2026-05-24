import { el } from "../utils/dom";
import { state, saveLinks, saveTodos, saveNotes, saveConfig } from "../state";
import { applyTheme } from "./theme";
import { applyLinksLayout } from "./linksLayout";
import { renderLinks } from "./links";
import { renderTodos } from "./todos";
import { renderNotes } from "./notes";
import { showToast } from "./toast";
import type { BackupFile, StorageAdapter } from "../types";

/* ─── Version ────────────────────────────────────────────────── */

const BACKUP_VERSION = chrome.runtime?.getManifest?.()?.version ?? "0.2.0";

/* ─── Validation ─────────────────────────────────────────────── */

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

/* ─── Export ─────────────────────────────────────────────────── */

function exportBackup(): void {
  const backup: BackupFile = {
    version: BACKUP_VERSION,
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

/* ─── Import ─────────────────────────────────────────────────── */

async function applyBackup(
  backup: BackupFile,
  storage: StorageAdapter,
): Promise<void> {
  state.links = backup.links;
  state.todos = backup.todos;
  state.notes = backup.notes;
  state.config = backup.config;

  await Promise.all([
    saveLinks(storage),
    saveTodos(storage),
    saveNotes(storage),
    saveConfig(storage),
  ]);

  applyTheme(state.config.theme);
  applyLinksLayout(state.config.linksLayout ?? "grid");
  renderLinks(storage);
  renderTodos(storage);
  renderNotes(storage);
}

/* ─── Init ───────────────────────────────────────────────────── */

export function initBackup(storage: StorageAdapter): void {
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
    try {
      await applyBackup(pendingBackup, storage);
      showToast("Backup imported successfully");
    } catch {
      showToast("Import failed", "error");
    } finally {
      pendingBackup = null;
      confirmBox.classList.add("hidden");
    }
  });

  btnCancel.addEventListener("click", () => {
    pendingBackup = null;
    confirmBox.classList.add("hidden");
  });
}
