// RESOLVERS — implement contract (app/contract.ts). DB/sqlite/pg ẩn trong đây (data.ts).
// Tiêm vào engine: makeServer/fluxe(..., { resolvers }) → engine dựng /__rpc + validate từ contract.
import { backend as store } from "./data";
import type { Resolvers } from "../../.fluxe/gen/server";

export const resolvers: Resolvers = {
  todos: () => store.listTodos(),
  addTodo: ({ title }) => store.addTodo(title),
  toggleTodo: ({ id }) => store.toggleTodo(id),
};
