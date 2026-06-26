import { test } from "node:test";
import assert from "node:assert/strict";
import { FluxeError, toErrorPayload, renderErrorPage } from "./errors.ts";

test("FluxeError (domain) → giữ status/code/message, không errorId/detail", () => {
  const p = toErrorPayload(new FluxeError("not_found", "Không tìm thấy", 404), { dev: true, errorId: "X" });
  assert.deepEqual(p, { status: 404, code: "not_found", message: "Không tìm thấy" });
});

test("FluxeError mặc định status 400", () => {
  assert.equal(new FluxeError("bad", "x").status, 400);
});

test("unexpected → 500 generic + errorId; dev có detail", () => {
  const p = toErrorPayload(new Error("nổ tung"), { dev: true, errorId: "abc" });
  assert.equal(p.status, 500);
  assert.equal(p.code, "internal");
  assert.equal(p.message, "Internal Server Error");
  assert.equal(p.errorId, "abc");
  assert.match(p.detail!, /nổ tung/);
});

test("unexpected prod → KHÔNG leak detail", () => {
  const p = toErrorPayload(new Error("nổ tung"), { dev: false, errorId: "abc" });
  assert.equal(p.status, 500);
  assert.equal(p.detail, undefined);
  assert.doesNotMatch(JSON.stringify(p), /nổ tung/);
});

test("renderErrorPage: HTML có status + message, escape", () => {
  const html = renderErrorPage({ status: 403, code: "forbidden", message: "<b>cấm</b>" });
  assert.match(html, /403/);
  assert.match(html, /&lt;b&gt;cấm&lt;\/b&gt;/);
});
