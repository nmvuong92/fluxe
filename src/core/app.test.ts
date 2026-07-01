// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { definePlugin, defineModule } from "./plugin.ts";
import { createApp } from "./app.ts";
import { f } from "./contract.ts";

const cell = (id: string) => ({ id, route: `/${id}`, async loader() { return {}; }, view: () => null }) as any;

test("createApp gộp cells từ nhiều plugin", async () => {
  const a = definePlugin({ name: "@fluxe/a", cells: [cell("a")] });
  const b = definePlugin({ name: "@fluxe/b", cells: [cell("b")] });
  const app = await createApp({ plugins: [a, b] });
  assert.deepEqual(app.cells.map((c) => c.id).sort(), ["a", "b"]);
});

test("createApp gộp base cells (opts.cells) với plugin cells", async () => {
  const page = cell("home");                                    // page cell từ frontend registry
  const p = definePlugin({ name: "@fluxe/p", cells: [cell("extra")] });
  const app = await createApp({ cells: [page], plugins: [p] });
  assert.deepEqual(app.cells.map((c) => c.id).sort(), ["extra", "home"]);
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

test("plugin.boot trả dispose → app.dispose() gọi teardown", async () => {
  let disposed = false;
  const p = definePlugin({ name: "@x/a", boot: () => () => { disposed = true; } });
  const app = await createApp({ plugins: [p] });
  await app.dispose();
  assert.equal(disposed, true);
});

test("dispose chạy NGƯỢC thứ tự topo (consumer teardown trước provider)", async () => {
  const order: string[] = [];
  const provider = definePlugin({ name: "@x/db", provides: ["db"], boot: () => () => { order.push("db"); } });
  const consumer = definePlugin({ name: "@x/svc", needs: ["db"], boot: () => () => { order.push("svc"); } });
  const app = await createApp({ plugins: [provider, consumer] });
  await app.dispose();
  assert.deepEqual(order, ["svc", "db"]);
});

test("app[Symbol.asyncDispose] = dispose (hỗ trợ `await using`)", async () => {
  let disposed = false;
  const p = definePlugin({ name: "@x/a", boot: () => () => { disposed = true; } });
  const app = await createApp({ plugins: [p] });
  await app[Symbol.asyncDispose]();
  assert.equal(disposed, true);
});

test("defineModule: resolvers factory nhận backend qua DI (không thread tay)", async () => {
  const mod = defineModule({
    name: "todos",
    contract: { list: { kind: "query" } as any },
    needs: ["backend"],
    resolvers: (ctx) => ({ list: () => (ctx.use("backend") as any).seed }),   // backend từ DI
  });
  const app = await createApp({ plugins: [mod], backend: { seed: 42 } });
  assert.equal(app.resolvers.list(), 42);
});

test("defineModule: resolver KHAI BÁO (object) + use → tiêm ctx.db (bỏ make/thread)", async () => {
  const mod = defineModule({
    name: "todos",
    contract: { list: { kind: "query" } as any, add: { kind: "mutation", input: {} } as any },
    use: { db: "backend" },
    resolvers: {
      list: (_input: any, { db }: any) => db.tag + ":list",          // query no-input → fn(_, ctx)
      add: (input: any, { db }: any) => db.tag + ":add:" + input.x,  // mutation → fn(input, ctx)
    },
  });
  const app = await createApp({ plugins: [mod], backend: { tag: "DB" } });
  assert.equal(app.resolvers.list(), "DB:list");
  assert.equal(app.resolvers.add({ x: 1 }), "DB:add:1");
});

test("createApp auto-provide capability 'backend' từ opts.backend (ambient, không cần plugin provide)", async () => {
  const mod = defineModule({ name: "m", needs: ["backend"], boot: () => {} });
  await assert.doesNotReject(createApp({ plugins: [mod], backend: {} }));   // needs backend không ném dù 0 plugin provide
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
