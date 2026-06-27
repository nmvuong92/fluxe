// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* Adapter Hono (chạy trên Node qua @hono/node-server). `hono` + `@hono/node-server` là peerDependency.
 * Hono yêu cầu handler trả về Web `Response`; còn createHandler ghi vào node res. Ta dùng một
 * "capture shim": chạy handler vào res đệm (buffer) rồi dựng Response chuẩn → Hono ghi sạch,
 * không đụng nội bộ node-server. (Đánh đổi: buffer toàn response thay vì stream — chấp nhận được
 * cho lớp adapter; muốn stream thì dùng makeServer/Express.) */
import { Writable } from "node:stream";
import type { MiddlewareHandler } from "hono";
import { createHandler } from "../server_factory.ts";

class CaptureRes extends Writable {
  statusCode = 200;
  headersSent = false;
  headers: Record<string, string | string[]> = {};
  chunks: Buffer[] = [];
  writeHead(status: number, headers?: Record<string, any>) {
    this.statusCode = status;
    if (headers) for (const k of Object.keys(headers)) this.headers[k.toLowerCase()] = headers[k];
    this.headersSent = true;
    return this;
  }
  setHeader(k: string, v: any) { this.headers[k.toLowerCase()] = v; return this; }
  getHeader(k: string) { return this.headers[k.toLowerCase()]; }
  _write(chunk: any, _enc: any, cb: (e?: Error | null) => void) { this.chunks.push(Buffer.from(chunk)); cb(); }
}

/* Mount fluxe như catch-all (đặt SAU route Hono riêng của bạn):
 *   app.use("*", fluxe(manifest, cells, layouts, { backend }));
 *   serve({ fetch: app.fetch, port: 5180 });   // từ @hono/node-server  */
export function fluxe(...args: Parameters<typeof createHandler>): MiddlewareHandler {
  const handler = createHandler(...args);
  return async (c) => {
    const { incoming } = c.env as { incoming: any };
    const res = new CaptureRes();
    const finished = new Promise<void>((resolve) => res.on("finish", resolve));
    await handler(incoming, res as any);
    await finished;
    const headers = new Headers();
    for (const [k, v] of Object.entries(res.headers)) {
      if (Array.isArray(v)) v.forEach((x) => headers.append(k, String(x)));
      else headers.set(k, String(v));
    }
    const body = Buffer.concat(res.chunks);
    return new Response(body.length ? body : null, { status: res.statusCode, headers });
  };
}
