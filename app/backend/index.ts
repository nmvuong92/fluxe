// RESOLVERS — implement contract (app/contract.ts). DB/sqlite/pg ẩn trong đây (data.ts).
// Kiểu suy TỪ contract (Resolvers<typeof contract>) — sai chữ ký = compile error ngay, 0 codegen.
import type { Resolvers } from "@nmvuong92/fluxe";
import { contract } from "../contract";
import { backend as store } from "./data";

export const resolvers: Resolvers<typeof contract> = {
  todos: () => store.listTodos(),
  addTodo: ({ title }) => store.addTodo(title),
  toggleTodo: ({ id }) => store.toggleTodo(id),
};
