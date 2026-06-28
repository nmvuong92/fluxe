import { f, type Infer } from "@nmvuong92/fluxe";

/* NGUỒN SỰ THẬT của contract cell↔backend — khai báo NGHIỆP VỤ (queries/mutations) bằng builder Zod.
 * Type suy ra TỨC THÌ (Infer<>), 0 codegen, DB ẩn sau resolver. */
const Todo = f.object({ id: f.string, title: f.string, done: f.bool });
export type Todo = Infer<typeof Todo>;

export const contract = f.contract({
  todos: f.query(Todo.array()),                        // đọc
  addTodo: f.mutation({ title: f.string }, Todo),      // ghi (nghiệp vụ bất kỳ)
  toggleTodo: f.mutation({ id: f.string }, Todo.array()),
  todoFeed: f.subscription(Todo.array()),              // stream realtime (broker SSE) — typed
});

export type AppContract = typeof contract;   // client import type-only → 0 schema xuống browser
