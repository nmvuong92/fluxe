// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* Adapter NestJS — nhúng fluxe vào app Nest (Express platform). `@nestjs/common` là peerDependency.
 * Nest chạy trên Express → req/res Node → tái dùng createHandler. */
import type { NestMiddleware } from "@nestjs/common";
import { createHandler } from "../server_factory.ts";

/* Functional middleware — mount global (khuyên dùng, catch-all đặt sau route Nest):
 *   const app = await NestFactory.create(AppModule);
 *   app.use(fluxeMiddleware(manifest, cells, layouts, { backend }));
 * (hoặc consumer.apply(...).forRoutes("{*splat}") trong module — Nest 11 dùng wildcard mới). */
export function fluxeMiddleware(...args: Parameters<typeof createHandler>): NestMiddleware["use"] {
  const handler = createHandler(...args);
  return (req: any, res: any, next: any) => { handler(req, res).catch(next); };
}
