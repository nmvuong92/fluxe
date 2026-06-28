// RESOLVERS — implement contract (app/contract.ts). DB/sqlite/pg ẩn trong đây (data.ts).
// Kiểu suy TỪ contract (Resolvers<typeof contract>) — sai chữ ký = compile error ngay, 0 codegen.
import type { Resolvers } from "@nmvuong92/fluxe";
import { contract } from "../contract";
import { backend as store } from "./data";
import type { AppSession } from "../auth";   // ctx.session typed

// Resolvers<contract, AppSession> → ctx.session: AppSession | null (biết ai đang gọi).
export const resolvers: Resolvers<typeof contract, AppSession> = {
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

  // ── Bidly ──
  lots: (ctx) => ctx!.span("db.lots", () => store.listLots()),
  // ctx.session.id = sellerId (host-verified). Op guard {auth:"seller"} đã chặn ở handleRpc.
  createLot: ({ title, description, startPrice, endsAt }, { session, span }) =>
    span("db.createLot", () => store.createLot({ title, description, startPrice, endsAt, sellerId: session!.id })),
};
