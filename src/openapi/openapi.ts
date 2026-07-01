// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* Contract → OpenAPI 3.1. Ánh xạ đúng runtime fluxe: query/mutation = POST /__rpc/<op>
 * (mutation có requestBody từ input). Subscription = SSE (/__sse/<op>) → bỏ khỏi paths HTTP. */
import type { Contract } from "../core/contract.ts";
import { schemaToJson } from "./schema.ts";

export interface OpenApiOpts { title?: string; version?: string; prefix?: string }

export function toOpenApi(contract: Contract, opts: OpenApiOpts = {}) {
  const prefix = opts.prefix ?? "/__rpc";
  const paths: Record<string, any> = {};
  for (const [op, d] of Object.entries(contract)) {
    if (d.kind === "subscription") continue;   // SSE, không phải request/response
    const rest = (d as any).rest as { method: string; path: string } | undefined;
    const method = (rest?.method ?? "POST").toLowerCase();
    const rawPath = rest?.path ?? `${prefix}/${op}`;
    const pathParams = [...rawPath.matchAll(/:([A-Za-z0-9_]+)/g)].map((m) => m[1]);
    const oaPath = rawPath.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
    const input = (d as any).input;
    const parameters: any[] = pathParams.map((p) => ({ name: p, in: "path", required: true, schema: { type: "string" } }));
    const operation: any = {
      operationId: op, summary: op, tags: [d.kind],
      responses: { "200": { description: "OK", content: { "application/json": { schema: schemaToJson(d.output) } } } },
    };
    const hasBody = ["post", "put", "patch"].includes(method);
    if (input && hasBody) {
      operation.requestBody = { required: true, content: { "application/json": { schema: schemaToJson(input) } } };
    } else if (input && !hasBody) {   // GET/DELETE: input (trừ path param) → query param
      const js = schemaToJson(input);
      for (const [k, v] of Object.entries(js.properties ?? {}))
        if (!pathParams.includes(k)) parameters.push({ name: k, in: "query", required: (js.required ?? []).includes(k), schema: v });
    }
    if (parameters.length) operation.parameters = parameters;
    (paths[oaPath] ??= {})[method] = operation;
  }
  return {
    openapi: "3.1.0",
    info: { title: opts.title ?? "fluxe API", version: opts.version ?? "0.0.0" },
    paths,
  };
}
