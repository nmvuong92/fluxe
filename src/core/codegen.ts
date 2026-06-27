// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* Codegen contract polyglot — MỘT schema → types TS + Go + Rust (chữ ký RCA:
 * type-safe xuyên ngôn ngữ). Thuần (string-in/string-out), dễ test. */

export type FieldType = "string" | "bool" | "int";
export interface Schema {
  types: Record<string, Record<string, FieldType>>;
}

const pascal = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const TS: Record<FieldType, string> = { string: "string", bool: "boolean", int: "number" };
const GO: Record<FieldType, string> = { string: "string", bool: "bool", int: "int" };
const RS: Record<FieldType, string> = { string: "String", bool: "bool", int: "i64" };

export function genTS(s: Schema): string {
  return Object.entries(s.types)
    .map(([name, fields]) =>
      `export interface ${name} {\n` +
      Object.entries(fields).map(([f, t]) => `  ${f}: ${TS[t]};`).join("\n") +
      `\n}`)
    .join("\n\n") + "\n";
}

export function genGo(s: Schema, pkg = "contract"): string {
  return `package ${pkg}\n\n` +
    Object.entries(s.types)
      .map(([name, fields]) =>
        `type ${name} struct {\n` +
        Object.entries(fields).map(([f, t]) => `\t${pascal(f)} ${GO[t]} \`json:"${f}"\``).join("\n") +
        `\n}`)
      .join("\n\n") + "\n";
}

export function genRust(s: Schema): string {
  return Object.entries(s.types)
    .map(([name, fields]) =>
      `#[derive(Clone, Debug)]\npub struct ${name} {\n` +
      Object.entries(fields).map(([f, t]) => `    pub ${f}: ${RS[t]},`).join("\n") +
      `\n}`)
    .join("\n\n") + "\n";
}
