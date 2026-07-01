// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* Adapter Fastify — nhúng fluxe vào app Fastify. `fastify` là peerDependency (optional).
 * fluxe = catch-all: hook `onRequest` chạy TRƯỚC body-parsing của Fastify → với request không khớp
 * route nào (`req.is404`), ta `reply.hijack()` nhường vòng đời rồi chạy createHandler thẳng trên
 * node raw (req.raw/reply.raw) — body/stream/SSE nguyên vẹn. Route riêng của bạn (kể cả POST) VẪN
 * qua parser Fastify bình thường (host thắng, giữ req.body đã parse). */
import type { FastifyPluginCallback } from "fastify";
import { createHandler } from "../server_factory.ts";

/* Đăng ký fluxe (đặt route riêng của bạn TRƯỚC — chúng thắng; fluxe catch-all phần còn lại):
 *   app.get("/host", ...);
 *   await app.register(fluxe(manifest, cells, layouts, { backend }));  */
export function fluxe(...args: Parameters<typeof createHandler>): FastifyPluginCallback {
  const handler = createHandler(...args);
  const plugin: FastifyPluginCallback = (fastify, _opts, done) => {
    fastify.addHook("onRequest", (req, reply, next) => {
      if (!req.is404) return next();      // route Fastify khớp → host lo (giữ body-parsing)
      reply.hijack();                     // nhường vòng đời response cho fluxe
      void handler(req.raw, reply.raw);   // node raw (body chưa bị parser nuốt); fluxe tự end response
    });
    done();
  };
  // skip-override: hook áp lên instance GỐC (không đóng gói) → onRequest bắt được cả path 404.
  (plugin as any)[Symbol.for("skip-override")] = true;
  return plugin;
}
