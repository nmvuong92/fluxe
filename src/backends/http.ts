// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import type { Backend, Todo } from "./types";

/* Backend #3/#4: gọi một service THẬT qua HTTP (Go hoặc Rust).
 * Cùng interface Backend → cell + frontend KHÔNG đổi một dòng.
 * Service chỉ cần tôn trọng "hợp đồng" 3 endpoint:
 *   GET  /todos                 → Todo[]
 *   POST /todos {title}         → Todo
 *   POST /todos/{id}/toggle     → Todo[]
 */
export function createHttpBackend(name: string, baseUrl: string): Backend {
  const base = baseUrl.replace(/\/$/, "");
  async function j<T>(path: string, init?: RequestInit): Promise<T> {
    const r = await fetch(base + path, init);
    if (!r.ok) throw new Error(`${name} backend ${path} → HTTP ${r.status}`);
    return (await r.json()) as T;
  }
  return {
    name,
    listTodos() {
      return j<Todo[]>("/todos");
    },
    addTodo(title) {
      return j<Todo>("/todos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title }),
      });
    },
    toggleTodo(id) {
      return j<Todo[]>(`/todos/${encodeURIComponent(id)}/toggle`, { method: "POST" });
    },
  };
}
