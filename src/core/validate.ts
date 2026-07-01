// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { validateStandard, type StandardSchemaV1 } from "./standard.ts";
import type { Action } from "./engine";

/* Input validation qua Standard Schema (nhận Zod/Valibot/TypeBox…). Sai → FluxeError 400
 * code=validation + details field-level. Dùng cho action/op input (body không tin được). */
export function validateInput<S extends StandardSchemaV1>(schema: S, raw: unknown) {
  return validateStandard(schema, raw);   // async: await sync|async validator
}

/* Bọc một action với schema input → runtime tự validate trước khi gọi handler. */
export function withInput<I, O>(schema: StandardSchemaV1<any, I>, handler: Action<I, O>): Action<I, O> {
  const fn = ((ctx: any) => handler(ctx)) as Action<I, O> & { inputSchema?: StandardSchemaV1<any, I> };
  fn.inputSchema = schema;
  return fn;
}
