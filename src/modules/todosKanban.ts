import { el, escapeHtml } from "../utils/dom";
import { state, saveTodos } from "../state";
import { DRAG_HANDLE_SVG } from "../utils/drag";
import { showToast } from "./toast";
import type { StorageAdapter, Todo, TodoStatus } from "../types";

/* ─── Kanban Board ───────────────────────────────────────────── */
/* Cards are dragged between the To-Do / In Progress / Review /   */
/* Done columns; dropping a card updates its status and its       */
/* position within `state.todos`.                                 */

const COLUMNS: { status: TodoStatus; label: string }[] = [
  { status: "todo", label: "To-Do" },
  { status: "inProgress", label: "In Progress" },
  { status: "review", label: "Review" },
  { status: "done", label: "Done" },
];

let kanbanDragSrcId: string | null = null;

/**
 * Moves `draggedId` to `newStatus`, positioning it just before/after
 * `targetId` (or at the end of the column if there is no target).
 */
function moveTodoCard(
  todos: Todo[],
  draggedId: string,
  newStatus: TodoStatus,
  targetId: string | null,
  insertBefore: boolean,
): Todo[] {
  const dragged = todos.find((t) => t.id === draggedId);
  if (!dragged) return todos;

  dragged.status = newStatus;
  const filtered = todos.filter((t) => t.id !== draggedId);

  if (!targetId) {
    filtered.push(dragged);
    return filtered;
  }

  const targetIdx = filtered.findIndex((t) => t.id === targetId);
  if (targetIdx === -1) {
    filtered.push(dragged);
    return filtered;
  }

  filtered.splice(insertBefore ? targetIdx : targetIdx + 1, 0, dragged);
  return filtered;
}

function clearKanbanIndicators(): void {
  document
    .querySelectorAll(".kanban-card, .kanban-col-cards")
    .forEach((elm) =>
      elm.classList.remove(
        "drag-over-before",
        "drag-over-after",
        "drag-over-empty",
      ),
    );
}

export function renderTodoKanban(storage: StorageAdapter): void {
  const board = el("todoKanban");
  board.innerHTML = "";

  COLUMNS.forEach(({ status, label }) => {
    const items = state.todos.filter((t) => t.status === status);

    const col = document.createElement("div");
    col.className = "kanban-col";
    col.innerHTML = `
      <div class="kanban-col-header">
        <span class="kanban-col-title">${label}</span>
        <span class="kanban-col-count">${items.length}</span>
      </div>
    `;

    const cardsWrap = document.createElement("div");
    cardsWrap.className = "kanban-col-cards";
    cardsWrap.dataset.status = status;

    items.forEach((todo) => {
      const card = document.createElement("div");
      card.className = "kanban-card";
      card.draggable = true;
      card.innerHTML = `
        ${DRAG_HANDLE_SVG}
        <span class="kanban-card-text">${escapeHtml(todo.text)}</span>
        <button class="card-delete" data-id="${todo.id}" title="Remove">×</button>
      `;

      card
        .querySelector<HTMLButtonElement>(".card-delete")!
        .addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();
          state.todos = state.todos.filter((t) => t.id !== todo.id);
          try {
            await saveTodos(storage);
            renderTodoKanban(storage);
          } catch {
            showToast("Failed to delete task", "error");
          }
        });

      card.addEventListener("dragstart", (e) => {
        kanbanDragSrcId = todo.id;
        requestAnimationFrame(() => card.classList.add("dragging"));
        e.dataTransfer!.effectAllowed = "move";
        e.dataTransfer!.setData("text/plain", todo.id);
      });

      card.addEventListener("dragend", () => {
        kanbanDragSrcId = null;
        card.classList.remove("dragging");
        clearKanbanIndicators();
      });

      card.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!kanbanDragSrcId || kanbanDragSrcId === todo.id) return;
        e.dataTransfer!.dropEffect = "move";

        const rect = card.getBoundingClientRect();
        const inTopHalf = e.clientY < rect.top + rect.height / 2;
        card.classList.toggle("drag-over-before", inTopHalf);
        card.classList.toggle("drag-over-after", !inTopHalf);
      });

      card.addEventListener("dragleave", (e) => {
        if (!card.contains(e.relatedTarget as Node)) {
          card.classList.remove("drag-over-before", "drag-over-after");
        }
      });

      card.addEventListener("drop", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        clearKanbanIndicators();
        if (!kanbanDragSrcId) return;

        const rect = card.getBoundingClientRect();
        const insertBefore = e.clientY < rect.top + rect.height / 2;
        state.todos = moveTodoCard(
          state.todos,
          kanbanDragSrcId,
          status,
          todo.id,
          insertBefore,
        );
        try {
          await saveTodos(storage);
          renderTodoKanban(storage);
        } catch {
          showToast("Failed to move task", "error");
        }
      });

      cardsWrap.appendChild(card);
    });

    // Allow dropping into empty space within the column (past the last card).
    cardsWrap.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (!kanbanDragSrcId) return;
      e.dataTransfer!.dropEffect = "move";
      if (e.target === cardsWrap) {
        cardsWrap.classList.add("drag-over-empty");
      }
    });

    cardsWrap.addEventListener("dragleave", (e) => {
      if (!cardsWrap.contains(e.relatedTarget as Node)) {
        cardsWrap.classList.remove("drag-over-empty");
      }
    });

    cardsWrap.addEventListener("drop", async (e) => {
      e.preventDefault();
      clearKanbanIndicators();
      if (!kanbanDragSrcId || e.target !== cardsWrap) return;

      state.todos = moveTodoCard(
        state.todos,
        kanbanDragSrcId,
        status,
        null,
        false,
      );
      try {
        await saveTodos(storage);
        renderTodoKanban(storage);
      } catch {
        showToast("Failed to move task", "error");
      }
    });

    col.appendChild(cardsWrap);
    board.appendChild(col);
  });
}
