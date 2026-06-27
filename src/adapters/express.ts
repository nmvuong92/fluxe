// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* Adapter Express — nhúng fluxe vào app Express có sẵn. `express` là peerDependency.
 * Express dựng trên node:http → req/res y hệt → mount thẳng createHandler. */
import type { RequestHandler } from "express";
import { createHandler } from "../server_factory.ts";

/* Mount fluxe như middleware (đặt SAU các route riêng của bạn — fluxe là catch-all):
 *   app.use(fluxe(manifest, cells, layouts, { backend }));  */
export function fluxe(...args: Parameters<typeof createHandler>): RequestHandler {
  const handler = createHandler(...args);
  return (req, res, next) => { handler(req, res).catch(next); };
}
