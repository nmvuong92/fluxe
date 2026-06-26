import { test } from "node:test";
import assert from "node:assert/strict";
import { signSession, verifySession, parseCookie } from "./auth.ts";

const SECRET = "test-secret";

test("sign → verify round-trip", () => {
  const token = signSession({ user: "alice" }, SECRET);
  assert.deepEqual(verifySession(token, SECRET), { user: "alice" });
});

test("token bị sửa → null (chống giả mạo)", () => {
  const token = signSession({ user: "alice" }, SECRET);
  const tampered = token.slice(0, -2) + (token.endsWith("aa") ? "bb" : "aa");
  assert.equal(verifySession(tampered, SECRET), null);
});

test("sai secret → null", () => {
  const token = signSession({ user: "alice" }, SECRET);
  assert.equal(verifySession(token, "khác"), null);
});

test("token rỗng/hỏng → null", () => {
  assert.equal(verifySession(undefined, SECRET), null);
  assert.equal(verifySession("rác", SECRET), null);
});

test("parseCookie tách cặp", () => {
  assert.deepEqual(parseCookie("a=1; session=xyz; b=2").session, "xyz");
  assert.deepEqual(parseCookie(undefined), {});
});
