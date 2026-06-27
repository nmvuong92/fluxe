// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { makeServer } from "../server_factory.ts";
import { resolve } from "./resolver.ts";
import { defineContract } from "./contract.ts";
import { z } from "zod";

const contract = defineContract({
  queries: { todos: { out: "string[]" } },
  mutations: { addTodo: { in: { title: "string" }, out: "string" } },
});
const validators = { addTodo: z.object({ title: z.string().min(1) }) };
const backend = {
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
  const srv = makeServer(m, [], {}, { backend, contract, validators }).listen(0);
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

test("[rpc] mutation thiếu CSRF → 403; input sai → 400; ok → output", async () => {
  const { srv, port } = await boot();
  try {
    const noCsrf = await req(port, "/__rpc/addTodo", { title: "x" });
    assert.equal(noCsrf.status, 403);
    const csrf = { cookie: "csrf=tok", "x-csrf-token": "tok" };
    const bad = await req(port, "/__rpc/addTodo", { title: "" }, csrf);
    assert.equal(bad.status, 400);
    const ok = await req(port, "/__rpc/addTodo", { title: "milk" }, csrf);
    assert.equal(ok.status, 200);
    assert.equal(JSON.parse(ok.body), "[added] milk");
  } finally { srv.close(); }
});

test("[rpc] op lạ → 404", async () => {
  const { srv, port } = await boot();
  try {
    const r = await req(port, "/__rpc/nope", {});
    assert.equal(r.status, 404);
  } finally { srv.close(); }
});
