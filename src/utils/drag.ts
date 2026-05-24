/* ─── Generic Drag-to-Reorder ────────────────────────────────── */

let dragSrcId: string | null = null;

export const DRAG_HANDLE_SVG = `
  <span class="drag-handle" aria-hidden="true">
    <svg viewBox="0 0 8 14" fill="currentColor">
      <circle cx="2" cy="2"  r="1.4"/>
      <circle cx="6" cy="2"  r="1.4"/>
      <circle cx="2" cy="7"  r="1.4"/>
      <circle cx="6" cy="7"  r="1.4"/>
      <circle cx="2" cy="12" r="1.4"/>
      <circle cx="6" cy="12" r="1.4"/>
    </svg>
  </span>`;

export function clearDropIndicators(): void {
  document
    .querySelectorAll<HTMLElement>(".link-card, .todo-item")
    .forEach((c) => c.classList.remove("drag-over-before", "drag-over-after"));
}

export interface DragHandlerOptions<T extends HTMLElement> {
  element: T;
  itemId: string;
  onDrop: (
    draggedId: string,
    targetId: string,
    insertBefore: boolean,
  ) => Promise<void>;
}

export function addDragHandlers<T extends HTMLElement>({
  element,
  itemId,
  onDrop,
}: DragHandlerOptions<T>): void {
  element.draggable = true;

  element.addEventListener("dragstart", (e) => {
    dragSrcId = itemId;
    requestAnimationFrame(() => element.classList.add("dragging"));
    e.dataTransfer!.effectAllowed = "move";
    e.dataTransfer!.setData("text/plain", itemId);
  });

  element.addEventListener("dragend", () => {
    dragSrcId = null;
    element.classList.remove("dragging");
    clearDropIndicators();
  });

  element.addEventListener("dragover", (e) => {
    e.preventDefault();
    if (!dragSrcId || dragSrcId === itemId) return;
    e.dataTransfer!.dropEffect = "move";

    const rect = element.getBoundingClientRect();
    const inTopHalf = e.clientY < rect.top + rect.height / 2;
    element.classList.toggle("drag-over-before", inTopHalf);
    element.classList.toggle("drag-over-after", !inTopHalf);
  });

  element.addEventListener("dragleave", (e) => {
    if (!element.contains(e.relatedTarget as Node)) {
      element.classList.remove("drag-over-before", "drag-over-after");
    }
  });

  element.addEventListener("drop", async (e) => {
    e.preventDefault();
    clearDropIndicators();
    if (!dragSrcId || dragSrcId === itemId) return;

    const rect = element.getBoundingClientRect();
    const insertBefore = e.clientY < rect.top + rect.height / 2;
    await onDrop(dragSrcId, itemId, insertBefore);
  });
}

/* ─── Array Reorder Helper ───────────────────────────────────── */

export function reorderItems<T extends { id: string }>(
  items: T[],
  draggedId: string,
  targetId: string,
  insertBefore: boolean,
): T[] {
  const dragged = items.find((i) => i.id === draggedId);
  if (!dragged) return items;

  const filtered = items.filter((i) => i.id !== draggedId);
  const targetIdx = filtered.findIndex((i) => i.id === targetId);
  filtered.splice(insertBefore ? targetIdx : targetIdx + 1, 0, dragged);
  return filtered;
}
