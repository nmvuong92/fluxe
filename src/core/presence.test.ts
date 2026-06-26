import { test } from "node:test";
import assert from "node:assert/strict";
import { createPresence } from "./presence.ts";

test("join → members + count", () => {
  const p = createPresence();
  p.join("room", "alice");
  assert.deepEqual(p.members("room"), ["alice"]);
  assert.equal(p.count("room"), 1);
});

test("multi-tab cùng id → 1 member (refcount), leave 1 vẫn còn", () => {
  const p = createPresence();
  const off1 = p.join("room", "alice");
  p.join("room", "alice"); // tab 2
  assert.deepEqual(p.members("room"), ["alice"]);
  off1(); // đóng tab 1 → vẫn online vì tab 2
  assert.deepEqual(p.members("room"), ["alice"]);
});

test("leave hết → rời", () => {
  const p = createPresence();
  const off = p.join("room", "alice");
  off();
  assert.deepEqual(p.members("room"), []);
  assert.equal(p.count("room"), 0);
});

test("nhiều người + topic cô lập", () => {
  const p = createPresence();
  p.join("a", "alice");
  p.join("a", "bob");
  p.join("b", "carol");
  assert.deepEqual(p.members("a").sort(), ["alice", "bob"]);
  assert.deepEqual(p.members("b"), ["carol"]);
});
