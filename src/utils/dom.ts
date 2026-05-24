/* ─── DOM Helpers ────────────────────────────────────────────── */

export function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "\x26amp;")
    .replace(/</g, "\x26lt;")
    .replace(/>/g, "\x26gt;")
    .replace(/"/g, "\x26quot;")
    .replace(/'/g, "\x26#039;");
}
