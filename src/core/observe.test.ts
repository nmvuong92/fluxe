import { test } from "node:test";
import assert from "node:assert/strict";
import { createRecorder } from "./observe.ts";

const mk = (path: string, status = 200) => ({ method: "GET", path, status, ms: 1, ts: 0 });

test("record + recent (mới nhất trước)", () => {
  const r = createRecorder();
  r.record(mk("/a"));
  r.record(mk("/b"));
  const recent = r.recent();
  assert.equal(recent[0].path, "/b");
  assert.equal(recent[1].path, "/a");
});

test("ring buffer cap → bỏ cũ nhất", () => {
  const r = createRecorder(3);
  for (const p of ["/1", "/2", "/3", "/4"]) r.record(mk(p));
  const paths = r.recent().map((e) => e.path);
  assert.deepEqual(paths, ["/4", "/3", "/2"]); // /1 bị đẩy ra, mới nhất trước
});

test("recent(n) giới hạn số lượng", () => {
  const r = createRecorder();
  for (let i = 0; i < 10; i++) r.record(mk("/" + i));
  assert.equal(r.recent(3).length, 3);
});
