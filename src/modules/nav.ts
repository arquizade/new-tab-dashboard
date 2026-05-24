import { el } from "../utils/dom";

/* ─── Sidebar Navigation ─────────────────────────────────────── */

const FORM_IDS = ["formLink", "formTodo", "formNote"] as const;

export function hideAllForms(): void {
  FORM_IDS.forEach((id) => el(id).classList.add("hidden"));
}

export function clearLinksSearch(onClear: () => void): void {
  const input = document.getElementById(
    "linksSearch",
  ) as HTMLInputElement | null;
  const clear = document.getElementById("linksClearSearch");
  if (input) input.value = "";
  if (clear) clear.classList.add("hidden");
  onClear();
}

export function switchSection(name: string, onLinksLeave: () => void): void {
  document
    .querySelectorAll<HTMLElement>(".nav-btn")
    .forEach((b) => b.classList.remove("active"));
  document
    .querySelectorAll<HTMLElement>(".section")
    .forEach((s) => s.classList.remove("active"));

  const btn = document.querySelector<HTMLElement>(
    `.nav-btn[data-section="${name}"]`,
  );
  if (btn) btn.classList.add("active");
  el(`section-${name}`).classList.add("active");

  if (name !== "links") clearLinksSearch(onLinksLeave);
  hideAllForms();
}

export function initNav(onLinksLeave: () => void): void {
  document.querySelectorAll<HTMLButtonElement>(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.section) switchSection(btn.dataset.section, onLinksLeave);
    });
  });
}
