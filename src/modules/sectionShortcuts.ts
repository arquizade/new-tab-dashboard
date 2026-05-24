import { registerShortcut } from "./keyboard";
import { switchSection } from "./nav";
import { resetLinksQuery } from "./links";

/* ─── Section Shortcuts (1 / 2 / 3) ─────────────────────────── */

const SECTION_KEYS: Record<string, string> = {
  "1": "links",
  "2": "todos",
  "3": "notes",
};

export function initSectionShortcuts(): void {
  for (const [key, section] of Object.entries(SECTION_KEYS)) {
    registerShortcut({
      key,
      handler: () => switchSection(section, resetLinksQuery),
    });
  }
}
