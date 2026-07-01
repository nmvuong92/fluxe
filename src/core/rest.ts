// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* REST layer — expose op có `rest` metadata ra endpoint chuẩn (GET/POST/PUT/PATCH/DELETE /v1/...).
 * Cùng resolver với /__rpc (1 khai báo → 2 cửa). Map: :param → input, còn lại body (ghi) / query (đọc). */
import type http from "node:http";
import { randomUUID } from "node:crypto";
import { FluxeError, toErrorPayload } from "./errors.ts";
import { validateInput } from "./validate.ts";
import type { Contract } from "./contract.ts";
import { createTracer, encodeTrace } from "./trace.ts";

export interface RestRoute { name: string; op: any; method: string; regex: RegExp; params: string[] }

/* Dựng route REST từ contract (1 lần lúc boot). path :param → regex + tên param. */
export function buildRestRoutes(contract: Contract | undefined): RestRoute[] {
  const routes: RestRoute[] = [];
  for (const [name, op] of Object.entries(contract ?? {})) {
    const rest = (op as any).rest;
    if (!rest) continue;
    const params: string[] = [];
    const pattern = rest.path.replace(/:([A-Za-z0-9_]+)/g, (_: string, p: string) => { params.push(p); return "([^/]+)"; });
    routes.push({ name, op, method: rest.method, regex: new RegExp("^" + pattern + "$"), params });
  }
  return routes;
}

export interface RestArgs {
  url: URL;
  req: http.IncomingMessage;
  res: http.ServerResponse;
  routes: RestRoute[];
  session?: any;
  resolvers: any;
  readBody: (req: http.IncomingMessage) => Promise<string>;
  publish?: (topic: string, data: unknown) => void;
  trace?: { enabled: boolean; maxSpans: number };
  dev?: boolean;
}

const HAS_BODY = new Set(["POST", "PUT", "PATCH"]);
/* Status best-practice: tạo → 201, xoá → 204 (no content), còn lại → 200. */
const okStatus = (method: string) => (method === "POST" ? 201 : method === "DELETE" ? 204 : 200);

export async function handleRest(a: RestArgs): Promise<boolean> {
  const method = a.req.method ?? "GET";
  for (const r of a.routes) {
    if (r.method !== method) continue;
    const m = r.regex.exec(a.url.pathname);
    if (!m) continue;

    // Đã khớp route REST → lớp này TỰ trả JSON (kể cả lỗi) theo chuẩn REST, không rơi ra HTML.
    const tracer = createTracer(a.trace?.maxSpans ?? 64);
    const t0 = Date.now();
    try {
      if (r.op.auth) {   // guard khai báo (giống /__rpc)
        const s: any = a.session;
        if (!s) throw new FluxeError("unauthorized", "Cần đăng nhập", 401);
        if (typeof r.op.auth === "string" && !(Array.isArray(s.roles) && s.roles.includes(r.op.auth)))
          throw new FluxeError("forbidden", `Cần quyền '${r.op.auth}'`, 403);
      }

      // Map request → input: :param → input, còn lại body (ghi) / query (đọc).
      const input: Record<string, any> = {};
      r.params.forEach((p, i) => (input[p] = decodeURIComponent(m[i + 1])));
      for (const [k, v] of a.url.searchParams) input[k] = v;
      if (HAS_BODY.has(method)) Object.assign(input, JSON.parse((await a.readBody(a.req)) || "{}"));

      let val: any = input;
      if (r.op.input) val = await tracer.span("validate", () => validateInput(r.op.input, input));
      const fn = a.resolvers?.[r.name];
      if (typeof fn !== "function") throw new FluxeError("no_resolver", `Resolver thiếu cho '${r.name}'`, 500);

      const ctx = {
        session: a.session ?? null,
        publish: (topic: string, data: unknown) => { void tracer.span("publish:" + topic, () => a.publish?.(topic, data)); },
        span: tracer.span,
      };
      const out = await tracer.span("resolver", () => (r.op.input ? fn(val, ctx) : fn(ctx)));

      const status = okStatus(method);
      const headers: Record<string, string> = { "x-fluxe-resolution": "rest:" + r.op.kind, "x-fluxe-server-ms": String(Date.now() - t0) };
      if (a.trace?.enabled !== false) { const enc = encodeTrace(tracer.finish()); if (enc) headers["x-fluxe-trace"] = enc; }
      if (status === 204) { a.res.writeHead(204, headers); a.res.end(); }         // xoá: no content
      else { a.res.writeHead(status, { "content-type": "application/json", ...headers }); a.res.end(JSON.stringify(out ?? null)); }
    } catch (err) {
      // Error handling chuẩn: JSON { error: { code, message, details, errorId } } + status đúng.
      const errorId = randomUUID();
      const p = toErrorPayload(err, { dev: a.dev ?? false, errorId });
      if (!(err instanceof FluxeError)) console.error(`[fluxe] rest ${errorId}:`, err);
      a.res.writeHead(p.status, { "content-type": "application/json" });
      a.res.end(JSON.stringify({ error: p }));
    }
    return true;
  }
  return false;
}
