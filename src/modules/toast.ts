import { el } from "../utils/dom";

/* ─── Toast ──────────────────────────────────────────────────── */

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export function showToast(
  message: string,
  type: "success" | "error" = "success",
): void {
  const toast = el("toast");
  toast.textContent = message;
  toast.className = `toast toast--${type} toast--visible`;

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("toast--visible");
  }, 3000);
}
