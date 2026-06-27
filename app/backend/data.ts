// TẦNG DATA CỦA APP — bạn sở hữu file này (engine KHÔNG biết gì về domain này).
// Định nghĩa interface domain + implement CRUD, rồi inject qua makeServer(..., { backend }).
import { DatabaseSync } from "node:sqlite";

// 1) Interface domain — đổi theo app của bạn (Note/User/Order…). Cell chỉ thấy interface này.
export interface Todo {
  id: string;
  title: string;
  done: boolean;
}
export interface Backend {
  name: string;
  listTodos(): Promise<Todo[]>;
  addTodo(title: string): Promise<Todo>;
  toggleTodo(id: string): Promise<Todo[]>;
}

// 2a) Driver in-memory (dev/test) — TS thuần, 0 hạ tầng.
export function memoryBackend(): Backend {
  let todos: Todo[] = [
    { id: "1", title: "Học kiến trúc fullstack", done: true },
    { id: "2", title: "Dựng app đầu tiên", done: false },
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

// 2b) Driver SQLite (persist) — dùng node:sqlite TRỰC TIẾP (cần --experimental-sqlite).
//     CRUD/SQL là việc của bạn; engine không liên quan.
export function sqliteBackend(path = ":memory:"): Backend {
  const db = new DatabaseSync(path);
  db.exec(`CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0
  )`);
  const toTodo = (r: any): Todo => ({ id: String(r.id), title: r.title, done: !!r.done });
  const all = () => db.prepare("SELECT * FROM todos ORDER BY id").all().map(toTodo);
  return {
    name: "sqlite",
    async listTodos() { return all(); },
    async addTodo(title) {
      const info = db.prepare("INSERT INTO todos (title) VALUES (?)").run(title);
      return toTodo(db.prepare("SELECT * FROM todos WHERE id = ?").get(info.lastInsertRowid));
    },
    async toggleTodo(id) {
      db.prepare("UPDATE todos SET done = 1 - done WHERE id = ?").run(Number(id));
      return all();
    },
  };
}

// 3) Chọn driver — đổi 1 dòng = đổi nơi lưu (memory ↔ sqlite ↔ postgres-của-bạn).
export const backend: Backend = process.env.FLUXE_SQLITE_PATH
  ? sqliteBackend(process.env.FLUXE_SQLITE_PATH)
  : memoryBackend();
