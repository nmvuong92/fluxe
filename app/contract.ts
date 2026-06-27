import { defineContract } from "@nmvuong92/fluxe";

/* NGUỒN SỰ THẬT của contract cell↔backend — khai báo NGHIỆP VỤ (queries/mutations), không phải DB.
 * `fx gen` (tự chạy trong sync) → .fluxe/gen/{types,validators,server,client}.ts. DB ẩn trong resolver. */
export const contract = defineContract({
  types: {
    Todo: { id: "string", title: "string", done: "bool" },
  },
  queries: {
    todos: { out: "Todo[]" },
  },
  mutations: {
    addTodo: { in: { title: "string" }, out: "Todo" },
    toggleTodo: { in: { id: "string" }, out: "Todo[]" },
  },
});
