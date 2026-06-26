import type { Schema } from "./core/codegen";

/* Nguồn sự thật DUY NHẤT cho contract dữ liệu — codegen ra TS/Go/Rust.
 * Đổi field ở đây → cả 3 ngôn ngữ đồng bộ (type-safe xuyên ngôn ngữ). */
export const contract: Schema = {
  types: {
    Todo: { id: "string", title: "string", done: "bool" },
  },
};
