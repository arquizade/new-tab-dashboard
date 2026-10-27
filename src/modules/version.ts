import { el } from "../utils/dom";

/* ─── Version Badge ──────────────────────────────────────────── */

function getVersion(): string {
  if (typeof chrome === "undefined") return "dev";
  return chrome.runtime?.getManifest?.()?.version ?? "dev";
}

export function initVersion(): void {
  const badge = el<HTMLSpanElement>("appVersion");
  if (!badge) return;
  badge.textContent = `v${getVersion()}`;
}
