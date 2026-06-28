import { f, type Infer } from "@nmvuong92/fluxe";

/* NGUỒN SỰ THẬT của contract cell↔backend — khai báo NGHIỆP VỤ (queries/mutations) bằng builder Zod.
 * Type suy ra TỨC THÌ (Infer<>), 0 codegen, DB ẩn sau resolver. */
const Todo = f.object({ id: f.string, title: f.string, done: f.bool });
export type Todo = Infer<typeof Todo>;

// ── Bidly: đấu giá ────────────────────────────────────────────────────────────
const Lot = f.object({
  id: f.string, title: f.string, description: f.string,
  startPrice: f.number, currentPrice: f.number, currentLeader: f.string.nullable(),
  status: f.string, endsAt: f.number, sellerId: f.string,
});
export type Lot = Infer<typeof Lot>;

export const contract = f.contract({
  // demo cũ
  todos: f.query(Todo.array()),
  addTodo: f.mutation({ title: f.string }, Todo),
  toggleTodo: f.mutation({ id: f.string }, Todo.array()),
  todoFeed: f.subscription(Todo.array()),

  // Bidly CRUD
  lots: f.query(Lot.array()),                                                   // đọc danh sách
  createLot: f.mutation(                                                        // seller tạo phiên
    { title: f.string, description: f.string, startPrice: f.coerce.number(), endsAt: f.coerce.number() },
    Lot, { auth: "seller" },
  ),
});

export type AppContract = typeof contract;   // client import type-only → 0 schema xuống browser
