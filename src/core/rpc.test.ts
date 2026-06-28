// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { makeServer } from "../server_factory.ts";
import { resolve } from "./resolver.ts";
import { f } from "./contract.ts";
import { handleRpc } from "./rpc.ts";
import { decodeTrace } from "./trace.ts";

const contract = f.contract({
  todos: f.query(f.string.array()),
  addTodo: f.mutation({ title: f.string }, f.string),
});
const resolvers = {
  async todos() { return ["a", "b"]; },
  async addTodo({ title }: { title: string }) { return "[added] " + title; },
};

function req(port: number, path: string, body: any, headers: any = {}): Promise<{ status: number; body: string }> {
  return new Promise((res, rej) => {
    const data = JSON.stringify(body);
    const r = http.request({ host: "127.0.0.1", port, path, method: "POST",
      headers: { "content-type": "application/json", "content-length": Buffer.byteLength(data), ...headers } }, (rr) => {
      let b = ""; rr.on("data", (c) => (b += c)); rr.on("end", () => res({ status: rr.statusCode!, body: b }));
    });
    r.on("error", rej); r.write(data); r.end();
  });
}

function boot() {
  const m = resolve([], { name: "t" });
  const srv = makeServer(m, [], {}, { resolvers, contract }).listen(0);
  return new Promise<{ srv: http.Server; port: number }>((r) => srv.once("listening", () => r({ srv, port: (srv.address() as any).port })));
}

test("[rpc] query không cần CSRF → output", async () => {
  const { srv, port } = await boot();
  try {
    const r = await req(port, "/__rpc/todos", {});
    assert.equal(r.status, 200);
    assert.deepEqual(JSON.parse(r.body), ["a", "b"]);
  } finally { srv.close(); }
});

test("[rpc] mutation: input sai → 400 (Zod); ok → output (CSRF do host lo, không 403)", async () => {
  const { srv, port } = await boot();
  try {
    const bad = await req(port, "/__rpc/addTodo", { title: 123 });   // sai kiểu (Zod từ contract) → 400
    assert.equal(bad.status, 400);
    const ok = await req(port, "/__rpc/addTodo", { title: "milk" }); // không cần CSRF (host middleware lo)
    assert.equal(ok.status, 200);
    assert.equal(JSON.parse(ok.body), "[added] milk");
  } finally { srv.close(); }
});

test("[rpc] op.auth: thiếu session → 401; thiếu role → 403; đủ role → chạy", async () => {
  const c = f.contract({ adminOnly: f.mutation({ x: f.string }, f.string, { auth: "admin" }) });
  const r = { adminOnly: async ({ x }: { x: string }) => "ok:" + x };
  const mk = async (session: any) => {
    let status = 0, body = "";
    const res: any = { writeHead: (s: number) => { status = s; }, end: (b?: string) => { body = b ?? ""; } };
    try {
      await handleRpc({
        url: new URL("http://x/__rpc/adminOnly"), req: { headers: {} } as any, res, cookies: {}, session,
        resolvers: r, contract: c as any, readBody: async () => JSON.stringify({ x: "1" }),
      });
    } catch (e: any) { status = e.status; }   // guard ném FluxeError → server bắt → status
    return { status, body };
  };
  assert.equal((await mk(null)).status, 401);
  assert.equal((await mk({ roles: ["user"] })).status, 403);
  const ok = await mk({ roles: ["admin"] });
  assert.equal(ok.status, 200);
  assert.equal(JSON.parse(ok.body), "ok:1");
});

test("[rpc] op lạ → 404", async () => {
  const { srv, port } = await boot();
  try {
    const r = await req(port, "/__rpc/nope", {});
    assert.equal(r.status, 404);
  } finally { srv.close(); }
});

test("[rpc] mutation nhận ctx.publish → publish topic subscription", async () => {
  const c = f.contract({ add: f.mutation({ x: f.string }, f.string), feed: f.subscription(f.string) });
  const published: Array<{ topic: string; data: unknown }> = [];
  const r = { add: async ({ x }: { x: string }, ctx: any) => { ctx.publish("feed", "live:" + x); return x; } };
  let status = 0, body = "";
  const res: any = { writeHead: (s: number) => { status = s; }, end: (b?: string) => { body = b ?? ""; } };
  await handleRpc({
    url: new URL("http://x/__rpc/add"), req: { headers: {} } as any, res, cookies: {},
    resolvers: r, contract: c as any, readBody: async () => JSON.stringify({ x: "1" }),
    publish: (topic, data) => published.push({ topic, data }),
  });
  assert.equal(status, 200);
  assert.equal(JSON.parse(body), "1");
  assert.deepEqual(published, [{ topic: "feed", data: "live:1" }]);
});

test("[rpc] trace: header x-fluxe-trace có cây span resolver (+ db từ ctx.span)", async () => {
  const c = f.contract({ get: f.query(f.string) });
  const r = { get: async (ctx: any) => { await ctx.span("db.read", async () => {}); return "ok"; } };
  let headers: any = {};
  const res: any = { writeHead: (_s: number, h: any) => { headers = h ?? {}; }, end: () => {} };
  await handleRpc({
    url: new URL("http://x/__rpc/get"), req: { headers: {} } as any, res, cookies: {},
    resolvers: r, contract: c as any, readBody: async () => "{}",
    trace: { enabled: true, maxSpans: 64 },
  });
  assert.equal(headers["x-fluxe-resolution"], "rpc:query");
  assert.ok(headers["x-fluxe-trace"]);
  const root = decodeTrace(headers["x-fluxe-trace"]);
  const resolver = root!.children.find((s) => s.name === "resolver");
  assert.ok(resolver, "có span resolver");
  assert.ok(resolver!.children.some((s) => s.name === "db.read"), "db.read nest dưới resolver");
});

test("[rpc] trace tắt (enabled:false) → không gửi header x-fluxe-trace", async () => {
  const c = f.contract({ get: f.query(f.string) });
  const r = { get: async () => "ok" };
  let headers: any = {};
  const res: any = { writeHead: (_s: number, h: any) => { headers = h ?? {}; }, end: () => {} };
  await handleRpc({
    url: new URL("http://x/__rpc/get"), req: { headers: {} } as any, res, cookies: {},
    resolvers: r, contract: c as any, readBody: async () => "{}",
    trace: { enabled: false, maxSpans: 64 },
  });
  assert.equal(headers["x-fluxe-trace"], undefined);
});

test("[rpc] ctx.session: resolver đọc được session host gắn", async () => {
  const c = f.contract({ whoami: f.query(f.string) });
  const r = { whoami: (ctx: any) => "user:" + (ctx.session?.id ?? "none") };
  let body = "";
  const res: any = { writeHead: () => {}, end: (b?: string) => { body = b ?? ""; } };
  await handleRpc({
    url: new URL("http://x/__rpc/whoami"), req: { headers: {} } as any, res, cookies: {},
    session: { id: "u1", roles: ["bidder"] }, resolvers: r, contract: c as any, readBody: async () => "{}",
  });
  assert.equal(JSON.parse(body), "user:u1");
});

test("[rpc] f.coerce.number: input string '5' → number 5 (form-friendly)", async () => {
  const c = f.contract({ buy: f.mutation({ qty: f.coerce.number() }, f.number) });
  const r = { buy: ({ qty }: { qty: number }) => qty * 2 };
  let body = "", status = 0;
  const res: any = { writeHead: (s: number) => { status = s; }, end: (b?: string) => { body = b ?? ""; } };
  await handleRpc({
    url: new URL("http://x/__rpc/buy"), req: { headers: {} } as any, res, cookies: {},
    resolvers: r, contract: c as any, readBody: async () => JSON.stringify({ qty: "5" }),
  });
  assert.equal(status, 200);
  assert.equal(JSON.parse(body), 10);   // "5" coerce → 5, *2 = 10
});

test("[rpc] op subscription qua /__rpc → 400 (đi qua /__sse)", async () => {
  const c = f.contract({ feed: f.subscription(f.string) });
  let status = 0;
  const res: any = { writeHead: (s: number) => { status = s; }, end: () => {} };
  await handleRpc({
    url: new URL("http://x/__rpc/feed"), req: { headers: {} } as any, res, cookies: {},
    resolvers: {}, contract: c as any, readBody: async () => "{}",
  });
  assert.equal(status, 400);
});
