// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import type http from "node:http";
import type { ZodType } from "zod";
import { FluxeError } from "./errors.ts";
import { validateInput } from "./validate.ts";
import type { Contract } from "./contract.ts";

export interface RpcArgs {
  url: URL;
  req: http.IncomingMessage;
  res: http.ServerResponse;
  cookies: Record<string, string>;
  backend: any;                       // resolvers
  contract?: Contract;
  validators?: Record<string, ZodType<any>>;
  readBody: (req: http.IncomingMessage) => Promise<string>;
}

/* Trả true nếu đã xử lý (/__rpc/<op>), false nếu không phải route rpc.
 * query → đọc thuần (không CSRF); mutation → CSRF double-submit. */
export async function handleRpc(a: RpcArgs): Promise<boolean> {
  if (!a.url.pathname.startsWith("/__rpc/")) return false;
  const op = decodeURIComponent(a.url.pathname.slice("/__rpc/".length));
  const queries = a.contract?.queries ?? {};
  const mutations = a.contract?.mutations ?? {};
  const isQuery = op in queries;
  const isMutation = op in mutations;
  if (!isQuery && !isMutation) { a.res.writeHead(404); a.res.end("no op"); return true; }

  if (isMutation && (!a.cookies.csrf || a.req.headers["x-csrf-token"] !== a.cookies.csrf)) {
    throw new FluxeError("csrf", "CSRF token không hợp lệ", 403);
  }
  let input = JSON.parse((await a.readBody(a.req)) || "{}");
  const schema = a.validators?.[op];
  if (schema) input = validateInput(schema, input);
  const fn = a.backend?.[op];
  if (typeof fn !== "function") throw new FluxeError("no_resolver", `Resolver thiếu cho '${op}'`, 500);
  const out = await fn(input);
  a.res.writeHead(200, { "content-type": "application/json" });
  a.res.end(JSON.stringify(out));
  return true;
}
