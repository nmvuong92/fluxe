/* ============================================================
 * Backend Adapter — interface chuẩn để SWITCH backend.
 * loader/action chỉ biết tới interface này, không biết
 * dữ liệu đến từ memory, Postgres, hay một service Go từ xa.
 * Đổi backend = thay một implementation, frontend & cell không đổi.
 * ============================================================ */

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
