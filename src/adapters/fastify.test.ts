// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { fluxe } from "./fastify.ts";
import { manifest, cells, getText } from "./fixture.ts";
import { f } from "../core/contract.ts";

test("[fastify] host route đi trước + fluxe catch-all SSR cell", async () => {
  const app = Fastify();
  app.get("/host", (_req, reply) => reply.send("from-host"));   // route riêng của user
  await app.register(fluxe(manifest, cells));                    // fluxe catch-all
  await app.listen({ port: 0, host: "127.0.0.1" });
  const port = (app.server.address() as any).port;
  try {
    const host = await getText(port, "/host");
    assert.equal(host.body, "from-host");                        // host thắng

    const ping = await getText(port, "/ping");
    assert.equal(ping.status, 200);
    assert.match(ping.body, /pong/);                             // fluxe SSR cell qua Fastify

    const stats = await getText(port, "/_fluxe/stats");
    assert.equal(stats.status, 200);
    assert.match(stats.body, /heapUsed/);                        // endpoint engine chạy qua Fastify
  } finally {
    await app.close();
  }
});

test("[fastify] POST /__rpc mutation — body JSON tới resolver (không bị Fastify nuốt)", async () => {
  const contract = { echo: f.mutation({ msg: f.string }, f.string) };
  const resolvers = { echo: (input: { msg: string }) => input.msg };
  const app = Fastify();
  await app.register(fluxe(manifest, cells, {}, { contract, resolvers }));
  await app.listen({ port: 0, host: "127.0.0.1" });
  const port = (app.server.address() as any).port;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/__rpc/echo`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ msg: "xin-chào" }),
    });
    assert.equal(res.status, 200);
    assert.equal(await res.json(), "xin-chào");
  } finally {
    await app.close();
  }
});
