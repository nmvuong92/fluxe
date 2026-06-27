// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import { bridgeSession, protect } from "./index.ts";

const run = (mw: any, req: any) => new Promise<{ session: any; err: any }>((resolve) => {
  mw(req, {}, (err?: any) => resolve({ session: req.session, err }));
});

test("bridgeSession: getSession trả session → req.session", async () => {
  const mw = bridgeSession(async () => ({ user: "alice", roles: ["admin"] }));
  const { session, err } = await run(mw, {});
  assert.equal(err, undefined);
  assert.equal(session.user, "alice");
});

test("bridgeSession: getSession throw → session = null (không chặn)", async () => {
  const mw = bridgeSession(async () => { throw new Error("provider down"); });
  const { session, err } = await run(mw, {});
  assert.equal(err, undefined);
  assert.equal(session, null);
});

test("protect: chưa đăng nhập → 401", async () => {
  const { err } = await run(protect(), { session: null });
  assert.equal(err?.status, 401);
});

test("protect: thiếu role → 403; đủ role → next sạch", async () => {
  const bad = await run(protect("admin"), { session: { roles: ["user"] } });
  assert.equal(bad.err?.status, 403);
  const ok = await run(protect("admin"), { session: { roles: ["admin", "user"] } });
  assert.equal(ok.err, undefined);
});
