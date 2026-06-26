import type { Backend, Todo } from "../backends/types";

/* Testing story — lợi thế của fluxe: Backend là interface → mock cực dễ.
 * createTestBackend cho phép test loader/action của cell mà KHÔNG cần HTTP/DB:
 *   - seed dữ liệu đầu vào
 *   - .calls: spy mọi lời gọi (method + args)
 *   - .failNext(method): tiêm lỗi đúng 1 lần để test nhánh lỗi */

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
