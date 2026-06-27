// TẦNG DATA CỦA APP — bạn sở hữu file này (không phải engine).
// Định nghĩa interface domain của bạn + chọn nơi lưu (driver). Cell nhận `backend` này
// trong loader/action qua DI: makeServer(manifest, cells, layouts, { backend }).
import { createMemoryBackend } from "../src/backends/memory";
import { createSqliteBackend } from "../src/backends/sqlite";

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

// 2) Chọn driver NGAY TẠI ĐÂY (không qua manifest). Đổi 1 dòng = đổi nơi lưu:
//    memory (dev) ↔ sqlite (persist file, set FLUXE_SQLITE_PATH) ↔ postgres (inject client `pg`).
export const backend: Backend = process.env.FLUXE_SQLITE_PATH
  ? createSqliteBackend(process.env.FLUXE_SQLITE_PATH)
  : createMemoryBackend();
