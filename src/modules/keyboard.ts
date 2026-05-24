import type { ShortcutEntry } from "../types";
import { hideAllForms } from "./nav";

/* ─── Shortcut Registry ──────────────────────────────────────── */

const shortcuts: ShortcutEntry[] = [];

export function registerShortcut(entry: ShortcutEntry): void {
  shortcuts.push(entry);
}

function getActiveSection(): HTMLElement | null {
  return document.querySelector<HTMLElement>(".section.active");
}

function isInputActive(target: HTMLElement): boolean {
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA";
}

export function initKeyboard(): void {
  document.addEventListener("keydown", (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const inInput = isInputActive(target);

    if (e.key === "Escape") {
      hideAllForms();
      (document.activeElement as HTMLElement)?.blur();
      return;
    }

    for (const shortcut of shortcuts) {
      if (shortcut.key !== e.key) continue;
      if (!shortcut.allowInInput && inInput) continue;

      if (shortcut.requiresSection) {
        const active = getActiveSection();
        if (active?.id !== shortcut.requiresSection) continue;
      }

      e.preventDefault();
      shortcut.handler(e);
      return;
    }
  });
}
