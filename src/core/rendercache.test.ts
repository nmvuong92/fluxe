// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRenderCache } from "./rendercache.ts";

test("set/get trả ĐÚNG buffer (byte-identical, cùng tham chiếu)", () => {
  const c = createRenderCache();
  const buf = Buffer.from("<html>home</html>");
  c.set("/", { etag: "a", buf });
  const hit = c.get("/");
  assert.ok(hit);
  assert.equal(hit.etag, "a");
  assert.equal(hit.buf, buf);                 // cùng ref → 0 copy
  assert.equal(hit.buf.toString(), "<html>home</html>");
});

test("miss key chưa có → undefined", () => {
  const c = createRenderCache();
  assert.equal(c.get("/khong-co"), undefined);
});

test("etag là của caller so sánh — lưu/trả nguyên vẹn", () => {
  const c = createRenderCache();
  c.set("/", { etag: "v1", buf: Buffer.from("x") });
  c.set("/", { etag: "v2", buf: Buffer.from("y") });   // data đổi → ghi đè
  assert.equal(c.get("/")!.etag, "v2");
  assert.equal(c.get("/")!.buf.toString(), "y");
});

test("bound LRU: không vượt maxKeys, evict key cũ nhất", () => {
  const c = createRenderCache({ maxKeys: 3 });
  for (const k of ["a", "b", "c", "d"]) c.set("/" + k, { etag: k, buf: Buffer.from(k) });
  assert.equal(c.size(), 3);
  assert.equal(c.get("/a"), undefined);        // 'a' bị evict (cũ nhất)
  assert.ok(c.get("/d"));
});

test("LRU: chạm get giữ key khỏi bị evict", () => {
  const c = createRenderCache({ maxKeys: 2 });
  c.set("/a", { etag: "a", buf: Buffer.from("a") });
  c.set("/b", { etag: "b", buf: Buffer.from("b") });
  c.get("/a");                                  // 'a' mới-dùng → 'b' thành cũ nhất
  c.set("/c", { etag: "c", buf: Buffer.from("c") });
  assert.ok(c.get("/a"));                       // còn
  assert.equal(c.get("/b"), undefined);         // 'b' bị evict
});
