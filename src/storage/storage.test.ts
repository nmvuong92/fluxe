// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import { createMemoryStorage } from "./memory.ts";
import { safeKey, makeKey } from "./types.ts";

test("safeKey: bỏ path + ký tự lạ, chặn ..", () => {
  assert.equal(safeKey("anh đẹp.png"), "anh___p.png");     // space + 2 ký tự có dấu → _
  assert.equal(safeKey("../../etc/passwd"), "passwd");      // bỏ path traversal
  assert.equal(safeKey("a/b/c.txt"), "c.txt");
  assert.equal(safeKey("....jpg"), "_jpg");                 // chuỗi dấu chấm → _ (chặn ..)
  assert.equal(safeKey(""), "file");
});

test("makeKey: <random>-<safe>", () => {
  assert.equal(makeKey("a b.png", "abc123"), "abc123-a_b.png");
});

test("memory storage: put → get → delete (byte-exact + url)", async () => {
  const s = createMemoryStorage();
  const data = Buffer.from([1, 2, 3, 4]);
  const r = await s.put("k1", data, { contentType: "image/png" });
  assert.equal(r.size, 4);
  assert.equal(r.url, "/__file/k1");

  const got = await s.get("k1");
  assert.ok(got);
  assert.deepEqual(got.data, data);                        // byte-exact
  assert.equal(got.contentType, "image/png");

  await s.delete("k1");
  assert.equal(await s.get("k1"), null);
});

test("memory storage: get key không có → null", async () => {
  const s = createMemoryStorage();
  assert.equal(await s.get("none"), null);
});
