// RESOLVERS — implement contract (app/contract.ts). DB/sqlite/pg ẩn trong đây (data.ts).
// Kiểu suy TỪ contract (Resolvers<typeof contract>) — sai chữ ký = compile error ngay, 0 codegen.
import type { Resolvers } from "@nmvuong92/fluxe";
import { contract } from "../contract";
import { backend as store } from "./data";

export const resolvers: Resolvers<typeof contract> = {
  todos: () => store.listTodos(),
  // ctx.publish → topic "todoFeed" (subscription) → mọi client đang nghe nhận list mới (realtime).
  addTodo: async ({ title }, { publish }) => {
    const t = await store.addTodo(title);
    publish("todoFeed", await store.listTodos());
    return t;
  },
  toggleTodo: async ({ id }, { publish }) => {
    const list = await store.toggleTodo(id);
    publish("todoFeed", list);
    return list;
  },
};
