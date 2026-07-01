// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* Contract → collection Bruno (.bru text, git-friendly, offline). Thứ Nest/Hono/tRPC không tự làm:
 * từ contract ra sẵn API client. Trả { filename → content } để `fx openapi` ghi ra đĩa. 0 dep. */
import type { Contract } from "../core/contract.ts";
import { schemaToJson } from "./schema.ts";

export interface BrunoOpts { name?: string; baseUrl?: string; prefix?: string }

/* Giá trị mẫu từ JSON Schema (placeholder cho request body trong Bruno). */
function example(json: any): any {
  switch (json?.type) {
    case "string": return "";
    case "integer": case "number": return 0;
    case "boolean": return false;
    case "null": return null;
    case "array": return [];
    case "object": {
      const o: Record<string, any> = {};
      for (const [k, v] of Object.entries(json.properties ?? {})) o[k] = example(v);
      return o;
    }
    default: return null;
  }
}

const indent = (text: string, n = 2) => text.split("\n").map((l) => " ".repeat(n) + l).join("\n");

export function toBruno(contract: Contract, opts: BrunoOpts = {}): Record<string, string> {
  const name = opts.name ?? "fluxe API";
  const baseUrl = opts.baseUrl ?? "http://localhost:5180";
  const prefix = opts.prefix ?? "/__rpc";
  const files: Record<string, string> = {
    "bruno.json": JSON.stringify({ version: "1", name, type: "collection" }, null, 2) + "\n",
    "environments/local.bru": `vars {\n  baseUrl: ${baseUrl}\n}\n`,
  };
  let seq = 0;
  for (const [op, d] of Object.entries(contract)) {
    if (d.kind === "subscription") continue;   // SSE, không phải HTTP request
    seq++;
    const hasBody = d.kind === "mutation";
    let bru = `meta {\n  name: ${op}\n  type: http\n  seq: ${seq}\n}\n\n`;
    bru += `post {\n  url: {{baseUrl}}${prefix}/${op}\n  body: ${hasBody ? "json" : "none"}\n  auth: none\n}\n`;
    if (hasBody) {
      const body = JSON.stringify(example(schemaToJson(d.input)), null, 2);
      bru += `\nbody:json {\n${indent(body)}\n}\n`;
    }
    files[`${op}.bru`] = bru;
  }
  return files;
}
