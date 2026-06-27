// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* Contract DSL — khai báo nghiệp vụ cell↔backend (queries/mutations + types) bằng TS-object.
 * Codegen thuần string-in/out: types · Zod · server Resolvers · client api. DB ẩn sau resolver. */

export type Scalar = "string" | "int" | "bool";
export interface OpDef { in?: Record<string, string>; out: string }
export interface Contract {
  types?: Record<string, Record<string, string>>;
  queries?: Record<string, OpDef>;
  mutations?: Record<string, OpDef>;
}

export function defineContract(c: Contract): Contract { return c; }

const SCALAR: Record<string, string> = { string: "string", int: "number", bool: "boolean" };

/* Type-expr → TS: hậu tố [] (mảng), ? (optional); scalar map; còn lại = ref type giữ nguyên. */
export function tsType(expr: string): string {
  let e = expr.trim();
  let optional = false;
  if (e.endsWith("?")) { optional = true; e = e.slice(0, -1); }
  let arr = false;
  if (e.endsWith("[]")) { arr = true; e = e.slice(0, -2); }
  let base = SCALAR[e] ?? e;
  if (arr) base = `${base}[]`;
  return optional ? `${base} | undefined` : base;
}

const pascal = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function genObjInterface(name: string, fields: Record<string, string>): string {
  return `export interface ${name} {\n` +
    Object.entries(fields).map(([f, t]) => `  ${f}: ${tsType(t)};`).join("\n") +
    `\n}`;
}

export function genContractTypes(c: Contract): string {
  const out: string[] = [];
  for (const [name, fields] of Object.entries(c.types ?? {})) out.push(genObjInterface(name, fields));
  const ops = { ...(c.queries ?? {}), ...(c.mutations ?? {}) };
  for (const [op, def] of Object.entries(ops)) {
    if (def.in) out.push(genObjInterface(`${pascal(op)}Input`, def.in));
  }
  return out.join("\n\n") + "\n";
}

const ZSCALAR: Record<string, string> = { string: "z.string()", int: "z.number()", bool: "z.boolean()" };

function zodExpr(expr: string): string {
  let e = expr.trim();
  let optional = false;
  if (e.endsWith("?")) { optional = true; e = e.slice(0, -1); }
  let arr = false;
  if (e.endsWith("[]")) { arr = true; e = e.slice(0, -2); }
  let z = ZSCALAR[e] ?? "z.any()";   // ref type input: v1 chưa nested-validate
  if (arr) z = `z.array(${z})`;
  return optional ? `${z}.optional()` : z;
}

export function genZod(c: Contract): string {
  const ops = { ...(c.queries ?? {}), ...(c.mutations ?? {}) };
  const blocks: string[] = [];
  for (const [op, def] of Object.entries(ops)) {
    if (!def.in) continue;
    const fields = Object.entries(def.in).map(([f, t]) => `  ${f}: ${zodExpr(t)},`).join("\n");
    blocks.push(`export const ${op}Input = z.object({\n${fields}\n});`);
  }
  return `import { z } from "zod";\n\n${blocks.join("\n\n")}\n`;
}

function sigOf(op: string, def: OpDef): string {
  const ret = `Promise<${tsType(def.out)}>`;
  return def.in ? `${op}(input: ${pascal(op)}Input): ${ret};` : `${op}(): ${ret};`;
}

export function genServer(c: Contract): string {
  const typeNames = Object.keys(c.types ?? {});
  const ops = { ...(c.queries ?? {}), ...(c.mutations ?? {}) };
  const inputNames = Object.entries(ops).filter(([, d]) => d.in).map(([op]) => `${pascal(op)}Input`);
  const imports = [...typeNames, ...inputNames];
  const sigs = Object.entries(ops).map(([op, def]) => `  ${sigOf(op, def)}`).join("\n");
  const kinds = [
    ...Object.keys(c.queries ?? {}).map((op) => `  ${op}: "query",`),
    ...Object.keys(c.mutations ?? {}).map((op) => `  ${op}: "mutation",`),
  ].join("\n");
  const typeImport = imports.length ? `import type { ${imports.join(", ")} } from "./types";\n\n` : "";
  return typeImport +
    `export interface Resolvers {\n${sigs}\n}\n\n` +
    `export const OPS = {\n${kinds}\n} as const;\n\n` +
    `export function createApi(r: Resolvers): Resolvers { return r; }\n`;
}

export function genClient(c: Contract): string {
  const typeNames = Object.keys(c.types ?? {});
  const ops = { ...(c.queries ?? {}), ...(c.mutations ?? {}) };
  const inputNames = Object.entries(ops).filter(([, d]) => d.in).map(([op]) => `${pascal(op)}Input`);
  const imports = [...typeNames, ...inputNames];
  const lines = Object.entries(ops).map(([op, def]) => {
    const ret = `Promise<${tsType(def.out)}>`;
    return def.in
      ? `  ${op}: (input: ${pascal(op)}Input): ${ret} => rpcCall("${op}", input),`
      : `  ${op}: (): ${ret} => rpcCall("${op}"),`;
  }).join("\n");
  const typeImport = imports.length ? `import type { ${imports.join(", ")} } from "./types";\n` : "";
  return `import { rpcCall } from "@nmvuong92/fluxe/client";\n${typeImport}\nexport const api = {\n${lines}\n};\n`;
}
