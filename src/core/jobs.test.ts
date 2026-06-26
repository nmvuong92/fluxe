import { test } from "node:test";
import assert from "node:assert/strict";
import { unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createQueue, drain } from "./jobs.ts";

test("enqueue + process thành công → done", async () => {
  const q = createQueue();
  q.enqueue("email", { to: "a" });
  const log: string[] = [];
  const j = await q.processNext({ email: async (p: any) => { log.push("sent:" + p.to); } });
  assert.equal(j?.type, "email");
  assert.equal(j?.status, "done");
  assert.deepEqual(log, ["sent:a"]);
  assert.equal(q.pending(), 0);
});

test("job lỗi → retry rồi dead-letter sau maxAttempts", async () => {
  const q = createQueue();
  q.enqueue("boom", {});
  const h = { boom: async () => { throw new Error("nổ"); } };
  let j = await q.processNext(h, { maxAttempts: 2 });   // attempt 1 → vẫn pending
  assert.equal(j?.status, "pending");
  assert.equal(q.pending(), 1);
  j = await q.processNext(h, { maxAttempts: 2 });        // attempt 2 → dead
  assert.equal(j?.status, "dead");
  assert.equal(q.pending(), 0);
  assert.equal(q.dead(), 1);
});

test("không còn pending → null", async () => {
  const q = createQueue();
  assert.equal(await q.processNext({}), null);
});

test("thiếu handler → coi như lỗi (retry/dead)", async () => {
  const q = createQueue();
  q.enqueue("unknown", {});
  const j = await q.processNext({}, { maxAttempts: 1 });
  assert.equal(j?.status, "dead");
});

test("drain: xử lý cạn (1 done + 1 dead) rồi dừng", async () => {
  const q = createQueue();
  q.enqueue("ok", {});
  q.enqueue("bad", {});
  const n = await drain(q, { ok: async () => {}, bad: async () => { throw new Error("x"); } }, { maxAttempts: 2 });
  assert.equal(q.pending(), 0);
  assert.equal(q.dead(), 1);
  assert.ok(n >= 2); // ok(1 lần) + bad(2 lần retry)
});

test("DURABLE: enqueue rồi mở lại file vẫn còn job pending", async () => {
  const path = join(tmpdir(), `fluxe-jobs-${process.pid}.db`);
  try {
    createQueue(path).enqueue("x", { v: 1 });
    const q2 = createQueue(path);          // "process" mới, cùng file
    assert.equal(q2.pending(), 1);
  } finally {
    try { unlinkSync(path); } catch {}
  }
});
