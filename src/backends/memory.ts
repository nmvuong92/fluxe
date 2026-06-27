// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import type { Backend, Todo } from "./types";

/* Backend #1: in-memory. Đại diện cho "TS thuần". */
export function createMemoryBackend(): Backend {
  let todos: Todo[] = [
    { id: "1", title: "Học kiến trúc fullstack", done: true },
    { id: "2", title: "Dựng PoC switch backend", done: false },
  ];
  let seq = 3;
  return {
    name: "memory",
    async listTodos() { return todos; },
    async addTodo(title) {
      const t: Todo = { id: String(seq++), title, done: false };
      todos = [...todos, t];
      return t;
    },
    async toggleTodo(id) {
      todos = todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
      return todos;
    },
  };
}
