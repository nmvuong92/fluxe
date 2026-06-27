// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { fluxe } from "./hono.ts";
import { manifest, cells, getText } from "./_fixture.ts";

test("[hono] host route đi trước + fluxe catch-all SSR cell", async () => {
  const app = new Hono();
  app.get("/host", (c) => c.text("from-host"));   // route riêng của user
  app.use("*", fluxe(manifest, cells));            // fluxe catch-all
  const srv: any = serve({ fetch: app.fetch, port: 0 });
  await new Promise((r) => srv.once("listening", r));
  const port = srv.address().port;
  try {
    const host = await getText(port, "/host");
    assert.equal(host.body, "from-host");

    const ping = await getText(port, "/ping");
    assert.equal(ping.status, 200);
    assert.match(ping.body, /pong/);                // fluxe SSR cell qua Hono

    const stats = await getText(port, "/_fluxe/stats");
    assert.match(stats.body, /bootstrapped/);
  } finally {
    srv.close();
  }
});
