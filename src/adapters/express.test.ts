// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { fluxe } from "./express.ts";
import { manifest, cells, getText } from "./fixture.ts";

test("[express] host route đi trước + fluxe catch-all SSR cell", async () => {
  const app = express();
  app.get("/host", (_req, res) => res.send("from-host"));   // route riêng của user
  app.use(fluxe(manifest, cells));                            // fluxe sau cùng (catch-all)
  const srv = app.listen(0);
  await new Promise((r) => srv.once("listening", r));
  const port = (srv.address() as any).port;
  try {
    const host = await getText(port, "/host");
    assert.equal(host.body, "from-host");                     // host thắng

    const ping = await getText(port, "/ping");
    assert.equal(ping.status, 200);
    assert.match(ping.body, /pong/);                          // fluxe SSR cell qua Express

    const stats = await getText(port, "/_fluxe/stats");
    assert.equal(stats.status, 200);
    assert.match(stats.body, /heapUsed/);                 // endpoint engine chạy qua Express
  } finally {
    srv.close();
  }
});
