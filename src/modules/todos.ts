import { el, escapeHtml } from "../utils/dom";
import { genId } from "../utils/id";
import { addDragHandlers, reorderItems, DRAG_HANDLE_SVG } from "../utils/drag";
import { state, saveTodos } from "../state";
import { registerShortcut } from "./keyboard";
import { showToast } from "./toast";
import { renderTodoKanban } from "./todosKanban";
import {
  TODO_BUCKETS,
  TODO_BUCKET_LABELS,
  defaultTodoBucket,
  getVisibleBuckets,
  renderTodoBucketChips,
  todoBucket,
} from "./todosBuckets";
import type { StorageAdapter, Todo, TodoBucket, TodoStatus } from "../types";

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

/* ─── Group Header ───────────────────────────────────────────── */

const CHEVRON_SVG = `
  <svg
    class="todo-group-chevron"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    aria-hidden="true"
  >
    <path d="M9 6l6 6-6 6" />
  </svg>`;

/** Parked is an icebox: collapsed until the user opens it. */
let parkedCollapsed = true;

/* ─── Render ─────────────────────────────────────────────────── */

export function renderTodos(storage: StorageAdapter): void {
  renderTodoBucketChips();

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
    empty.textContent = "No tasks. Enjoy the quiet.";
    empty.classList.remove("hidden");
    return;
  }

  const visibleBuckets = getVisibleBuckets();
  const visibleTodos = state.todos.filter((todo) => visibleBuckets.has(todoBucket(todo)));

  if (visibleTodos.length === 0) {
    empty.textContent = "No tasks in the selected buckets.";
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  TODO_BUCKETS.forEach((bucket) => {
    if (!visibleBuckets.has(bucket)) return;

    const items = visibleTodos.filter((todo) => todoBucket(todo) === bucket);
    if (items.length === 0) return;

    const isParked = bucket === "parked";
    const collapsed = isParked && parkedCollapsed;

    const group = document.createElement("li");
    group.className = "todo-group";
    group.dataset.bucket = bucket;

    const header = document.createElement(isParked ? "button" : "div");
    if (isParked) {
      (header as HTMLButtonElement).type = "button";
      header.setAttribute("aria-expanded", String(!collapsed));
    }
    header.className = "todo-group-header";
    header.dataset.bucket = bucket;
    header.title = `Drag a task here to move it to ${TODO_BUCKET_LABELS[bucket]}`;
    header.innerHTML = `
      ${isParked ? CHEVRON_SVG : ""}
      <span class="todo-group-title">${TODO_BUCKET_LABELS[bucket]}</span>
      <span class="todo-group-count">${items.length}</span>
    `;

    if (isParked) {
      header.addEventListener("click", () => {
        parkedCollapsed = !parkedCollapsed;
        renderTodoList(storage);
      });
    }

    addBucketDropHandlers(header, bucket, storage);

    const groupList = document.createElement("ul");
    groupList.className = "todo-group-list";
    if (collapsed) groupList.classList.add("hidden");

    items.forEach((todo) => groupList.appendChild(buildTodoItem(todo, storage)));

    group.append(header, groupList);
    list.appendChild(group);
  });
}

function buildTodoItem(todo: Todo, storage: StorageAdapter): HTMLLIElement {
  const isDone = todo.status === "done";
  const li = document.createElement("li");
  li.className = `todo-item${isDone ? " completed" : ""}`;
  li.dataset.bucket = todoBucket(todo);
  li.innerHTML = `
    ${DRAG_HANDLE_SVG}
    <input type="checkbox" class="todo-checkbox" ${isDone ? "checked" : ""} />
    <span class="todo-text">${escapeHtml(todo.text)}</span>
    ${statusPillHtml(todo.status)}
    <button class="todo-delete" data-id="${todo.id}" title="Remove">×</button>
  `;

  li.querySelector<HTMLInputElement>(".todo-checkbox")!.addEventListener("change", async (e) => {
    const item = state.todos.find((t) => t.id === todo.id);
    if (item) {
      item.status = (e.target as HTMLInputElement).checked ? "done" : "todo";
    }
    try {
      await saveTodos(storage);
      renderTodos(storage);
    } catch {
      showToast("Failed to update todo", "error");
    }
  });

  li.querySelector<HTMLButtonElement>(".todo-delete")!.addEventListener("click", async () => {
    state.todos = state.todos.filter((t) => t.id !== todo.id);
    try {
      await saveTodos(storage);
      renderTodos(storage);
    } catch {
      showToast("Failed to delete todo", "error");
    }
  });

  addDragHandlers({
    element: li,
    itemId: todo.id,
    onDrop: async (draggedId, targetId, insertBefore) => {
      const dragged = state.todos.find((t) => t.id === draggedId);
      const target = state.todos.find((t) => t.id === targetId);
      if (!dragged || !target) return;

      /* Dropping onto a row in another group also files it there. */
      const targetBucket = todoBucket(target);
      if (todoBucket(dragged) !== targetBucket) {
        dragged.bucket = targetBucket === "active" ? undefined : targetBucket;
      }

      state.todos = reorderItems(state.todos, draggedId, targetId, insertBefore);
      try {
        await saveTodos(storage);
        renderTodos(storage);
      } catch {
        showToast("Failed to reorder todos", "error");
      }
    },
  });

  return li;
}

/* ─── Move to Bucket by Dropping on a Header ─────────────────── */

function addBucketDropHandlers(
  header: HTMLElement,
  bucket: TodoBucket,
  storage: StorageAdapter,
): void {
  header.addEventListener("dragover", (e) => {
    if (!e.dataTransfer?.types.includes("text/plain")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    header.classList.add("drag-over");
  });

  header.addEventListener("dragleave", (e) => {
    if (!header.contains(e.relatedTarget as Node)) header.classList.remove("drag-over");
  });

  header.addEventListener("drop", async (e) => {
    e.preventDefault();
    header.classList.remove("drag-over");

    const draggedId = e.dataTransfer?.getData("text/plain");
    if (!draggedId) return;

    const dragged = state.todos.find((t) => t.id === draggedId);
    if (!dragged || todoBucket(dragged) === bucket) return;

    dragged.bucket = bucket === "active" ? undefined : bucket;

    /* Dropping on a header puts the task at the top of that group. */
    const others = state.todos.filter((t) => t.id !== draggedId);
    const firstIdx = others.findIndex((t) => todoBucket(t) === bucket);
    if (firstIdx === -1) others.push(dragged);
    else others.splice(firstIdx, 0, dragged);
    state.todos = others;

    try {
      await saveTodos(storage);
      renderTodos(storage);
    } catch {
      showToast("Failed to move task", "error");
    }
  });
}

/* ─── CRUD ───────────────────────────────────────────────────── */

export function initTodos(storage: StorageAdapter): void {
  const form = el("formTodo");
  const input = el<HTMLInputElement>("todoText");
  const bucketSelect = el<HTMLSelectElement>("todoBucket");
  const btnAdd = el("btnAddTodo");
  const btnSave = el("saveTodoBtn");
  const btnCancel = el("cancelTodoBtn");

  function openForm(): void {
    bucketSelect.value = defaultTodoBucket();
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

    const bucket = bucketSelect.value as TodoBucket;
    state.todos.push({
      id: genId(),
      text,
      status: "todo",
      ...(bucket !== "active" ? { bucket } : {}),
    });
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
    if (e.key === "Enter") {
      saveTodo().catch((err) => console.error("[ntd] Failed to save todo:", err));
    }
    if (e.key === "Escape") closeForm();
  });

  /* A cancelled drag should not leave a group header highlighted. */
  document.addEventListener("dragend", () => {
    document
      .querySelectorAll(".todo-group-header.drag-over")
      .forEach((header) => header.classList.remove("drag-over"));
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
