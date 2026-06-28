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
  session?: any;          // host gắn (req.session) — cho op.auth guard
  resolvers: any;
  contract?: Contract;
  readBody: (req: http.IncomingMessage) => Promise<string>;
  publish?: (topic: string, data: unknown) => void;   // broker.publish → ctx.publish (realtime subscription)
}

/* Trả true nếu đã xử lý (/__rpc/<op>), false nếu không phải route rpc.
 * Đọc contract TRỰC TIẾP (0 codegen): op.kind=mutation → CSRF; op.input → validate Zod. */
export async function handleRpc(a: RpcArgs): Promise<boolean> {
  if (!a.url.pathname.startsWith("/__rpc/")) return false;
  const name = decodeURIComponent(a.url.pathname.slice("/__rpc/".length));
  const op = a.contract?.[name];
  if (!op) { a.res.writeHead(404); a.res.end("no op"); return true; }

  // Guard khai báo: op.auth (đọc session host gắn). CSRF/rate-limit do HOST middleware lo.
  if (op.auth) {
    const s: any = a.session;
    if (!s) throw new FluxeError("unauthorized", "Cần đăng nhập", 401);
    if (typeof op.auth === "string" && !(Array.isArray(s.roles) && s.roles.includes(op.auth))) {
      throw new FluxeError("forbidden", `Cần quyền '${op.auth}'`, 403);
    }
  }
  if (op.kind === "subscription") { a.res.writeHead(400); a.res.end("subscription qua /__sse"); return true; }
  let input = JSON.parse((await a.readBody(a.req)) || "{}");
  if (op.kind === "mutation") input = validateInput(op.input, input);   // Zod từ chính contract
  const fn = a.resolvers?.[name];
  if (typeof fn !== "function") throw new FluxeError("no_resolver", `Resolver thiếu cho '${name}'`, 500);
  const ctx = { publish: a.publish ?? (() => {}) };   // arg 2: ctx.publish → realtime subscription
  const out = op.kind === "query" ? await fn(ctx) : await fn(input, ctx);
  a.res.writeHead(200, { "content-type": "application/json" });
  a.res.end(JSON.stringify(out));
  return true;
}
