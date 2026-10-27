import { el } from "../utils/dom";
import { state } from "../state";
import type { TodoBucket } from "../types";

/* ─── Todo Bucket Filter ─────────────────────────────────────── */
/*
 * Buckets are a shelf beside the `Todo.status` pipeline, not extra
 * statuses. Which buckets are visible is view state only: it stays
 * in memory and is not part of config or backups.
 */

export const TODO_BUCKETS: TodoBucket[] = ["active", "backlog", "parked"];

export const TODO_BUCKET_LABELS: Record<TodoBucket, string> = {
  active: "Active",
  backlog: "Backlog",
  parked: "Parked",
};

const visibleBuckets = new Set<TodoBucket>(TODO_BUCKETS);
let onChangeRef: () => void = () => {};

export function getVisibleBuckets(): Set<TodoBucket> {
  return visibleBuckets;
}

/** A missing or unknown bucket reads as "active". */
export function todoBucket(todo: { bucket?: TodoBucket }): TodoBucket {
  return todo.bucket === "backlog" || todo.bucket === "parked" ? todo.bucket : "active";
}

/** Bucket a new task lands in: the only visible one, else Active. */
export function defaultTodoBucket(): TodoBucket {
  if (visibleBuckets.size === 1) return [...visibleBuckets][0];
  return visibleBuckets.has("active")
    ? "active"
    : TODO_BUCKETS.find((bucket) => visibleBuckets.has(bucket))!;
}

/* ─── Chip Row ───────────────────────────────────────────────── */

export function renderTodoBucketChips(): void {
  const bar = el("todoBucketBar");
  if (!bar) return;
  bar.innerHTML = "";

  TODO_BUCKETS.forEach((bucket) => {
    const isVisible = visibleBuckets.has(bucket);
    const label = TODO_BUCKET_LABELS[bucket];

    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `todo-bucket-chip${isVisible ? " active" : ""}`;
    chip.dataset.bucket = bucket;
    chip.setAttribute("aria-pressed", String(isVisible));
    chip.title = `${isVisible ? "Hide" : "Show"} ${label.toLowerCase()} tasks`;

    const name = document.createElement("span");
    name.textContent = label;
    const count = document.createElement("span");
    count.className = "todo-bucket-count";
    count.textContent = String(state.todos.filter((todo) => todoBucket(todo) === bucket).length);
    chip.append(name, count);

    chip.addEventListener("click", () => {
      /* Keep at least one bucket visible so the page is never blank. */
      if (isVisible && visibleBuckets.size === 1) return;

      if (isVisible) visibleBuckets.delete(bucket);
      else visibleBuckets.add(bucket);

      renderTodoBucketChips();
      onChangeRef();
    });

    bar.appendChild(chip);
  });
}

export function initTodoBuckets(onChange: () => void): void {
  onChangeRef = onChange;
  renderTodoBucketChips();
}
