// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* Standard Schema → JSON Schema (cho OpenAPI/Bruno). Introspect surface của `f` (Zod v3);
 * validator khác (Valibot/TypeBox…) → permissive {} (vẫn dùng được, chỉ kém chi tiết). 0 dep. */

type Json = Record<string, any>;
const def = (s: any) => s?._def;
const name = (s: any) => def(s)?.typeName as string | undefined;

/* Bỏ lớp Optional/Nullable/Default để lấy schema lõi. */
function unwrap(s: any): any {
  const n = name(s);
  if (n === "ZodOptional" || n === "ZodNullable" || n === "ZodDefault") return unwrap(def(s).innerType);
  return s;
}
const isOptional = (s: any) => ["ZodOptional", "ZodDefault"].includes(name(s) ?? "");

export function schemaToJson(schema: any): Json {
  const s = unwrap(schema);
  switch (name(s)) {
    case "ZodString": return { type: "string" };
    case "ZodNumber": return { type: (def(s).checks ?? []).some((c: any) => c.kind === "int") ? "integer" : "number" };
    case "ZodBoolean": return { type: "boolean" };
    case "ZodNull": return { type: "null" };
    case "ZodArray": return { type: "array", items: schemaToJson(def(s).type) };
    case "ZodUnion": return { anyOf: (def(s).options as any[]).map(schemaToJson) };
    case "ZodObject": {
      const shape = (s.shape ?? def(s).shape?.()) as Record<string, any>;
      const properties: Json = {};
      const required: string[] = [];
      for (const [k, v] of Object.entries(shape)) {
        properties[k] = schemaToJson(v);
        if (!isOptional(v)) required.push(k);
      }
      return required.length ? { type: "object", properties, required } : { type: "object", properties };
    }
    default: return {};   // validator không phải Zod / kiểu chưa map → permissive
  }
}
