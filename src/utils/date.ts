/* ─── Shared Constants ───────────────────────────────────────── */

export const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/* ─── Formatters ─────────────────────────────────────────────── */

export function formatDate(isoString: string): string {
  const d = new Date(isoString);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export function formatClock(date: Date): { time: string; date: string } {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return {
    time: `${h}:${m}`,
    date: `${DAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`,
  };
}
