// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* Standard Schema (https://standardschema.dev) — interface CHUẨN để contract nhận BẤT KỲ validator
 * nào (Zod/Valibot/TypeBox/ArkType) thay vì khoá Zod. Core chỉ gọi `~standard.validate`; 0 codegen,
 * thuần inference. Zod ≥3.24 đã implement `~standard`. */
import { FluxeError } from "./errors.ts";

export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly "~standard": {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (value: unknown) => StandardResult<Output> | Promise<StandardResult<Output>>;
    readonly types?: { readonly input: Input; readonly output: Output } | undefined;
  };
}
type StandardResult<Output> =
  | { readonly value: Output; readonly issues?: undefined }
  | { readonly issues: ReadonlyArray<StandardIssue> };
interface StandardIssue {
  readonly message: string;
  readonly path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }> | undefined;
}

export type InferInput<S extends StandardSchemaV1> = NonNullable<S["~standard"]["types"]>["input"];
export type InferOutput<S extends StandardSchemaV1> = NonNullable<S["~standard"]["types"]>["output"];

/* Validate qua interface chuẩn (await sync|async). Sai → FluxeError 400 code=validation + details
 * field-level (giữ nguyên shape lỗi cũ để form/UI map đúng field). */
export async function validateStandard<S extends StandardSchemaV1>(schema: S, raw: unknown): Promise<InferOutput<S>> {
  let r = schema["~standard"].validate(raw);
  if (r instanceof Promise) r = await r;
  if (r.issues) {
    const details = r.issues.map((i) => ({
      path: (i.path ?? []).map((p) => (typeof p === "object" ? p.key : p)).join(".") || "(root)",
      message: i.message,
    }));
    throw new FluxeError("validation", "Dữ liệu không hợp lệ", 400, details);
  }
  return r.value;
}
