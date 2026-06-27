// Test spy cho Backend của app — mock CRUD mà KHÔNG cần HTTP/DB.
// Vì Backend là interface (app/backend.ts), mock cực dễ: seed + .calls + .failNext.
import type { Backend, Todo } from "./backend/data";

export interface TestBackend extends Backend {
  calls: { method: string; args: unknown[] }[];
  failNext(method: "listTodos" | "addTodo" | "toggleTodo", error?: Error): void;
}

export function createTestBackend(initial: Todo[] = []): TestBackend {
  let todos: Todo[] = initial.map((t) => ({ ...t }));
  let seq = initial.length + 1;
  const calls: { method: string; args: unknown[] }[] = [];
  const failures: Record<string, Error | undefined> = {};

  const guard = (method: string) => {
    const e = failures[method];
    if (e) { failures[method] = undefined; throw e; }
  };

  return {
    name: "test",
    calls,
    failNext(method, error = new Error(`test fail: ${method}`)) {
      failures[method] = error;
    },
    async listTodos() {
      calls.push({ method: "listTodos", args: [] });
      guard("listTodos");
      return todos.map((t) => ({ ...t }));
    },
    async addTodo(title) {
      calls.push({ method: "addTodo", args: [title] });
      guard("addTodo");
      const t: Todo = { id: String(seq++), title, done: false };
      todos = [...todos, t];
      return { ...t };
    },
    async toggleTodo(id) {
      calls.push({ method: "toggleTodo", args: [id] });
      guard("toggleTodo");
      todos = todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
      return todos.map((t) => ({ ...t }));
    },
  };
}
