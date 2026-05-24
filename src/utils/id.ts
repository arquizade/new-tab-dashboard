/* ─── ID Generation ──────────────────────────────────────────── */

export function genId(): string {
  return crypto.randomUUID();
}
