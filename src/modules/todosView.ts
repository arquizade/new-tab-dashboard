import { el } from "../utils/dom";
import { state, saveConfig } from "../state";
import { renderTodos } from "./todos";
import type { StorageAdapter } from "../types";

/* ─── Todos View Toggle (List / Kanban) ──────────────────────── */

export function applyTodosView(view: "list" | "kanban"): void {
  const list = el("todoList");
  const empty = el("todosEmpty");
  const kanban = el("todoKanban");
  const btnList = el("todosViewList");
  const btnKanban = el("todosViewKanban");

  if (view === "kanban") {
    list.classList.add("hidden");
    empty.classList.add("hidden");
    kanban.classList.remove("hidden");
    btnKanban.classList.add("active");
    btnList.classList.remove("active");
  } else {
    kanban.classList.add("hidden");
    list.classList.remove("hidden");
    btnList.classList.add("active");
    btnKanban.classList.remove("active");
  }
}

export function initTodosView(storage: StorageAdapter): void {
  applyTodosView(state.config.todosView ?? "list");

  el("todosViewList").addEventListener("click", async () => {
    state.config.todosView = "list";
    applyTodosView("list");
    renderTodos(storage);
    await saveConfig(storage);
  });

  el("todosViewKanban").addEventListener("click", async () => {
    state.config.todosView = "kanban";
    applyTodosView("kanban");
    renderTodos(storage);
    await saveConfig(storage);
  });
}
