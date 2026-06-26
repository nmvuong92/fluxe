import type { ZodType } from "zod";
import { FluxeError } from "./errors.ts";
import type { Action } from "./engine";

/* Input validation từ schema (Zod). Sai → FluxeError 400 code=validation + details
 * field-level (gắn error handling T5). Dùng cho action input (body không tin được). */
export function validateInput<T>(schema: ZodType<T>, raw: unknown): T {
  const r = schema.safeParse(raw);
  if (!r.success) {
    const details = r.error.issues.map((i) => ({ path: i.path.join(".") || "(root)", message: i.message }));
    throw new FluxeError("validation", "Dữ liệu không hợp lệ", 400, details);
  }
  return r.data;
}

/* Bọc một action với schema input → runtime tự validate trước khi gọi handler. */
export function withInput<I, O>(schema: ZodType<I>, handler: Action<I, O>): Action<I, O> {
  const fn = ((ctx: any) => handler(ctx)) as Action<I, O> & { inputSchema?: ZodType<I> };
  fn.inputSchema = schema;
  return fn;
}
