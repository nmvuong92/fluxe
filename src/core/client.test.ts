import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRpcError, RpcError, rpc, mutate } from "./client.ts";

test("parseRpcError: body có {error} → RpcError giữ code/details", () => {
  const e = parseRpcError(400, JSON.stringify({ error: { code: "validation", message: "sai", details: [{ path: "title", message: "rỗng" }] } }));
  assert.ok(e instanceof RpcError);
  assert.equal(e.code, "validation");
  assert.equal(e.status, 400);
  assert.equal((e.details as any)[0].path, "title");
});

test("parseRpcError: body không JSON → http error", () => {
  const e = parseRpcError(500, "boom");
  assert.equal(e.code, "http");
  assert.equal(e.status, 500);
});

test("rpc: ok → trả data (mock fetch)", async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = (async () => ({ ok: true, json: async () => ({ id: "1", title: "x" }) })) as any;
  try {
    const r = await rpc("todos", "add", { title: "x" });
    assert.deepEqual(r, { id: "1", title: "x" });
  } finally { globalThis.fetch = orig; }
});

test("rpc: 400 validation → ném RpcError có details", async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = (async () => ({ ok: false, status: 400, text: async () => JSON.stringify({ error: { code: "validation", message: "sai", details: [{ path: "title", message: "rỗng" }] } }) })) as any;
  try {
    await assert.rejects(() => rpc("todos", "add", { title: "" }), (e: any) => e instanceof RpcError && e.code === "validation" && Array.isArray(e.details));
  } finally { globalThis.fetch = orig; }
});

test("mutate: thành công → optimistic gọi, không rollback", async () => {
  let opt = false, rb = false;
  const r = await mutate({ optimistic: () => (opt = true), rollback: () => (rb = true), run: async () => 42 });
  assert.equal(r, 42); assert.equal(opt, true); assert.equal(rb, false);
});

test("mutate: lỗi → rollback gọi + ném lại", async () => {
  let rb = false;
  await assert.rejects(() => mutate({ optimistic: () => {}, rollback: () => (rb = true), run: async () => { throw new Error("x"); } }));
  assert.equal(rb, true);
});
