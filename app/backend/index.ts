// RESOLVERS — implement contract (app/contract.ts). DB/sqlite/pg ẩn trong đây (data.ts).
// Kiểu suy TỪ contract (Resolvers<typeof contract>) — sai chữ ký = compile error ngay, 0 codegen.
import type { Resolvers } from "@nmvuong92/fluxe";
import { contract } from "../contract";
import { backend as store } from "./data";

export const resolvers: Resolvers<typeof contract> = {
  // ctx.span("db.x", fn) → span con dưới resolver trong waterfall DevTools (Jaeger-lite).
  todos: (ctx) => ctx!.span("db.list", () => store.listTodos()),
  // ctx.publish → topic "todoFeed" (subscription) → mọi client đang nghe nhận list mới (realtime).
  addTodo: async ({ title }, { publish, span }) => {
    const t = await span("db.insert", () => store.addTodo(title));
    publish("todoFeed", await span("db.list", () => store.listTodos()));
    return t;
  },
  toggleTodo: async ({ id }, { publish, span }) => {
    const list = await span("db.toggle", () => store.toggleTodo(id));
    publish("todoFeed", list);
    return list;
  },
};
