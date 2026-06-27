// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import "reflect-metadata";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { fluxeMiddleware } from "./nest.ts";
import { manifest, cells, getText } from "./_fixture.ts";

test("[nest] middleware fluxe SSR cell qua Nest (platform-express)", async () => {
  class AppModule {}
  Module({})(AppModule);   // áp @Module dạng hàm (không cần bật experimentalDecorators)

  const app = await NestFactory.create(AppModule, { logger: false });
  app.use(fluxeMiddleware(manifest, cells));   // global middleware (Nest → Express) — fluxe catch-all
  await app.listen(0);
  const port = (app.getHttpServer().address() as any).port;
  try {
    const ping = await getText(port, "/ping");
    assert.equal(ping.status, 200);
    assert.match(ping.body, /pong/);                 // fluxe SSR cell qua Nest

    const stats = await getText(port, "/_fluxe/stats");
    assert.match(stats.body, /bootstrapped/);
  } finally {
    await app.close();
  }
});
