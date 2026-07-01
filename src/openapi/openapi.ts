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
    const jsonResponse = { content: { "application/json": { schema: schemaToJson(d.output) } } };
    const operation: any = {
      operationId: op,
      summary: op,
      tags: [d.kind],
      responses: { "200": { description: "OK", ...jsonResponse } },
    };
    if (d.kind === "mutation") {
      operation.requestBody = { required: true, content: { "application/json": { schema: schemaToJson(d.input) } } };
    }
    paths[`${prefix}/${op}`] = { post: operation };
  }
  return {
    openapi: "3.1.0",
    info: { title: opts.title ?? "fluxe API", version: opts.version ?? "0.0.0" },
    paths,
  };
}
