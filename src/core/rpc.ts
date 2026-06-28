// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import type http from "node:http";
import { FluxeError } from "./errors.ts";
import { validateInput } from "./validate.ts";
import type { Contract } from "./contract.ts";
import { createTracer, encodeTrace } from "./trace.ts";

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
  trace?: { enabled: boolean; maxSpans: number };      // bật waterfall + header x-fluxe-trace (config)
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

  // Tracer: dựng cây span pipeline RCA. ctx.span cho resolver thêm span con (DB…). Rẻ → luôn dựng.
  const tracer = createTracer(a.trace?.maxSpans ?? 64);
  const t0 = Date.now();

  let input = await tracer.span("parse", async () => JSON.parse((await a.readBody(a.req)) || "{}"));
  if (op.kind === "mutation") input = await tracer.span("validate", () => validateInput(op.input, input));   // Zod từ contract
  const fn = a.resolvers?.[name];
  if (typeof fn !== "function") throw new FluxeError("no_resolver", `Resolver thiếu cho '${name}'`, 500);

  // ctx: session (host gắn) + publish (bọc span "publish:<topic>") + span.
  const ctx = {
    session: a.session ?? null,
    publish: (topic: string, data: unknown) => { void tracer.span("publish:" + topic, () => a.publish?.(topic, data)); },
    span: tracer.span,
  };
  const out = await tracer.span("resolver", () => (op.kind === "query" ? fn(ctx) : fn(input, ctx)));

  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-fluxe-resolution": "rpc:" + op.kind,
    "x-fluxe-server-ms": String(Date.now() - t0),
  };
  if (a.trace?.enabled !== false) {
    const enc = encodeTrace(tracer.finish());
    if (enc) headers["x-fluxe-trace"] = enc;
  }
  a.res.writeHead(200, headers);
  a.res.end(JSON.stringify(out));
  return true;
}
