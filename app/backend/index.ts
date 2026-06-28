// RESOLVERS — implement contract (app/contract.ts). DB/sqlite/pg ẩn trong đây (data.ts).
// Kiểu suy TỪ contract (Resolvers<typeof contract>) — sai chữ ký = compile error ngay, 0 codegen.
import { type Resolvers, FluxeError } from "@nmvuong92/fluxe";
import { contract } from "../contract";
import { backend as store, BidError } from "./data";
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
  createLot: async ({ title, description, startPrice, endsAt }, { session, span, publish }) => {
    const lot = await span("db.createLot", () => store.createLot({ title, description, startPrice, endsAt, sellerId: session!.id }));
    publish("lot:created", lot);   // → job worker (host) nghe & lên lịch đóng phiên đúng giờ (decouple)
    return lot;
  },

  // Đặt giá: publish giá mới cho phòng `lot:<id>` + báo người vừa bị vượt giá `notif:<id>`.
  placeBid: async ({ lotId, amount }, { session, publish, span }) => {
    let r;
    try {
      r = await span("db.placeBid", () => store.placeBid({ lotId, bidderId: session!.id, amount }));
    } catch (e) {
      if (e instanceof BidError) throw new FluxeError("bid", e.message, 400);   // → 400 có message rõ
      throw e;
    }
    publish(`lot:${lotId}`, r.lot);   // realtime: mọi người xem lot thấy giá mới
    if (r.previousLeader && r.previousLeader !== session!.id) {
      publish(`notif:${r.previousLeader}`, { type: "outbid", lotId, title: r.lot.title, amount });   // 🔔
    }
    return r.bid;
  },
};
