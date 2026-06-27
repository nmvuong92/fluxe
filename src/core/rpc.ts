// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import type http from "node:http";
import { FluxeError } from "./errors.ts";
import { validateInput } from "./validate.ts";
import type { Contract } from "./contract.ts";

export interface RpcArgs {
  url: URL;
  req: http.IncomingMessage;
  res: http.ServerResponse;
  cookies: Record<string, string>;
  resolvers: any;
  contract?: Contract;
  readBody: (req: http.IncomingMessage) => Promise<string>;
}

/* Trả true nếu đã xử lý (/__rpc/<op>), false nếu không phải route rpc.
 * Đọc contract TRỰC TIẾP (0 codegen): op.kind=mutation → CSRF; op.input → validate Zod. */
export async function handleRpc(a: RpcArgs): Promise<boolean> {
  if (!a.url.pathname.startsWith("/__rpc/")) return false;
  const name = decodeURIComponent(a.url.pathname.slice("/__rpc/".length));
  const op = a.contract?.[name];
  if (!op) { a.res.writeHead(404); a.res.end("no op"); return true; }

  if (op.kind === "mutation" && (!a.cookies.csrf || a.req.headers["x-csrf-token"] !== a.cookies.csrf)) {
    throw new FluxeError("csrf", "CSRF token không hợp lệ", 403);
  }
  let input = JSON.parse((await a.readBody(a.req)) || "{}");
  if (op.kind === "mutation") input = validateInput(op.input, input);   // Zod từ chính contract
  const fn = a.resolvers?.[name];
  if (typeof fn !== "function") throw new FluxeError("no_resolver", `Resolver thiếu cho '${name}'`, 500);
  const out = await fn(input);
  a.res.writeHead(200, { "content-type": "application/json" });
  a.res.end(JSON.stringify(out));
  return true;
}
