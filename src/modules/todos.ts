import { el, escapeHtml } from "../utils/dom";
import { genId } from "../utils/id";
import { addDragHandlers, reorderItems, DRAG_HANDLE_SVG } from "../utils/drag";
import { state, saveTodos } from "../state";
import { registerShortcut } from "./keyboard";
import { showToast } from "./toast";
import { renderTodoKanban } from "./todosKanban";
import type { StorageAdapter, TodoStatus } from "../types";

/* ─── Status Pill ────────────────────────────────────────────── */

const STATUS_LABELS: Record<TodoStatus, string> = {
  todo: "To-Do",
  inProgress: "In Progress",
  review: "Review",
  done: "Done",
};

function statusPillHtml(status: TodoStatus): string {
  return `<span class="status-pill status-${status}">${STATUS_LABELS[status]}</span>`;
}

/* ─── Render ─────────────────────────────────────────────────── */

export function renderTodos(storage: StorageAdapter): void {
  if (state.config.todosView === "kanban") {
    renderTodoKanban(storage);
  } else {
    renderTodoList(storage);
  }
}

function renderTodoList(storage: StorageAdapter): void {
  const list = el("todoList");
  const empty = el("todosEmpty");
  list.innerHTML = "";

  if (state.todos.length === 0) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  state.todos.forEach((todo) => {
    const isDone = todo.status === "done";
    const li = document.createElement("li");
    li.className = `todo-item${isDone ? " completed" : ""}`;
    li.innerHTML = `
      ${DRAG_HANDLE_SVG}
      <input type="checkbox" class="todo-checkbox" ${isDone ? "checked" : ""} />
      <span class="todo-text">${escapeHtml(todo.text)}</span>
      ${statusPillHtml(todo.status)}
      <button class="todo-delete" data-id="${todo.id}" title="Remove">×</button>
    `;

    li.querySelector<HTMLInputElement>(".todo-checkbox")!.addEventListener(
      "change",
      async (e) => {
        const item = state.todos.find((t) => t.id === todo.id);
        if (item) {
          item.status = (e.target as HTMLInputElement).checked
            ? "done"
            : "todo";
        }
        try {
          await saveTodos(storage);
          renderTodos(storage);
        } catch {
          showToast("Failed to update todo", "error");
        }
      },
    );

    li.querySelector<HTMLButtonElement>(".todo-delete")!.addEventListener(
      "click",
      async () => {
        state.todos = state.todos.filter((t) => t.id !== todo.id);
        try {
          await saveTodos(storage);
          renderTodos(storage);
        } catch {
          showToast("Failed to delete todo", "error");
        }
      },
    );

    addDragHandlers({
      element: li,
      itemId: todo.id,
      onDrop: async (draggedId, targetId, insertBefore) => {
        state.todos = reorderItems(
          state.todos,
          draggedId,
          targetId,
          insertBefore,
        );
        try {
          await saveTodos(storage);
          renderTodos(storage);
        } catch {
          showToast("Failed to reorder todos", "error");
        }
      },
    });

    list.appendChild(li);
  });
}

/* ─── CRUD ───────────────────────────────────────────────────── */

export function initTodos(storage: StorageAdapter): void {
  const form = el("formTodo");
  const input = el<HTMLInputElement>("todoText");
  const btnAdd = el("btnAddTodo");
  const btnSave = el("saveTodoBtn");
  const btnCancel = el("cancelTodoBtn");

  function openForm(): void {
    form.classList.remove("hidden");
    form.classList.add("flex");
    input.focus();
  }

  function closeForm(): void {
    form.classList.add("hidden");
    form.classList.remove("flex");
    input.value = "";
  }

  async function saveTodo(): Promise<void> {
    const text = input.value.trim();
    if (!text) return;

    state.todos.push({ id: genId(), text, status: "todo" });
    try {
      await saveTodos(storage);
      renderTodos(storage);
      closeForm();
    } catch {
      showToast("Failed to save todo", "error");
    }
  }

  btnAdd.addEventListener("click", () => {
    if (form.classList.contains("hidden")) openForm();
    else closeForm();
  });

  btnCancel.addEventListener("click", closeForm);
  btnSave.addEventListener("click", saveTodo);

  input.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Enter") saveTodo();
    if (e.key === "Escape") closeForm();
  });

  registerShortcut({
    key: "a",
    requiresSection: "section-todos",
    handler: () => openForm(),
  });

  registerShortcut({
    key: "A",
    requiresSection: "section-todos",
    handler: () => openForm(),
  });
}
