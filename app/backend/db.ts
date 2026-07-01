// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* Driver MEMORY (0-dep, dev). Đổi driver = thay file này, module KHÔNG đổi. */
export interface Todo { id: string; title: string; done: boolean }
export interface TodoStore {
  name: string;
  list(): Promise<Todo[]>;
  add(title: string): Promise<Todo>;
  toggle(id: string): Promise<Todo | null>;
}
export function makeDb(): TodoStore {
  const todos: Todo[] = []; let seq = 0;
  return {
    name: "memory",
    async list() { return todos.slice(); },
    async add(title) { const t = { id: String(++seq), title, done: false }; todos.push(t); return t; },
    async toggle(id) { const t = todos.find((x) => x.id === id); if (t) t.done = !t.done; return t ?? null; },
  };
}
