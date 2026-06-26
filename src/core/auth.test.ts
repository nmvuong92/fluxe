import { test } from "node:test";
import assert from "node:assert/strict";
import { signSession, verifySession, parseCookie, hasRole, hashPassword, verifyPassword } from "./auth.ts";

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

test("hasRole: có role → true", () => {
  assert.equal(hasRole({ user: "a", roles: ["admin", "user"] }, "admin"), true);
});

test("hasRole: thiếu role / không session → false", () => {
  assert.equal(hasRole({ user: "a", roles: ["user"] }, "admin"), false);
  assert.equal(hasRole({ user: "a" }, "admin"), false);
  assert.equal(hasRole(null, "admin"), false);
});

test("password: hash rồi verify đúng/sai", () => {
  const stored = hashPassword("secret");
  assert.equal(verifyPassword("secret", stored), true);
  assert.equal(verifyPassword("wrong", stored), false);
});

test("password: cùng mật khẩu → hash KHÁC nhau (salt ngẫu nhiên)", () => {
  assert.notEqual(hashPassword("secret"), hashPassword("secret"));
});

test("verifyPassword: format hỏng → false", () => {
  assert.equal(verifyPassword("x", "rác"), false);
});
