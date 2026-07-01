// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { definePlugin } from "./plugin.ts";
import { createApp } from "./app.ts";
import { f } from "./contract.ts";

const cell = (id: string) => ({ id, route: `/${id}`, async loader() { return {}; }, view: () => null }) as any;

test("createApp gộp cells từ nhiều plugin", async () => {
  const a = definePlugin({ name: "@fluxe/a", cells: [cell("a")] });
  const b = definePlugin({ name: "@fluxe/b", cells: [cell("b")] });
  const app = await createApp({ plugins: [a, b] });
  assert.deepEqual(app.cells.map((c) => c.id).sort(), ["a", "b"]);
});

test("createApp ném khi trùng cell id giữa 2 plugin", async () => {
  const a = definePlugin({ name: "@fluxe/a", cells: [cell("dup")] });
  const b = definePlugin({ name: "@fluxe/b", cells: [cell("dup")] });
  await assert.rejects(createApp({ plugins: [a, b] }), /dup/);
});

test("createApp gộp contract + resolvers theo op name", async () => {
  const a = definePlugin({ name: "@fluxe/a", contract: { listA: { kind: "query" } }, resolvers: { listA: () => 1 } });
  const b = definePlugin({ name: "@fluxe/b", contract: { listB: { kind: "query" } }, resolvers: { listB: () => 2 } });
  const app = await createApp({ plugins: [a, b] });
  assert.deepEqual(Object.keys(app.contract).sort(), ["listA", "listB"]);
  assert.equal(app.resolvers.listA(), 1);
});

test("createApp ném khi trùng op name giữa 2 plugin", async () => {
  const a = definePlugin({ name: "@fluxe/a", contract: { list: { kind: "query" } } });
  const b = definePlugin({ name: "@fluxe/b", contract: { list: { kind: "query" } } });
  await assert.rejects(createApp({ plugins: [a, b] }), /list/);
});

test("capability: provider boot TRƯỚC consumer dù khai báo ngược (topo-sort)", async () => {
  let seen: string | undefined;
  const consumer = definePlugin({
    name: "@fluxe/consumer", needs: ["storage"],
    boot(app) { seen = app.use<string>("storage"); },
  });
  const provider = definePlugin({
    name: "@fluxe/store", provides: ["storage"],
    boot(app) { app.provide("storage", "s3"); },
  });
  await createApp({ plugins: [consumer, provider] });   // cố ý để consumer trước
  assert.equal(seen, "s3");
});

test("capability: needs không ai provide → fail-fast rõ ràng", async () => {
  const p = definePlugin({ name: "@fluxe/consumer", needs: ["storage"] });
  await assert.rejects(createApp({ plugins: [p] }), /storage/);
});

test("capability: vòng lặp phụ thuộc → fail-fast (cycle)", async () => {
  const a = definePlugin({ name: "@fluxe/a", needs: ["capB"], provides: ["capA"] });
  const b = definePlugin({ name: "@fluxe/b", needs: ["capA"], provides: ["capB"] });
  await assert.rejects(createApp({ plugins: [a, b] }), /cycle|vòng lặp/);
});

test("createApp gộp commands từ nhiều plugin", async () => {
  const a = definePlugin({ name: "@fluxe/a", commands: [{ name: "a:x" }] });
  const b = definePlugin({ name: "@fluxe/b", commands: [{ name: "b:y" }] });
  const app = await createApp({ plugins: [a, b] });
  assert.deepEqual(app.commands.map((c: any) => c.name).sort(), ["a:x", "b:y"]);
});

test("createApp = thin composer: handler phục vụ op plugin qua /__rpc", async () => {
  const plugin = definePlugin({
    name: "@fluxe/ping",
    contract: { ping: f.query(f.string) },
    resolvers: { ping: () => "pong" },
  });
  const app = await createApp({ manifest: { cells: {} } as any, plugins: [plugin] });
  const server = http.createServer(app.handler!);
  await new Promise<void>((r) => server.listen(0, r));
  const port = (server.address() as any).port;
  const res = await fetch(`http://localhost:${port}/__rpc/ping`, { method: "POST" });
  const body = await res.json();
  server.close();
  assert.equal(res.status, 200);
  assert.equal(body, "pong");
});
