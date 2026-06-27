// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* Codegen contract — MỘT schema → types TS. Thuần (string-in/string-out), dễ test. */

export type FieldType = "string" | "bool" | "int";
export interface Schema {
  types: Record<string, Record<string, FieldType>>;
}

const TS: Record<FieldType, string> = { string: "string", bool: "boolean", int: "number" };

export function genTS(s: Schema): string {
  return Object.entries(s.types)
    .map(([name, fields]) =>
      `export interface ${name} {\n` +
      Object.entries(fields).map(([f, t]) => `  ${f}: ${TS[t]};`).join("\n") +
      `\n}`)
    .join("\n\n") + "\n";
}
