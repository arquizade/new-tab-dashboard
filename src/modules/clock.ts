import { el } from "../utils/dom";
import { formatClock } from "../utils/date";

/* ─── Clock ──────────────────────────────────────────────────── */

function updateClock(): void {
  const { time, date } = formatClock(new Date());
  el("timeDisplay").textContent = time;
  el("dateDisplay").textContent = date;
}

export function initClock(): void {
  updateClock();
  setInterval(updateClock, 30_000);
}
