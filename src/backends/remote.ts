import type { Backend, Todo } from "./types";

/* Backend #2: giả lập gọi service từ xa (vd: Go/Rust qua HTTP).
 * Cùng interface Backend → cell và frontend KHÔNG đổi một dòng.
 * Ở đây mô phỏng bằng delay + prefix để thấy rõ là backend khác. */
export function createRemoteBackend(): Backend {
  let todos: Todo[] = [
    { id: "r1", title: "[từ service Go] Đơn hàng #1001", done: false },
    { id: "r2", title: "[từ service Go] Đơn hàng #1002", done: true },
  ];
  let seq = 3;
  const delay = () => new Promise((r) => setTimeout(r, 5));
  return {
    name: "remote-go",
    async listTodos() { await delay(); return todos; },
    async addTodo(title) {
      await delay();
      const t: Todo = { id: "r" + seq++, title: "[từ service Go] " + title, done: false };
      todos = [...todos, t];
      return t;
    },
    async toggleTodo(id) {
      await delay();
      todos = todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
      return todos;
    },
  };
}
